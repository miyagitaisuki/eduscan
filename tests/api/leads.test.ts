import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, ADMIN } from '../helpers';
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
