import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { classes, enrollments, tuitionRecords, users } from '../db/schema';
import { tuitionDto } from '../lib/dto';
import { ah, AuthedRequest, isStudent, todayStr } from '../lib/http';
import { newId } from '../lib/security';
import { currentDueDate, currentMonthLabel } from './students';
import { canManageClass, canManageStudent } from '../lib/access';
import { parseDateOnly } from '../lib/validation';
import type { Deps } from './deps';

const EDITABLE = ['amount', 'paidAmount', 'dueDate', 'paidDate', 'status', 'notes', 'month'] as const;
const TUITION_STATUSES = new Set(['unpaid', 'partial', 'paid']);

/** Số tiền học phí: số nguyên không âm; undefined nếu không hợp lệ */
function parseAmount(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : undefined;
}

function parseMonth(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const month = v.trim();
  return month.length > 0 && month.length <= 20 ? month : undefined;
}

// Học phí chỉ dành cho admin: giáo viên không đọc hay ghi học phí
export function tuitionRoutes({ db, auth }: Deps) {
  const r = Router();

  // Học viên xem học phí của mình; admin xem tất cả; giáo viên không xem được
  r.get(
    '/',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      if (!isStudent(req) && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Chỉ admin mới xem được học phí.' });
      }
      const conds = isStudent(req) ? [eq(tuitionRecords.studentId, req.user.id)] : [];
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
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      if (!b.student_id) return res.status(400).json({ error: 'Thiếu student_id' });
      if (!(await canManageStudent(db, req.user, String(b.student_id)))) {
        return res.status(403).json({ error: 'Bạn chỉ được ghi học phí cho học viên của lớp mình phụ trách.' });
      }
      if (b.class_id && !(await canManageClass(db, req.user, String(b.class_id)))) {
        return res.status(403).json({ error: 'Bạn chỉ được ghi học phí cho lớp mình phụ trách.' });
      }
      // 0 là số tiền hợp lệ (miễn phí), không được biến thành 800000 như `Number(x) || default`
      const amount = b.amount === undefined || b.amount === null || b.amount === '' ? 800000 : parseAmount(b.amount);
      if (amount === undefined) return res.status(400).json({ error: 'Học phí phải là số nguyên không âm.' });
      const paidAmountInput = parseAmount(b.paid_amount);
      if (b.paid_amount !== undefined && b.paid_amount !== null && b.paid_amount !== '' && paidAmountInput === undefined) {
        return res.status(400).json({ error: 'Số tiền đã đóng phải là số nguyên không âm.' });
      }
      const month = b.month === undefined || b.month === null || b.month === '' ? currentMonthLabel() : parseMonth(b.month);
      if (!month) return res.status(400).json({ error: 'Tháng học phí không hợp lệ.' });
      const status = TUITION_STATUSES.has(b.status) ? b.status : 'unpaid';
      const paid = status === 'paid';
      const [row] = await db
        .insert(tuitionRecords)
        .values({
          id: newId('tui'),
          studentId: b.student_id,
          classId: b.class_id || null,
          month,
          amount,
          paidAmount: paidAmountInput ?? (paid ? amount : 0),
          dueDate: currentDueDate(),
          paidDate: paid ? todayStr() : null,
          status,
          notes: b.notes || '',
        })
        .returning();
      return res.status(201).json(tuitionDto(row));
    })
  );

  r.put(
    '/:id',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const [current] = await db.select().from(tuitionRecords).where(eq(tuitionRecords.id, req.params.id)).limit(1);
      if (!current) return res.status(404).json({ error: 'Không tìm thấy hồ sơ học phí' });
      if (!(await canManageStudent(db, req.user, current.studentId))) {
        return res.status(403).json({ error: 'Bạn chỉ được sửa học phí của học viên lớp mình phụ trách.' });
      }

      const set: Partial<Record<(typeof EDITABLE)[number], unknown>> = {};
      if (b.amount !== undefined) {
        const amount = parseAmount(b.amount);
        if (amount === undefined) return res.status(400).json({ error: 'Học phí phải là số nguyên không âm.' });
        set.amount = amount;
      }
      if (b.paid_amount !== undefined) {
        const paidAmount = parseAmount(b.paid_amount);
        if (paidAmount === undefined) return res.status(400).json({ error: 'Số tiền đã đóng phải là số nguyên không âm.' });
        set.paidAmount = paidAmount;
      }
      if (b.status !== undefined) {
        if (typeof b.status !== 'string' || !TUITION_STATUSES.has(b.status)) {
          return res.status(400).json({ error: 'Trạng thái học phí không hợp lệ.' });
        }
        set.status = b.status;
      }
      for (const [apiKey, col] of [['due_date', 'dueDate'], ['paid_date', 'paidDate']] as const) {
        if (b[apiKey] === undefined) continue;
        const d = parseDateOnly(b[apiKey]);
        if (d === undefined) return res.status(400).json({ error: 'Ngày phải có dạng YYYY-MM-DD.' });
        set[col] = d;
      }
      if (b.month !== undefined) {
        const month = parseMonth(b.month);
        if (!month) return res.status(400).json({ error: 'Tháng học phí không hợp lệ.' });
        set.month = month;
      }
      if (b.notes !== undefined) set.notes = String(b.notes);
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
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const { student_id, month, amount } = req.body ?? {};
      if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });
      if (!(await canManageStudent(db, req.user, String(student_id)))) {
        return res.status(403).json({ error: 'Bạn chỉ được thu học phí của học viên lớp mình phụ trách.' });
      }
      const monthLabel = month === undefined || month === null || month === '' ? currentMonthLabel() : parseMonth(month);
      if (!monthLabel) return res.status(400).json({ error: 'Tháng học phí không hợp lệ.' });
      // undefined = không truyền số tiền (dùng học phí của hồ sơ); 0 là số tiền hợp lệ
      const hasAmount = amount !== undefined && amount !== null && amount !== '';
      const amt = hasAmount ? parseAmount(amount) : undefined;
      if (hasAmount && amt === undefined) return res.status(400).json({ error: 'Số tiền thu phải là số nguyên không âm.' });

      // Khóa hàng học viên để hai lần thu đồng thời không tạo hai hồ sơ cùng tháng.
      // (Bảng chưa có unique index nên khóa dòng là cách chặn race an toàn.)
      const { row, created } = await db.transaction(async (tx) => {
        await tx.execute(sql`select id from users where id = ${student_id} for update`);
        const [existing] = await tx
          .select()
          .from(tuitionRecords)
          .where(and(eq(tuitionRecords.studentId, student_id), eq(tuitionRecords.month, monthLabel)))
          .limit(1);
        if (existing) {
          const [updated] = await tx
            .update(tuitionRecords)
            .set({ status: 'paid', paidAmount: amt ?? existing.amount, paidDate: todayStr(), notes: 'Đã thu tại lớp' })
            .where(eq(tuitionRecords.id, existing.id))
            .returning();
          return { row: updated, created: false };
        }

        const [enr] = await tx
          .select({ classId: enrollments.classId })
          .from(enrollments)
          .where(and(eq(enrollments.studentId, student_id), eq(enrollments.status, 'active')))
          .limit(1);
        const [inserted] = await tx
          .insert(tuitionRecords)
          .values({
            id: newId('tui'),
            studentId: student_id,
            classId: enr?.classId ?? null,
            month: monthLabel,
            amount: amt ?? 0,
            paidAmount: amt ?? 0,
            paidDate: todayStr(),
            status: 'paid',
            notes: 'Đã thu tại lớp',
          })
          .returning();
        return { row: inserted, created: true };
      });
      return res.status(created ? 201 : 200).json(tuitionDto(row));
    })
  );

  return r;
}
