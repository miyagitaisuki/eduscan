import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN, TEACHER, STUDENT_AN, SEED_PASSWORD } from '../helpers';
import { hashPassword } from '../../server/lib/security';
import { classes, users } from '../../server/db/schema';
import { eq } from 'drizzle-orm';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let ADM: string, T: string, S: string, OTHER: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
// 2030-01-07 là Thứ Hai: 3 tuần T2-4-6 = 9 buổi
const plan = (over: Record<string, unknown> = {}) => ({
  weekdays: [1, 3, 5],
  start_time: '18:00',
  end_time: '19:30',
  start_date: '2030-01-07',
  weeks: 3,
  ...over,
});
const planUrl = (id: string) => `/api/classes/${id}/lesson-plan`;
const listLessons = async (id: string, token = ADM) => (await ctx.api.get(`/api/classes/${id}/lessons`).set(auth(token))).body as any[];

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
});
afterAll(async () => {
  await ctx.close();
});

describe('sinh và đồng bộ lịch', () => {
  it('xem trước không ghi gì, áp lịch mới tạo buổi và cập nhật chuỗi lịch của lớp', async () => {
    const preview = await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ dry_run: true }));
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ applied: false, total: 9, end_date: '2030-01-27' });
    expect(preview.body.create).toHaveLength(9);
    expect(await listLessons('cls-n5-01')).toHaveLength(0);

    const applied = await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan());
    expect(applied.status).toBe(200);
    expect(applied.body.applied).toBe(true);
    const lessons = await listLessons('cls-n5-01');
    expect(lessons).toHaveLength(9);
    expect(lessons[0]).toMatchObject({ lesson_date: '2030-01-07', start_time: '18:00', end_time: '19:30', title: '', state: 'upcoming' });

    const cls = (await ctx.api.get('/api/classes/cls-n5-01').set(auth(ADM))).body;
    expect(cls).toMatchObject({ weekdays: [1, 3, 5], lesson_start_time: '18:00', end_date: '2030-01-27', schedule: 'Thứ 2 - 4 - 6 (18:00 - 19:30)' });
  });

  it('áp lại cùng lịch thì không tạo trùng', async () => {
    const again = await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan());
    expect(again.body.create).toEqual([]);
    expect(again.body.remove).toEqual([]);
    expect(await listLessons('cls-n5-01')).toHaveLength(9);
  });

  it('lớp đã dùng lịch tự động không cho sửa tay chuỗi lịch', async () => {
    const res = await ctx.api.put('/api/classes/cls-n5-01').set(auth(ADM)).send({ schedule: 'Thứ 7', name: 'N5 đổi tên' });
    expect(res.status).toBe(200);
    expect(res.body.schedule).toBe('Thứ 2 - 4 - 6 (18:00 - 19:30)');
    expect(res.body.name).toBe('N5 đổi tên');
  });

  it('đổi thứ chỉ sinh lại buổi chưa chốt: giữ buổi đã sửa tay và buổi đã điểm danh', async () => {
    const before = await listLessons('cls-n5-01');
    const edited = before.find((l) => l.lesson_date === '2030-01-09')!;
    const patched = await ctx.api.patch(`/api/lessons/${edited.id}`).set(auth(ADM)).send({ title: 'Hiragana hàng A' });
    expect(patched.status).toBe(200);
    expect(patched.body.manually_edited).toBe(true);

    // Điểm danh nhanh cho ngày 2030-01-11 (T6) làm buổi đó được bảo vệ
    const batch = await ctx.api
      .post('/api/attendance/batch')
      .set(auth(ADM))
      .send({ class_id: 'cls-n5-01', date: '2030-01-11', presentStudentIds: ['usr-student-1'] });
    expect(batch.status).toBe(200);

    // Đổi sang chỉ học thứ Hai
    const res = await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ weekdays: [1] }));
    expect(res.status).toBe(200);
    expect(res.body.kept_off_schedule).toBe(2);

    const dates = (await listLessons('cls-n5-01')).map((l) => l.lesson_date);
    expect(dates).toEqual(['2030-01-07', '2030-01-09', '2030-01-11', '2030-01-14', '2030-01-21']);
    const attended = (await listLessons('cls-n5-01')).find((l) => l.lesson_date === '2030-01-11')!;
    expect(attended.has_attendance).toBe(true);
    expect(attended.state).toBe('done');
  });

  it('đổi giờ cập nhật các buổi chưa chốt', async () => {
    const res = await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ weekdays: [1], start_time: '19:00', end_time: '20:30' }));
    expect(res.body.update.length).toBeGreaterThan(0);
    const l = (await listLessons('cls-n5-01')).find((x) => x.lesson_date === '2030-01-14')!;
    expect(l.start_time).toBe('19:00');
    const kept = (await listLessons('cls-n5-01')).find((x) => x.lesson_date === '2030-01-09')!;
    expect(kept.start_time).toBe('18:00');
  });
});

