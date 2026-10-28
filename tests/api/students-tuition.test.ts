import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN } from '../helpers';
import { eq } from 'drizzle-orm';
import { enrollments, tuitionRecords } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
});
afterAll(async () => {
  await ctx.close();
});

describe('học viên và học phí', () => {
  it('tạo học viên kèm lớp sẽ tạo ghi danh và học phí chưa đóng; mật khẩu tạm chỉ có trong phản hồi này', async () => {
    const res = await ctx.api.post('/api/students').set('Authorization', `Bearer ${T}`).send({
      full_name: 'Học viên mới',
      email: 'moi@example.com',
      class_id: 'cls-n5-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.temporary_password).toBeTruthy();
    expect(res.body.password_hash).toBeUndefined();

    const list = await ctx.api.get('/api/students').set('Authorization', `Bearer ${T}`);
    const created = list.body.find((s: any) => s.email === 'moi@example.com');
    expect(created.class_name).toBe('N5 Sơ cấp 1 (Minna no Nihongo)');

    const tuition = await ctx.db.select().from(tuitionRecords).where(eq(tuitionRecords.studentId, created.id));
    expect(tuition.length).toBe(1);
    expect(tuition[0].status).toBe('unpaid');
    expect(tuition[0].amount).toBe(800000);

    // Mật khẩu tạm đăng nhập được
    const login = await ctx.api.post('/api/auth/login').send({ email: 'moi@example.com', password: res.body.temporary_password });
    expect(login.status).toBe(200);
  });

  it('chuyển lớp: hủy ghi danh cũ (giữ lịch sử) và bật ghi danh lớp mới', async () => {
    const anToken = await ctx.login(STUDENT_AN);
    const profile = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${anToken}`);
    await ctx.api.put(`/api/students/${profile.body.id}`).set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-kaiwa-01' });
    const rows = await ctx.db.select().from(enrollments).where(eq(enrollments.studentId, profile.body.id));
    expect(rows.find((r) => r.classId === 'cls-n5-01')?.status).toBe('dropped');
    expect(rows.find((r) => r.classId === 'cls-kaiwa-01')?.status).toBe('active');
    // Chuyển lại: không tạo ghi danh trùng
    await ctx.api.put(`/api/students/${profile.body.id}`).set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-n5-01' });
    const after = await ctx.db.select().from(enrollments).where(eq(enrollments.studentId, profile.body.id));
    expect(after.filter((r) => r.classId === 'cls-n5-01').length).toBe(1);
    expect(after.filter((r) => r.status === 'active').length).toBe(1);
  });

  it('xóa học viên chỉ xóa được học viên, không xóa được giáo viên qua route này', async () => {
    // Giáo viên chỉ quản lý học viên trong lớp mình phụ trách, nên xếp học viên vào lớp đó
    const created = await ctx.api
      .post('/api/students')
      .set('Authorization', `Bearer ${T}`)
      .send({ full_name: 'Tạm', email: 'tam@example.com', class_id: 'cls-n5-01' });
    const del = await ctx.api.delete(`/api/students/${created.body.id}`).set('Authorization', `Bearer ${T}`);
    expect(del.status).toBe(200);
    const teacherDel = await ctx.api.delete('/api/students/usr-teacher-1').set('Authorization', `Bearer ${T}`);
    // Giáo viên không phải học viên trong lớp của mình nên bị từ chối (403)
    expect(teacherDel.status).toBe(403);
  });

  it('ghi nhận thu học phí: cập nhật hồ sơ cùng tháng, không tạo trùng', async () => {
    const list = await ctx.api.get('/api/tuition').set('Authorization', `Bearer ${T}`);
    const unpaid = list.body.find((t: any) => t.status === 'unpaid');
    const res = await ctx.api.post('/api/tuition/payment').set('Authorization', `Bearer ${T}`).send({
      student_id: unpaid.student_id,
      month: unpaid.month,
      amount: unpaid.amount,
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(unpaid.id);
    expect(res.body.status).toBe('paid');
    const rows = await ctx.db.select().from(tuitionRecords).where(eq(tuitionRecords.studentId, unpaid.student_id));
    expect(rows.filter((r) => r.month === unpaid.month).length).toBe(1);
  });

  it('cập nhật học phí sang đã đóng tự ghi ngày đóng và số tiền đã đóng', async () => {
    const list = await ctx.api.get('/api/tuition').set('Authorization', `Bearer ${T}`);
    const t = list.body[0];
    const res = await ctx.api.put(`/api/tuition/${t.id}`).set('Authorization', `Bearer ${T}`).send({ status: 'paid' });
    expect(res.body.status).toBe('paid');
    expect(res.body.paid_date).toBeTruthy();
    expect(res.body.paid_amount).toBe(t.amount);
  });

  it('danh sách học viên có tên lớp cho mọi học viên', async () => {
    const list = await ctx.api.get('/api/students').set('Authorization', `Bearer ${T}`);
    expect(list.body.every((s: any) => typeof s.class_name === 'string')).toBe(true);
  });
});
