import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, ADMIN, SEED_PASSWORD } from '../helpers';
import { hashPassword } from '../../server/lib/security';
import { eq } from 'drizzle-orm';
import { tuitionRecords, submissions, users, notifications } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string;
let A: string;
let S: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  A = await ctx.login(ADMIN);
  S = await ctx.login(STUDENT_AN);
});
afterAll(async () => {
  await ctx.close();
});

describe('sửa lỗi logic', () => {
  it('sửa học viên: null không thành "null", trạng thái và họ tên được kiểm tra', async () => {
    const list = await ctx.api.get('/api/students').set('Authorization', `Bearer ${T}`);
    const id = list.body[0].id;
    const ok = await ctx.api.put(`/api/students/${id}`).set('Authorization', `Bearer ${T}`).send({ phone: null });
    expect(ok.status).toBe(200);
    expect(ok.body.phone).toBe('');
    expect((await ctx.api.put(`/api/students/${id}`).set('Authorization', `Bearer ${T}`).send({ status: 'bogus' })).status).toBe(400);
    expect((await ctx.api.put(`/api/students/${id}`).set('Authorization', `Bearer ${T}`).send({ full_name: '  ' })).status).toBe(400);
  });

  it('thu học phí: thu thiếu là partial, hồ sơ đã đóng đủ không bị ghi đè', async () => {
    const list = await ctx.api.get('/api/students').set('Authorization', `Bearer ${T}`);
    const id = list.body[0].id;
    await ctx.db.delete(tuitionRecords).where(eq(tuitionRecords.studentId, id));
    await ctx.db.insert(tuitionRecords).values({ id: 'tui-x', studentId: id, month: '01/2030', amount: 800000, status: 'unpaid' });
    const part = await ctx.api.post('/api/tuition/payment').set('Authorization', `Bearer ${A}`).send({ student_id: id, month: '01/2030', amount: 300000 });
    expect(part.body.status).toBe('partial');
    expect(part.body.paid_amount).toBe(300000);
    const full = await ctx.api.post('/api/tuition/payment').set('Authorization', `Bearer ${A}`).send({ student_id: id, month: '01/2030', amount: 800000 });
    expect(full.body.status).toBe('paid');
    await ctx.db.update(tuitionRecords).set({ notes: 'ghi chú cũ', paidDate: '2030-01-05' }).where(eq(tuitionRecords.id, 'tui-x'));
    const again = await ctx.api.post('/api/tuition/payment').set('Authorization', `Bearer ${A}`).send({ student_id: id, month: '01/2030' });
    expect(again.body.notes).toBe('ghi chú cũ');
    expect(again.body.paid_date).toBe('2030-01-05');
  });

  it('nộp lại bài xóa bản nháp AI và kết quả chấm cũ', async () => {
    const asg = await ctx.api.get('/api/assignments').set('Authorization', `Bearer ${S}`);
    const assignmentId = asg.body.find((a: any) => a.kind !== 'minna').id;
    const first = await ctx.api.post('/api/submissions').set('Authorization', `Bearer ${S}`).send({ assignment_id: assignmentId, content: 'v1' });
    await ctx.db.update(submissions).set({ aiDraft: { score: 9 }, aiDraftAt: new Date(), strengths: ['a'] }).where(eq(submissions.id, first.body.id));
    const second = await ctx.api.post('/api/submissions').set('Authorization', `Bearer ${S}`).send({ assignment_id: assignmentId, content: 'v2' });
    expect(second.body.ai_draft).toBeNull();
    expect(second.body.strengths).toBeNull();
  });

  it('đổi tháng học phí sang tháng đã có hồ sơ trả 409, không phải 500', async () => {
    const list = await ctx.api.get('/api/students').set('Authorization', `Bearer ${T}`);
    const id = list.body[0].id;
    await ctx.db.delete(tuitionRecords).where(eq(tuitionRecords.studentId, id));
    await ctx.db.insert(tuitionRecords).values([
      { id: 'tui-m1', studentId: id, month: '02/2031', amount: 1, status: 'unpaid' },
      { id: 'tui-m2', studentId: id, month: '03/2031', amount: 1, status: 'unpaid' },
    ]);
    const res = await ctx.api.put('/api/tuition/tui-m2').set('Authorization', `Bearer ${A}`).send({ month: '02/2031' });
    expect(res.status).toBe(409);
  });

  it('nhập CSV: email của dòng lỗi không chặn dòng sau; mã học viên tự sinh không trùng', async () => {
    const rows = [
      { full_name: '', email: 'chung@example.com', class_id: 'cls-n5-01' },
      { full_name: 'Người hợp lệ', email: 'chung@example.com' },
      { full_name: 'Người hai' },
    ];
    const res = await ctx.api
      .post('/api/students/import')
      .set('Authorization', `Bearer ${T}`)
      .send({ class_id: 'cls-n5-01', rows });
    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe('error');
    expect(res.body.results[1].status).toBe('ok');
    const all = await ctx.db.select({ code: users.studentCode }).from(users);
    const codes = all.map((u) => u.code).filter((c): c is string => !!c && c.startsWith('STU'));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('học viên xem được học phí của chính mình nhưng không gọi được danh sách học viên', async () => {
    // Giao diện học viên phải tải /api/tuition và không được gọi /api/students (403 làm banner báo lỗi tải)
    const profile = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${S}`);
    await ctx.db.insert(tuitionRecords).values({ id: 'tui-own', studentId: profile.body.id, month: '04/2031', amount: 900000, status: 'unpaid' });
    const mine = await ctx.api.get('/api/tuition').set('Authorization', `Bearer ${S}`);
    expect(mine.status).toBe(200);
    expect(mine.body.every((t: any) => t.student_id === profile.body.id)).toBe(true);
    expect(mine.body.some((t: any) => t.id === 'tui-own')).toBe(true);
    expect((await ctx.api.get('/api/students').set('Authorization', `Bearer ${S}`)).status).toBe(403);
  });
});

describe('xếp học viên chưa có lớp', () => {
  it('giáo viên thấy học viên chưa xếp lớp và chỉ được xếp vào lớp mình phụ trách', async () => {
    const created = await ctx.api.post('/api/students').set('Authorization', `Bearer ${A}`).send({ full_name: 'Chưa có lớp', email: 'chualop@example.com' });
    expect(created.status).toBe(201);
    const list = await ctx.api.get('/api/students').set('Authorization', `Bearer ${T}`);
    expect(list.body.some((s: any) => s.id === created.body.id)).toBe(true);
    // Không được sửa thông tin khác của học viên chưa xếp lớp
    const edit = await ctx.api.put(`/api/students/${created.body.id}`).set('Authorization', `Bearer ${T}`).send({ full_name: 'Đổi tên' });
    expect(edit.status).toBe(403);
    const assign = await ctx.api.put(`/api/students/${created.body.id}`).set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-n5-01' });
    expect(assign.status).toBe(200);
    expect(assign.body.class_id).toBe('cls-n5-01');
  });
});

describe('giáo viên xem và chấm bài mọi lớp; thông báo khi xếp lớp', () => {
  it('giáo viên không phụ trách xem được bài tập, bài nộp và danh sách học viên của lớp khác', async () => {
    // Giáo viên thứ hai không phụ trách lớp nào
    await ctx.db.insert(users).values({
      id: 'usr-teacher-x',
      email: 'gv.khac@eduscan.edu.vn',
      passwordHash: hashPassword(SEED_PASSWORD),
      fullName: 'GV khác',
      role: 'teacher',
      status: 'active',
    });
    const token = await ctx.login('gv.khac@eduscan.edu.vn');
    const asg = await ctx.api.get('/api/assignments').set('Authorization', `Bearer ${token}`);
    expect(asg.body.length).toBeGreaterThan(0);
    const subs = await ctx.api.get('/api/submissions').set('Authorization', `Bearer ${token}`);
    expect(subs.status).toBe(200);
    const roster = await ctx.api.get('/api/classes/cls-n5-01/roster').set('Authorization', `Bearer ${token}`);
    expect(roster.status).toBe(200);
    expect(roster.body[0]).not.toHaveProperty('phone');
    expect((await ctx.api.get('/api/classes/cls-n5-01/roster').set('Authorization', `Bearer ${S}`)).status).toBe(403);
  });

  it('xếp học viên vào lớp gửi thông báo cho học viên', async () => {
    const created = await ctx.api.post('/api/students').set('Authorization', `Bearer ${A}`).send({ full_name: 'Thông báo lớp', email: 'tbl@example.com' });
    await ctx.api.put(`/api/students/${created.body.id}`).set('Authorization', `Bearer ${A}`).send({ class_id: 'cls-n5-01' });
    const rows = await ctx.db.select().from(notifications).where(eq(notifications.userId, created.body.id));
    expect(rows.some((n) => n.type === 'class')).toBe(true);
  });
});
