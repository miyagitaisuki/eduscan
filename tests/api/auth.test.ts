import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, SEED_PASSWORD } from '../helpers';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../../server/lib/security';
import { loadConfig } from '../../server/lib/config';
import { eq } from 'drizzle-orm';
import { users } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('xác thực', () => {
  it('API yêu cầu token, route health thì công khai', async () => {
    expect((await ctx.api.get('/api/classes')).status).toBe(401);
    expect((await ctx.api.get('/api/health')).status).toBe(200);
  });

  it('đăng nhập đúng trả token, không lộ mật khẩu', async () => {
    const res = await ctx.api.post('/api/auth/login').send({ email: TEACHER, password: SEED_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password_hash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('scrypt$');
  });

  it('đăng nhập sai bị từ chối, không phân biệt email hay mật khẩu sai', async () => {
    const res = await ctx.api.post('/api/auth/login').send({ email: TEACHER, password: 'sai' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email hoặc mật khẩu không chính xác.');
  });

  it('đăng ký công khai luôn tạo học viên, bỏ qua trường role', async () => {
    const res = await ctx.api.post('/api/auth/register').send({
      email: 'new.student@example.com',
      password: 'abcdef',
      full_name: 'Học viên mới',
      role: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
  });

  it('đăng ký với mật khẩu quá ngắn bị từ chối', async () => {
    const res = await ctx.api.post('/api/auth/register').send({ email: 'x@example.com', password: '123', full_name: 'X' });
    expect(res.status).toBe(400);
  });

  it('token giả mạo hoặc bị sửa bị từ chối', async () => {
    const token = await ctx.login(STUDENT_AN);
    const [h, b, s] = token.split('.');
    const forged = `${h}.${b.slice(0, -2)}AA.${s}`;
    const res = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('tài khoản bị khóa mất quyền ngay, không cần chờ token hết hạn', async () => {
    const token = await ctx.login(STUDENT_AN);
    await ctx.db.update(users).set({ status: 'suspended' }).where(eq(users.email, STUDENT_AN));
    const res = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    await ctx.db.update(users).set({ status: 'active' }).where(eq(users.email, STUDENT_AN));
  });

  it('làm mới token trả về token mới cho người dùng hợp lệ', async () => {
    const token = await ctx.login(TEACHER);
    const res = await ctx.api.post('/api/auth/refresh').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(verifyJwt(res.body.token, ctx.config.jwtSecret)?.role).toBe('teacher');
  });

  it('giới hạn đăng nhập theo tài khoản: sau 10 lần sai thì khóa tạm', async () => {
    const email = 'lockout.target@example.com';
    await ctx.db.insert(users).values({
      id: 'usr-lockout',
      email,
      passwordHash: hashPassword('dung-mat-khau'),
      fullName: 'Lockout',
      role: 'student',
    });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await ctx.api.post('/api/auth/login').send({ email, password: 'sai-' + i });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401 || s === 429)).toBe(true);
    expect(statuses[10]).toBe(429);
    // Mật khẩu đúng cũng bị chặn trong thời gian khóa
    const ok = await ctx.api.post('/api/auth/login').send({ email, password: 'dung-mat-khau' });
    expect(ok.status).toBe(429);
  });
});

describe('mật khẩu và JWT', () => {
  it('băm và kiểm tra mật khẩu đúng cách, không lưu văn bản rõ', () => {
    const h = hashPassword('abc123');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(h).not.toContain('abc123');
    expect(verifyPassword('abc123', h)).toBe(true);
    expect(verifyPassword('abc124', h)).toBe(false);
    expect(verifyPassword('abc123', 'plaintext')).toBe(false);
  });

  it('JWT hết hạn bị từ chối', () => {
    const token = signJwt({ id: 'x' }, 'secret-at-least-32-characters-long!!', -10);
    expect(verifyJwt(token, 'secret-at-least-32-characters-long!!')).toBeNull();
  });

  it('production bắt buộc JWT_SECRET đủ dài', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'ngan' } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
    const cfg = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) } as NodeJS.ProcessEnv);
    expect(cfg.jwtSecret).toBe('x'.repeat(40));
    expect(cfg.seedPasswordGenerated).toBe(true);
  });
});
