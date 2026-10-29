import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { classes, enrollments, users } from '../db/schema';
import { classDto } from '../lib/dto';
import { ah, AuthedRequest } from '../lib/http';
import { newId } from '../lib/security';
import { canManageClass, isAdmin } from '../lib/access';
import type { Deps } from './deps';

const EDITABLE = ['name', 'code', 'description', 'schedule', 'level', 'monthlyFee'] as const;

// Học phí lớp chỉ admin được xem và sửa: giáo viên nhận DTO không có monthly_fee
function classFor(req: AuthedRequest, c: any, extra: Record<string, unknown> = {}) {
  const dto = classDto(c, extra);
  if (isAdmin(req.user)) return dto;
  const { monthly_fee: _fee, ...rest } = dto;
  return rest;
}

// Giáo viên phụ trách phải là tài khoản giáo viên hoặc admin, không được là học viên
async function isTeacherAccount(db: Deps['db'], id: string) {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  return !!u && (u.role === 'teacher' || u.role === 'admin');
}

export function classRoutes({ db, auth }: Deps) {
  const r = Router();

  // Giáo viên chỉ được sửa, xóa lớp mình phụ trách; admin làm được với mọi lớp
  const requireClassOwner = ah(async (req: AuthedRequest, res, next) => {
    if (!(await canManageClass(db, req.user, req.params.id))) {
      const [exists] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, req.params.id)).limit(1);
      if (!exists) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      return res.status(403).json({ error: 'Bạn chỉ được quản lý lớp do mình phụ trách.' });
    }
    return next();
  });

  r.get(
    '/',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const rows = await db
        .select({ c: classes, teacherName: users.fullName })
        .from(classes)
        .leftJoin(users, eq(users.id, classes.teacherId));
      const counts = await db
        .select({ classId: enrollments.classId, n: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(eq(enrollments.status, 'active'))
        .groupBy(enrollments.classId);
      const countMap = new Map(counts.map((c) => [c.classId, c.n]));
      return res.json(
        rows.map((row) =>
          classFor(req, { ...row.c, teacherName: row.teacherName }, { student_count: countMap.get(row.c.id) ?? 0 })
        )
      );
    })
  );

  r.get(
    '/:id',
    auth.requireAuth,
    ah(async (req, res) => {
      const [row] = await db
        .select({ c: classes, teacherName: users.fullName })
        .from(classes)
        .leftJoin(users, eq(users.id, classes.teacherId))
        .where(eq(classes.id, req.params.id))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      const list = await db.select().from(enrollments).where(eq(enrollments.classId, row.c.id));
      return res.json(
        classFor(req, 
          { ...row.c, teacherName: row.teacherName },
          {
            enrollments: list.map((e) => ({
              id: e.id,
              student_id: e.studentId,
              class_id: e.classId,
              join_date: e.joinDate,
              status: e.status,
            })),
          }
        )
      );
    })
  );

  r.post(
    '/',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      if (!b.name) return res.status(400).json({ error: 'Tên lớp không được để trống.' });
      // Giáo viên tạo lớp cho chính mình; admin có thể chọn giáo viên khác
      const teacherId = req.user.role === 'admin' && b.teacher_id ? String(b.teacher_id) : req.user.id;
      if (teacherId !== req.user.id && !(await isTeacherAccount(db, teacherId))) {
        return res.status(400).json({ error: 'Giáo viên phụ trách không hợp lệ.' });
      }
      const [row] = await db
        .insert(classes)
        .values({
          id: newId('cls'),
          name: String(b.name).trim(),
          code: b.code || `CLS-${Math.floor(100 + Math.random() * 900)}`,
          teacherId,
          description: b.description || '',
          schedule: b.schedule || 'Thứ 2 - 4 - 6',
          level: b.level || 'N5',
          monthlyFee: isAdmin(req.user) ? Number(b.monthly_fee) || 800000 : 800000,
        })
        .returning();
      const [t] = await db.select({ n: users.fullName }).from(users).where(eq(users.id, teacherId)).limit(1);
      return res.status(201).json(classFor(req, { ...row, teacherName: t?.n ?? '' }, { student_count: 0 }));
    })
  );

  r.put(
    '/:id',
    auth.requireTeacher,
    requireClassOwner,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const set: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name',
        code: 'code',
        description: 'description',
        schedule: 'schedule',
        level: 'level',
        monthly_fee: 'monthlyFee',
      };
      for (const [apiKey, col] of Object.entries(map)) {
        // Chỉ admin được đổi học phí lớp
        if (apiKey === 'monthly_fee' && !isAdmin(req.user)) continue;
        if (b[apiKey] !== undefined) set[col] = apiKey === 'monthly_fee' ? Number(b[apiKey]) : b[apiKey];
      }
      if (b.teacher_id !== undefined && isAdmin(req.user)) {
        if (!(await isTeacherAccount(db, String(b.teacher_id)))) {
          return res.status(400).json({ error: 'Giáo viên phụ trách không hợp lệ.' });
        }
        set.teacherId = String(b.teacher_id);
      }
      if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });

      const [row] = await db.update(classes).set(set).where(eq(classes.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      const [t] = await db.select({ n: users.fullName }).from(users).where(eq(users.id, row.teacherId)).limit(1);
      return res.json(classFor(req, { ...row, teacherName: t?.n ?? '' }));
    })
  );

  r.delete(
    '/:id',
    auth.requireTeacher,
    requireClassOwner,
    ah(async (req, res) => {
      // Xóa lớp kéo theo ghi danh, bài tập, phiên điểm danh (ON DELETE CASCADE trong DB)
      const deleted = await db.delete(classes).where(eq(classes.id, req.params.id)).returning({ id: classes.id });
      if (deleted.length === 0) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      return res.json({ success: true, message: 'Đã xóa lớp học thành công.' });
    })
  );

  return r;
}
