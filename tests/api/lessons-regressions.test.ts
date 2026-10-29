import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN, TEACHER } from '../helpers';
import { todayStr } from '../../server/lib/http';
import { addDays } from '../../server/lib/lessons';

// Lỗi tìm thấy khi QC PR lịch giảng: giữ lại để không quay lại
let ctx: Awaited<ReturnType<typeof createTestContext>>;
let ADM: string, T: string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const lessonDates = async () =>
  ((await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(ADM))).body as any[]).map((l) => l.lesson_date as string);

beforeAll(async () => {
  ctx = await createTestContext();
  ADM = await ctx.login(ADMIN);
  T = await ctx.login(TEACHER);
});
afterAll(async () => {
  await ctx.close();
});

describe('đổi lịch giữa khóa', () => {
  const today = todayStr();
  const start = addDays(today, -21);
  const plan = (weekdays: number[]) => ({ weekdays, start_time: '18:00', end_time: '19:30', start_date: start, weeks: 6 });

  it('lần thiết lập đầu tạo cả buổi đã qua để đủ lịch sử', async () => {
    await ctx.api.post('/api/classes/cls-n5-01/lesson-plan').set(auth(ADM)).send(plan([1]));
    expect((await lessonDates()).some((d) => d < today)).toBe(true);
  });

  it('thêm thứ học giữa khóa không sinh buổi trong quá khứ', async () => {
    const before = await lessonDates();
    const preview = await ctx.api.post('/api/classes/cls-n5-01/lesson-plan').set(auth(ADM)).send({ ...plan([1, 3]), dry_run: true });
    expect(preview.body.create.every((d: string) => d > today)).toBe(true);
    await ctx.api.post('/api/classes/cls-n5-01/lesson-plan').set(auth(ADM)).send(plan([1, 3]));
    const added = (await lessonDates()).filter((d) => !before.includes(d));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((d) => d > today)).toBe(true);
  });

  it('form lớp không đổi được ngày bắt đầu của lớp đã có lịch lặp; ngày nghỉ không liên quan không làm đổi lịch', async () => {
    const before = await lessonDates();
    const res = await ctx.api.put('/api/classes/cls-n5-01').set(auth(ADM)).send({ start_date: addDays(today, 30), name: 'N5 đổi tên' });
    expect(res.status).toBe(200);
    expect(res.body.start_date).toBe(start);
    await ctx.api.post('/api/holidays').set(auth(ADM)).send({ name: 'Xa', start_date: '2099-01-01' });
    expect(await lessonDates()).toEqual(before);
  });
});

describe('giáo viên nhập học viên', () => {
  it('phải chọn lớp, nếu không học viên sẽ biến khỏi danh sách của chính giáo viên', async () => {
    const res = await ctx.api
      .post('/api/students/import')
      .set(auth(T))
      .send({ dry_run: true, rows: [{ line: 2, full_name: 'Không lớp', email: 'nolop@x.vn' }] });
    expect(res.body.results[0].errors[0]).toContain('Chọn lớp');
    const ok = await ctx.api
      .post('/api/students/import')
      .set(auth(T))
      .send({ dry_run: true, class_id: 'cls-n5-01', rows: [{ line: 2, full_name: 'Có lớp', email: 'colop@x.vn' }] });
    expect(ok.body.valid).toBe(1);
  });

  it('admin vẫn được tạo học viên chưa xếp lớp', async () => {
    const res = await ctx.api
      .post('/api/students/import')
      .set(auth(ADM))
      .send({ dry_run: true, rows: [{ line: 2, full_name: 'Chờ xếp lớp', email: 'cho@x.vn' }] });
    expect(res.body.valid).toBe(1);
  });
});
