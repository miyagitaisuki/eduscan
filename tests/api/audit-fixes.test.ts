import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { createTestContext, ADMIN, TEACHER, STUDENT_AN, SEED_PASSWORD, signedQr } from '../helpers';
import { hashPassword, hashToken, verifyPassword } from '../../server/lib/security';
import { createAttachmentSignedUrl } from '../../server/lib/storage';
import { passwordResets, attendanceRecords, attendanceSessions, users } from '../../server/db/schema';
import { and, eq, like } from 'drizzle-orm';

const OTHER_TEACHER = 'other.teacher.audit@eduscan.edu.vn';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let A: string, T: string, S: string, OTHER: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.db.insert(users).values({
    id: 'usr-teacher-audit',
    email: OTHER_TEACHER,
    passwordHash: hashPassword(SEED_PASSWORD),
    fullName: 'GV audit',
    role: 'teacher',
    status: 'active',
  });
  A = await ctx.login(ADMIN);
  T = await ctx.login(TEACHER);
  S = await ctx.login(STUDENT_AN);
  OTHER = await ctx.login(OTHER_TEACHER);
});
afterAll(async () => {
  await ctx.close();
});

describe('phân quyền xem chi tiết lớp', () => {
  it('học viên không thuộc lớp không xem được chi tiết lớp hay danh sách ghi danh', async () => {
    const res = await ctx.api.get('/api/classes/cls-n4-01').set(auth(S));
    expect(res.status).toBe(403);
  });

  it('học viên đang học xem được lớp của mình nhưng không thấy ID học viên khác', async () => {
    const res = await ctx.api.get('/api/classes/cls-n5-01').set(auth(S));
    expect(res.status).toBe(200);
    expect(res.body.name).toContain('N5');
    expect(res.body.enrollments).toEqual([]);
  });

  it('giáo viên không phụ trách không xem được chi tiết lớp người khác', async () => {
    const res = await ctx.api.get('/api/classes/cls-n5-01').set(auth(OTHER));
    expect(res.status).toBe(403);
  });

  it('giáo viên phụ trách và admin vẫn thấy danh sách ghi danh', async () => {
    for (const token of [T, A]) {
      const res = await ctx.api.get('/api/classes/cls-n5-01').set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.enrollments.length).toBeGreaterThan(0);
    }
  });
});

describe('tạo học viên với lớp không tồn tại', () => {
  it('trả 400 và không để lại tài khoản mồ côi', async () => {
    const res = await ctx.api.post('/api/students').set(auth(A)).send({
      full_name: 'Học viên mồ côi',
      email: 'orphan.audit@example.com',
      class_id: 'cls-khong-ton-tai',
    });
    expect(res.status).toBe(400);
    const rows = await ctx.db.select().from(users).where(eq(users.email, 'orphan.audit@example.com'));
    expect(rows).toHaveLength(0);
  });
});

describe('mật khẩu hỏng không làm đăng nhập trả 500', () => {
  it('verifyPassword trả false với hash sai định dạng', () => {
    expect(verifyPassword('x', 'scrypt$')).toBe(false);
    expect(verifyPassword('x', 'scrypt$abc$')).toBe(false);
    expect(verifyPassword('x', 'scrypt$abc$zz')).toBe(false);
    expect(verifyPassword('x', 'scrypt$abc$abcd')).toBe(false);
  });

  it('đăng nhập tài khoản có hash hỏng trả 401', async () => {
    await ctx.db.insert(users).values({
      id: 'usr-broken-hash',
      email: 'broken.hash@example.com',
      passwordHash: 'scrypt$broken',
      fullName: 'Broken Hash',
      role: 'student',
      status: 'active',
    });
    const res = await ctx.api.post('/api/auth/login').send({ email: 'broken.hash@example.com', password: 'bat-ky' });
    expect(res.status).toBe(401);
  });
});

