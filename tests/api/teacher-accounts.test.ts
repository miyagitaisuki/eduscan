import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, TEACHER, ADMIN } from '../helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let A: string; // admin
let T: string; // giáo viên seed (có lớp)

beforeAll(async () => {
  ctx = await createTestContext();
  A = await ctx.login(ADMIN);
  T = await ctx.login(TEACHER);
});
afterAll(async () => {
  await ctx.close();
});

describe('quản lý tài khoản giáo viên', () => {
  it('chỉ admin xem và tạo được tài khoản giáo viên', async () => {
    expect((await ctx.api.get('/api/teachers').set('Authorization', `Bearer ${T}`)).status).toBe(403);
    const list = await ctx.api.get('/api/teachers').set('Authorization', `Bearer ${A}`);
    expect(list.status).toBe(200);
    expect(list.body.every((t: any) => t.role === 'teacher')).toBe(true);
  });

  it('admin tạo giáo viên với mật khẩu tự sinh, buộc đổi mật khẩu ở lần đầu', async () => {
    const res = await ctx.api.post('/api/teachers').set('Authorization', `Bearer ${A}`).send({
      email: 'gv.moi@eduscan.edu.vn',
      full_name: 'Giáo viên Mới',
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('teacher');
    expect(res.body.must_change_password).toBe(true);
    expect(res.body.temporary_password).toBeTruthy();

    // Đăng nhập được bằng mật khẩu tạm, nhưng mọi API khác bị chặn cho tới khi đổi
    const newToken = await ctx.login('gv.moi@eduscan.edu.vn', res.body.temporary_password);
    const blocked = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${newToken}`);
    expect(blocked.body.code).toBe('MUST_CHANGE_PASSWORD');
  });

  it('không tạo được giáo viên trùng tên đăng nhập', async () => {
    const res = await ctx.api.post('/api/teachers').set('Authorization', `Bearer ${A}`).send({
      email: TEACHER,
      full_name: 'Trùng',
    });
    expect(res.status).toBe(409);
  });

  it('đổi tên đăng nhập: tài khoản cũ không đăng nhập được nữa', async () => {
    const created = await ctx.api
      .post('/api/teachers')
      .set('Authorization', `Bearer ${A}`)
      .send({ email: 'gv.doi@eduscan.edu.vn', full_name: 'Đổi Email', password: 'matkhau-ban-dau' });
    expect(created.status).toBe(201);

    const upd = await ctx.api
      .put(`/api/teachers/${created.body.id}`)
      .set('Authorization', `Bearer ${A}`)
      .send({ email: 'gv.doi.moi@eduscan.edu.vn' });
    expect(upd.status).toBe(200);
    expect(upd.body.email).toBe('gv.doi.moi@eduscan.edu.vn');

    const oldLogin = await ctx.api.post('/api/auth/login').send({ email: 'gv.doi@eduscan.edu.vn', password: 'matkhau-ban-dau' });
    expect(oldLogin.status).toBe(401);
  });

  it('giáo viên không đổi được tên đăng nhập của chính mình qua hồ sơ', async () => {
    const res = await ctx.api
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${T}`)
      .send({ email: 'hack@eduscan.edu.vn', full_name: 'Thầy Quang', phone: '0912.345.678' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEACHER);
    expect(res.body.full_name).toBe('Thầy Quang');
  });

  it('không khóa giáo viên đang phụ trách lớp, và không tự khóa chính mình', async () => {
    const teacherRow = (await ctx.api.get('/api/teachers').set('Authorization', `Bearer ${A}`)).body.find(
      (t: any) => t.email === TEACHER
    );
    const lock = await ctx.api
      .put(`/api/teachers/${teacherRow.id}/status`)
      .set('Authorization', `Bearer ${A}`)
      .send({ status: 'inactive' });
    expect(lock.status).toBe(409);

    const self = (await ctx.api.get('/api/teachers').set('Authorization', `Bearer ${A}`)).body.find(
      (t: any) => t.email === ADMIN
    );
    // Admin không nằm trong danh sách giáo viên nên không thể tự khóa qua route này
    expect(self).toBeUndefined();
  });

  it('khóa giáo viên không có lớp thì đăng nhập bị từ chối', async () => {
    const created = await ctx.api
      .post('/api/teachers')
      .set('Authorization', `Bearer ${A}`)
      .send({ email: 'gv.khoa@eduscan.edu.vn', full_name: 'Sẽ khóa', password: 'matkhau-khoa-1' });
    const lock = await ctx.api
      .put(`/api/teachers/${created.body.id}/status`)
      .set('Authorization', `Bearer ${A}`)
      .send({ status: 'inactive' });
    expect(lock.status).toBe(200);
    const login = await ctx.api.post('/api/auth/login').send({ email: 'gv.khoa@eduscan.edu.vn', password: 'matkhau-khoa-1' });
    expect(login.status).toBe(401);
  });

  it('admin đặt lại mật khẩu giáo viên: cũ mất hiệu lực, buộc đổi lại', async () => {
    const created = await ctx.api
      .post('/api/teachers')
      .set('Authorization', `Bearer ${A}`)
      .send({ email: 'gv.reset@eduscan.edu.vn', full_name: 'Reset', password: 'matkhau-cu-1' });
    const reset = await ctx.api
      .put(`/api/teachers/${created.body.id}/password`)
      .set('Authorization', `Bearer ${A}`)
      .send({ new_password: 'matkhau-moi-2' });
    expect(reset.status).toBe(200);
    const oldLogin = await ctx.api.post('/api/auth/login').send({ email: 'gv.reset@eduscan.edu.vn', password: 'matkhau-cu-1' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await ctx.api.post('/api/auth/login').send({ email: 'gv.reset@eduscan.edu.vn', password: 'matkhau-moi-2' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.must_change_password).toBe(true);
  });
});

describe('học phí và thông tin nhạy cảm với giáo viên', () => {
  it('giáo viên không đọc được học phí', async () => {
    const res = await ctx.api.get('/api/tuition').set('Authorization', `Bearer ${T}`);
    expect(res.status).toBe(403);
  });

  it('danh sách lớp không chứa học phí với giáo viên, nhưng có với admin', async () => {
    const asTeacher = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${T}`);
    expect(asTeacher.status).toBe(200);
    expect(asTeacher.body.length).toBeGreaterThan(0);
    expect(asTeacher.body[0].monthly_fee).toBeUndefined();

    const asAdmin = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${A}`);
    expect(typeof asAdmin.body[0].monthly_fee).toBe('number');
  });

  it('giáo viên không đặt được học phí lớp', async () => {
    const before = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${A}`);
    const cls = before.body[0];
    await ctx.api.put(`/api/classes/${cls.id}`).set('Authorization', `Bearer ${T}`).send({ monthly_fee: 1 });
    const after = await ctx.api.get('/api/classes').set('Authorization', `Bearer ${A}`);
    expect(after.body.find((c: any) => c.id === cls.id).monthly_fee).toBe(cls.monthly_fee);
  });

  it('không gán lớp cho tài khoản học viên', async () => {
    const cls = (await ctx.api.get('/api/classes').set('Authorization', `Bearer ${A}`)).body[0];
    const res = await ctx.api
      .put(`/api/classes/${cls.id}`)
      .set('Authorization', `Bearer ${A}`)
      .send({ teacher_id: 'usr-student-1' });
    expect(res.status).toBe(400);
  });
});

