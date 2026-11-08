import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext } from '../helpers';

const registerBody = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  password: 'abcdefgh',
  full_name: 'Học viên đăng ký',
  ...extra,
});

describe('đăng ký công khai cần mã mời', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext({
      registrationMode: 'invite',
      registrationInviteCode: 'moi-2026',
    });
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('thiếu mã mời trả 403', async () => {
    const res = await ctx.api.post('/api/auth/register').send(registerBody('invite-missing@example.com'));
    expect(res.status).toBe(403);
  });

  it('sai mã mời trả 403', async () => {
    const res = await ctx.api
      .post('/api/auth/register')
      .send(registerBody('invite-wrong@example.com', { invite_code: 'sai-ma' }));
    expect(res.status).toBe(403);
  });

  it('đúng mã mời tạo được tài khoản học viên', async () => {
    const res = await ctx.api
      .post('/api/auth/register')
      .send(registerBody('invite-ok@example.com', { invite_code: 'moi-2026' }));
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
    expect(res.body.token).toBeTruthy();
  });
});

describe('đăng ký công khai đang đóng', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext({ registrationMode: 'closed' });
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('từ chối cả khi có mã mời', async () => {
    const res = await ctx.api
      .post('/api/auth/register')
      .send(registerBody('closed@example.com', { invite_code: 'bat-ky' }));
    expect(res.status).toBe(403);
  });
});
