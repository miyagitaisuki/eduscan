import { Router } from 'express';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { classes, enrollments, tuitionRecords, users } from '../db/schema';
import { userDto, classDto } from '../lib/dto';
import { ah, AuthedRequest, todayStr } from '../lib/http';
import { newId, generatePassword, hashPassword, MIN_PASSWORD_LENGTH } from '../lib/security';
import { newTempPassword } from './auth';
import { audit } from '../lib/audit';
import { sendPasswordReset } from '../lib/reset';
import { canManageClass, canManageStudent, isAdmin, manageableClassIds } from '../lib/access';
import type { Deps } from './deps';
import type { AppDb } from '../db/client';

// Chuyển lớp: hủy ghi danh đang hoạt động ở lớp khác (giữ lịch sử), bật ghi danh vào lớp mới.
export async function setStudentClass(db: AppDb, studentId: string, classId: string | null) {
  const conds = [eq(enrollments.studentId, studentId), eq(enrollments.status, 'active')];
  if (classId) conds.push(ne(enrollments.classId, classId));
  await db
    .update(enrollments)
    .set({ status: 'dropped' })
    .where(and(...conds));
  if (!classId) return;

  const [existing] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId)))
    .limit(1);
  if (existing) {
    await db.update(enrollments).set({ status: 'active' }).where(eq(enrollments.id, existing.id));
  } else {
    await db.insert(enrollments).values({ id: newId('enr'), studentId, classId, joinDate: todayStr(), status: 'active' });
  }
}

// Học phí tháng hiện tại, dạng MM/YYYY như giao diện đang dùng
export function currentMonthLabel() {
  const d = new Date();
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
// Học phí riêng của học viên: null/chuỗi rỗng = dùng học phí lớp. Trả về 'invalid' nếu không hợp lệ.
export function parseTuitionFee(v: unknown): number | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : 'invalid';
}

