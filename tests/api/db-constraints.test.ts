import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN } from '../helpers';
import { attendanceSessions, tuitionRecords } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let A: string;

beforeAll(async () => {
  ctx = await createTestContext();
  A = await ctx.login(ADMIN);
});
afterAll(async () => {
  await ctx.close();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('ràng buộc duy nhất ở mức cơ sở dữ liệu', () => {
  it('không cho hai hồ sơ học phí cùng học viên và tháng', async () => {
    await ctx.db.insert(tuitionRecords).values({
      id: 'tui-constraint-1',
      studentId: 'usr-student-1',
      month: '03/2031',
      amount: 100000,
    });
    await expect(
      ctx.db.insert(tuitionRecords).values({
        id: 'tui-constraint-2',
        studentId: 'usr-student-1',
        month: '03/2031',
        amount: 200000,
      })
    ).rejects.toThrow();
  });

  it('API tạo hồ sơ học phí trùng tháng trả 409', async () => {
    const body = { student_id: 'usr-student-2', month: '04/2031', amount: 100000 };
    const first = await ctx.api.post('/api/tuition').set(auth(A)).send(body);
    expect(first.status).toBe(201);

    const second = await ctx.api.post('/api/tuition').set(auth(A)).send(body);
    expect(second.status).toBe(409);
  });

  it('chỉ chặn trùng mã giữa các phiên đang mở, không chặn phiên đã đóng', async () => {
    const code = 'ES-777777';
    const base = {
      classId: 'cls-n5-01',
      qrCode: 'EDUSCAN_TEST_CONSTRAINT',
      sessionCode: code,
      sessionDate: '2031-03-01',
      startTime: new Date('2031-03-01T18:00:00Z'),
    };
    await ctx.db.insert(attendanceSessions).values({ ...base, id: 'ses-constraint-1', isActive: true });

    await expect(
      ctx.db.insert(attendanceSessions).values({ ...base, id: 'ses-constraint-2', isActive: true })
    ).rejects.toThrow();

    // Phiên đã đóng được giữ mã cũ: partial unique index chỉ áp dụng cho is_active = true
    await ctx.db.insert(attendanceSessions).values({ ...base, id: 'ses-constraint-3', isActive: false });
  });
});
