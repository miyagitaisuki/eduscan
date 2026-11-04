import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext } from '../helpers';
import { classes } from '../../server/db/schema';
import { todayStr } from '../../server/lib/http';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
const day = (offset: number) => todayStr(new Date(Date.now() + offset * 86400000));

beforeAll(async () => {
  ctx = await createTestContext();
  const [t] = await ctx.db.select({ id: classes.teacherId }).from(classes).limit(1);
  const base = { teacherId: t.id, monthlyFee: 999000, room: 'Phòng bí mật', description: 'nội bộ' };
  await ctx.db.insert(classes).values([
    { ...base, id: 'pub-past', name: 'Lớp đã khai giảng', level: 'N5', startDate: day(-10), weekdays: [1, 3] },
    { ...base, id: 'pub-later', name: 'N3 tối', level: 'N3', startDate: day(20), weekdays: [2, 4], lessonStartTime: '19:30', lessonEndTime: '21:00' },
    { ...base, id: 'pub-soon', name: 'N4 tối', level: 'N4', startDate: day(5), weekdays: [5, 1], lessonStartTime: '18:00', lessonEndTime: '19:30' },
    { ...base, id: 'pub-nodate', name: 'Chưa có ngày', level: 'N5', startDate: null, weekdays: [3] },
  ]);
});
afterAll(async () => {
  await ctx.close();
});

describe('GET /api/public/classes', () => {
  it('công khai, chỉ trả lớp sắp khai giảng theo thứ tự ngày, kèm thứ và giờ', async () => {
    const res = await ctx.api.get('/api/public/classes');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('public');
    expect(res.body.next_start_date).toBe(day(5));
    expect(res.body.classes.map((c: any) => c.level)).toEqual(['N4', 'N3']);
    expect(res.body.classes[0]).toEqual({ level: 'N4', start_date: day(5), weekdays: [1, 5], start_time: '18:00', end_time: '19:30' });
    expect(res.body.weekdays).toEqual([1, 2, 4, 5]);
  });

  it('không lộ tên lớp, phòng, học phí, giáo viên', async () => {
    const text = JSON.stringify((await ctx.api.get('/api/public/classes')).body);
    for (const secret of ['bí mật', 'nội bộ', '999000', 'teacher', 'Lớp đã khai giảng', 'N4 tối']) expect(text).not.toContain(secret);
  });

  it('không có lớp sắp khai giảng thì next_start_date là null', async () => {
    const c = await createTestContext();
    await c.db.delete(classes);
    const res = await c.api.get('/api/public/classes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ next_start_date: null, weekdays: [], classes: [] });
    await c.close();
  });
});
