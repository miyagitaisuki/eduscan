import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestContext, TEACHER, STUDENT_AN, ADMIN } from '../helpers';
import { createApp } from '../../server/app';
import type { GoogleGenAI } from '@google/genai';

const DRAFT = {
  score: 7,
  gradeClassification: 'Khá',
  rubricBreakdown: [{ criterion: 'Ngữ pháp', maxScore: 10, earnedScore: 7, comment: 'Tốt' }],
  strengths: ['Đúng cấu trúc'],
  weaknesses: ['Thiếu trợ từ'],
  detailedFeedback: 'Bài làm khá tốt.',
  suggestions: ['Luyện thêm trợ từ'],
};

// Gemini giả: trả về bản nháp cố định, hoặc lỗi khi được yêu cầu
let failNext = false;
const fakeAi = {
  models: {
    generateContent: async () => {
      if (failNext) {
        failNext = false;
        throw new Error('quota exceeded');
      }
      return { text: JSON.stringify(DRAFT) };
    },
  },
} as unknown as GoogleGenAI;

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let api: ReturnType<typeof request>;
let T: string, AN: string, ADM: string;

beforeAll(async () => {
  ctx = await createTestContext();
  // Dùng app có Gemini giả; các test khác vẫn dùng app không có AI
  api = request(createApp({ db: ctx.db, config: ctx.config, ai: fakeAi }));
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  ADM = await ctx.login(ADMIN);
});
afterAll(async () => {
  await ctx.close();
});

describe('bản nháp chấm AI', () => {
  it('giáo viên phụ trách tạo bản nháp, điểm chưa thay đổi', async () => {
    const before = await api.get('/api/submissions').set('Authorization', `Bearer ${T}`);
    const sub = before.body.find((s: any) => s.id === 'sub-1');
    expect(sub).toBeTruthy();

    const res = await api.post('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${T}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.ai_draft.score).toBe(7);
    expect(res.body.ai_draft.detailedFeedback).toBe('Bài làm khá tốt.');
    expect(res.body.score).toBe(sub.score);
    expect(res.body.graded_by_ai).toBe(sub.graded_by_ai);
  });

  it('học viên không tạo được bản nháp', async () => {
    const res = await api.post('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${AN}`).send({});
    expect(res.status).toBe(403);
  });

  it('lỗi Gemini trả 503 và không lưu bản nháp', async () => {
    await api.delete('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${T}`);
    failNext = true;
    const res = await api.post('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${T}`).send({});
    expect(res.status).toBe(503);
    expect(res.body.aiFallback).toBe(false);
    const list = await api.get('/api/submissions').set('Authorization', `Bearer ${T}`);
    expect(list.body.find((s: any) => s.id === 'sub-1').ai_draft).toBeNull();
  });

  it('duyệt bản nháp qua route chấm điểm: lưu điểm, đánh dấu do AI, xóa nháp', async () => {
    await api.post('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${T}`).send({});
    const res = await api
      .put('/api/submissions/sub-1/grade')
      .set('Authorization', `Bearer ${T}`)
      .send({ score: 7, feedback: 'Bài làm khá tốt.', graded_by_ai: true });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(7);
    expect(res.body.graded_by_ai).toBe(true);
    expect(res.body.ai_draft).toBeNull();
  });

  it('bỏ bản nháp không đổi điểm', async () => {
    await api.post('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${T}`).send({});
    const res = await api.delete('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${T}`);
    expect(res.status).toBe(200);
    expect(res.body.ai_draft).toBeNull();
    expect(res.body.score).toBe(7);
  });

  it('admin tạo được bản nháp cho lớp bất kỳ', async () => {
    const res = await api.post('/api/ai/drafts/sub-1').set('Authorization', `Bearer ${ADM}`).send({});
    expect(res.status).toBe(200);
  });
});
