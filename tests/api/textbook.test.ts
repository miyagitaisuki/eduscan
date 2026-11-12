import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, STUDENT_MAI } from '../helpers';
import { LESSON_FILE } from '../fixtures/textbookLesson';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string;
let lessonId: string;
let asgId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
});
afterAll(async () => {
  await ctx.close();
});

describe('thư viện giáo trình', () => {
  it('giáo viên nhập lesson.json; nhập lại thì ghi đè, không nhân đôi', async () => {
    const a = await ctx.api.post('/api/textbook/import').set(auth(T)).send({ book: 'Cuốn 8', data: LESSON_FILE });
    expect(a.status).toBe(200);
    expect(a.body).toEqual({ book: 'Cuốn 8', lessons: 2, gradable_exercises: 2 });
    const b = await ctx.api.post('/api/textbook/import').set(auth(T)).send({ book: 'Cuốn 8', data: LESSON_FILE });
    expect(b.status).toBe(200);
    const list = await ctx.api.get('/api/textbook/lessons').set(auth(T));
    expect(list.body).toHaveLength(2);
    expect(list.body[0].exercises).toEqual([
      { id: 'renshuu.1.A', title: 'Ⅰ-A　〜そうです', count: 2 },
      { id: 'yomikaki.reading', title: '読みもの　Bài đọc', count: 1 },
    ]);
    lessonId = list.body[0].id;
  });

  it('từ chối file sai định dạng và học viên', async () => {
    const bad = await ctx.api.post('/api/textbook/import').set(auth(T)).send({ book: 'X', data: { schema: 'khac' } });
    expect(bad.status).toBe(400);
    expect((await ctx.api.post('/api/textbook/import').set(auth(AN)).send({ book: 'X', data: LESSON_FILE })).status).toBe(403);
    expect((await ctx.api.get('/api/textbook/lessons').set(auth(AN))).status).toBe(403);
  });
});

describe('bài giao từ giáo trình', () => {
  it('giao bài với các bài tập được chọn; bài không tự chấm được thì báo lỗi', async () => {
    const res = await ctx.api.post('/api/assignments').set(auth(T)).send({
      class_id: 'cls-n5-01',
      title: 'Bài 1: luyện tập',
      kind: 'textbook',
      textbook_lesson_id: lessonId,
      exercise_ids: ['renshuu.1.A'],
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('textbook');
    expect(res.body.payload.exercises.map((e: any) => e.id)).toEqual(['renshuu.1.A']);
    asgId = res.body.id;

    const lessons = await ctx.api.get('/api/textbook/lessons').set(auth(T));
    const empty = await ctx.api.post('/api/assignments').set(auth(T)).send({
      class_id: 'cls-n5-01', title: 'x', kind: 'textbook', textbook_lesson_id: lessons.body[1].id,
    });
    expect(empty.status).toBe(400);
  });

  it('học viên không nhận đáp án trước hạn nộp; giáo viên thì có', async () => {
    const st = await ctx.api.get(`/api/assignments/${asgId}`).set(auth(AN));
    expect(st.body.payload.answers_visible).toBe(false);
    expect(st.body.payload.exercises[0].items[0].answer).toBeUndefined();
    const list = await ctx.api.get('/api/assignments').set(auth(AN));
    const item = list.body.find((a: any) => a.id === asgId);
    expect(item.payload.exercises[0].items[0].answer).toBeUndefined();
    const te = await ctx.api.get(`/api/assignments/${asgId}`).set(auth(T));
    expect(te.body.payload.exercises[0].items[0].answer).toContain('そうです');
  });

  it('server tự chấm, nộp lại thì thay lần trước và đếm số lượt', async () => {
    const post = (answers: object) =>
      ctx.api.post(`/api/assignments/${asgId}/textbook-submit`).set(auth(AN)).send({ answers });
    const a = await post({ 'renshuu.1.A#1': '明日は雨がふるそうです', 'renshuu.1.A#2': 'ジョンくんは忙しいです' });
    expect(a.status).toBe(200);
    expect(a.body.score).toBe(5);
    expect(a.body.status).toBe('graded');
    const content = JSON.parse(a.body.content);
    expect(content.results).toEqual({ 'renshuu.1.A#1': 'correct', 'renshuu.1.A#2': 'review' });
    expect(a.body.feedback).toContain('1 câu chưa khớp');

    const b = await post({ 'renshuu.1.A#1': '明日は雨が降るそうです', 'renshuu.1.A#2': 'ジョンくんはいそがしいそうです' });
    expect(b.body.score).toBe(10);
    expect(JSON.parse(b.body.content).attempts).toBe(2);
  });

  it('chặn giáo viên, học viên ngoài lớp và bài thường', async () => {
    const body = { answers: {} };
    expect((await ctx.api.post(`/api/assignments/${asgId}/textbook-submit`).set(auth(T)).send(body)).status).toBe(403);
    const mai = await ctx.login(STUDENT_MAI);
    const enrolled = await ctx.api.get('/api/assignments').set(auth(mai));
    if (!enrolled.body.some((a: any) => a.id === asgId)) {
      expect((await ctx.api.post(`/api/assignments/${asgId}/textbook-submit`).set(auth(mai)).send(body)).status).toBe(403);
    }
    expect((await ctx.api.post('/api/assignments/asg-2/textbook-submit').set(auth(AN)).send(body)).status).toBe(404);
  });
});
