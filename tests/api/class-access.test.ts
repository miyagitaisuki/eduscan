import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN, TEACHER, SEED_PASSWORD } from '../helpers';
import { hashPassword } from '../../server/lib/security';
import { users } from '../../server/db/schema';

// Giáo viên thứ hai: không phụ trách lớp nào trong dữ liệu demo
const OTHER_TEACHER = 'other.teacher@eduscan.edu.vn';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, OTHER: string, ADM: string;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.db.insert(users).values({
    id: 'usr-teacher-2',
    email: OTHER_TEACHER,
    passwordHash: hashPassword(SEED_PASSWORD),
    fullName: 'GV khác',
    role: 'teacher',
    status: 'active',
  });
  T = await ctx.login(TEACHER);
  OTHER = await ctx.login(OTHER_TEACHER);
  ADM = await ctx.login(ADMIN);
});
afterAll(async () => {
  await ctx.close();
});

describe('phân quyền theo lớp', () => {
  it('giáo viên không phụ trách không sửa, xóa được lớp của người khác', async () => {
    const put = await ctx.api.put('/api/classes/cls-n5-01').set('Authorization', `Bearer ${OTHER}`).send({ name: 'x' });
    expect(put.status).toBe(403);
    const del = await ctx.api.delete('/api/classes/cls-n5-01').set('Authorization', `Bearer ${OTHER}`);
    expect(del.status).toBe(403);
  });

  it('giáo viên phụ trách vẫn sửa được lớp của mình', async () => {
    const res = await ctx.api.put('/api/classes/cls-n5-01').set('Authorization', `Bearer ${T}`).send({ name: 'N5 Sơ cấp 1 (Minna no Nihongo)' });
    expect(res.status).toBe(200);
  });

  it('giáo viên không phụ trách không mở được điểm danh hay điểm danh hộ cho lớp khác', async () => {
    const open = await ctx.api.post('/api/attendance/session').set('Authorization', `Bearer ${OTHER}`).send({ class_id: 'cls-n5-01' });
    expect(open.status).toBe(403);
    const batch = await ctx.api
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${OTHER}`)
      .send({ class_id: 'cls-n5-01', date: '2026-10-27', presentStudentIds: [] });
    expect(batch.status).toBe(403);
  });

  it('giáo viên phụ trách mở được điểm danh cho lớp mình', async () => {
    const res = await ctx.api.post('/api/attendance/session').set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-n5-01' });
    expect(res.status).toBe(201);
  });

  it('giáo viên không phụ trách không thấy học viên, bài tập, học phí của lớp khác', async () => {
    const students = await ctx.api.get('/api/students').set('Authorization', `Bearer ${OTHER}`);
    expect(students.status).toBe(200);
    expect(students.body).toEqual([]);
    const asg = await ctx.api.get('/api/assignments').set('Authorization', `Bearer ${OTHER}`);
    expect(asg.body).toEqual([]);
    const tuition = await ctx.api.get('/api/tuition').set('Authorization', `Bearer ${OTHER}`);
    expect(tuition.body).toEqual([]);
  });

  it('giáo viên không phụ trách không giao bài hay chấm bài cho lớp khác', async () => {
    const post = await ctx.api
      .post('/api/assignments')
      .set('Authorization', `Bearer ${OTHER}`)
      .send({ class_id: 'cls-n5-01', title: 'Bài lạ' });
    expect(post.status).toBe(403);
    const grade = await ctx.api.put('/api/submissions/sub-1/grade').set('Authorization', `Bearer ${OTHER}`).send({ score: 9 });
    expect(grade.status).toBe(403);
  });

  it('giáo viên không phụ trách không xếp học viên hay thu học phí của lớp khác', async () => {
    const pay = await ctx.api
      .post('/api/tuition/payment')
      .set('Authorization', `Bearer ${OTHER}`)
      .send({ student_id: 'usr-student-1', amount: 800000 });
    expect(pay.status).toBe(403);
  });

  it('giáo viên tạo lớp mới sẽ phụ trách lớp đó', async () => {
    const created = await ctx.api.post('/api/classes').set('Authorization', `Bearer ${OTHER}`).send({ name: 'Lớp mới của GV khác' });
    expect(created.status).toBe(201);
    const put = await ctx.api.put(`/api/classes/${created.body.id}`).set('Authorization', `Bearer ${OTHER}`).send({ name: 'Đã sửa' });
    expect(put.status).toBe(200);
  });

  it('admin vẫn thao tác được trên mọi lớp', async () => {
    expect((await ctx.api.get('/api/students').set('Authorization', `Bearer ${ADM}`)).body.length).toBeGreaterThan(0);
    expect((await ctx.api.put('/api/classes/cls-n5-01').set('Authorization', `Bearer ${ADM}`).send({ name: 'Admin sửa' })).status).toBe(200);
  });
});
