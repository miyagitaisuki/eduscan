import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, STUDENT_AN, STUDENT_MAI, STUDENT_DUNG, signedQr } from '../helpers';
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
  it('giáo viên lấy mã QR do server ký, học viên quét được', async () => {
    const s = await openSession();
    const qr = await ctx.api.get(`/api/attendance/session/${s.id}/qr`).set('Authorization', `Bearer ${T}`);
    expect(qr.status).toBe(200);
    expect(qr.body.payload).toMatch(/^EDUSCAN_QR:/);
    expect(qr.body.refresh_in_ms).toBeGreaterThan(0);
    expect(qr.body.refresh_in_ms).toBeLessThanOrEqual(15000);
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${AN}`).send({ qr_payload: qr.body.payload });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('QR của chu kỳ hiện tại và chu kỳ liền trước đều được chấp nhận', async () => {
    const s = await openSession();
    const now = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${AN}`).send({
      qr_payload: signedQr(ctx.config, s.id),
    });
    expect([200, 201]).toContain(now.status);
    const prev = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({
      qr_payload: signedQr(ctx.config, s.id, 1),
    });
    expect([200, 201]).toContain(prev.status);
  });

  it('QR đã quá 2 chu kỳ (30 giây) bị từ chối', async () => {
    const s = await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({
      qr_payload: signedQr(ctx.config, s.id, 2),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hết hạn/);
  });

  it('QR của tương lai bị từ chối', async () => {
    const s = await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({
      qr_payload: signedQr(ctx.config, s.id, -1),
    });
    expect(res.status).toBe(400);
  });

  it('QR tự dựng theo định dạng cũ (classId + stamp + ngày) bị từ chối', async () => {
    await openSession();
    const stamp = Math.floor(Date.now() / 15000);
    const forged = `EDUSCAN_QR:cls-n5-01:${stamp}:${new Date().toISOString().split('T')[0]}`;
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({ qr_payload: forged });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/không hợp lệ/);
  });

  it('QR tự dựng với sessionId đúng nhưng chữ ký giả bị từ chối', async () => {
    const s = await openSession();
    const stamp = Math.floor(Date.now() / 15000);
    for (const sig of ['AAAAAAAAAAAAAAAAAAAAAA', '', 'x']) {
      const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({
        qr_payload: `EDUSCAN_QR:${s.id}:${stamp}:${sig}`,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/không hợp lệ/);
    }
  });

  it('sửa stamp của một mã hợp lệ làm chữ ký không còn khớp', async () => {
    const s = await openSession();
    const parts = signedQr(ctx.config, s.id).split(':');
    parts[2] = String(Number(parts[2]) + 1);
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({ qr_payload: parts.join(':') });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/không hợp lệ/);
  });

  it('mã QR của phiên cũ không dùng được sau khi giáo viên mở phiên mới', async () => {
    const oldSession = await openSession();
    const oldQr = signedQr(ctx.config, oldSession.id);
    await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({ qr_payload: oldQr });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kết thúc/);
  });

  it('mã QR ký bằng khóa khác (server khác) bị từ chối', async () => {
    const s = await openSession();
    const other = signedQr({ ...ctx.config, jwtSecret: 'khac-hoan-toan-' + ctx.config.jwtSecret }, s.id);
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({ qr_payload: other });
    expect(res.status).toBe(400);
  });

  it('giáo viên thấy số học viên đã điểm danh tăng khi học viên quét', async () => {
    const s = await openSession();
    const before = await ctx.api.get(`/api/attendance/session/${s.id}/checkins`).set('Authorization', `Bearer ${T}`);
    expect(before.status).toBe(200);
    expect(before.body.count).toBe(0);
    expect(before.body.student_ids).toEqual([]);
    await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${AN}`).send({ qr_payload: signedQr(ctx.config, s.id) });
    await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({ qr_payload: s.session_code });
    // điểm danh lại không làm tăng số đếm
    await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${AN}`).send({ qr_payload: s.session_code });
    const after = await ctx.api.get(`/api/attendance/session/${s.id}/checkins`).set('Authorization', `Bearer ${T}`);
    expect(after.body.count).toBe(2);
    expect([...after.body.student_ids].sort()).toEqual([AN_ID, MAI_ID].sort());
    expect(after.body.is_active).toBe(true);
  });

  it('học viên không xem được danh sách điểm danh của phiên; phiên không tồn tại trả 404', async () => {
    const s = await openSession();
    expect((await ctx.api.get(`/api/attendance/session/${s.id}/checkins`).set('Authorization', `Bearer ${AN}`)).status).toBe(403);
    expect((await ctx.api.get('/api/attendance/session/ses-khong-co/checkins').set('Authorization', `Bearer ${T}`)).status).toBe(404);
  });

  it('đóng phiên: mã nhập tay, mã QR và session_id đều hết hiệu lực', async () => {
    const s = await openSession();
    const close = await ctx.api.post(`/api/attendance/session/${s.id}/close`).set('Authorization', `Bearer ${T}`);
    expect(close.status).toBe(200);
    // đóng lần hai vẫn ổn
    expect((await ctx.api.post(`/api/attendance/session/${s.id}/close`).set('Authorization', `Bearer ${T}`)).status).toBe(200);
    const byCode = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${DUNG}`).send({ qr_payload: s.session_code });
    expect(byCode.status).toBe(400);
    const byQr = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${DUNG}`).send({ qr_payload: signedQr(ctx.config, s.id) });
    expect(byQr.status).toBe(400);
    expect((await ctx.api.get(`/api/attendance/session/${s.id}/qr`).set('Authorization', `Bearer ${T}`)).status).toBe(409);
    expect((await ctx.api.get(`/api/attendance/session/${s.id}/checkins`).set('Authorization', `Bearer ${T}`)).body.is_active).toBe(false);
  });

  it('học viên không đóng được phiên; phiên không tồn tại trả 404', async () => {
    const s = await openSession();
    expect((await ctx.api.post(`/api/attendance/session/${s.id}/close`).set('Authorization', `Bearer ${AN}`)).status).toBe(403);
    expect((await ctx.api.post('/api/attendance/session/ses-khong-co/close').set('Authorization', `Bearer ${T}`)).status).toBe(404);
  });

  it('học viên không lấy được mã QR của phiên', async () => {
    const s = await openSession();
    const res = await ctx.api.get(`/api/attendance/session/${s.id}/qr`).set('Authorization', `Bearer ${AN}`);
    expect(res.status).toBe(403);
  });

  it('không lấy được mã QR của phiên đã đóng hoặc không tồn tại', async () => {
    const oldSession = await openSession();
    await openSession();
    const closed = await ctx.api.get(`/api/attendance/session/${oldSession.id}/qr`).set('Authorization', `Bearer ${T}`);
    expect(closed.status).toBe(409);
    const missing = await ctx.api.get('/api/attendance/session/ses-khong-co/qr').set('Authorization', `Bearer ${T}`);
    expect(missing.status).toBe(404);
  });

  it('học viên không thể điểm danh bằng session_id, bỏ qua QR', async () => {
    const s = await openSession();
    const res = await ctx.api.post('/api/attendance/checkin').set('Authorization', `Bearer ${MAI}`).send({ session_id: s.id });
    expect(res.status).toBe(403);
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

