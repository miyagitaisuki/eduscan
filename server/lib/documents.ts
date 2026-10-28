import { google, drive_v3, sheets_v4 } from 'googleapis';
import type { Readable } from 'stream';

// Thư viện tài liệu: Drive lưu file gốc, Google Sheet làm chỉ mục (một dòng cho mỗi file).
// Chỉ mục được đồng bộ từ Drive; giáo viên có thể sửa tay môn/năm/loại trên Sheet, lần đồng bộ sau sẽ giữ lại.

export const DOC_TYPES = ['exam', 'answer', 'material'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

export const SHEET_TAB = 'documents';
// Thứ tự cột trên Sheet. Đổi thứ tự này là phá chỉ mục hiện có.
export const SHEET_COLUMNS = [
  'drive_file_id',
  'name',
  'subject',
  'year',
  'doc_type',
  'tags',
  'folder_path',
  'mime_type',
  'size',
  'modified_time',
  'indexed_at',
  'status',
] as const;
type Column = (typeof SHEET_COLUMNS)[number];

export interface DocumentRecord {
  drive_file_id: string;
  name: string;
  subject: string;
  year: number | null;
  doc_type: DocType;
  tags: string;
  folder_path: string;
  mime_type: string;
  size: number;
  modified_time: string;
  indexed_at: string;
  status: 'ok' | 'missing';
}

export interface DocumentFilter {
  q?: string;
  subject?: string;
  year?: number;
  type?: DocType;
}

// ---- Phân tích metadata từ đường dẫn thư mục và tên file ----
// Quy ước: <Môn>/<Năm>/<Loại>/<file>. Mọi phần đều không bắt buộc; thiếu thì để trống để giáo viên sửa trên Sheet.

export function inferDocType(name: string): DocType {
  const n = name.toLowerCase();
  if (/đáp\s*án|dap\s*an|answer|key/.test(n)) return 'answer';
  if (/đề|de\s*thi|exam|test/.test(n)) return 'exam';
  return 'material';
}

export function inferYear(segments: string[], name: string): number | null {
  for (const s of [...segments, name]) {
    const m = s.match(/\b(20\d{2})\b/);
    if (m) return Number(m[1]);
  }
  return null;
}

export function inferSubject(segments: string[]): string {
  return segments[0]?.trim() ?? '';
}

export function isDocMime(mime: string): boolean {
  return mime in DOC_MIME_TYPES;
}

// Lọc danh sách đã có chỉ mục (bỏ file bị xóa khỏi Drive)
export function filterDocuments(docs: DocumentRecord[], f: DocumentFilter): DocumentRecord[] {
  const q = f.q?.trim().toLowerCase();
  const subject = f.subject?.trim().toLowerCase();
  return docs.filter((d) => {
    if (d.status !== 'ok') return false;
    if (subject && d.subject.toLowerCase() !== subject) return false;
    if (f.year && d.year !== f.year) return false;
    if (f.type && d.doc_type !== f.type) return false;
    if (q) {
      const hay = `${d.name} ${d.subject} ${d.tags}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---- Chuyển đổi hàng Sheet <-> bản ghi ----

export function rowToRecord(row: string[]): DocumentRecord {
  const get = (c: Column) => (row[SHEET_COLUMNS.indexOf(c)] ?? '').trim();
  const docType = get('doc_type') as DocType;
  const year = Number(get('year'));
  return {
    drive_file_id: get('drive_file_id'),
    name: get('name'),
    subject: get('subject'),
    year: Number.isInteger(year) && year > 0 ? year : null,
    doc_type: (DOC_TYPES as readonly string[]).includes(docType) ? docType : 'material',
    tags: get('tags'),
    folder_path: get('folder_path'),
    mime_type: get('mime_type'),
    size: Number(get('size')) || 0,
    modified_time: get('modified_time'),
    indexed_at: get('indexed_at'),
    status: get('status') === 'missing' ? 'missing' : 'ok',
  };
}

export function recordToRow(d: DocumentRecord): string[] {
  const values: Record<Column, string> = {
    drive_file_id: d.drive_file_id,
    name: d.name,
    subject: d.subject,
    year: d.year ? String(d.year) : '',
    doc_type: d.doc_type,
    tags: d.tags,
    folder_path: d.folder_path,
    mime_type: d.mime_type,
    size: String(d.size),
    modified_time: d.modified_time,
    indexed_at: d.indexed_at,
    status: d.status,
  };
  return SHEET_COLUMNS.map((c) => values[c]);
}

// ---- Đồng bộ: trộn file hiện có trên Drive với chỉ mục cũ ----
// Giữ nguyên các trường giáo viên sửa tay (subject, year, doc_type, tags) nếu file đã có trong chỉ mục.

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  folderPath: string[];
}

export function mergeIndex(existing: DocumentRecord[], driveFiles: DriveFile[], now: string): DocumentRecord[] {
  const byId = new Map(existing.map((d) => [d.drive_file_id, d]));
  const seen = new Set<string>();
  const out: DocumentRecord[] = [];

  for (const f of driveFiles) {
    seen.add(f.id);
    const prev = byId.get(f.id);
    const segments = f.folderPath;
    out.push({
      drive_file_id: f.id,
      name: f.name,
      subject: prev?.subject || inferSubject(segments),
      year: prev?.year ?? inferYear(segments, f.name),
      doc_type: prev?.doc_type || inferDocType(f.name),
      tags: prev?.tags ?? '',
      folder_path: segments.join('/'),
      mime_type: f.mimeType,
      size: f.size,
      modified_time: f.modifiedTime,
      indexed_at: now,
      status: 'ok',
    });
  }

  // File đã biến mất khỏi Drive: giữ dòng nhưng đánh dấu missing để không mất ghi chú thủ công
  for (const d of existing) {
    if (!seen.has(d.drive_file_id)) out.push({ ...d, status: 'missing' });
  }
  return out;
}

// ---- Adapter Google (Drive + Sheets) ----

export interface DocumentStore {
  list(filter: DocumentFilter): Promise<DocumentRecord[]>;
  findOk(driveFileId: string): Promise<DocumentRecord | null>;
  sync(): Promise<{ scanned: number; added: number; missing: number; total: number }>;
  openFile(driveFileId: string): Promise<{ stream: Readable; name: string; mimeType: string; size: number }>;
}

export interface GoogleDocsOptions {
  credentials: Record<string, unknown>;
  folderId: string;
  sheetId: string;
  cacheMs?: number;
}

export function createGoogleDocumentStore(opts: GoogleDocsOptions): DocumentStore {
  const auth = new google.auth.GoogleAuth({
    credentials: opts.credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
  const drive: drive_v3.Drive = google.drive({ version: 'v3', auth });
  const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth });
  const cacheMs = opts.cacheMs ?? 60_000;

  let cache: { at: number; docs: DocumentRecord[] } | null = null;

  async function readIndex(): Promise<DocumentRecord[]> {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: opts.sheetId,
      range: `${SHEET_TAB}!A2:L`,
    });
    return (res.data.values ?? [])
      .map((r) => rowToRecord(r as string[]))
      .filter((d) => d.drive_file_id);
  }

  async function cachedIndex(): Promise<DocumentRecord[]> {
    if (cache && Date.now() - cache.at < cacheMs) return cache.docs;
    const docs = await readIndex();
    cache = { at: Date.now(), docs };
    return docs;
  }

  // Liệt kê đệ quy mọi file trong thư mục gốc, kèm đường dẫn thư mục cha
  async function listDriveFiles(): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    async function walk(folderId: string, path: string[]) {
      let pageToken: string | undefined;
      do {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
          pageSize: 200,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        for (const f of res.data.files ?? []) {
          if (!f.id || !f.name || !f.mimeType) continue;
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            await walk(f.id, [...path, f.name]);
          } else if (isDocMime(f.mimeType)) {
            out.push({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: Number(f.size) || 0,
              modifiedTime: f.modifiedTime ?? '',
              folderPath: path,
            });
          }
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    }
    await walk(opts.folderId, []);
    return out;
  }

  return {
    async list(filter) {
      return filterDocuments(await cachedIndex(), filter);
    },

    async findOk(driveFileId) {
      const docs = await cachedIndex();
      return docs.find((d) => d.drive_file_id === driveFileId && d.status === 'ok') ?? null;
    },

    async sync() {
      const [files, existing] = await Promise.all([listDriveFiles(), readIndex()]);
      const now = new Date().toISOString();
      const merged = mergeIndex(existing, files, now);
      const values: string[][] = [[...SHEET_COLUMNS], ...merged.map(recordToRow)];
      await sheets.spreadsheets.values.clear({ spreadsheetId: opts.sheetId, range: `${SHEET_TAB}!A:L` });
      await sheets.spreadsheets.values.update({
        spreadsheetId: opts.sheetId,
        range: `${SHEET_TAB}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
      cache = null;
      const existingIds = new Set(existing.map((d) => d.drive_file_id));
      const added = files.filter((f) => !existingIds.has(f.id)).length;
      return {
        scanned: files.length,
        added,
        missing: merged.filter((d) => d.status === 'missing').length,
        total: merged.length,
      };
    },

    async openFile(driveFileId) {
      const meta = await drive.files.get({
        fileId: driveFileId,
        fields: 'name, mimeType, size',
        supportsAllDrives: true,
      });
      const res = await drive.files.get(
        { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      return {
        stream: res.data as unknown as Readable,
        name: meta.data.name ?? 'tai-lieu',
        mimeType: meta.data.mimeType ?? 'application/octet-stream',
        size: Number(meta.data.size) || 0,
      };
    },
  };
}

// Đọc JSON service account từ biến môi trường: chấp nhận JSON thô hoặc base64 của JSON
export function parseServiceAccount(raw: string): Record<string, unknown> {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const parsed = JSON.parse(text);
  if (!parsed.client_email || !parsed.private_key) throw new Error('Service account thiếu client_email hoặc private_key.');
  return parsed;
}
