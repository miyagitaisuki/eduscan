import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, STUDENT_MAI, ADMIN } from '../helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string, MAI: string, ADM: string;
let AN_ID: string, MAI_ID: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  MAI = await ctx.login(STUDENT_MAI);
  ADM = await ctx.login(ADMIN);
  AN_ID = (await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${AN}`)).body.id;
  MAI_ID = (await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${MAI}`)).body.id;
});
afterAll(async () => {
  await ctx.close();
});

describe('phân quyền theo vai trò', () => {
  it('học viên chỉ thấy lớp mình đang học', async () => {
    const mine = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${AN}`);
    expect(mine.status).toBe(200);
    expect(mine.body.map((c: any) => c.id)).toEqual(['cls-n5-01']);
    const all = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${T}`);
    expect(all.body.length).toBeGreaterThan(1);
  });

  it('học viên không thể tạo, sửa, xóa lớp', async () => {
    expect((await ctx.api.post('/api/classes').set('Authorization', `Bearer ${AN}`).send({ name: 'x' })).status).toBe(403);
    expect((await ctx.api.put('/api/classes/cls-n5-01').set('Authorization', `Bearer ${AN}`).send({ name: 'x' })).status).toBe(403);
    expect((await ctx.api.delete('/api/classes/cls-n5-01').set('Authorization', `Bearer ${AN}`)).status).toBe(403);
  });

  it('học viên không xem được danh sách học viên toàn bộ', async () => {
    expect((await ctx.api.get('/api/students').set('Authorization', `Bearer ${AN}`)).status).toBe(403);
  });

  it('học viên không chấm điểm, không tạo học phí, không gọi AI chấm bài', async () => {
    expect((await ctx.api.put('/api/submissions/sub-1/grade').set('Authorization', `Bearer ${AN}`).send({ score: 10 })).status).toBe(403);
    expect((await ctx.api.post('/api/tuition').set('Authorization', `Bearer ${AN}`).send({ student_id: AN_ID })).status).toBe(403);
    expect((await ctx.api.post('/api/ai/grade-assignment').set('Authorization', `Bearer ${AN}`).send({})).status).toBe(403);
  });

  it('PUT học viên không đổi được vai trò, id hay mật khẩu', async () => {
    const res = await ctx.api.put(`/api/students/${AN_ID}`).set('Authorization', `Bearer ${T}`).send({
      role: 'admin',
      id: 'usr-hacked',
      password_hash: 'scrypt$x$y',
      full_name: 'An đã đổi tên',
    });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('student');
    expect(res.body.id).toBe(AN_ID);
    expect(res.body.full_name).toBe('An đã đổi tên');
    await ctx.api.put(`/api/students/${AN_ID}`).set('Authorization', `Bearer ${T}`).send({ full_name: 'Nguyễn Văn An' });
    // Mật khẩu cũ vẫn đăng nhập được
    expect((await ctx.api.post('/api/auth/login').send({ email: STUDENT_AN, password: '123456' })).status).toBe(200);
  });

  it('không tạo được học viên trùng email', async () => {
    const res = await ctx.api.post('/api/students').set('Authorization', `Bearer ${T}`).send({ full_name: 'Trùng', email: STUDENT_AN });
    expect(res.status).toBe(409);
  });

  it('PUT lớp không đổi được id', async () => {
    const res = await ctx.api.put('/api/classes/cls-n5-01').set('Authorization', `Bearer ${T}`).send({ id: 'cls-hack', name: 'N5 Sơ cấp 1 (Minna no Nihongo)' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('cls-n5-01');
  });

  it('học viên chỉ xem học phí của mình', async () => {
    const res = await ctx.api.get('/api/tuition').set('Authorization', `Bearer ${AN}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((t: any) => t.student_id === AN_ID)).toBe(true);
  });

  it('thông báo không nhận user_id từ client, luôn trả của người đăng nhập', async () => {
    const res = await ctx.api.get('/api/notifications?user_id=usr-student-2').set('Authorization', `Bearer ${AN}`);
    expect(res.status).toBe(200);
    expect(res.body.every((n: any) => n.user_id === AN_ID)).toBe(true);
  });

  it('không đánh dấu được thông báo của người khác', async () => {
    const notifMai = (await ctx.api.get('/api/notifications').set('Authorization', `Bearer ${MAI}`)).body[0];
    expect(notifMai).toBeTruthy();
    await ctx.api.put(`/api/notifications/${notifMai.id}/read`).set('Authorization', `Bearer ${AN}`);
    const check = await ctx.api.get('/api/notifications').set('Authorization', `Bearer ${MAI}`);
    expect(check.body.find((n: any) => n.id === notifMai.id).is_read).toBe(false);
  });

  it('học viên chỉ thấy bài nộp của mình', async () => {
    const res = await ctx.api.get('/api/submissions').set('Authorization', `Bearer ${MAI}`);
    expect(res.status).toBe(200);
    expect(res.body.every((s: any) => s.student_id === MAI_ID)).toBe(true);
  });

  it('học viên chỉ thấy bài tập của lớp mình đang học', async () => {
    const res = await ctx.api.get('/api/assignments').set('Authorization', `Bearer ${AN}`);
    expect(res.body.length).toBe(2);
    const kaiwa = await ctx.api.get('/api/assignments?class_id=cls-kaiwa-01').set('Authorization', `Bearer ${AN}`);
    expect(kaiwa.body.length).toBe(0);
  });

  it('admin có quyền như giáo viên, còn học viên không tự nâng quyền', async () => {
    expect((await ctx.api.get('/api/students').set('Authorization', `Bearer ${ADM}`)).status).toBe(200);
  });

  it('API không tồn tại trả 404 JSON, không trả HTML', async () => {
    const res = await ctx.api.get('/api/khong-ton-tai').set('Authorization', `Bearer ${T}`);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