describe('ngày nghỉ chung', () => {
  it('thêm ngày nghỉ bỏ buổi chưa chốt, giữ buổi đã chốt; xóa ngày nghỉ sinh lại', async () => {
    const holiday = await ctx.api
      .post('/api/holidays')
      .set(auth(ADM))
      .send({ name: 'Nghỉ lễ', start_date: '2030-01-14', end_date: '2030-01-22' });
    expect(holiday.status).toBe(201);
    expect(holiday.body.removed_lessons).toBeGreaterThan(0);
    let dates = (await listLessons('cls-n5-01')).map((l) => l.lesson_date);
    expect(dates).not.toContain('2030-01-14');
    expect(dates).not.toContain('2030-01-21');
    expect(dates).toContain('2030-01-09');

    const del = await ctx.api.delete(`/api/holidays/${holiday.body.id}`).set(auth(ADM));
    expect(del.status).toBe(200);
    dates = (await listLessons('cls-n5-01')).map((l) => l.lesson_date);
    expect(dates).toContain('2030-01-14');
    expect(dates).toContain('2030-01-21');
  });

  it('xem trước lịch báo ngày bị bỏ vì nghỉ lễ; chỉ admin được quản lý ngày nghỉ', async () => {
    const h = await ctx.api.post('/api/holidays').set(auth(ADM)).send({ name: 'Tết', start_date: '2030-01-10' });
    const preview = await ctx.api.post(planUrl('cls-n4-01')).set(auth(ADM)).send(plan({ weekdays: [4], dry_run: true }));
    expect(preview.body.skipped_holidays).toEqual([{ date: '2030-01-10', name: 'Tết' }]);
    expect((await ctx.api.post('/api/holidays').set(auth(T)).send({ name: 'x', start_date: '2030-02-01' })).status).toBe(403);
    expect((await ctx.api.delete(`/api/holidays/${h.body.id}`).set(auth(S))).status).toBe(403);
    expect((await ctx.api.get('/api/holidays').set(auth(S))).status).toBe(200);
    await ctx.api.delete(`/api/holidays/${h.body.id}`).set(auth(ADM));
  });

  it('kiểm tra dữ liệu ngày nghỉ', async () => {
    expect((await ctx.api.post('/api/holidays').set(auth(ADM)).send({ name: '', start_date: '2030-02-01' })).status).toBe(400);
    expect((await ctx.api.post('/api/holidays').set(auth(ADM)).send({ name: 'x', start_date: '2030-02-31' })).status).toBe(400);
    expect((await ctx.api.post('/api/holidays').set(auth(ADM)).send({ name: 'x', start_date: '2030-02-05', end_date: '2030-02-01' })).status).toBe(400);
  });
});

describe('trùng giáo viên / phòng', () => {
  it('hai lớp cùng giáo viên, cùng giờ bị báo xung đột và bị chặn khi áp', async () => {
    // cls-n5-01 đang có buổi thứ Hai 19:00-20:30 (xem test trước); lớp N4 cùng giáo viên học T2 20:00-21:00
    const body = plan({ weekdays: [1], start_time: '20:00', end_time: '21:00' });
    const preview = await ctx.api.post(planUrl('cls-n4-01')).set(auth(ADM)).send({ ...body, dry_run: true });
    expect(preview.body.conflicts.length).toBeGreaterThan(0);
    expect(preview.body.conflicts[0]).toMatchObject({ kind: 'teacher', class_id: 'cls-n5-01' });

    const blocked = await ctx.api.post(planUrl('cls-n4-01')).set(auth(ADM)).send(body);
    expect(blocked.status).toBe(409);
    expect(await listLessons('cls-n4-01')).toHaveLength(0);

    const forced = await ctx.api.post(planUrl('cls-n4-01')).set(auth(ADM)).send({ ...body, allow_conflicts: true });
    expect(forced.status).toBe(200);
    expect(await listLessons('cls-n4-01')).not.toHaveLength(0);
  });

  it('giờ liền kề không bị coi là xung đột', async () => {
    const res = await ctx.api
      .post(planUrl('cls-kaiwa-01'))
      .set(auth(ADM))
      .send(plan({ weekdays: [1], start_time: '21:00', end_time: '22:30', dry_run: true }));
    expect(res.body.conflicts).toEqual([]);
  });

  it('trùng phòng (không phân biệt hoa thường) giữa hai giáo viên khác nhau', async () => {
    await ctx.db.update(classes).set({ room: 'Phòng 201', teacherId: 'usr-teacher-2' }).where(eq(classes.id, 'cls-kaiwa-01'));
    await ctx.db.update(classes).set({ room: ' phòng 201 ' }).where(eq(classes.id, 'cls-n5-01'));
    const res = await ctx.api
      .post(planUrl('cls-kaiwa-01'))
      .set(auth(ADM))
      .send(plan({ weekdays: [1], start_time: '19:30', end_time: '21:00', dry_run: true }));
    expect(res.body.conflicts.some((c: any) => c.kind === 'room' && c.class_id === 'cls-n5-01')).toBe(true);
    expect(res.body.conflicts.some((c: any) => c.kind === 'teacher' && c.class_id === 'cls-n5-01')).toBe(false);
  });

  it('chuyển một buổi sang giờ trùng bị từ chối', async () => {
    const n4 = await listLessons('cls-n4-01');
    const l = n4.find((x) => x.lesson_date === '2030-01-14')!;
    const res = await ctx.api.patch(`/api/lessons/${l.id}`).set(auth(ADM)).send({ start_time: '19:00', end_time: '20:00' });
    expect(res.status).toBe(409);
  });
});

