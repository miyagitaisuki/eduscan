import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { classes, leads, users } from '../db/schema';
import { ah, AuthedRequest } from '../lib/http';
import { audit } from '../lib/audit';
import { newId } from '../lib/security';
import { notifyNewLead } from '../lib/leadNotify';
import { parseDateOnly } from '../lib/validation';
import { todayStr } from '../lib/http';
import { newTempPassword } from './auth';
import { enrollNewStudent } from './students';
import type { AppDb } from '../db/client';
import { randomBytes } from 'crypto';
import type { Deps } from './deps';

export const LEAD_STATUSES = ['new', 'contacted', 'trial', 'enrolled', 'declined'] as const;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Chuẩn hóa số điện thoại Việt Nam: bỏ khoảng trắng, dấu chấm, gạch; +84/84 đổi về 0. null nếu không hợp lệ.
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let p = v.replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = `0${p.slice(3)}`;
  else if (p.startsWith('84') && p.length === 11) p = `0${p.slice(2)}`;
  return /^0\d{9}$/.test(p) ? p : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ConvertConflict extends Error {}

const leadDto = (l: typeof leads.$inferSelect) => ({
  id: l.id,
  full_name: l.fullName,
  phone: l.phone,
  current_level: l.currentLevel ?? '',
  target_jlpt: l.targetJlpt ?? '',
  notes: l.notes ?? '',
  source: l.source ?? '',
  consent_at: l.consentAt.toISOString(),
  status: l.status,
  admin_note: l.adminNote ?? '',
  student_id: l.studentId ?? '',
  created_at: l.createdAt.toISOString(),
});

