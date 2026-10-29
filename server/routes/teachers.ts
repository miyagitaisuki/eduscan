import { Router } from 'express';
import { and, count, eq, ne } from 'drizzle-orm';
import { classes, users } from '../db/schema';
import { parseGender, userDto } from '../lib/dto';
import { ah, AuthedRequest } from '../lib/http';
import { newId, hashPassword, generatePassword, MIN_PASSWORD_LENGTH } from '../lib/security';
import { audit } from '../lib/audit';
import type { Deps } from './deps';

const STATUSES = ['active', 'inactive'] as const;

// Quản lý tài khoản giáo viên: chỉ admin. Tên đăng nhập (email) và mật khẩu chỉ admin đổi.
export function teacherRoutes({ db, auth }: Deps) {
  const r = Router();

  const findTeacher = async (id: string) => {
    const [t] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'teacher')))
      .limit(1);
    return t;
  };

  const emailTaken = async (email: string, exceptId?: string) => {
    const conds = [eq(users.email, email)];
    if (exceptId) conds.push(ne(users.id, exceptId));
    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(...conds))
      .limit(1);
    return !!dup;
  };

  r.get(
    '/',
    auth.requireAdmin,
    ah(async (_req, res) => {
      const rows = await db.select().from(users).where(eq(users.role, 'teacher'));
      const classCounts = await db
        .select({ teacherId: classes.teacherId, n: count() })
        .from(classes)
        .groupBy(classes.teacherId);
      const byTeacher = new Map(classCounts.map((c) => [c.teacherId, Number(c.n)]));
      return res.json(rows.map((u) => ({ ...userDto(u), class_count: byTeacher.get(u.id) ?? 0 })));
    })
  );

  // Tạo tài khoản giáo viên. Không nhập mật khẩu thì hệ thống tự sinh và trả về một lần.
  r.post(
    '/',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const email = String(b.email ?? '').trim().toLowerCase();
      const fullName = String(b.full_name ?? '').trim();
      if (!email || !fullName) return res.status(400).json({ error: 'Cần nhập tên đăng nhập (email) và họ tên.' });
      if (await emailTaken(email)) return res.status(409).json({ error: 'Tên đăng nhập này đã được sử dụng.' });

      const generate = b.generate === true || !b.password;
      const plain = generate ? generatePassword() : String(b.password);
      if (!generate && plain.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` });
      }

      const [u] = await db
        .insert(users)
        .values({
          id: newId('usr'),
          email,
          passwordHash: hashPassword(plain),
          fullName,
          role: 'teacher',
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
          phone: String(b.phone ?? '').trim(),
          gender: parseGender(b.gender) ?? null,
          status: 'active',
          mustChangePassword: true,
        })
        .returning();
      await audit(db, req.user.id, 'teacher.created', u.id, { generated: generate });
      return res.status(201).json({ ...userDto(u), ...(generate ? { temporary_password: plain } : {}) });
    })
  );

  // Sửa họ tên, SĐT, tên đăng nhập. Đổi tên đăng nhập sẽ đăng xuất các phiên đang có.
  r.put(
    '/:id',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const target = await findTeacher(req.params.id);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy giáo viên.' });

      const b = req.body ?? {};
      const set: Partial<typeof users.$inferInsert> = {};
      const changed: string[] = [];
      if (b.full_name !== undefined) {
        const name = String(b.full_name).trim();
        if (!name) return res.status(400).json({ error: 'Họ tên không được để trống.' });
        set.fullName = name;
        changed.push('full_name');
      }
      if (b.phone !== undefined) {
        set.phone = String(b.phone).trim();
        changed.push('phone');
      }
      if (b.gender !== undefined) {
        const gender = parseGender(b.gender);
        if (gender === undefined) return res.status(400).json({ error: 'Giới tính phải là nam hoặc nữ.' });
        set.gender = gender;
        changed.push('gender');
      }
      if (b.email !== undefined) {
        const email = String(b.email).trim().toLowerCase();
        if (!email) return res.status(400).json({ error: 'Tên đăng nhập không được để trống.' });
        if (email !== target.email) {
          if (await emailTaken(email, target.id)) return res.status(409).json({ error: 'Tên đăng nhập này đã được sử dụng.' });
          set.email = email;
          set.tokenVersion = target.tokenVersion + 1;
          changed.push('email');
        }
      }
      if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });

      const [u] = await db.update(users).set(set).where(eq(users.id, target.id)).returning();
      await audit(db, req.user.id, 'teacher.updated', target.id, { fields: changed });
      return res.json(userDto(u));
    })
  );

  // Khóa hoặc mở tài khoản. Khóa sẽ đăng xuất giáo viên ngay; không khóa chính mình hoặc giáo viên đang có lớp.
  r.put(
    '/:id/status',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const status = req.body?.status;
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
      const target = await findTeacher(req.params.id);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy giáo viên.' });

      if (status === 'inactive') {
        if (target.id === req.user.id) return res.status(400).json({ error: 'Bạn không thể khóa tài khoản của chính mình.' });
        const [{ n }] = await db.select({ n: count() }).from(classes).where(eq(classes.teacherId, target.id));
        if (Number(n) > 0) {
          return res.status(409).json({ error: 'Giáo viên đang phụ trách lớp. Hãy chuyển lớp sang giáo viên khác trước khi khóa.' });
        }
      }

      const set: Partial<typeof users.$inferInsert> = { status };
      if (status === 'inactive') set.tokenVersion = target.tokenVersion + 1;
      const [u] = await db.update(users).set(set).where(eq(users.id, target.id)).returning();
      await audit(db, req.user.id, 'teacher.status_changed', target.id, { status });
      return res.json(userDto(u));
    })
  );

  // Đặt lại mật khẩu: tự sinh hoặc nhập tay. Giáo viên phải đổi mật khẩu ở lần đăng nhập sau.
  r.put(
    '/:id/password',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const target = await findTeacher(req.params.id);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy giáo viên.' });

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
      await audit(db, req.user.id, 'teacher.password_set', target.id, { generated: generate });
      return res.json({ ok: true, ...(generate ? { temporary_password: plain } : {}) });
    })
  );

  return r;
}
