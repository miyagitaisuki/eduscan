import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN } from '../helpers';
import { eq } from 'drizzle-orm';
import { tuitionRecords, users } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
});
afterAll(async () => {
  await ctx.close();
});

describe('học phí riêng theo từng học viên', () => {
  it('đặt học phí riêng cho học viên, trả về trong danh sách và không đổi học phí lớp', async () => {
    const anToken = await ctx.login(STUDENT_AN);
    const profile = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${anToken}`);

    const res = await ctx.api
      .put(`/api/students/${profile.body.id}`)
      .set('Authorization', `Bearer ${T}`)
      .send({ tuition_fee: 650000 });
    expect(res.status).toBe(200);
    expect(res.body.tuition_fee).toBe(650000);

    const list = await ctx.api.get('/api/students').set('Authorization', `Bearer ${T}`);
    expect(list.body.find((s: any) => s.id === profile.body.id).tuition_fee).toBe(650000);

    const classes = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${T}`);
    expect(classes.body.find((c: any) => c.id === 'cls-n5-01').monthly_fee).toBe(800000);
  });

  it('xóa học phí riêng (null) thì quay về học phí của lớp', async () => {
    const anToken = await ctx.login(STUDENT_AN);
    const profile = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${anToken}`);

    const res = await ctx.api
      .put(`/api/students/${profile.body.id}`)
      .set('Authorization', `Bearer ${T}`)
      .send({ tuition_fee: null });
    expect(res.status).toBe(200);
    expect(res.body.tuition_fee).toBeNull();

    const [row] = await ctx.db.select().from(users).where(eq(users.id, profile.body.id));
    expect(row.tuitionFee).toBeNull();
  });

  it('từ chối học phí riêng âm hoặc không phải số nguyên', async () => {
    const anToken = await ctx.login(STUDENT_AN);
    const profile = await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${anToken}`);

    for (const bad of [-1, 'abc', 1.5]) {
      const res = await ctx.api
        .put(`/api/students/${profile.body.id}`)
        .set('Authorization', `Bearer ${T}`)
        .send({ tuition_fee: bad });
      expect(res.status).toBe(400);
    }
  });

  it('tạo học viên với học phí riêng thì học phí tháng đầu dùng giá riêng', async () => {
    const res = await ctx.api.post('/api/students').set('Authorization', `Bearer ${T}`).send({
      full_name: 'Học viên giá riêng',
      email: 'gia-rieng@example.com',
      class_id: 'cls-n5-01',
      tuition_fee: 500000,
    });
    expect(res.status).toBe(201);
    expect(res.body.tuition_fee).toBe(500000);

    const rows = await ctx.db.select().from(tuitionRecords).where(eq(tuitionRecords.studentId, res.body.id));
    expect(rows[0].amount).toBe(500000);
  });
});
