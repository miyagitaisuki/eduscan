import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import request from 'supertest';
import { createTestContext, TEACHER, STUDENT_AN } from '../helpers';
import { createApp } from '../../server/app';
import type { DocumentStore, DocumentRecord } from '../../server/lib/documents';

const doc = (over: Partial<DocumentRecord>): DocumentRecord => ({
  drive_file_id: 'f1',
  name: 'De thi N5 2025.pdf',
  subject: 'Tiếng Nhật',
  year: 2025,
  doc_type: 'exam',
  tags: 'n5',
  folder_path: 'Tiếng Nhật/2025',
  mime_type: 'application/pdf',
  size: 10,
  modified_time: '2026-01-01T00:00:00Z',
  indexed_at: '2026-01-02T00:00:00Z',
  status: 'ok',
  ...over,
});

// Store giả lập: kiểm thử route mà không gọi Google
function fakeStore(): DocumentStore {
  const docs = [doc({}), doc({ drive_file_id: 'f2', name: 'Dap an N5 2025.docx', doc_type: 'answer', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), doc({ drive_file_id: 'f3', status: 'missing' })];
  return {
    async list(f) {
      return docs.filter((d) => d.status === 'ok' && (!f.type || d.doc_type === f.type) && (!f.q || d.name.toLowerCase().includes(f.q.toLowerCase())));
    },
    async findOk(id) {
      return docs.find((d) => d.drive_file_id === id && d.status === 'ok') ?? null;
    },
    async sync() {
      return { scanned: 2, added: 0, missing: 1, total: 3 };
    },
    async openFile() {
      return { stream: Readable.from([Buffer.from('hello')]), name: 'Đáp án.pdf', mimeType: 'application/pdf', size: 5 };
    },
  };
}

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let T: string, AN: string;
let ctxNoDocs: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  ctx = await createTestContext();
  // Tạo app riêng với store giả lập; ctx.api dùng app mặc định (không có documents)
  ctx.api = request(createApp({ db: ctx.db, config: ctx.config, documents: fakeStore() }));
  T = await ctx.login(TEACHER);
  AN = await ctx.login(STUDENT_AN);
  ctxNoDocs = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
  await ctxNoDocs.close();
});

describe('thư viện tài liệu', () => {
  it('chưa cấu hình Google thì trả 503', async () => {
    const T2 = await ctxNoDocs.login(TEACHER);
    const res = await ctxNoDocs.api.get('/api/documents').set('Authorization', `Bearer ${T2}`);
    expect(res.status).toBe(503);
  });

  it('chưa đăng nhập thì không xem được', async () => {
    const res = await ctx.api.get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('học viên xem được danh sách và không thấy file missing', async () => {
    const res = await ctx.api.get('/api/documents').set('Authorization', `Bearer ${AN}`);
    expect(res.status).toBe(200);
    expect(res.body.map((d: DocumentRecord) => d.drive_file_id)).toEqual(['f1', 'f2']);
  });

  it('lọc theo loại và từ khóa', async () => {
    const res = await ctx.api.get('/api/documents?type=answer&q=dap').set('Authorization', `Bearer ${AN}`);
    expect(res.body.map((d: DocumentRecord) => d.drive_file_id)).toEqual(['f2']);
  });

  it('từ chối loại tài liệu và năm không hợp lệ', async () => {
    expect((await ctx.api.get('/api/documents?type=abc').set('Authorization', `Bearer ${AN}`)).status).toBe(400);
    expect((await ctx.api.get('/api/documents?year=x').set('Authorization', `Bearer ${AN}`)).status).toBe(400);
  });

  it('tải file đã lập chỉ mục và đặt tên tiếng Việt đúng cách', async () => {
    const res = await ctx.api.get('/api/documents/f1/download').set('Authorization', `Bearer ${AN}`).buffer(true).parse((r, cb) => {
      let data = '';
      r.on('data', (c) => (data += c));
      r.on('end', () => cb(null, data));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''");
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body).toBe('hello');
  });

  it('không tải file không có trong chỉ mục hoặc đã mất', async () => {
    expect((await ctx.api.get('/api/documents/khong-co/download').set('Authorization', `Bearer ${AN}`)).status).toBe(404);
    expect((await ctx.api.get('/api/documents/f3/download').set('Authorization', `Bearer ${AN}`)).status).toBe(404);
  });

  it('chỉ giáo viên/admin được đồng bộ', async () => {
    expect((await ctx.api.post('/api/documents/sync').set('Authorization', `Bearer ${AN}`)).status).toBe(403);
    const res = await ctx.api.post('/api/documents/sync').set('Authorization', `Bearer ${T}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });
});
