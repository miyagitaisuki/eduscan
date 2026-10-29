import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, ADMIN, STUDENT_AN } from '../helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, A: string, AN: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  A = await ctx.login(ADMIN);
  AN = await ctx.login(STUDENT_AN);
});
afterAll(async () => {
  await ctx.close();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('lớp học lưu đủ các trường giao diện nhập', () => {
  it('tạo lớp lưu ghi chú, phòng học, ngày bắt đầu và trả lại đúng khi tải danh sách', async () => {
    const created = await ctx.api.post('/api/classes').set(auth(T)).send({
      name: 'Lớp thử',
      level: 'N3',
      schedule: 'Thứ 3 - 5 (19:00 - 20:30)',
      description: 'Minna no Nihongo bài 1-10',
      room: '  Phòng 201  ',
      start_date: '2026-11-02',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ description: 'Minna no Nihongo bài 1-10', room: 'Phòng 201', start_date: '2026-11-02', level: 'N3' });

    const list = await ctx.api.get('/api/classes').set(auth(T));
    const found = list.body.find((c: any) => c.id === created.body.id);
    expect(found).toMatchObject({ description: 'Minna no Nihongo bài 1-10', room: 'Phòng 201', start_date: '2026-11-02' });
  });

  it('lớp chưa đặt phòng và ngày bắt đầu trả chuỗi rỗng, không phải null', async () => {
    const res = await ctx.api.post('/api/classes').set(auth(T)).send({ name: 'Lớp trống' });
    expect(res.status).toBe(201);
    expect(res.body.room).toBe('');
    expect(res.body.start_date).toBe('');
    expect(res.body.description).toBe('');
  });

  it('sửa lớp cập nhật phòng và ngày bắt đầu; để trống thì xóa giá trị', async () => {
    const id = (await ctx.api.post('/api/classes').set(auth(T)).send({ name: 'Lớp sửa', room: 'P1', start_date: '2026-10-01' })).body.id;
    const put = await ctx.api.put(`/api/classes/${id}`).set(auth(T)).send({ room: 'P2', start_date: '2026-12-31', description: 'mới' });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ room: 'P2', start_date: '2026-12-31', description: 'mới' });
    const cleared = await ctx.api.put(`/api/classes/${id}`).set(auth(T)).send({ room: '', start_date: '' });
    expect(cleared.body).toMatchObject({ room: '', start_date: '' });
  });

  it('từ chối cấp độ, ngày và phòng học không hợp lệ', async () => {
    const bad = [
      { name: 'x', level: 'N9' },
      { name: 'x', start_date: '02/11/2026' },
      { name: 'x', start_date: '2026-02-31' },
      { name: 'x', room: 'P'.repeat(101) },
    ];
    for (const body of bad) {
      const res = await ctx.api.post('/api/classes').set(auth(T)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const put = await ctx.api.put('/api/classes/cls-n5-01').set(auth(T)).send({ level: 'N0' });
    expect(put.status).toBe(400);
  });

  it('học phí lớp vẫn chỉ admin thấy sau khi thêm trường mới', async () => {
    const asTeacher = await ctx.api.get('/api/classes').set(auth(T));
    expect(asTeacher.body[0].monthly_fee).toBeUndefined();
    const asAdmin = await ctx.api.get('/api/classes').set(auth(A));
    expect(typeof asAdmin.body[0].monthly_fee).toBe('number');
  });
});

describe('học viên có ngày vào lớp và cấp độ lấy từ lớp', () => {
  it('danh sách học viên trả ngày vào lớp từ ghi danh và cấp độ của lớp', async () => {
    const list = await ctx.api.get('/api/students').set(auth(T));
    const an = list.body.find((s: any) => s.email === STUDENT_AN);
    expect(an.join_date).toBe('2026-09-05');
    expect(an.level).toBe('N5');
    expect(an.class_id).toBe('cls-n5-01');
  });

  it('học viên chưa xếp lớp có cấp độ và ngày vào lớp rỗng, không bịa N5', async () => {
    const created = await ctx.api.post('/api/students').set(auth(A)).send({ full_name: 'Chưa lớp' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ class_id: '', level: '', join_date: '', class_name: 'Chưa xếp lớp' });
  });

  it('tạo học viên với ngày vào lớp tùy chọn; phản hồi có đủ thông tin lớp', async () => {
    const res = await ctx.api.post('/api/students').set(auth(T)).send({ full_name: 'Vào lớp', class_id: 'cls-n5-01', join_date: '2026-10-10' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ class_id: 'cls-n5-01', join_date: '2026-10-10', level: 'N5' });
  });

  it('sửa ngày vào lớp khi giữ nguyên lớp; chuyển lớp thì ngày vào lớp mới là hôm nay', async () => {
    const id = (await ctx.api.post('/api/students').set(auth(A)).send({ full_name: 'Đổi ngày', class_id: 'cls-n5-01', join_date: '2026-09-01' })).body.id;
    const same = await ctx.api.put(`/api/students/${id}`).set(auth(A)).send({ class_id: 'cls-n5-01', join_date: '2026-09-15' });
    expect(same.body.join_date).toBe('2026-09-15');
    const only = await ctx.api.put(`/api/students/${id}`).set(auth(A)).send({ join_date: '2026-09-20' });
    expect(only.body.join_date).toBe('2026-09-20');

    const other = (await ctx.api.post('/api/classes').set(auth(A)).send({ name: 'Lớp khác' })).body.id;
    const moved = await ctx.api.put(`/api/students/${id}`).set(auth(A)).send({ class_id: other, join_date: '2026-09-20' });
    expect(moved.body.class_id).toBe(other);
    expect(moved.body.join_date).toBe(new Date().toISOString().split('T')[0]);
  });

  it('từ chối ngày vào lớp sai định dạng', async () => {
    const res = await ctx.api.post('/api/students').set(auth(T)).send({ full_name: 'Sai ngày', class_id: 'cls-n5-01', join_date: '10-10-2026' });
    expect(res.status).toBe(400);
  });
});

describe('bản ghi điểm danh có lớp và ngày', () => {
  it('phản hồi điểm danh có class_id và date của buổi học', async () => {
    const s = (await ctx.api.post('/api/attendance/session').set(auth(T)).send({ class_id: 'cls-n5-01' })).body;
    const res = await ctx.api.post('/api/attendance/checkin').set(auth(AN)).send({ qr_payload: s.session_code });
    expect([200, 201]).toContain(res.status);
    expect(res.body.record).toMatchObject({ class_id: 'cls-n5-01', date: s.session_date });
  });
});

describe('ghi nhận bài nộp thủ công', () => {
  it('nhận nhận xét qua feedback, vẫn nhận comment (tên cũ), và bỏ đánh dấu nộp xóa điểm', async () => {
    const base = { assignment_id: 'asg-1', student_id: 'usr-student-3' };
    const a = await ctx.api.post('/api/submissions/manual').set(auth(T)).send({ ...base, status: 'submitted', score: 7, feedback: 'Khá tốt' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ status: 'submitted', score: 7, feedback: 'Khá tốt' });

    const legacy = await ctx.api.post('/api/submissions/manual').set(auth(T)).send({ ...base, status: 'submitted', score: 7, comment: 'Tên cũ' });
    expect(legacy.body.feedback).toBe('Tên cũ');

    const un = await ctx.api.post('/api/submissions/manual').set(auth(T)).send({ ...base, status: 'unsubmitted', score: null, feedback: 'Tên cũ' });
    expect(un.body).toMatchObject({ status: 'unsubmitted', score: null, feedback: 'Tên cũ' });
  });
});
