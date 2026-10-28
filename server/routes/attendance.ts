import { Router } from 'express';
import { and, desc, eq, inArray, like } from 'drizzle-orm';
import {
  attendanceRecords,
  attendanceSessions,
  classes,
  enrollments,
  users,
} from '../db/schema';
import { attendanceDto, sessionDto } from '../lib/dto';
import { ah, AuthedRequest, isStudent, todayStr } from '../lib/http';
import { newId, newSessionCode } from '../lib/security';
import { canManageClass, manageableClassIds } from '../lib/access';
import type { Deps } from './deps';

const QR_WINDOW_SECONDS = 15;

export function attendanceRoutes({ db, auth }: Deps) {
  const r = Router();

  // Giáo viên mở một buổi điểm danh QR (đóng các buổi đang mở của lớp)
  r.post(
    '/session',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const classId = req.body?.class_id;
      if (!classId) return res.status(400).json({ error: 'Thiếu class_id' });
      const [cls] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
      if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      if (!(await canManageClass(db, req.user, cls.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được mở điểm danh cho lớp mình phụ trách.' });
      }

      const now = new Date();
      const stamp = Math.floor(now.getTime() / (QR_WINDOW_SECONDS * 1000));
      const id = newId('ses');
      const session = await db.transaction(async (tx) => {
        await tx
          .update(attendanceSessions)
          .set({ isActive: false, endTime: now })
          .where(and(eq(attendanceSessions.classId, classId), eq(attendanceSessions.isActive, true)));
        const [row] = await tx
          .insert(attendanceSessions)
          .values({
            id,
            classId,
            qrCode: `EDUSCAN_QR:${classId}:${stamp}:${todayStr()}`,
            sessionCode: newSessionCode(),
            sessionDate: todayStr(),
            startTime: now,
            isActive: true,
          })
          .returning();
        return row;
      });
      return res.status(201).json(sessionDto(session, { class_name: cls.name }));
    })
  );

  // Học viên điểm danh: QR động, hoặc mã phiên nhập tay (ES-xxxx)
  r.post(
    '/checkin',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const { session_id, student_id: bodyStudentId, qr_payload, notes } = req.body ?? {};

      // Học viên chỉ điểm danh cho chính mình; giáo viên có thể điểm danh hộ
      const studentId = isStudent(req) ? req.user.id : bodyStudentId;
      if (!studentId) return res.status(400).json({ error: 'Thiếu thông tin học viên' });

      let session: typeof attendanceSessions.$inferSelect | undefined;

      if (session_id) {
        [session] = await db
          .select()
          .from(attendanceSessions)
          .where(and(eq(attendanceSessions.id, session_id), eq(attendanceSessions.isActive, true)))
          .limit(1);
        if (!session) return res.status(400).json({ error: 'Buổi học chưa mở hoặc đã kết thúc.' });
      } else if (typeof qr_payload === 'string' && qr_payload.startsWith('EDUSCAN_QR:')) {
        // Định dạng: EDUSCAN_QR:<classId>:<tokenStamp>:<date>
        const parts = qr_payload.split(':');
        if (parts.length !== 4) return res.status(400).json({ error: 'Mã QR không hợp lệ.' });
        const [, classId, stampStr] = parts;
        const stamp = Number(stampStr);
        const nowStamp = Math.floor(Date.now() / (QR_WINDOW_SECONDS * 1000));
        // Chỉ chấp nhận chu kỳ hiện tại hoặc chu kỳ trước (bù độ trễ mạng)
        if (!Number.isInteger(stamp) || (stamp !== nowStamp && stamp !== nowStamp - 1)) {
          return res.status(400).json({ error: 'Mã QR đã hết hạn. Vui lòng quét mã đang hiển thị trên màn hình.' });
        }
        [session] = await db
          .select()
          .from(attendanceSessions)
          .where(and(eq(attendanceSessions.classId, classId), eq(attendanceSessions.isActive, true)))
          .limit(1);
        if (!session) return res.status(400).json({ error: 'Buổi học chưa bắt đầu hoặc đã kết thúc.' });
      } else if (typeof qr_payload === 'string' && qr_payload.trim()) {
        // Mã phiên nhập tay: phải khớp đúng một phiên đang mở
        const code = qr_payload.trim().toUpperCase();
        [session] = await db
          .select()
          .from(attendanceSessions)
          .where(and(eq(attendanceSessions.isActive, true), eq(attendanceSessions.sessionCode, code)))
          .limit(1);
        if (!session) return res.status(400).json({ error: 'Mã phiên không hợp lệ hoặc buổi học chưa mở.' });
      } else {
        return res.status(400).json({ error: 'Vui lòng quét mã QR hoặc nhập mã phiên.' });
      }

      // Giáo viên chỉ điểm danh hộ cho lớp mình phụ trách
      if (!isStudent(req) && !(await canManageClass(db, req.user, session.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được điểm danh cho lớp mình phụ trách.' });
      }

      const [enrolled] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.classId, session.classId),
            eq(enrollments.status, 'active')
          )
        )
        .limit(1);
      if (!enrolled) return res.status(403).json({ error: 'Bạn không thuộc lớp của buổi học này.' });

      const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.studentId, studentId)))
        .limit(1);
      if (existing) {
        return res.json({
          success: true,
          alreadyCheckedIn: true,
          message: `${student?.fullName || 'Học viên'} đã điểm danh trước đó rồi!`,
          record: attendanceDto(existing, { student_name: student?.fullName }),
        });
      }

      const [record] = await db
        .insert(attendanceRecords)
        .values({
          id: newId('rec'),
          sessionId: session.id,
          studentId,
          status: 'present',
          notes: notes || 'Check-in thành công qua mã QR',
        })
        .returning();
      return res.status(201).json({
        success: true,
        message: `Điểm danh thành công cho ${student?.fullName}!`,
        record: attendanceDto(record, { student_name: student?.fullName }),
      });
    })
  );

  r.get(
    '/history',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const classId = req.query.class_id as string | undefined;
      const studentId = isStudent(req) ? req.user.id : (req.query.student_id as string | undefined);
      const conds = [];
      if (studentId) conds.push(eq(attendanceRecords.studentId, studentId));
      if (classId) conds.push(eq(attendanceSessions.classId, classId));
      if (!isStudent(req)) {
        const owned = await manageableClassIds(db, req.user);
        if (owned) {
          if (owned.length === 0) return res.json([]);
          conds.push(inArray(attendanceSessions.classId, owned));
        }
      }

      const rows = await db
        .select({ r: attendanceRecords, s: attendanceSessions, c: classes, u: users })
        .from(attendanceRecords)
        .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
        .innerJoin(classes, eq(classes.id, attendanceSessions.classId))
        .innerJoin(users, eq(users.id, attendanceRecords.studentId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(attendanceRecords.checkInTime));

      return res.json(
        rows.map((row) =>
          attendanceDto(row.r, {
            student_name: row.u.fullName,
            student_code: row.u.studentCode ?? '',
            class_id: row.c.id,
            class_name: row.c.name,
            date: row.s.sessionDate,
          })
        )
      );
    })
  );

  // Điểm danh nhanh cả lớp theo ngày (giáo viên). Chỉ ghi đè phiên batch của ngày đó,
  // không đụng đến các phiên QR cùng ngày.
  r.post(
    '/batch',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const { class_id, date, presentStudentIds, notesMap } = req.body ?? {};
      if (!class_id || !date) return res.status(400).json({ error: 'Thiếu class_id hoặc ngày học' });
      if (!(await canManageClass(db, req.user, class_id))) {
        return res.status(403).json({ error: 'Bạn chỉ được điểm danh cho lớp mình phụ trách.' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        return res.status(400).json({ error: 'Ngày học phải có dạng YYYY-MM-DD.' });
      }

      const present = new Set<string>(Array.isArray(presentStudentIds) ? presentStudentIds : []);
      const students = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(and(eq(enrollments.classId, class_id), eq(enrollments.status, 'active')));

      await db.transaction(async (tx) => {
        let [session] = await tx
          .select()
          .from(attendanceSessions)
          .where(
            and(
              eq(attendanceSessions.classId, class_id),
              eq(attendanceSessions.sessionDate, String(date)),
              like(attendanceSessions.qrCode, 'EDUSCAN_BATCH_%')
            )
          )
          .limit(1);
        if (!session) {
          [session] = await tx
            .insert(attendanceSessions)
            .values({
              id: newId('ses'),
              classId: class_id,
              qrCode: `EDUSCAN_BATCH_${class_id}_${date}`,
              sessionCode: newSessionCode(),
              sessionDate: String(date),
              startTime: new Date(`${date}T18:00:00Z`),
              isActive: false,
            })
            .returning();
        }

        await tx.delete(attendanceRecords).where(eq(attendanceRecords.sessionId, session.id));
        if (students.length > 0) {
          await tx.insert(attendanceRecords).values(
            students.map((s) => {
              const isPresent = present.has(s.studentId);
              return {
                id: newId('rec'),
                sessionId: session.id,
                studentId: s.studentId,
                status: isPresent ? ('present' as const) : ('absent' as const),
                notes: notesMap?.[s.studentId] || (isPresent ? 'Có mặt' : 'Vắng'),
              };
            })
          );
        }
      });

      return res.json({ success: true, count: students.length });
    })
  );

  return r;
}
