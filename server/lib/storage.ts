import crypto from 'crypto';

// Lưu tệp bài làm trên Supabase Storage (bucket riêng, private) thay vì nhét base64 vào cột varchar của database.
const BUCKET = 'homework';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

// Nhận chuỗi data URL (data:<mime>;base64,<dữ liệu>) từ trình duyệt và đưa tệp lên Storage.
// Trả về đường dẫn tệp trong bucket để lưu vào attachment_url.
export async function uploadHomeworkAttachment(dataUrl: string, submissionKey: string): Promise<string> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageError('Chưa cấu hình nơi lưu tệp đính kèm.', 503);

  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new StorageError('Tệp đính kèm không hợp lệ.', 400);

  const mime = match[1].toLowerCase();
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw new StorageError('Chỉ chấp nhận ảnh (JPG, PNG, WEBP, HEIC), PDF hoặc DOCX.', 400);

  const body = Buffer.from(match[2], 'base64');
  if (body.length === 0) throw new StorageError('Tệp đính kèm rỗng.', 400);
  if (body.length > MAX_ATTACHMENT_BYTES) throw new StorageError('Tệp đính kèm vượt quá 10 MB.', 413);

  const path = `${submissionKey}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': mime,
      'x-upsert': 'false',
    },
    body,
  });
  if (!res.ok) {
    console.error('[storage] Upload thất bại:', res.status, await res.text().catch(() => ''));
    throw new StorageError('Không lưu được tệp đính kèm. Vui lòng thử lại.', 502);
  }
  return `${BUCKET}/${path}`;
}

// Tạo link tạm thời để xem tệp (mặc định 10 phút). Bucket private nên không có link công khai.
export async function createAttachmentSignedUrl(attachmentPath: string, expiresIn = 600): Promise<string> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageError('Chưa cấu hình nơi lưu tệp đính kèm.', 503);

  const prefix = `${BUCKET}/`;
  if (!attachmentPath.startsWith(prefix)) throw new StorageError('Đường dẫn tệp không hợp lệ.', 400);
  const path = attachmentPath.slice(prefix.length);

  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  const data = (await res.json().catch(() => null)) as { signedURL?: string } | null;
  if (!res.ok || !data?.signedURL) {
    console.error('[storage] Tạo link xem thất bại:', res.status);
    throw new StorageError('Không mở được tệp đính kèm. Vui lòng thử lại.', 502);
  }
  return `${url}/storage/v1${data.signedURL}`;
}

// Xóa tệp khỏi bucket homework theo đường dẫn (không kèm tên bucket). Dùng API bulk delete của Storage.
export async function deleteHomeworkObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageError('Chưa cấu hình nơi lưu tệp đính kèm.', 503);

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) {
    console.error('[storage] Xóa tệp thất bại:', res.status);
    throw new StorageError('Không xóa được tệp hết hạn.', 502);
  }
}

export const HOMEWORK_BUCKET_PREFIX = `${BUCKET}/`;
