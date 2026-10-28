import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, ADMIN } from '../helpers';
import { eq } from 'drizzle-orm';
import { submissions, users } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string, ADM: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  ADM = await ctx.login(ADMIN);
});
afterAll(async () => {
  await ctx.close();
});

describe('sao lưu và khôi phục', () => {
  it('chỉ admin tải được bản sao lưu; giáo viên bị từ chối', async () => {
    expect((await ctx.api.get('/api/admin/backup').set('Authorization', `Bearer ${T}`)).status).toBe(403);
    expect((await ctx.api.get('/api/admin/backup').set('Authorization', `Bearer ${AN}`)).status).toBe(403);
    const res = await ctx.api.get('/api/admin/backup').set('Authorization', `Bearer ${ADM}`);
    expect(res.status).toBe(200);
    expect(res.body.tables.users.length).toBeGreaterThan(0);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  it('khôi phục cần xác nhận RESTORE và đúng định dạng', async () => {
    const backup = (await ctx.api.get('/api/admin/backup').set('Authorization', `Bearer ${ADM}`)).body;
    expect((await ctx.api.post('/api/admin/restore').set('Authorization', `Bearer ${ADM}`).send({ data: backup })).status).toBe(400);
    expect((await ctx.api.post('/api/admin/restore').set('Authorization', `Bearer ${ADM}`).send({ confirm: 'RESTORE', data: { version: 1 } })).status).toBe(400);
    expect((await ctx.api.post('/api/admin/restore').set('Authorization', `Bearer ${T}`).send({ confirm: 'RESTORE', data: backup })).status).toBe(403);
  });

  it('sao lưu rồi khôi phục giữ nguyên dữ liệu, kể cả mật khẩu và ngày tháng', async () => {
    const backup = (await ctx.api.get('/api/admin/backup').set('Authorization', `Bearer ${ADM}`)).body;
    // Làm thay đổi dữ liệu sau khi sao lưu
    await ctx.api.post('/api/assignments').set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-n5-01', title: 'Sau sao lưu' });
    const restore = await ctx.api.post('/api/admin/restore').set('Authorization', `Bearer ${ADM}`).send({ confirm: 'RESTORE', data: backup });
    expect(restore.status).toBe(200);
    expect(restore.body.counts.users).toBe(backup.tables.users.length);

    const list = await ctx.api.get('/api/assignments').set('Authorization', `Bearer ${T}`);
    expect(list.body.some((a: any) => a.title === 'Sau sao lưu')).toBe(false);
    // Đăng nhập vẫn được sau khôi phục (mật khẩu băm được giữ nguyên)
    expect((await ctx.api.post('/api/auth/login').send({ email: TEACHER, password: '123456' })).status).toBe(200);
    const [sub] = await ctx.db.select().from(submissions).where(eq(submissions.id, 'sub-1'));
    expect(sub.submittedAt).toBeInstanceOf(Date);
    const [u] = await ctx.db.select().from(users).where(eq(users.id, 'usr-student-1'));
    expect(u.passwordHash.startsWith('scrypt$')).toBe(true);
  });
});

describe('AI không bao giờ trả kết quả giả', () => {
  it('khi không có GEMINI_API_KEY, chấm bài trả 503, không có điểm', async () => {
    const res = await ctx.api.post('/api/ai/grade-assignment').set('Authorization', `Bearer ${T}`).send({
      assignmentTitle: 'Bài 1',
      studentName: 'An',
      submissionContent: 'Nội dung',
    });
    expect(res.status).toBe(503);
    expect(res.body.score).toBeUndefined();
    expect(res.body.aiFallback).toBe(false);
  });

  it('sinh nhận xét khi AI không khả dụng trả 503, không có nhận xét mẫu', async () => {
    const res = await ctx.api.post('/api/ai/generate-feedback').set('Authorization', `Bearer ${T}`).send({ studentName: 'An', score: 8 });
    expect(res.status).toBe(503);
    expect(res.body.detailedFeedback).toBeUndefined();
  });
});
