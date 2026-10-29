import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN, TEACHER, STUDENT_AN } from '../helpers';


// Gemini giả: trả đúng JSON theo schema, hoặc ném lỗi khi test yêu cầu
let reply: () => Promise<{ text: string }> = async () => ({ text: JSON.stringify({ titles: ['Hiragana A', 'Hiragana KA', 'Hiragana SA'] }) });
const fakeAi = {
  models: {
    generateContent: (args: unknown) => {
      lastCall = args;
      return reply();
    },
  },
};
let lastCall: any = null;

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let ADM: string, T: string, S: string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  ctx = await createTestContext({}, fakeAi);
  ADM = await ctx.login(ADMIN);
  T = await ctx.login(TEACHER);
  S = await ctx.login(STUDENT_AN);
});
afterAll(async () => {
  await ctx.close();
});

describe('gợi ý nội dung buổi học bằng AI', () => {
  it('admin nhận danh sách gợi ý đúng số buổi, không ghi gì vào lịch', async () => {
    const before = await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(ADM));
    const res = await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 3 });
    expect(res.status).toBe(200);
    expect(res.body.titles).toEqual(['Hiragana A', 'Hiragana KA', 'Hiragana SA']);
    const after = await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(ADM));
    expect(after.body).toEqual(before.body);
  });

  it('prompt gửi cấp độ và giáo trình của lớp, cùng ghi chú của giáo viên', async () => {
    lastCall = null;
    await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 2, hint: 'ưu tiên chữ Kanji' });
    expect(lastCall.contents[0]).toContain('JLPT N5');
    expect(lastCall.contents[0]).toContain('Minna no Nihongo');
    expect(lastCall.contents[0]).toContain('ưu tiên chữ Kanji');
    expect(lastCall.config.responseMimeType).toBe('application/json');
  });

  it('cắt đúng số lượng, bỏ dòng trống, và báo khi AI không trả gì', async () => {
    reply = async () => ({ text: JSON.stringify({ titles: ['  ', 'Bài 1', 'Bài 2', 'Bài 3'] }) });
    const res = await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 2 });
    expect(res.body.titles).toEqual(['Bài 1', 'Bài 2']);

    reply = async () => ({ text: JSON.stringify({ titles: [] }) });
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 2 })).status).toBe(502);
  });

  it('lỗi AI hoặc JSON hỏng trả 503 chứ không trả nội dung giả', async () => {
    reply = async () => {
      throw new Error('quota');
    };
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 2 })).status).toBe(503);
    reply = async () => ({ text: 'không phải json' });
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 2 })).status).toBe(503);
  });

  it('chỉ admin được gợi ý; số buổi phải hợp lệ', async () => {
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(T)).send({ count: 2 })).status).toBe(403);
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(S)).send({ count: 2 })).status).toBe(403);
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 0 })).status).toBe(400);
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/suggest-titles').set(auth(ADM)).send({ count: 61 })).status).toBe(400);
    expect((await ctx.api.post('/api/classes/khong-co/lessons/suggest-titles').set(auth(ADM)).send({ count: 2 })).status).toBe(404);
  });
});

describe('học viên tạo lẻ cũng phải đổi mật khẩu tạm', () => {
  it('học viên mới bị buộc đổi mật khẩu ở lần đăng nhập đầu', async () => {
    const created = await ctx.api
      .post('/api/students')
      .set(auth(T))
      .send({ full_name: 'Phạm Thị Lan', email: 'lan.pham@qnu.edu.vn', class_id: 'cls-n5-01' });
    expect(created.status).toBe(201);
    const login = await ctx.api.post('/api/auth/login').send({ email: 'lan.pham@qnu.edu.vn', password: created.body.temporary_password });
    expect(login.status).toBe(200);
    expect(login.body.user.must_change_password).toBe(true);
  });
});