export function leadRoutes({ db, auth }: Deps) {
  const r = Router();

  // Giới hạn theo IP: tối đa 10 đăng ký/giờ
  const publicLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Gửi quá nhiều lần. Vui lòng thử lại sau hoặc gọi trực tiếp để được tư vấn.' },
  });

  // Công khai (website gọi): nhận đăng ký học thử. Không đọc được gì từ endpoint này.
  r.post(
    '/public',
    publicLimiter,
    ah(async (req, res) => {
      const body = req.body ?? {};
      // Ô "website" ẩn trên form: người thật để trống, bot điền vào. Trả OK để bot không dò được.
      if (str(body.website, 200)) return res.json({ ok: true });

      const fullName = str(body.fullName, 150);
      const phone = normalizePhone(body.phone);
      if (!fullName) return res.status(400).json({ ok: false, error: 'Vui lòng nhập họ tên.' });
      if (!phone) return res.status(400).json({ ok: false, error: 'Số điện thoại không hợp lệ.' });
      if (body.consent !== true) {
        return res.status(400).json({ ok: false, error: 'Cần đồng ý chính sách bảo vệ dữ liệu cá nhân.' });
      }

      // Cùng số điện thoại trong 24 giờ: coi như đã nhận, không tạo bản ghi trùng
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [dup] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.phone, phone), gt(leads.createdAt, since)))
        .limit(1);
      if (dup) return res.json({ ok: true });

      const [created] = await db
        .insert(leads)
        .values({
        id: newId('lead'),
        fullName,
        phone,
        currentLevel: str(body.currentLevel, 100) || null,
        targetJlpt: str(body.targetJlpt, 50) || null,
        notes: str(body.notes, 2000) || null,
        source: str(body.source, 300) || null,
        consentAt: new Date(),
        })
        .returning();
      // Báo email chạy nền: phản hồi cho người đăng ký không phải chờ và không phụ thuộc vào email
      void notifyNewLead(db, created);
      return res.status(201).json({ ok: true });
    })
  );

  // Admin: danh sách đăng ký, mới nhất trước. ?status= để lọc.
  r.get(
    '/',
    auth.requireAdmin,
    ah(async (req, res) => {
      const status = typeof req.query.status === 'string' ? req.query.status : '';
      if (status && !(LEAD_STATUSES as readonly string[]).includes(status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
      }
      const rows = await db
        .select()
        .from(leads)
        .where(status ? eq(leads.status, status as (typeof LEAD_STATUSES)[number]) : undefined)
        .orderBy(desc(leads.createdAt))
        .limit(500);
      return res.json(rows.map(leadDto));
    })
  );

  // Admin: đổi trạng thái hoặc ghi chú xử lý
  r.patch(
    '/:id',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const { status, admin_note } = req.body ?? {};
      const set: Partial<typeof leads.$inferInsert> = {};
      if (status !== undefined) {
        if (!(LEAD_STATUSES as readonly unknown[]).includes(status)) {
          return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
        }
        set.status = status;
      }
      if (admin_note !== undefined) set.adminNote = str(admin_note, 2000) || null;
      if (!Object.keys(set).length) return res.status(400).json({ error: 'Không có gì để cập nhật.' });

      const [row] = await db.update(leads).set(set).where(eq(leads.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: 'Không tìm thấy đăng ký này.' });
      await audit(db, req.user.id, 'lead.update', row.id, { status: set.status });
      return res.json(leadDto(row));
    })
  );

  // Admin: tạo tài khoản học viên từ đăng ký, ghi danh vào lớp và đánh dấu "Đã ghi danh".
  // Mật khẩu tạm chỉ trả về một lần; học viên phải đổi ở lần đăng nhập đầu.
  r.post(
    '/:id/convert',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const classId = typeof b.class_id === 'string' ? b.class_id : '';
      if (!classId) return res.status(400).json({ error: 'Chọn lớp để ghi danh.' });
      const joinDate = b.join_date === undefined || b.join_date === '' ? todayStr() : parseDateOnly(b.join_date);
      if (!joinDate) return res.status(400).json({ error: 'Ngày vào lớp không hợp lệ (định dạng YYYY-MM-DD).' });
      let email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
      if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email không đúng định dạng.' });

      const [lead] = await db.select().from(leads).where(eq(leads.id, req.params.id)).limit(1);
      if (!lead) return res.status(404).json({ error: 'Không tìm thấy đăng ký này.' });
      if (lead.studentId) return res.status(409).json({ error: 'Đăng ký này đã được tạo tài khoản học viên.' });
      const [cls] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
      if (!cls) return res.status(400).json({ error: 'Lớp học không tồn tại.' });

      if (email) {
        const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (dup) return res.status(409).json({ error: 'Email này đã được sử dụng.' });
      } else {
        // Không nhập email: sinh địa chỉ duy nhất để học viên vẫn có tài khoản đăng nhập
        do {
          email = `student.${randomBytes(5).toString('hex')}@eduscan.edu.vn`;
        } while ((await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)).length);
      }

      const tmp = newTempPassword();
      const studentId = newId('usr');
      let updated: typeof leads.$inferSelect;
      try {
        updated = await db.transaction(async (tx) => {
          await tx.insert(users).values({
            id: studentId,
            email,
            passwordHash: tmp.hash,
            fullName: lead.fullName,
            role: 'student',
            studentCode: `STU${Math.floor(1000 + Math.random() * 9000)}`,
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(lead.fullName)}`,
            phone: lead.phone,
            status: 'active',
            mustChangePassword: true,
          });
          await enrollNewStudent(tx as unknown as AppDb, studentId, cls, joinDate);
          // Chỉ ghi khi đăng ký chưa có học viên: hai lần bấm cùng lúc thì lần sau thất bại và hoàn tác
          const [row] = await tx
            .update(leads)
            .set({ studentId, status: 'enrolled' })
            .where(and(eq(leads.id, lead.id), isNull(leads.studentId)))
            .returning();
          if (!row) throw new ConvertConflict();
          return row;
        });
      } catch (err) {
        if (err instanceof ConvertConflict) {
          return res.status(409).json({ error: 'Đăng ký này đã được tạo tài khoản học viên.' });
        }
        throw err;
      }
      await audit(db, req.user.id, 'lead.convert', lead.id, { student_id: studentId, class_id: cls.id });
      return res.status(201).json({
        lead: leadDto(updated),
        student: { id: studentId, full_name: lead.fullName, email, class_id: cls.id, class_name: cls.name },
        temporary_password: tmp.plain,
      });
    })
  );

  return r;
}
