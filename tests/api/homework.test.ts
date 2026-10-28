import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, STUDENT_MAI } from '../helpers';
import { eq } from 'drizzle-orm';
import { submissions, notifications } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string, MAI: string;
let AN_ID: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  MAI = await ctx.login(STUDENT_MAI);
  AN_ID = (await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${AN}`)).body.id;
});
afterAll(async () => {
  await ctx.close();
});

describe('bài tập và bài nộp', () => {
  it('giáo viên giao bài và học viên đang học nhận thông báo', async () => {
    const res = await ctx.api.post('/api/assignments').set('Authorization', `Bearer ${T}`).send({
      class_id: 'cls-n5-01',
      title: 'Bài mới',
      deadline: '2026-12-01T00:00:00Z',
    });
    expect(res.status).toBe(201);
    const notifs = await ctx.db.select().from(notifications).where(eq(notifications.type, 'assignment'));
    expect(notifs.some((n) => n.message.includes('Bài mới'))).toBe(true);
  });

  it('học viên nộp bài cho chính mình, nộp lại thì ghi đè không tạo bản thứ hai', async () => {
    const first = await ctx.api.post('/api/submissions').set('Authorization', `Bearer ${AN}`).send({
      assignment_id: 'asg-2',
      content: 'Bài nộp lần 1',
    });
    expect(first.status).toBe(201);
    const second = await ctx.api.post('/api/submissions').set('Authorization', `Bearer ${AN}`).send({
      assignment_id: 'asg-2',
      content: 'Bài nộp lần 2',
    });
    expect(second.status).toBe(201);
    const rows = await ctx.db.select().from(submissions).where(eq(submissions.assignmentId, 'asg-2'));
    expect(rows.filter((r) => r.studentId === AN_ID).length).toBe(1);
    expect(rows.find((r) => r.studentId === AN_ID)?.content).toBe('Bài nộp lần 2');
  });

  it('giáo viên không nộp bài được', async () => {
    const res = await ctx.api.post('/api/submissions').set('Authorization', `Bearer ${T}`).send({ assignment_id: 'asg-2' });
    expect(res.status).toBe(403);
  });

  it('học viên không nộp được bài của lớp mình không học', async () => {
    const res = await ctx.api.post('/api/assignments').set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-kaiwa-01', title: 'Kaiwa' });
    const created = res.body.id;
    const sub = await ctx.api.post('/api/submissions').set('Authorization', `Bearer ${AN}`).send({ assignment_id: created });
    expect(sub.status).toBe(403);
  });

  it('chấm điểm: đặt trạng thái graded, gửi thông báo cho học viên', async () => {
    const list = await ctx.api.get('/api/submissions?assignment_id=asg-2').set('Authorization', `Bearer ${T}`);
    const sub = list.body.find((s: any) => s.student_id === AN_ID);
    const res = await ctx.api.put(`/api/submissions/${sub.id}/grade`).set('Authorization', `Bearer ${T}`).send({
      score: 8.5,
      feedback: 'Tốt',
      strengths: ['Chữ viết đẹp'],
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('graded');
    expect(res.body.score).toBe(8.5);
    const notifs = await ctx.db.select().from(notifications).where(eq(notifications.type, 'grade'));
    expect(notifs.some((n) => n.userId === AN_ID)).toBe(true);
  });

  it('điểm ngoài khoảng 0–10 bị từ chối', async () => {
    const list = await ctx.api.get('/api/submissions?assignment_id=asg-2').set('Authorization', `Bearer ${T}`);
    const sub = list.body.find((s: any) => s.student_id === AN_ID);
    const res = await ctx.api.put(`/api/submissions/${sub.id}/grade`).set('Authorization', `Bearer ${T}`).send({ score: 42 });
    expect(res.status).toBe(400);
  });

  it('cập nhật nhận xét không có điểm không đánh dấu bài là đã chấm', async () => {
    const list = await ctx.api.get('/api/submissions?assignment_id=asg-1').set('Authorization', `Bearer ${T}`);
    const mai = list.body.find((s: any) => s.student_id !== AN_ID && s.status === 'submitted');
    expect(mai).toBeTruthy();
    const res = await ctx.api.put(`/api/submissions/${mai.id}/grade`).set('Authorization', `Bearer ${T}`).send({ comment: 'Cần cố gắng hơn' });
    expect(res.body.status).toBe('submitted');
    expect(res.body.score).toBeNull();
    expect(res.body.feedback).toBe('Cần cố gắng hơn');
  });

  it('giáo viên ghi nhận thủ công điểm cho học viên chưa nộp bài trên hệ thống', async () => {
    const maiProfile = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${MAI}`);
    const res = await ctx.api.post('/api/submissions/manual').set('Authorization', `Bearer ${T}`).send({
      assignment_id: 'asg-2',
      student_id: maiProfile.body.id,
      status: 'graded',
      score: 7,
      comment: 'Nộp trực tiếp',
    });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(7);
    const maiId = res.body.student_id;
    const again = await ctx.api.post('/api/submissions/manual').set('Authorization', `Bearer ${T}`).send({
      assignment_id: 'asg-2',
      student_id: res.body.student_id,
      status: 'graded',
      score: 9,
    });
    expect(again.body.id).toBe(res.body.id);
    expect(again.body.score).toBe(9);
  });

  it('học viên xem bài đã nộp của mình kèm tên bài tập và hạn', async () => {
    const res = await ctx.api.get('/api/submissions/my').set('Authorization', `Bearer ${AN}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].assignment_title).toBeTruthy();
    expect(res.body[0].deadline).toBeTruthy();
  });

  it('xóa bài tập kéo theo bài nộp của bài đó', async () => {
    const created = await ctx.api.post('/api/assignments').set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-n5-01', title: 'Tạm' });
    await ctx.api.post('/api/submissions').set('Authorization', `Bearer ${AN}`).send({ assignment_id: created.body.id, content: 'x' });
    await ctx.api.delete(`/api/assignments/${created.body.id}`).set('Authorization', `Bearer ${T}`);
    const rows = await ctx.db.select().from(submissions).where(eq(submissions.assignmentId, created.body.id));
    expect(rows.length).toBe(0);
  });
});
