import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN } from '../helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string;
let asgId: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  const res = await ctx.api.post('/api/assignments').set('Authorization', `Bearer ${T}`).send({
    class_id: 'cls-n5-01',
    title: 'Luyện tập Minna bài 5',
    kind: 'minna',
    minna_lesson: 5,
  });
  asgId = res.body.id;
});
afterAll(async () => {
  await ctx.close();
});

const post = (token: string, body: object, id = asgId) =>
  ctx.api.post(`/api/assignments/${id}/minna-result`).set('Authorization', `Bearer ${token}`).send(body);

describe('bài luyện tập Minna giao cho cả lớp', () => {
  it('giao bài Minna cần số bài hợp lệ', async () => {
    const bad = await ctx.api.post('/api/assignments').set('Authorization', `Bearer ${T}`).send({
      class_id: 'cls-n5-01',
      title: 'x',
      kind: 'minna',
      minna_lesson: 99,
    });
    expect(bad.status).toBe(400);
  });

  it('ghi điểm theo thang 10, giữ điểm cao nhất và đếm số lượt', async () => {
    const a = await post(AN, { lesson_no: 5, game: 1, total: 20, correct: 15 });
    expect(a.status).toBe(200);
    expect(a.body.score).toBe(7.5);
    expect(a.body.status).toBe('graded');
    const b = await post(AN, { lesson_no: 5, game: 1, total: 20, correct: 10 });
    expect(b.body.score).toBe(7.5);
    expect(JSON.parse(b.body.content).attempts).toBe(2);
    const c = await post(AN, { lesson_no: 5, game: 2, total: 20, correct: 19 });
    expect(c.body.score).toBe(9.5);
  });

  it('từ chối kết quả không hợp lệ, sai bài, hoặc không phải học viên', async () => {
    expect((await post(AN, { lesson_no: 5, total: 10, correct: 11 })).status).toBe(400);
    expect((await post(AN, { lesson_no: 6, total: 10, correct: 5 })).status).toBe(400);
    expect((await post(T, { lesson_no: 5, total: 10, correct: 5 })).status).toBe(403);
  });

  it('không ghi điểm cho bài tập thường', async () => {
    expect((await post(AN, { lesson_no: 5, total: 10, correct: 5 }, 'asg-2')).status).toBe(404);
  });
});
