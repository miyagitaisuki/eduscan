import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { passwordResets, users } from '../db/schema';
import {
  hashPassword,
  verifyPassword,
  signJwt,
  newId,
  randomPassword,
  hashToken,
  MIN_PASSWORD_LENGTH,
} from '../lib/security';
import { userDto } from '../lib/dto';
import { ah, AuthedRequest } from '../lib/http';
import { audit } from '../lib/audit';
import { sendPasswordReset } from '../lib/reset';
import type { Deps } from './deps';

// Khóa tạm theo tài khoản: chống dò mật khẩu từ nhiều IP khác nhau.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

function accountLocked(key: string) {
  const f = failures.get(key);
  return !!f && f.resetAt > Date.now() && f.count >= MAX_FAILURES;
}
function recordFailure(key: string) {
  const now = Date.now();
  const f = failures.get(key);
  if (!f || f.resetAt <= now) failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else f.count++;
}

// JWT mang theo tv (token_version): đổi mật khẩu làm tăng tv, token cũ bị từ chối
function issueToken(
  u: { id: string; email: string; role: string; fullName: string; tokenVersion: number },
  secret: string
) {
  return signJwt({ id: u.id, email: u.email, role: u.role, full_name: u.fullName, tv: u.tokenVersion }, secret);
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
  // Quên mật khẩu và đặt lại: giới hạn số lần gửi/thử theo IP
  const resetLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' },
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

      const token = issueToken(u, config.jwtSecret);
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
      const token = issueToken(u, config.jwtSecret);
      return res.status(201).json({ token, user: userDto(u) });
    })
  );

  r.post(
    '/refresh',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const token = issueToken(
        {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          fullName: req.user.full_name,
          tokenVersion: req.user.tokenVersion ?? 0,
        },
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

  // Tự cập nhật hồ sơ: họ tên và SĐT. Email (tên đăng nhập) và vai trò chỉ admin đổi được.
  r.put(
    '/profile',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const set: Partial<{ fullName: string; phone: string }> = {};
      if (b.full_name !== undefined) {
        const name = String(b.full_name).trim();
        if (!name) return res.status(400).json({ error: 'Họ tên không được để trống.' });
        set.fullName = name;
      }
      if (b.phone !== undefined) set.phone = String(b.phone).trim();
      if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });

      const [u] = await db.update(users).set(set).where(eq(users.id, req.user.id)).returning();
      await audit(db, req.user.id, 'profile.updated', req.user.id, { fields: Object.keys(set) });
      return res.json(userDto(u));
    })
  );

  // Người dùng tự đổi mật khẩu: cần mật khẩu hiện tại. Sau khi đổi, mọi token cũ bị vô hiệu,
  // và server trả về token mới cho phiên hiện tại.
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
      if (next.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` });
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

      const [updated] = await db
        .update(users)
        .set({ passwordHash: hashPassword(next), mustChangePassword: false, tokenVersion: u.tokenVersion + 1 })
        .where(eq(users.id, u.id))
        .returning();
      return res.json({
        ok: true,
        message: 'Đã đổi mật khẩu.',
        token: issueToken(updated, config.jwtSecret),
        user: userDto(updated),
      });
    })
  );

  // Quên mật khẩu: luôn trả về cùng một thông báo để không lộ email nào có trong hệ thống
  r.post(
    '/forgot-password',
    resetLimiter,
    ah(async (req, res) => {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const generic = {
        ok: true,
        message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.',
      };
      if (!email) return res.json(generic);
      const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (u && u.status === 'active') {
        await sendPasswordReset(db, { id: u.id, email: u.email, fullName: u.fullName });
      }
      return res.json(generic);
    })
  );

  // Đặt lại mật khẩu bằng token trong email (dùng một lần, hết hạn sau 30 phút)
  r.post(
    '/reset-password',
    resetLimiter,
    ah(async (req, res) => {
      const token = String(req.body?.token ?? '');
      const next = String(req.body?.new_password ?? '');
      if (!token || !next) {
        return res.status(400).json({ error: 'Thiếu token hoặc mật khẩu mới.' });
      }
      if (next.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` });
      }
      const invalid = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';

      const [row] = await db
        .select()
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.tokenHash, hashToken(token)),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, new Date())
          )
        )
        .limit(1);
      if (!row) return res.status(400).json({ error: invalid });

      const [u] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      if (!u || u.status !== 'active') return res.status(400).json({ error: invalid });

      await db
        .update(users)
        .set({ passwordHash: hashPassword(next), mustChangePassword: false, tokenVersion: u.tokenVersion + 1 })
        .where(eq(users.id, u.id));
      // Vô hiệu mọi link đặt lại còn lại của người dùng này
      await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.userId, u.id));
      await audit(db, u.id, 'password.reset_by_email', u.id);

      return res.json({ ok: true, message: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.' });
    })
  );

  return r;
}

// Dùng cho route tạo học viên và seed: mật khẩu tạm ngẫu nhiên
export function newTempPassword() {
  const plain = randomPassword();
  return { plain, hash: hashPassword(plain) };
}
