import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN, TEACHER, STUDENT_AN, SEED_PASSWORD } from '../helpers';
import { hashPassword } from '../../server/lib/security';
import { users } from '../../server/db/schema';
import { foldVi } from '../../server/lib/csv';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let ADM: string, T: string, S: string, OTHER: string;
const OTHER_TEACHER = 'other.teacher@eduscan.edu.vn';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const count = async () => (await ctx.api.get('/api/students').set(auth(ADM))).body.length as number;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.db.insert(users).values({
    id: 'usr-teacher-2',
    email: OTHER_TEACHER,
    passwordHash: hashPassword(SEED_PASSWORD),
    fullName: 'GV khác',
    role: 'teacher',
    status: 'active',
  });
  ADM = await ctx.login(ADMIN);
  T = await ctx.login(TEACHER);
  S = await ctx.login(STUDENT_AN);
  OTHER = await ctx.login(OTHER_TEACHER);
});
afterAll(async () => {
  await ctx.close();
});

describe('xuất CSV', () => {
  it('có BOM, tiêu đề tiếng Việt và chỉ gồm học viên của lớp giáo viên phụ trách', async () => {
    const res = await ctx.api.get('/api/students/export').set(auth(T));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain('Mã số,Họ tên,Email,Điện thoại,Giới tính,Lớp,Cấp độ,Ngày vào lớp');
    expect(res.text).toContain('Nguyễn Văn An');
  });

  it('giáo viên không phụ trách không xuất được, và không thấy học viên lớp khác', async () => {
    const res = await ctx.api.get('/api/students/export').set(auth(OTHER));
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Nguyễn Văn An');
    expect((await ctx.api.get('/api/students/export?class_id=cls-n5-01').set(auth(OTHER))).status).toBe(403);
  });

  it('học viên không được xuất', async () => {
    expect((await ctx.api.get('/api/students/export').set(auth(S))).status).toBe(403);
  });

  it('ô bắt đầu bằng ký tự công thức bị thêm dấu nháy để Excel không chạy', async () => {
    await ctx.api.post('/api/students').set(auth(ADM)).send({ full_name: '=HYPERLINK("http://x")', class_id: 'cls-n5-01' });
    const res = await ctx.api.get('/api/students/export').set(auth(ADM));
    // Ô có dấu nháy kép được bọc trong ngoặc kép và nhân đôi dấu nháy bên trong
    expect(res.text).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});

describe('nhập CSV', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    line: 2,
    full_name: 'Trần Thị Hoa',
    email: 'hoa.tran@qnu.edu.vn',
    phone: '0907000111',
    gender: 'Nữ',
    class_name: 'N5 Sơ cấp 1 (Minna no Nihongo)',
    join_date: '2026-10-01',
    ...over,
  });

  it('kiểm tra thử (dry_run) báo từng dòng và không ghi gì vào DB', async () => {
    const before = await count();
    const res = await ctx.api
      .post('/api/students/import')
      .set(auth(T))
      .send({
        dry_run: true,
        rows: [
          row(),
          row({ line: 3, full_name: '', email: 'x1@qnu.edu.vn' }),
          row({ line: 4, email: 'student@qnu.edu.vn' }),
          row({ line: 5, email: 'a@qnu.edu.vn', class_name: 'Lớp không có' }),
          row({ line: 6, email: 'b@qnu.edu.vn', gender: 'lạ' }),
          row({ line: 7, email: 'c@qnu.edu.vn', join_date: '2026-02-31' }),
          row({ line: 8, email: 'not-an-email' }),
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dry_run: true, total: 7, valid: 1, invalid: 6 });
    const byLine = Object.fromEntries(res.body.results.map((r: any) => [r.line, r]));
    expect(byLine[2].status).toBe('ok');
    expect(byLine[3].errors[0]).toContain('Thiếu họ tên');
    expect(byLine[4].errors[0]).toContain('đã được sử dụng');
    expect(byLine[5].errors[0]).toContain('Không tìm thấy lớp');
    expect(byLine[6].errors[0]).toContain('Nam hoặc Nữ');
    expect(byLine[7].errors[0]).toContain('YYYY-MM-DD');
    expect(byLine[8].errors[0]).toContain('định dạng');
    expect(await count()).toBe(before);
  });

  it('ghi các dòng hợp lệ, trả mật khẩu tạm một lần và học viên đăng nhập được', async () => {
    const before = await count();
    const res = await ctx.api
      .post('/api/students/import')
      .set(auth(T))
      .send({ rows: [row(), row({ line: 3, full_name: 'Lê Văn Nam', email: '', gender: 'Nam', class_name: '', phone: '' })], class_id: 'cls-n5-01' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: 2, invalid: 0 });
    expect(await count()).toBe(before + 2);

    const hoa = res.body.credentials.find((c: any) => c.full_name === 'Trần Thị Hoa');
    expect(hoa.class_name).toBe('N5 Sơ cấp 1 (Minna no Nihongo)');
    const login = await ctx.api.post('/api/auth/login').send({ email: hoa.email, password: hoa.temporary_password });
    expect(login.status).toBe(200);
    expect(login.body.user.must_change_password).toBe(true);

    const nam = res.body.credentials.find((c: any) => c.full_name === 'Lê Văn Nam');
    expect(nam.email).toMatch(/^student\.[0-9a-f]+@eduscan\.edu\.vn$/);
    expect(nam.class_name).toBe('N5 Sơ cấp 1 (Minna no Nihongo)');
  });

  it('ghi học viên vào lớp đúng, học phí tháng đầu được tạo cho lớp có học viên', async () => {
    const list = (await ctx.api.get('/api/students').set(auth(ADM))).body as any[];
    const hoa = list.find((s) => s.full_name === 'Trần Thị Hoa');
    expect(hoa.class_id).toBe('cls-n5-01');
    const tuition = (await ctx.api.get('/api/tuition').set(auth(ADM))).body as any[];
    expect(tuition.some((t) => t.student_id === hoa.id && t.notes === 'Học viên mới')).toBe(true);
  });

  it('giáo viên không nhập được vào lớp của người khác; file bị trùng email trong chính nó bị báo', async () => {
    const res = await ctx.api
      .post('/api/students/import')
      .set(auth(OTHER))
      .send({ dry_run: true, class_id: 'cls-n5-01', rows: [row({ line: 2, email: 'p@qnu.edu.vn' }), row({ line: 3, email: 'p@qnu.edu.vn' })] });
    expect(res.status).toBe(403);

    const res2 = await ctx.api
      .post('/api/students/import')
      .set(auth(OTHER))
      .send({ dry_run: true, rows: [row({ line: 2, email: 'q@qnu.edu.vn', class_name: 'N5 Sơ cấp 1 (Minna no Nihongo)' }), row({ line: 3, email: 'q@qnu.edu.vn', class_name: '' })] });
    expect(res2.body.results[0].errors[0]).toContain('không phụ trách');
    expect(res2.body.results[1].errors[0]).toContain('đã được sử dụng');
  });

  it('chặn file quá lớn, file rỗng và học viên dùng API nhập', async () => {
    expect((await ctx.api.post('/api/students/import').set(auth(T)).send({ rows: [] })).status).toBe(400);
    const many = Array.from({ length: 201 }, (_, i) => row({ line: i + 2, email: `m${i}@qnu.edu.vn` }));
    expect((await ctx.api.post('/api/students/import').set(auth(T)).send({ rows: many })).status).toBe(400);
    expect((await ctx.api.post('/api/students/import').set(auth(S)).send({ rows: [row()] })).status).toBe(403);
  });
});

describe('chuẩn hóa tên cột và lớp', () => {
  it('bỏ dấu và viết thường để so khớp', () => {
    expect(foldVi('Họ Tên')).toBe('ho ten');
    expect(foldVi('Nữ')).toBe('nu');
    expect(foldVi('Đà Nẵng')).toBe('da nang');
  });
});