describe('token đặt lại mật khẩu dùng một lần', () => {
  it('hai request đồng thời cùng token chỉ một request thành công', async () => {
    const token = crypto.randomBytes(32).toString('base64url');
    await ctx.db.insert(passwordResets).values({
      id: 'prs-audit-race',
      userId: 'usr-student-3',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const body = { token, new_password: 'matkhau-moi-audit' };
    const [a, b] = await Promise.all([
      ctx.api.post('/api/auth/reset-password').send(body),
      ctx.api.post('/api/auth/reset-password').send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });
});

describe('điểm danh đồng thời', () => {
  it('hai check-in cùng lúc chỉ tạo một bản ghi, không trả 500', async () => {
    const session = await ctx.api.post('/api/attendance/session').set(auth(T)).send({ class_id: 'cls-n5-01' });
    expect(session.status).toBe(201);
    const qr = signedQr(ctx.config, session.body.id);

    const [a, b] = await Promise.all([
      ctx.api.post('/api/attendance/checkin').set(auth(S)).send({ qr_payload: qr }),
      ctx.api.post('/api/attendance/checkin').set(auth(S)).send({ qr_payload: qr }),
    ]);
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);

    const checkins = await ctx.api.get(`/api/attendance/session/${session.body.id}/checkins`).set(auth(T));
    expect(checkins.body.count).toBe(1);
  });

  it('điểm danh nhanh từ chối ngày không tồn tại', async () => {
    const res = await ctx.api.post('/api/attendance/batch').set(auth(T)).send({
      class_id: 'cls-n5-01',
      date: '2026-02-31',
      presentStudentIds: [],
    });
    expect(res.status).toBe(400);
  });
});

describe('thu học phí', () => {
  it('hai lần thu cùng tháng đồng thời chỉ tạo một hồ sơ', async () => {
    const month = '12/2026';
    const body = { student_id: 'usr-student-1', month, amount: 800000 };
    const [a, b] = await Promise.all([
      ctx.api.post('/api/tuition/payment').set(auth(A)).send(body),
      ctx.api.post('/api/tuition/payment').set(auth(A)).send(body),
    ]);
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    const list = await ctx.api.get('/api/tuition').set(auth(A));
    const rows = list.body.filter((t: any) => t.student_id === 'usr-student-1' && t.month === month);
    expect(rows).toHaveLength(1);
  });

  it('từ chối số tiền âm và giữ nguyên 0 thay vì thay bằng mặc định', async () => {
    const bad = await ctx.api.post('/api/tuition').set(auth(A)).send({
      student_id: 'usr-student-2',
      month: '01/2027',
      amount: -5,
    });
    expect(bad.status).toBe(400);

    const free = await ctx.api.post('/api/tuition').set(auth(A)).send({
      student_id: 'usr-student-2',
      month: '01/2027',
      amount: 0,
    });
    expect(free.status).toBe(201);
    expect(free.body.amount).toBe(0);
  });
});

describe('ghi nhận bài nộp thủ công', () => {
  it('không ghi nhận được cho học viên không thuộc lớp của bài tập', async () => {
    const created = await ctx.api.post('/api/assignments').set(auth(T)).send({
      class_id: 'cls-n4-01',
      title: 'Bài tập lớp N4',
    });
    expect(created.status).toBe(201);
    const res = await ctx.api.post('/api/submissions/manual').set(auth(T)).send({
      assignment_id: created.body.id,
      student_id: 'usr-student-1',
      status: 'submitted',
    });
    expect(res.status).toBe(400);
  });
});

describe('tệp đính kèm', () => {
  it('từ chối đường dẫn có ../ khi tạo link xem', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    await expect(createAttachmentSignedUrl('homework/../../other/x.jpg')).rejects.toMatchObject({ status: 400 });
    vi.unstubAllEnvs();
  });

  it('học viên không lưu được chuỗi tùy ý làm attachment_url', async () => {
    const res = await ctx.api.post('/api/submissions').set(auth(S)).send({
      assignment_id: 'asg-1',
      content: 'bài làm',
      attachment_url: 'Tệp tin đã tải lên',
    });
    expect(res.status).toBe(400);
  });
});

describe('đếm bài đã nộp', () => {
  it('bài đã chấm vẫn được tính là đã nộp', async () => {
    // asg-1 có 1 bài 'graded' và 1 bài 'submitted'
    const res = await ctx.api.get('/api/assignments').set(auth(T));
    const asg = res.body.find((a: any) => a.id === 'asg-1');
    expect(asg.submitted_count).toBe(2);
  });
});

describe('điểm danh nhanh', () => {
  it('giữ trạng thái đi muộn / có phép khi lưu lại cả lớp', async () => {
    const first = await ctx.api.post('/api/attendance/batch').set(auth(T)).send({
      class_id: 'cls-n5-01',
      date: '2026-10-05',
      presentStudentIds: ['usr-student-1', 'usr-student-2', 'usr-student-3'],
    });
    expect(first.status).toBe(200);

    const [session] = await ctx.db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.classId, 'cls-n5-01'),
          eq(attendanceSessions.sessionDate, '2026-10-05'),
          like(attendanceSessions.qrCode, 'EDUSCAN_BATCH_%')
        )
      )
      .limit(1);
    await ctx.db
      .update(attendanceRecords)
      .set({ status: 'late', notes: 'Đi muộn' })
      .where(and(eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.studentId, 'usr-student-1')));

    // Lưu lại với danh sách có mặt rỗng: không được biến "đi muộn" thành "vắng"
    const second = await ctx.api.post('/api/attendance/batch').set(auth(T)).send({
      class_id: 'cls-n5-01',
      date: '2026-10-05',
      presentStudentIds: [],
    });
    expect(second.status).toBe(200);

    const [kept] = await ctx.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.studentId, 'usr-student-1')));
    expect(kept.status).toBe('late');
    expect(kept.notes).toBe('Đi muộn');
  });
});

describe('đăng ký công khai', () => {
  it('áp dụng đúng chính sách mật khẩu 8 ký tự', async () => {
    const short = await ctx.api.post('/api/auth/register').send({
      email: 'short.audit@example.com',
      password: 'abcdefg',
      full_name: 'Short Audit',
    });
    expect(short.status).toBe(400);

    const ok = await ctx.api.post('/api/auth/register').send({
      email: 'ok.audit@example.com',
      password: 'abcdefgh',
      full_name: 'Ok Audit',
    });
    expect(ok.status).toBe(201);
  });
});

describe('giới hạn body công khai', () => {
  it('đăng nhập với body lớn hơn 8KB trả 413', async () => {
    const res = await ctx.api.post('/api/auth/login').send({ email: 'a'.repeat(9000), password: 'x' });
    expect(res.status).toBe(413);
  });
});

describe('giới hạn gọi AI', () => {
  it('quá 20 lần/phút theo tài khoản trả 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await ctx.api.post('/api/ai/generate-feedback').set(auth(T)).send({});
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 503)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
