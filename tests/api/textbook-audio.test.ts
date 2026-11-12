import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN } from '../helpers';
import { LESSON_FILE } from '../fixtures/textbookLesson';
import { bookFolder } from '../../server/lib/textbookAudio';

// MP3 tối thiểu: header ID3 + vài byte
const MP3_B64 = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00fakeaudio').toString('base64');
const BOOK = 'Cuốn 8';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string;
let asgId: string;
const calls: { url: string; method: string }[] = [];

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.includes('/storage/v1/object/sign/')) {
        const path = url.split('/storage/v1/object/sign/textbook-audio/')[1];
        return new Response(JSON.stringify({ signedURL: `/object/sign/textbook-audio/${path}?token=t` }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  await ctx.api.post('/api/textbook/import').set(auth(T)).send({ book: BOOK, data: LESSON_FILE });
  const lessons = (await ctx.api.get('/api/textbook/lessons').set(auth(T))).body;
  const r = await ctx.api.post('/api/assignments').set(auth(T)).send({
    class_id: 'cls-n5-01',
    title: 'Bài 1',
    kind: 'textbook',
    textbook_lesson_id: lessons[0].id,
    deadline: new Date(Date.now() + 86400000).toISOString(),
  });
  asgId = r.body.id;
});
afterAll(async () => {
  await ctx.close();
});

describe('âm thanh bài giáo trình', () => {
  it('bài giao có kèm hội thoại; học viên chưa thấy link khi chưa có file', async () => {
    const res = await ctx.api.get(`/api/assignments/${asgId}`).set(auth(AN));
    expect(res.body.payload.dialogues).toHaveLength(1);
    expect(res.body.payload.dialogues[0].audio_url).toBeNull();
    expect(res.body.payload.exercises[0].audio_url).toBeNull();
  });

  it('giáo viên tải mp3 + srt; học viên nhận link ký tạm cho đúng mã ♪', async () => {
    const up = await ctx.api
      .post('/api/textbook/audio')
      .set(auth(T))
      .send({ book: BOOK, code: '1-01', mp3_base64: MP3_B64, srt_text: '1\n00:00:00,000 --> 00:00:01,000\nこんにちは\n' });
    expect(up.status).toBe(200);
    expect(up.body).toEqual({ book: BOOK, code: '1-01', has_srt: true });
    const folder = bookFolder(BOOK);
    expect(calls.some((c) => c.url.endsWith(`/storage/v1/object/textbook-audio/${folder}/1-01.mp3`) && c.method === 'POST')).toBe(true);
    expect(calls.some((c) => c.url.endsWith(`/${folder}/1-01.srt`))).toBe(true);

    const res = await ctx.api.get(`/api/assignments/${asgId}`).set(auth(AN));
    expect(res.body.payload.dialogues[0].audio_url).toContain('/storage/v1/object/sign/textbook-audio/');
    expect(res.body.payload.dialogues[0].audio_url).toContain(`${folder}/1-01.mp3`);
    expect(res.body.payload.exercises[0].audio_url).toBeNull(); // 1-04 chưa có file
  });

  it('danh sách mã đã có file cho giáo viên', async () => {
    const list = await ctx.api.get(`/api/textbook/audio?book=${encodeURIComponent(BOOK)}`).set(auth(T));
    expect(list.body.map((x: any) => x.code)).toEqual(['1-01']);
    expect(list.body[0].has_srt).toBe(true);
  });

  it('từ chối mã sai, tệp không phải mp3, và học viên tải lên', async () => {
    const bad = (body: object) => ctx.api.post('/api/textbook/audio').set(auth(T)).send(body);
    expect((await bad({ book: BOOK, code: '../x', mp3_base64: MP3_B64 })).status).toBe(400);
    expect((await bad({ book: BOOK, code: '1-02', mp3_base64: Buffer.from('hello world').toString('base64') })).status).toBe(400);
    expect(
      (await ctx.api.post('/api/textbook/audio').set(auth(AN)).send({ book: BOOK, code: '1-02', mp3_base64: MP3_B64 })).status
    ).toBe(403);
  });

  it('upload trùng mã thì thay file (upsert), không tạo hàng mới', async () => {
    await ctx.api.post('/api/textbook/audio').set(auth(T)).send({ book: BOOK, code: '1-01', mp3_base64: MP3_B64, srt_text: null });
    const list = await ctx.api.get(`/api/textbook/audio?book=${encodeURIComponent(BOOK)}`).set(auth(T));
    expect(list.body).toHaveLength(1);
    expect(list.body[0].has_srt).toBe(false);
  });

  it('mã đã ký nhận sau hạn nộp vẫn không lộ đáp án', async () => {
    const res = await ctx.api.get(`/api/assignments/${asgId}`).set(auth(AN));
    expect(res.body.payload.exercises[0].items[0].answer).toBeUndefined();
  });
});
