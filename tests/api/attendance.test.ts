import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, STUDENT_MAI, STUDENT_DUNG, currentQr } from '../helpers';
import { eq } from 'drizzle-orm';
import { attendanceSessions, attendanceRecords } from '../../server/db/schema';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string, MAI: string, DUNG: string;
let AN_ID: string, MAI_ID: string, DUNG_ID: string;

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  MAI = await ctx.login(STUDENT_MAI);
  DUNG = await ctx.login(STUDENT_DUNG);
  AN_ID = (await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${AN}`)).body.id;
  MAI_ID = (await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${MAI}`)).body.id;
  DUNG_ID = (await ctx.api.get('/api/auth/profile').set('Authorization', `Bearer ${DUNG}`)).body.id;
});
afterAll(async () => {
  await ctx.close();
});

async function openSession(classId = 'cls-n5-01') {
  const res = await ctx.api.post('/api/attendance/session').set('Authorization', `Bearer ${T}`).send({ class_id: classId });
  expect(res.status).toBe(201);
  return res.body as { id: string; session_code: string; class_id: string };
}

describe('điểm danh QR và mã phiên', () => {
  it('QR của chu kỳ hiện tại được chấp nhận', async () => {
    await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${AN}`).send({
      qr_payload: currentQr('cls-n5-01'),
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('QR đã quá 2 chu kỳ (30 giây) bị từ chối', async () => {
    await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({
      qr_payload: currentQr('cls-n5-01', 2),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hết hạn/);
  });

  it('QR của tương lai bị từ chối', async () => {
    await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({
      qr_payload: currentQr('cls-n5-01', -1),
    });
    expect(res.status).toBe(400);
  });

  it('mã phiên nhập tay phải khớp đúng phiên đang mở (không phân biệt hoa thường)', async () => {
    const s = await openSession();
    const bad = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${DUNG}`).send({ qr_payload: 'ES-0000' });
    expect(bad.status).toBe(400);
    const ok = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${DUNG}`).send({
      qr_payload: s.session_code.toLowerCase(),
    });
    expect([200, 201]).toContain(ok.status);
    expect(ok.body.record.student_id).toBeTruthy();
  });

  it('mã phiên của lớp khác không được dùng để điểm danh vào lớp này', async () => {
    const s = await openSession('cls-kaiwa-01');
    // Học viên An chưa học lớp Kaiwa nên không được điểm danh dù mã đúng
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${AN}`).send({ qr_payload: s.session_code });
    expect(res.status).toBe(403);
  });

  it('học viên luôn điểm danh cho chính mình, bỏ qua student_id trong body', async () => {
    const s = await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({
      qr_payload: s.session_code,
      student_id: AN_ID,
    });
    expect(res.body.record.student_id).toBe(MAI_ID);
    const rows = await ctx.db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, s.id));
    expect(rows.some((r) => r.studentId === AN_ID)).toBe(false);
  });

  it('học viên không thuộc lớp không điểm danh được', async () => {
    const s = await openSession();
    // Tạo học viên không có lớp
    const created = await ctx.api.post('/api/students').set('Authorization', `Bearer ${T}`).send({ full_name: 'Không lớp', email: 'nolop@example.com' });
    const token = await ctx.login('nolop@example.com', created.body.temporary_password);
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${token}`).send({ qr_payload: s.session_code });
    expect(res.status).toBe(403);
  });

  it('điểm danh lặp lại không tạo bản ghi trùng', async () => {
    const s = await openSession();
    await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${DUNG}`).send({ qr_payload: s.session_code });
    const again = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${DUNG}`).send({ qr_payload: s.session_code });
    expect(again.status).toBe(200);
    expect(again.body.alreadyCheckedIn).toBe(true);
    const rows = await ctx.db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, s.id));
    expect(rows.filter((r) => r.studentId === DUNG_ID).length).toBe(1);
  });

  it('mở buổi mới sẽ đóng buổi cũ của cùng lớp', async () => {
    const first = await openSession();
    await openSession();
    const [old] = await ctx.db.select().from(attendanceSessions).where(eq(attendanceSessions.id, first.id));
    expect(old.isActive).toBe(false);
  });
});

describe('lịch sử điểm danh và điểm danh nhanh', () => {
  it('học viên chỉ xem lịch sử của mình, có class_id để thống kê đúng lớp', async () => {
    await openSession();
    const res = await ctx.api.get('/api/attendance/history').set('Authorization', `Bearer ${AN}`);
    expect(res.status).toBe(200);
    expect(res.body.every((r: any) => r.student_id === AN_ID)).toBe(true);
    const teacherView = await ctx.api.get('/api/attendance/history?class_id=cls-n5-01').set('Authorization', `Bearer ${T}`);
    expect(teacherView.body.length).toBeGreaterThan(0);
    expect(teacherView.body.every((r: any) => r.class_id === 'cls-n5-01')).toBe(true);
  });

  it('điểm danh nhanh theo ngày không ghi đè bản ghi QR cùng ngày', async () => {
    const s = await openSession();
    await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${DUNG}`).send({ qr_payload: s.session_code });
    const before = await ctx.db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, s.id));
    const date = '2026-10-20';
    const batch = await ctx.api.post('/api/attendance/batch').set('Authorization', `Bearer ${T}`).send({
      class_id: 'cls-n5-01',
      date,
      presentStudentIds: [AN_ID],
    });
    expect(batch.status).toBe(200);
    const after = await ctx.db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, s.id));
    expect(after.length).toBe(before.length);
    // Điểm danh nhanh có đúng trạng thái theo danh sách có mặt
    const batchSessions = await ctx.db.select().from(attendanceSessions).where(eq(attendanceSessions.sessionDate, date));
    expect(batchSessions.some((x) => x.qrCode.startsWith('EDUSCAN_BATCH_'))).toBe(true);
  });

  it('điểm danh nhanh từ chối ngày sai định dạng', async () => {
    const res = await ctx.api.post('/api/attendance/batch').set('Authorization', `Bearer ${T}`).send({
      class_id: 'cls-n5-01',
      date: '28/10/2026',
      presentStudentIds: [],
    });
    expect(res.status).toBe(400);
  });
});

