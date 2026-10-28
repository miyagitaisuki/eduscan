import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, ADMIN, SEED_PASSWORD } from '../helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

const STUDENT_ID = 'usr-student-1';

describe('quản lý tài khoản học viên', () => {
  it('chỉ admin đặt được mật khẩu học viên', async () => {
    const teacherToken = await ctx.login(TEACHER);
    const res = await ctx.api
      .put(`/api/students/${STUDENT_ID}/password`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ generate: true });
    expect(res.status).toBe(403);
  });

  it('admin tự sinh mật khẩu tạm: học viên đăng nhập được, bị buộc đổi, API khác bị chặn', async () => {
    const adminToken = await ctx.login(ADMIN);
    const set = await ctx.api
      .put(`/api/students/${STUDENT_ID}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ generate: true });
    expect(set.status).toBe(200);
    const temp: string = set.body.temporary_password;
    expect(temp.length).toBeGreaterThanOrEqual(8);

    const login = await ctx.api.post('/api/auth/login').send({ email: STUDENT_AN, password: temp });
    expect(login.status).toBe(200);
    expect(login.body.user.must_change_password).toBe(true);

    const blocked = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${login.body.token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('MUST_CHANGE_PASSWORD');

    const profile = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${login.body.token}`);
    expect(profile.status).toBe(200);
  });

  it('đổi mật khẩu vô hiệu token cũ, cấp token mới và bỏ cờ bắt buộc', async () => {
    const adminToken = await ctx.login(ADMIN);
    await ctx.api
      .put(`/api/students/${STUDENT_ID}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ new_password: 'matkhau-moi-1' });

    const oldToken = await ctx.login(STUDENT_AN, 'matkhau-moi-1');
    const change = await ctx.api
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ current_password: 'matkhau-moi-1', new_password: 'matkhau-moi-2', confirm_password: 'matkhau-moi-2' });
    expect(change.status).toBe(200);
    expect(change.body.user.must_change_password).toBe(false);

    const stale = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${oldToken}`);
    expect(stale.status).toBe(401);

    const fresh = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${change.body.token}`);
    expect(fresh.status).toBe(200);
  });

  it('giáo viên không đổi được email đăng nhập của học viên, admin thì được', async () => {
    const teacherToken = await ctx.login(TEACHER);
    const denied = await ctx.api
      .put(`/api/students/${STUDENT_ID}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ email: 'hacker@example.com' });
    expect(denied.status).toBe(403);

    const adminToken = await ctx.login(ADMIN);
    const ok = await ctx.api
      .put(`/api/students/${STUDENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'an.nguyen@qnu.edu.vn' });
    expect(ok.status).toBe(200);
    expect(ok.body.email).toBe('an.nguyen@qnu.edu.vn');
  });

  it('quên mật khẩu luôn trả về cùng thông báo, link sai bị từ chối', async () => {
    const unknown = await ctx.api.post('/api/auth/forgot-password').send({ email: 'khong-ton-tai@example.com' });
    const known = await ctx.api.post('/api/auth/forgot-password').send({ email: TEACHER });
    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);

    const bad = await ctx.api.post('/api/auth/reset-password').send({ token: 'sai', new_password: 'matkhau-moi-3' });
    expect(bad.status).toBe(400);
  });

  it('admin gửi email đặt lại: không có cấu hình email thì báo 503', async () => {
    const adminToken = await ctx.login(ADMIN);
    const res = await ctx.api
      .post(`/api/students/${STUDENT_ID}/send-reset`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(503);
  });
});
