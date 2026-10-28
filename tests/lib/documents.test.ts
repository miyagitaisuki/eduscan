import { describe, it, expect } from 'vitest';
import {
  inferDocType,
  inferYear,
  inferSubject,
  mergeIndex,
  filterDocuments,
  rowToRecord,
  recordToRow,
  parseServiceAccount,
  DocumentRecord,
} from '../../server/lib/documents';

describe('suy luận metadata', () => {
  it('nhận diện loại tài liệu theo tên file', () => {
    expect(inferDocType('Đáp án N5 2025.pdf')).toBe('answer');
    expect(inferDocType('dap an bai 3.docx')).toBe('answer');
    expect(inferDocType('Đề thi thử N4.pdf')).toBe('exam');
    expect(inferDocType('Từ vựng bài 1.png')).toBe('material');
  });

  it('lấy năm và môn từ thư mục', () => {
    expect(inferYear(['Tiếng Nhật', '2025'], 'x.pdf')).toBe(2025);
    expect(inferYear([], 'De 2024 N3.pdf')).toBe(2024);
    expect(inferYear(['A'], 'x.pdf')).toBeNull();
    expect(inferSubject(['Tiếng Nhật', '2025'])).toBe('Tiếng Nhật');
    expect(inferSubject([])).toBe('');
  });
});

describe('trộn chỉ mục', () => {
  const old: DocumentRecord = {
    drive_file_id: 'a',
    name: 'cu.pdf',
    subject: 'Sửa tay',
    year: 2019,
    doc_type: 'answer',
    tags: 'gìn giữ',
    folder_path: '',
    mime_type: 'application/pdf',
    size: 1,
    modified_time: '',
    indexed_at: '',
    status: 'ok',
  };

  it('giữ trường giáo viên đã sửa, thêm file mới, đánh dấu file đã mất', () => {
    const merged = mergeIndex(
      [old, { ...old, drive_file_id: 'b', subject: '', year: null, doc_type: 'material', tags: '' }],
      [
        { id: 'a', name: 'cu.pdf', mimeType: 'application/pdf', size: 2, modifiedTime: 't', folderPath: ['Khác', '2030'] },
        { id: 'c', name: 'Đề N5 2026.pdf', mimeType: 'application/pdf', size: 3, modifiedTime: 't', folderPath: ['Tiếng Nhật'] },
      ],
      'now'
    );
    const byId = Object.fromEntries(merged.map((d) => [d.drive_file_id, d]));
    expect(byId.a.subject).toBe('Sửa tay');
    expect(byId.a.year).toBe(2019);
    expect(byId.a.tags).toBe('gìn giữ');
    expect(byId.a.size).toBe(2);
    expect(byId.c.subject).toBe('Tiếng Nhật');
    expect(byId.c.year).toBe(2026);
    expect(byId.c.doc_type).toBe('exam');
    expect(byId.b.status).toBe('missing');
    expect(byId.b.subject).toBe('');
  });
});

describe('lọc và chuyển đổi hàng Sheet', () => {
  it('bỏ file missing và lọc theo môn, năm', () => {
    const rec = (id: string, over: Partial<DocumentRecord>): DocumentRecord => ({
      drive_file_id: id,
      name: id,
      subject: 'Toán',
      year: 2025,
      doc_type: 'exam',
      tags: '',
      folder_path: '',
      mime_type: '',
      size: 0,
      modified_time: '',
      indexed_at: '',
      status: 'ok',
      ...over,
    });
    const docs = [rec('1', {}), rec('2', { year: 2024 }), rec('3', { status: 'missing' }), rec('4', { subject: 'Lý' })];
    expect(filterDocuments(docs, { subject: 'toán', year: 2025 }).map((d) => d.drive_file_id)).toEqual(['1']);
  });

  it('khứ hồi hàng Sheet giữ nguyên dữ liệu', () => {
    const d: DocumentRecord = {
      drive_file_id: 'x',
      name: 'n',
      subject: 's',
      year: 2025,
      doc_type: 'answer',
      tags: 't',
      folder_path: 'p',
      mime_type: 'm',
      size: 7,
      modified_time: 'mt',
      indexed_at: 'ia',
      status: 'ok',
    };
    expect(rowToRecord(recordToRow(d))).toEqual(d);
  });

  it('đọc service account dạng JSON hoặc base64', () => {
    const json = JSON.stringify({ client_email: 'a@b.iam', private_key: 'k' });
    expect(parseServiceAccount(json).client_email).toBe('a@b.iam');
    expect(parseServiceAccount(Buffer.from(json).toString('base64')).client_email).toBe('a@b.iam');
    expect(() => parseServiceAccount('{"x":1}')).toThrow();
  });
});