describe('quyền xem và sửa', () => {
  it('chỉ admin sinh lịch, sửa, xóa buổi và gán nội dung', async () => {
    const [l] = await listLessons('cls-n5-01');
    expect((await ctx.api.post(planUrl('cls-n5-01')).set(auth(T)).send(plan())).status).toBe(403);
    expect((await ctx.api.patch(`/api/lessons/${l.id}`).set(auth(T)).send({ title: 'x' })).status).toBe(403);
    expect((await ctx.api.delete(`/api/lessons/${l.id}`).set(auth(S))).status).toBe(403);
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/titles').set(auth(T)).send({ titles: ['a'] })).status).toBe(403);
  });

  it('giáo viên chỉ xem lớp mình; học viên chỉ xem lớp mình học', async () => {
    expect((await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(T))).status).toBe(200);
    expect((await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(OTHER))).status).toBe(403);
    expect((await ctx.api.get('/api/classes/cls-n5-01/lessons').set(auth(S))).status).toBe(200);
    expect((await ctx.api.get('/api/classes/cls-n4-01/lessons').set(auth(S))).status).toBe(403);
    expect((await ctx.api.get('/api/classes/khong-co/lessons').set(auth(ADM))).status).toBe(404);
  });

  it('danh sách theo khoảng ngày được lọc theo vai trò', async () => {
    const q = '/api/lessons?from=2030-01-01&to=2030-02-28';
    const admin = (await ctx.api.get(q).set(auth(ADM))).body as any[];
    const student = (await ctx.api.get(q).set(auth(S))).body as any[];
    const other = (await ctx.api.get(q).set(auth(OTHER))).body as any[];
    expect(new Set(admin.map((l) => l.class_id)).size).toBeGreaterThan(1);
    expect(new Set(student.map((l) => l.class_id))).toEqual(new Set(['cls-n5-01']));
    expect(student[0].class_name).toBeTruthy();
    expect(other.every((l) => l.class_id === 'cls-kaiwa-01')).toBe(true);
    expect((await ctx.api.get('/api/lessons?from=2030-01-01').set(auth(ADM))).status).toBe(400);
  });
});

describe('nội dung từng buổi', () => {
  it('dán danh sách nội dung: điền lần lượt vào buổi còn trống, bỏ qua buổi đã hủy', async () => {
    const lessons = await listLessons('cls-n5-01');
    const cancelTarget = lessons.find((l) => l.lesson_date === '2030-01-14')!;
    const cancel = await ctx.api.patch(`/api/lessons/${cancelTarget.id}`).set(auth(ADM)).send({ status: 'cancelled' });
    expect(cancel.body.state).toBe('cancelled');

    const res = await ctx.api
      .post('/api/classes/cls-n5-01/lessons/titles')
      .set(auth(ADM))
      .send({ titles: ['Bài 1', ' ', 'Bài 2', 'Bài 3', 'Bài 4', 'Bài 5', 'Bài 6'] });
    expect(res.status).toBe(200);
    const after = await listLessons('cls-n5-01');
    const titled = after.filter((l) => l.title).map((l) => [l.lesson_date, l.title]);
    // 2030-01-09 đã có "Hiragana hàng A" nên không bị ghi đè; buổi hủy 01-14 bị bỏ qua
    expect(after.find((l) => l.lesson_date === '2030-01-09')!.title).toBe('Hiragana hàng A');
    expect(after.find((l) => l.lesson_date === '2030-01-14')!.title).toBe('');
    expect(titled.map((t) => t[1])).toContain('Bài 1');
  });

  it('kiểm tra dữ liệu', async () => {
    expect((await ctx.api.post('/api/classes/cls-n5-01/lessons/titles').set(auth(ADM)).send({ titles: [] })).status).toBe(400);
    expect((await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ weekdays: [] }))).status).toBe(400);
    expect((await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ start_time: '20:00', end_time: '19:00' }))).status).toBe(400);
    expect((await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ weeks: undefined }))).status).toBe(400);
    expect((await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ weeks: 0 }))).status).toBe(400);
    expect((await ctx.api.post(planUrl('cls-n5-01')).set(auth(ADM)).send(plan({ weeks: undefined, end_date: '2029-01-01' }))).status).toBe(400);
    expect((await ctx.api.patch('/api/lessons/khong-co').set(auth(ADM)).send({ title: 'x' })).status).toBe(404);
  });

  it('xóa lớp kéo theo lịch của lớp', async () => {
    expect((await ctx.api.delete('/api/classes/cls-n4-01').set(auth(ADM))).status).toBe(200);
    const rows = (await ctx.api.get('/api/lessons?from=2030-01-01&to=2030-02-28').set(auth(ADM))).body as any[];
    expect(rows.some((l) => l.class_id === 'cls-n4-01')).toBe(false);
  });
});
