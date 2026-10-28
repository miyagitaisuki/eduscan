import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { hashPassword, verifyPassword, signJwt, newId, randomPassword } from '../lib/security';
import { userDto } from '../lib/dto';
import { ah, AuthedRequest } from '../lib/http';
import type { Deps } from './deps';

// Khóa tạm theo tài khoản: chống dò mật khẩu từ nhiều IP khác nhau.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

function accountLocked(email: string) {
  const f = failures.get(email);
  return !!f && f.resetAt > Date.now() && f.count >= MAX_FAILURES;
}
function recordFailure(email: string) {
  const now = Date.now();
  const f = failures.get(email);
  if (!f || f.resetAt <= now) failures.set(email, { count: 1, resetAt: now + WINDOW_MS });
  else f.count++;
}

export function authRoutes({ db, auth, config }: Deps) {
  const r = Router();

  // Giới hạn theo IP: 10 lần sai/15 phút (lần đúng không tính)
  const loginLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_FAILURES,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.' },
  });

  r.post(
    '/login',
    loginLimiter,
    ah(async (req, res) => {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu.' });
      }
      if (accountLocked(email)) {
        return res.status(429).json({ error: 'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau 15 phút.' });
      }

      const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!u || !verifyPassword(password, u.passwordHash) || u.status !== 'active') {
        recordFailure(email);
        return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
      }
      failures.delete(email);

      const token = signJwt({ id: u.id, email: u.email, role: u.role, full_name: u.fullName }, config.jwtSecret);
      return res.json({ token, user: userDto(u) });
    })
  );

  // Đăng ký công khai chỉ tạo tài khoản học viên
  r.post(
    '/register',
    loginLimiter,
    ah(async (req, res) => {
      const { password, full_name, phone, student_code } = req.body ?? {};
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      if (!email || !password || !full_name) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ email, mật khẩu và họ tên.' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      }
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) return res.status(409).json({ error: 'Email này đã được đăng ký trong hệ thống.' });

      const id = newId('usr');
      const [u] = await db
        .insert(users)
        .values({
          id,
          email,
          passwordHash: hashPassword(String(password)),
          fullName: String(full_name).trim(),
          role: 'student',
          studentCode: student_code || `STU${Math.floor(100000 + Math.random() * 900000)}`,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(String(full_name))}`,
          phone: phone || '',
          status: 'active',
        })
        .returning();
      const token = signJwt({ id, email, role: 'student', full_name: u.fullName }, config.jwtSecret);
      return res.status(201).json({ token, user: userDto(u) });
    })
  );

  r.post(
    '/refresh',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const token = signJwt(
        { id: req.user.id, email: req.user.email, role: req.user.role, full_name: req.user.full_name },
        config.jwtSecret
      );
      return res.json({ token });
    })
  );

  r.get(
    '/profile',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const [u] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
      if (!u) return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản.' });
      return res.json(userDto(u));
    })
  );
  // Đổi mật khẩu: bắt buộc nhập mật khẩu hiện tại, hash bằng cùng hàm scrypt
  r.post(
    '/change-password',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const current = String(req.body?.current_password ?? '');
      const next = String(req.body?.new_password ?? '');
      const confirm = String(req.body?.confirm_password ?? '');
      const lockKey = `pw:${req.user.id}`; // tách khỏi khóa theo email của đăng nhập

      if (!current || !next || !confirm) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
      }
      if (next.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      }
      if (next !== confirm) {
        return res.status(400).json({ error: 'Mật khẩu nhập lại không khớp.' });
      }
      if (next === current) {
        return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
      }
      if (accountLocked(lockKey)) {
        return res.status(429).json({ error: 'Nhập sai quá nhiều lần. Thử lại sau 15 phút.' });
      }

      const [u] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
      if (!u || !verifyPassword(current, u.passwordHash)) {
        recordFailure(lockKey);
        return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
      }
      failures.delete(lockKey);

      await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, u.id));
      return res.json({ ok: true, message: 'Đã đổi mật khẩu.' });
    })
  );
  return r;
}

// Dùng cho route tạo học viên và seed: mật khẩu tạm ngẫu nhiên
export function newTempPassword() {
  const plain = randomPassword();
  return { plain, hash: hashPassword(plain) };
}