export function currentDueDate() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-15`;
}

async function studentClassMap(db: AppDb, studentIds: string[]) {
  if (studentIds.length === 0) return new Map<string, { id: string; name: string; level: string }>();
  const rows = await db
    .select({ studentId: enrollments.studentId, c: classes })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.status, 'active'), inArray(enrollments.studentId, studentIds)));
  return new Map(rows.map((r) => [r.studentId, { id: r.c.id, name: r.c.name, level: r.c.level }]));
}

const EDITABLE_FIELDS = ['fullName', 'phone', 'studentCode', 'status', 'avatar'] as const;
const API_TO_COL: Record<string, (typeof EDITABLE_FIELDS)[number]> = {
  full_name: 'fullName',
  phone: 'phone',
  student_code: 'studentCode',
  status: 'status',
  avatar: 'avatar',
};

export function studentRoutes({ db, auth }: Deps) {
  const r = Router();

  r.get(
    '/',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const owned = await manageableClassIds(db, req.user);
      const list = await db.select().from(users).where(eq(users.role, 'student'));
      const cls = await studentClassMap(
        db,
        list.map((u) => u.id)
      );
      // Giáo viên chỉ thấy học viên đang học lớp mình phụ trách
      const visible = owned ? list.filter((u) => cls.has(u.id) && owned.includes(cls.get(u.id)!.id)) : list;
      return res.json(
        visible.map((u) => {
          const c = cls.get(u.id);
          return {
            ...userDto(u),
            class_id: c?.id ?? '',
            class_name: c?.name ?? 'Chưa xếp lớp',
            level: c?.level ?? 'N5',
          };
        })
      );
    })
  );

  r.get(
    '/:id',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const [u] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, req.params.id), eq(users.role, 'student')))
        .limit(1);
      if (!u) return res.status(404).json({ error: 'Không tìm thấy học viên.' });
      if (!(await canManageStudent(db, req.user, u.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được xem học viên của lớp mình phụ trách.' });
      }
      const [row] = await db
        .select({ c: classes })
        .from(enrollments)
        .innerJoin(classes, eq(classes.id, enrollments.classId))
        .where(eq(enrollments.studentId, u.id))
        .limit(1);
      return res.json({ ...userDto(u), class: row ? classDto(row.c) : null });
    })
  );

  r.post(
    '/',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      if (!b.full_name) return res.status(400).json({ error: 'Họ tên học viên không được để trống.' });
      if (b.class_id && !(await canManageClass(db, req.user, b.class_id))) {
        return res.status(403).json({ error: 'Bạn chỉ được xếp học viên vào lớp mình phụ trách.' });
      }
      const tuitionFee = parseTuitionFee(b.tuition_fee);
      if (tuitionFee === 'invalid') return res.status(400).json({ error: 'Học phí riêng phải là số nguyên không âm.' });

      const email = String(b.email || `student.${Date.now()}@eduscan.edu.vn`).trim().toLowerCase();
      const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (dup) return res.status(409).json({ error: 'Email này đã được sử dụng.' });

      const tmp = newTempPassword();
      const id = newId('usr');
      const [u] = await db
        .insert(users)
        .values({
          id,
          email,
          passwordHash: tmp.hash,
          fullName: String(b.full_name).trim(),
          role: 'student',
          studentCode: b.student_code || `STU${Math.floor(1000 + Math.random() * 9000)}`,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(String(b.full_name))}`,
          phone: b.phone || '',
          tuitionFee,
          status: 'active',
        })
        .returning();

      if (b.class_id) {
        const [cls] = await db.select().from(classes).where(eq(classes.id, b.class_id)).limit(1);
        if (!cls) return res.status(400).json({ error: 'Lớp học không tồn tại.' });
        await setStudentClass(db, id, cls.id);
        await db.insert(tuitionRecords).values({
          id: newId('tui'),
          studentId: id,
          classId: cls.id,
          month: currentMonthLabel(),
          amount: tuitionFee ?? cls.monthlyFee,
          paidAmount: 0,
          dueDate: currentDueDate(),
          status: 'unpaid',
          notes: 'Học viên mới',
        });
      }

      // Mật khẩu tạm chỉ trả về một lần trong phản hồi tạo học viên
      return res.status(201).json({ ...userDto(u), temporary_password: tmp.plain });
    })
  );

  r.put(
    '/:id',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, req.params.id), eq(users.role, 'student')))
        .limit(1);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy học viên.' });
      if (!(await canManageStudent(db, req.user, target.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được sửa học viên của lớp mình phụ trách.' });
      }
      if (b.class_id && !(await canManageClass(db, req.user, b.class_id))) {
        return res.status(403).json({ error: 'Bạn chỉ được xếp học viên vào lớp mình phụ trách.' });
      }
      if (b.email !== undefined && !isAdmin(req.user)) {
        return res.status(403).json({ error: 'Chỉ admin mới được đổi email đăng nhập của học viên.' });
      }

      // Không cho đổi vai trò, id, mật khẩu hay ngày tạo qua route này
      const set: Partial<Record<(typeof EDITABLE_FIELDS)[number] | 'email' | 'tuitionFee', string | number | null>> = {};
      for (const [apiKey, col] of Object.entries(API_TO_COL)) {
        if (b[apiKey] !== undefined) set[col] = String(b[apiKey]);
      }
      if (b.tuition_fee !== undefined) {
        const fee = parseTuitionFee(b.tuition_fee);
        if (fee === 'invalid') return res.status(400).json({ error: 'Học phí riêng phải là số nguyên không âm.' });
        set.tuitionFee = fee;
      }
      if (b.email !== undefined) {
        const email = String(b.email).trim().toLowerCase();
        const [dup] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, email), ne(users.id, target.id)))
          .limit(1);
        if (dup) return res.status(409).json({ error: 'Email này đã được sử dụng.' });
        set.email = email;
        if (email !== target.email) await audit(db, req.user.id, 'student.email_changed', target.id);
      }
      if (Object.keys(set).length > 0) {
        await db.update(users).set(set as any).where(eq(users.id, target.id));
      }
      if (b.class_id !== undefined) {
        await setStudentClass(db, target.id, b.class_id || null);
      }

      const [u] = await db.select().from(users).where(eq(users.id, target.id)).limit(1);
      return res.json(userDto(u));
    })
  );

  // Admin đặt mật khẩu cho học viên: tự sinh hoặc nhập tay. Học viên buộc đổi ở lần đăng nhập kế tiếp.
  // Tăng token_version nên phiên cũ của học viên bị đăng xuất ngay.
  r.put(
    '/:id/password',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, req.params.id), eq(users.role, 'student')))
        .limit(1);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy học viên.' });

      const b = req.body ?? {};
      const generate = b.generate === true;
      const plain = generate ? generatePassword() : String(b.new_password ?? '');
      if (!generate && plain.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` });
      }

      await db
        .update(users)
        .set({ passwordHash: hashPassword(plain), mustChangePassword: true, tokenVersion: target.tokenVersion + 1 })
        .where(eq(users.id, target.id));
      await audit(db, req.user.id, 'student.password_set', target.id, { generated: generate });
      // Mật khẩu chỉ trả về một lần trong phản hồi này khi admin chọn tự sinh
      return res.json({ ok: true, ...(generate ? { temporary_password: plain } : {}) });
    })
  );

  // Admin gửi email đặt lại mật khẩu tới địa chỉ đăng nhập của học viên (link hiệu lực 30 phút)
  r.post(
    '/:id/send-reset',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, req.params.id), eq(users.role, 'student')))
        .limit(1);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy học viên.' });

      const sent = await sendPasswordReset(db, { id: target.id, email: target.email, fullName: target.fullName });
      await audit(db, req.user.id, 'student.reset_email_sent', target.id, { sent });
      if (!sent) {
        return res.status(503).json({ error: 'Chưa gửi được email. Kiểm tra cấu hình RESEND_API_KEY và MAIL_FROM.' });
      }
      return res.json({ ok: true, message: `Đã gửi email đặt lại mật khẩu tới ${target.email}.` });
    })
  );

  r.delete(
    '/:id',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      // Chỉ xóa học viên; giáo viên và admin không bị xóa qua route này
      if (!(await canManageStudent(db, req.user, req.params.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được xóa học viên của lớp mình phụ trách.' });
      }
      const deleted = await db
        .delete(users)
        .where(and(eq(users.id, req.params.id), eq(users.role, 'student')))
        .returning({ id: users.id });
      if (deleted.length === 0) return res.status(404).json({ error: 'Không tìm thấy học viên.' });
      return res.json({ success: true });
    })
  );

  return r;
}
