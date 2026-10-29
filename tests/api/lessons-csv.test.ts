import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN, TEACHER, STUDENT_AN, SEED_PASSWORD } from '../helpers';
import { hashPassword } from '../../server/lib/security';
import { users } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let ADM: string, T: string, S: string, OTHER: string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.db.insert(users).values({
    id: 'usr-teacher-2',
    email: 'other.teacher@eduscan.edu.vn',
    passwordHash: hashPassword(SEED_PASSWORD),
    fullName: 'GV khác',
    role: 'teacher',
    status: 'active',
  });
  ADM = await ctx.login(ADMIN);
  T = await ctx.login(TEACHER);
  S = await ctx.login(STUDENT_AN);
  OTHER = await ctx.login('other.teacher@eduscan.edu.vn');
  // Lịch lớp N5: T2-T4-T6 từ 2030-01-07, 3 tuần
  await ctx.api
    .post('/api/classes/cls-n5-01/lesson-plan')
    .set(auth(ADM))
    .send({ weekdays: [1, 3, 5], start_time: '18:00', end_time: '19:30', start_date: '2030-01-07', weeks: 3 });
});
afterAll(async () => {
  await ctx.close();
});

describe('xuất CSV nội dung buổi học', () => {
  it('giáo viên phụ trách xuất được, có BOM, đủ cột và đúng thứ trong tuần', async () => {
    const res = await ctx.api.get('/api/classes/cls-n5-01/lessons/export.csv').set(auth(T));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const lines = res.text.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('Ngày,Thứ,Giờ bắt đầu,Giờ kết thúc,Trạng thái,Nội dung,Ghi chú');
    expect(lines[1]).toBe('2030-01-07,Thứ Hai,18:00,19:30,,,');
    expect(lines).toHaveLength(10);
  });

  it('giáo viên khác và học viên không xuất được', async () => {
    expect((await ctx.api.get('/api/classes/cls-n5-01/lessons/export.csv').set(auth(OTHER))).status).toBe(403);
    expect((await ctx.api.get('/api/classes/cls-n5-01/lessons/export.csv').set(auth(S))).status).toBe(403);
  });
});

describe('nhập CSV nội dung buổi học', () => {
  const row = (over: Record<string, unknown> = {}) => ({ line: 2, lesson_date: '2030-01-07', title: 'Hiragana A', notes: '', ...over });

  it('kiểm tra thử báo từng dòng và không ghi gì', async () => {
    const before = await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(T));
    const res = await ctx.api
      .post('/api/classes/cls-n5-01/lessons/import-csv')
      .set(auth(T))
      .send({
        dry_run: true,
        rows: [
          row(),
          row({ line: 3, lesson_date: '2030-01-08', title: 'Ngày không học' }),
          row({ line: 4, lesson_date: '2030-02-30' }),
          row({ line: 5, lesson_date: '2030-01-09', title: '', notes: '' }),
          row({ line: 6, lesson_date: '2030-01-07', title: 'trùng' }),
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dry_run: true, valid: 1, skipped: 1, invalid: 3 });
    const byLine = Object.fromEntries(res.body.results.map((r: any) => [r.line, r]));
    expect(byLine[3].errors[0]).toContain('không có buổi học');
    expect(byLine[4].errors[0]).toContain('YYYY-MM-DD');
    expect(byLine[5].status).toBe('skip');
    expect(byLine[6].errors[0]).toContain('nhiều lần');
    expect(await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(T))).toMatchObject({ body: before.body });
  });

  it('ghi nội dung và ghi chú, buổi được đánh dấu đã sửa tay', async () => {
    const res = await ctx.api
      .post('/api/classes/cls-n5-01/lessons/import-csv')
      .set(auth(T))
      .send({ rows: [row({ notes: 'Mang bút chì' }), row({ line: 3, lesson_date: '2030-01-09', title: 'Hiragana KA' })] });
    expect(res.body).toMatchObject({ dry_run: false, updated: 2, invalid: 0 });
    const lessons = (await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(T))).body as any[];
    const first = lessons.find((l) => l.lesson_date === '2030-01-07');
    expect(first).toMatchObject({ title: 'Hiragana A', notes: 'Mang bút chì', manually_edited: true });
    expect(lessons.find((l) => l.lesson_date === '2030-01-09').title).toBe('Hiragana KA');
  });

  it('dòng không ghi tên nội dung giữ nguyên tên cũ', async () => {
    await ctx.api.post('/api/classes/cls-n5-01/lessons/import-csv').set(auth(T)).send({ rows: [row({ title: '', notes: 'Ôn tập' })] });
    const first = ((await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(T))).body as any[]).find((l) => l.lesson_date === '2030-01-07');
    expect(first).toMatchObject({ title: 'Hiragana A', notes: 'Ôn tập' });
  });

  it('giáo viên khác không nhập được; học viên không nhập được', async () => {
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/import-csv').set(auth(OTHER)).send({ rows: [row()] })).status).toBe(403);
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/import-csv').set(auth(S)).send({ rows: [row()] })).status).toBe(403);
  });

  it('xuất rồi nhập lại chính file đó không làm thay đổi gì (file mẫu dùng được)', async () => {
    const exported = await ctx.api.get('/api/classes/cls-n5-01/lessons/export.csv').set(auth(T));
    const { parseCsv } = await import('../../src/shared/utils/csv');
    const table = parseCsv(exported.text);
    const rows = table.slice(1).map((cells, i) => ({ line: i + 2, lesson_date: cells[0], title: cells[5], notes: cells[6] }));
    const res = await ctx.api.post('/api/classes/cls-n5-01/lessons/import-csv').set(auth(T)).send({ dry_run: true, rows });
    expect(res.body.invalid).toBe(0);
  });
});
