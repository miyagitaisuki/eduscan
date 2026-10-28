import { Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { classes, enrollments, tuitionRecords, users } from '../db/schema';
import { tuitionDto } from '../lib/dto';
import { ah, AuthedRequest, isStudent, todayStr } from '../lib/http';
import { newId } from '../lib/security';
import { currentDueDate, currentMonthLabel } from './students';
import { canManageClass, canManageStudent, manageableClassIds } from '../lib/access';
import type { Deps } from './deps';

const EDITABLE = ['amount', 'paidAmount', 'dueDate', 'paidDate', 'status', 'notes', 'month'] as const;

export function tuitionRoutes({ db, auth }: Deps) {
  const r = Router();

  r.get(
    '/',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const conds = isStudent(req) ? [eq(tuitionRecords.studentId, req.user.id)] : [];
      const owned = isStudent(req) ? null : await manageableClassIds(db, req.user);
      if (owned) {
        if (owned.length === 0) return res.json([]);
        // Giáo viên chỉ thấy học phí của học viên đang học lớp mình phụ trách
        const inOwned = await db
          .select({ studentId: enrollments.studentId })
          .from(enrollments)
          .where(and(eq(enrollments.status, 'active'), inArray(enrollments.classId, owned)));
        const ids = inOwned.map((r) => r.studentId);
        if (ids.length === 0) return res.json([]);
        conds.push(inArray(tuitionRecords.studentId, ids));
      }
      const rows = await db
        .select({ t: tuitionRecords, u: users, c: classes })
        .from(tuitionRecords)
        .innerJoin(users, eq(users.id, tuitionRecords.studentId))
        .leftJoin(classes, eq(classes.id, tuitionRecords.classId))
        .where(conds.length ? and(...conds) : undefined);
      return res.json(
        rows.map((row) =>
          tuitionDto(row.t, {
            student_name: row.u.fullName,
            student_code: row.u.studentCode ?? '',
            class_name: row.c?.name ?? '',
          })
        )
      );
    })
  );

  r.post(
    '/',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      if (!b.student_id) return res.status(400).json({ error: 'Thiếu student_id' });
      if (!(await canManageStudent(db, req.user, String(b.student_id)))) {
        return res.status(403).json({ error: 'Bạn chỉ được ghi học phí cho học viên của lớp mình phụ trách.' });
      }
      if (b.class_id && !(await canManageClass(db, req.user, String(b.class_id)))) {
        return res.status(403).json({ error: 'Bạn chỉ được ghi học phí cho lớp mình phụ trách.' });
      }
      const amount = Number(b.amount) || 800000;
      const paid = b.status === 'paid';
      const [row] = await db
        .insert(tuitionRecords)
        .values({
          id: newId('tui'),
          studentId: b.student_id,
          classId: b.class_id || null,
          month: b.month || currentMonthLabel(),
          amount,
          paidAmount: paid ? Number(b.paid_amount) || amount : Number(b.paid_amount) || 0,
          dueDate: currentDueDate(),
          paidDate: paid ? todayStr() : null,
          status: b.status === 'paid' || b.status === 'partial' ? b.status : 'unpaid',
          notes: b.notes || '',
        })
        .returning();
      return res.status(201).json(tuitionDto(row));
    })
  );

  r.put(
    '/:id',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const [current] = await db.select().from(tuitionRecords).where(eq(tuitionRecords.id, req.params.id)).limit(1);
      if (!current) return res.status(404).json({ error: 'Không tìm thấy hồ sơ học phí' });
      if (!(await canManageStudent(db, req.user, current.studentId))) {
        return res.status(403).json({ error: 'Bạn chỉ được sửa học phí của học viên lớp mình phụ trách.' });
      }

      const set: Partial<Record<(typeof EDITABLE)[number], unknown>> = {};
      const map: Record<string, (typeof EDITABLE)[number]> = {
        amount: 'amount',
        paid_amount: 'paidAmount',
        due_date: 'dueDate',
        paid_date: 'paidDate',
        status: 'status',
        notes: 'notes',
        month: 'month',
      };
      for (const [apiKey, col] of Object.entries(map)) {
        if (b[apiKey] !== undefined) set[col] = b[apiKey];
      }
      // Đánh dấu đã đóng: ghi ngày đóng và số tiền đã đóng bằng học phí
      if (set.status === 'paid') {
        if (!set.paidDate) set.paidDate = todayStr();
        if (set.paidAmount === undefined) set.paidAmount = Number(set.amount ?? current.amount);
      }
      if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });

      const [row] = await db.update(tuitionRecords).set(set as any).where(eq(tuitionRecords.id, current.id)).returning();
      return res.json(tuitionDto(row));
    })
  );

  // Ghi nhận thu học phí tại lớp: cập nhật hồ sơ cùng tháng nếu có, không thì tạo mới
  r.post(
    '/payment',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const { student_id, month, amount } = req.body ?? {};
      if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });
      if (!(await canManageStudent(db, req.user, String(student_id)))) {
        return res.status(403).json({ error: 'Bạn chỉ được thu học phí của học viên lớp mình phụ trách.' });
      }
      const monthLabel = month || currentMonthLabel();
      const amt = Number(amount) || 0;

      const [existing] = await db
        .select()
        .from(tuitionRecords)
        .where(and(eq(tuitionRecords.studentId, student_id), eq(tuitionRecords.month, monthLabel)))
        .limit(1);
      if (existing) {
        const [row] = await db
          .update(tuitionRecords)
          .set({ status: 'paid', paidAmount: amt || existing.amount, paidDate: todayStr(), notes: 'Đã thu tại lớp' })
          .where(eq(tuitionRecords.id, existing.id))
          .returning();
        return res.json(tuitionDto(row));
      }

      const [enr] = await db
        .select({ classId: enrollments.classId })
        .from(enrollments)
        .where(and(eq(enrollments.studentId, student_id), eq(enrollments.status, 'active')))
        .limit(1);
      const [row] = await db
        .insert(tuitionRecords)
        .values({
          id: newId('tui'),
          studentId: student_id,
          classId: enr?.classId ?? null,
          month: monthLabel,
          amount: amt,
          paidAmount: amt,
          paidDate: todayStr(),
          status: 'paid',
          notes: 'Đã thu tại lớp',
        })
        .returning();
      return res.status(201).json(tuitionDto(row));
    })
  );

  return r;
}
