import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, ADMIN } from '../helpers';
import { eq } from 'drizzle-orm';
import { tuitionRecords, submissions } from '../../server/db/schema';

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
});
