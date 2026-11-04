import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, ADMIN, STUDENT_AN as STUDENT_EMAIL } from '../helpers';
import { leads } from '../../server/db/schema';
import { normalizePhone } from '../../server/routes/leads';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, ADM: string;

const valid = { fullName: 'Nguyễn Văn A', phone: '0901 234 567', currentLevel: 'Mới bắt đầu', targetJlpt: 'N5', notes: 'Học tối', consent: true };

beforeAll(async () => {
  ctx = await createTestContext();
  T = await ctx.login(TEACHER);
  ADM = await ctx.login(ADMIN);
});
afterAll(async () => {
  await ctx.close();
});

describe('chuẩn hóa số điện thoại', () => {
  it('nhận các dạng thường gặp, từ chối số sai', () => {
    expect(normalizePhone('0901 234 567')).toBe('0901234567');
    expect(normalizePhone('+84 901.234.567')).toBe('0901234567');
    expect(normalizePhone('84901234567')).toBe('0901234567');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe('POST /api/leads/public', () => {
  it('nhận đăng ký không cần đăng nhập và lưu số đã chuẩn hóa', async () => {
    const res = await ctx.api.post('/api/leads/public').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    const list = await ctx.api.get('/api/leads').set('Authorization', `Bearer ${ADM}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ full_name: 'Nguyễn Văn A', phone: '0901234567', target_jlpt: 'N5', status: 'new' });
    expect(list.body[0].consent_at).toBeTruthy();
  });

  it('cùng số điện thoại trong 24 giờ không tạo bản ghi trùng', async () => {
    const res = await ctx.api.post('/api/leads/public').send({ ...valid, fullName: 'Người khác', phone: '+84901234567' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(await ctx.db.select().from(leads)).toHaveLength(1);
  });

  it('từ chối khi thiếu họ tên, số sai hoặc chưa đồng ý', async () => {
    for (const bad of [
      { ...valid, phone: '0911000001', fullName: '  ' },
      { ...valid, phone: '123' },
      { ...valid, phone: '0911000002', consent: false },
      { ...valid, phone: '0911000003', consent: 'true' },
    ]) {
      const res = await ctx.api.post('/api/leads/public').send(bad);
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    }
    expect(await ctx.db.select().from(leads)).toHaveLength(1);
  });

  it('ô ẩn website bị điền (bot): trả OK nhưng không lưu', async () => {
    const res = await ctx.api.post('/api/leads/public').send({ ...valid, phone: '0911000009', website: 'http://spam' });
    expect(res.body).toEqual({ ok: true });
    expect(await ctx.db.select().from(leads)).toHaveLength(1);
  });

  it('cắt độ dài trường và từ chối body quá lớn', async () => {
    await ctx.api.post('/api/leads/public').send({ ...valid, phone: '0911000010', notes: 'x'.repeat(5000) });
    const [row] = (await ctx.db.select().from(leads)).filter((l) => l.phone === '0911000010');
    expect(row.notes).toHaveLength(2000);
    const big = await ctx.api.post('/api/leads/public').send({ ...valid, phone: '0911000011', notes: 'x'.repeat(20000) });
    expect(big.status).toBe(413);
  });

  it('giới hạn 10 lần/giờ theo IP', async () => {
    const c = await createTestContext();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await c.api.post('/api/leads/public').send({ ...valid, phone: `09110000${String(i).padStart(2, '0')}` })).status;
    }
    expect(last).toBe(429);
    await c.close();
  });
});

describe('quản lý đăng ký (admin)', () => {
  it('chỉ admin xem và sửa; không token, giáo viên bị chặn', async () => {
    expect((await ctx.api.get('/api/leads')).status).toBe(401);
    expect((await ctx.api.get('/api/leads').set('Authorization', `Bearer ${T}`)).status).toBe(403);
    const [l] = await ctx.db.select().from(leads);
    expect((await ctx.api.patch(`/api/leads/${l.id}`).set('Authorization', `Bearer ${T}`).send({ status: 'contacted' })).status).toBe(403);
  });

  it('admin đổi trạng thái, ghi chú và có nhật ký; lọc theo trạng thái', async () => {
    const [l] = await ctx.db.select().from(leads);
    const res = await ctx.api.patch(`/api/leads/${l.id}`).set('Authorization', `Bearer ${ADM}`).send({ status: 'contacted', admin_note: 'Đã gọi' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'contacted', admin_note: 'Đã gọi' });
    const filtered = await ctx.api.get('/api/leads?status=contacted').set('Authorization', `Bearer ${ADM}`);
    expect(filtered.body.map((x: any) => x.id)).toEqual([l.id]);
    expect((await ctx.api.get('/api/leads?status=new').set('Authorization', `Bearer ${ADM}`)).body.some((x: any) => x.id === l.id)).toBe(false);
  });

  it('từ chối trạng thái sai, id không tồn tại, body rỗng', async () => {
    const [l] = await ctx.db.select().from(leads);
    const auth = { Authorization: `Bearer ${ADM}` };
    expect((await ctx.api.patch(`/api/leads/${l.id}`).set(auth).send({ status: 'xyz' })).status).toBe(400);
    expect((await ctx.api.patch(`/api/leads/${l.id}`).set(auth).send({})).status).toBe(400);
    expect((await ctx.api.patch('/api/leads/nope').set(auth).send({ status: 'new' })).status).toBe(404);
    expect((await ctx.api.get('/api/leads?status=xyz').set(auth)).status).toBe(400);
  });
});

describe('báo email khi có đăng ký mới', () => {
  it('gửi cho admin đang hoạt động, dùng LEADS_NOTIFY_EMAIL nếu có, và escape HTML', async () => {
    const { vi } = await import('vitest');
    const { leadRecipients } = await import('../../server/lib/leadNotify');
    expect(await leadRecipients(ctx.db, {} as NodeJS.ProcessEnv)).toEqual([ADMIN]);
    expect(await leadRecipients(ctx.db, { LEADS_NOTIFY_EMAIL: 'a@x.vn, b@x.vn' } as NodeJS.ProcessEnv)).toEqual(['a@x.vn', 'b@x.vn']);

    const sent: any[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: any) => {
      sent.push(JSON.parse(init.body));
      return { ok: true } as Response;
    });
    process.env.RESEND_API_KEY = 'k';
    process.env.MAIL_FROM = 'EduScan <no-reply@x.vn>';
    try {
      const res = await ctx.api.post('/api/leads/public').send({ ...valid, phone: '0922000001', fullName: '<b>Hack</b>', notes: 'a & b' });
      expect(res.status).toBe(201);
      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].to).toEqual([ADMIN]);
      expect(sent[0].subject).toContain('Đăng ký học thử mới');
      expect(sent[0].html).toContain('&lt;b&gt;Hack&lt;/b&gt;');
      expect(sent[0].html).not.toContain('<b>Hack</b>');
      expect(sent[0].html).toContain('a &amp; b');
    } finally {
      vi.unstubAllGlobals();
      delete process.env.RESEND_API_KEY;
      delete process.env.MAIL_FROM;
    }
  });

  it('lỗi email không làm hỏng việc nhận đăng ký', async () => {
    const { vi } = await import('vitest');
    vi.stubGlobal('fetch', async () => {
      throw new Error('mạng lỗi');
    });
    process.env.RESEND_API_KEY = 'k';
    process.env.MAIL_FROM = 'x@x.vn';
    try {
      const res = await ctx.api.post('/api/leads/public').send({ ...valid, phone: '0922000002' });
      expect(res.status).toBe(201);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.RESEND_API_KEY;
      delete process.env.MAIL_FROM;
    }
  });
});

describe('ghi danh từ đăng ký (convert)', () => {
  const adm = () => ({ Authorization: `Bearer ${ADM}` });
  // Ghi thẳng vào DB: endpoint công khai bị giới hạn 10 lần/giờ nên không dùng cho dữ liệu dựng sẵn
  async function newLead(phone: string, fullName = 'Học Viên Mới') {
    const [row] = await ctx.db
      .insert(leads)
      .values({ id: `lead-${phone}`, fullName, phone, consentAt: new Date() })
      .returning();
    return row;
  }

  it('chỉ admin; thiếu lớp, lớp sai, email sai bị từ chối', async () => {
    const l = await newLead('0933000001');
    expect((await ctx.api.post(`/api/leads/${l.id}/convert`).send({ class_id: 'cls-n5-01' })).status).toBe(401);
    expect((await ctx.api.post(`/api/leads/${l.id}/convert`).set('Authorization', `Bearer ${T}`).send({ class_id: 'cls-n5-01' })).status).toBe(403);
    expect((await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({})).status).toBe(400);
    expect((await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'nope' })).status).toBe(400);
    expect((await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01', email: 'sai' })).status).toBe(400);
    expect((await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01', join_date: '2026-02-31' })).status).toBe(400);
    expect((await ctx.api.post('/api/leads/nope/convert').set(adm()).send({ class_id: 'cls-n5-01' })).status).toBe(404);
    const [still] = (await ctx.db.select().from(leads)).filter((x) => x.id === l.id);
    expect(still.studentId).toBeNull();
    expect(still.status).toBe('new');
  });

  it('tạo tài khoản học viên, ghi danh, học phí, đánh dấu đã ghi danh và đăng nhập được bằng mật khẩu tạm', async () => {
    const l = await newLead('0933000002', 'Nguyễn Thị Lead');
    const res = await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01', email: 'Lead.Moi@Example.com' });
    expect(res.status).toBe(201);
    expect(res.body.student).toMatchObject({ full_name: 'Nguyễn Thị Lead', email: 'lead.moi@example.com', class_id: 'cls-n5-01' });
    expect(res.body.lead).toMatchObject({ status: 'enrolled', student_id: res.body.student.id });
    expect(typeof res.body.temporary_password).toBe('string');

    const students = await ctx.api.get('/api/students').set(adm());
    const st = students.body.find((s: any) => s.id === res.body.student.id);
    expect(st).toMatchObject({ phone: '0933000002', class_id: 'cls-n5-01', must_change_password: true });
    const tuition = await ctx.api.get('/api/tuition').set(adm());
    expect(tuition.body.some((t: any) => t.student_id === st.id)).toBe(true);

    const login = await ctx.api.post('/api/auth/login').send({ email: 'lead.moi@example.com', password: res.body.temporary_password });
    expect(login.status).toBe(200);
  });

  it('không tạo hai lần, kể cả khi bấm đồng thời', async () => {
    const l = await newLead('0933000003');
    const [a, b] = await Promise.all([
      ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01' }),
      ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const again = await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01' });
    expect(again.status).toBe(409);
  });

  it('email đã dùng thì 409 và không tạo gì; không nhập email thì tự sinh', async () => {
    const l = await newLead('0933000004');
    const dup = await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01', email: STUDENT_EMAIL });
    expect(dup.status).toBe(409);
    expect((await ctx.db.select().from(leads)).find((x) => x.id === l.id)!.studentId).toBeNull();
    const ok = await ctx.api.post(`/api/leads/${l.id}/convert`).set(adm()).send({ class_id: 'cls-n5-01' });
    expect(ok.status).toBe(201);
    expect(ok.body.student.email).toMatch(/^student\.[0-9a-f]{10}@eduscan\.edu\.vn$/);
  });
});
