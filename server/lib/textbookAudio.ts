import crypto from 'crypto';
import { StorageError } from './storage';

// Âm thanh bài giáo trình (mp3 + srt) lưu trong bucket riêng, private. Mã ♪ (vd "1-01") là tên tệp.
export const TEXTBOOK_AUDIO_BUCKET = 'textbook-audio';
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const AUDIO_CODE = /^\d{1,3}-\d{1,2}$/;
export const SIGNED_URL_SECONDS = 3600;

const env = () => {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageError('Chưa cấu hình nơi lưu âm thanh.', 503);
  return { url, key };
};

/** Thư mục trong bucket theo tên giáo trình; băm để tên tiếng Nhật/Việt không thành đường dẫn lạ. */
export function bookFolder(book: string): string {
  return crypto.createHash('sha256').update(book.normalize('NFC')).digest('hex').slice(0, 16);
}

/** Đưa mp3 (base64 hoặc data URL) và srt (văn bản) lên Storage; trả đường dẫn đối tượng mp3 và srt. */
export async function uploadTextbookAudio(
  book: string,
  code: string,
  mp3Base64: string,
  srtText: string | null
): Promise<{ mp3Path: string; srtPath: string | null }> {
  if (!AUDIO_CODE.test(code)) throw new StorageError('Mã âm thanh không hợp lệ (ví dụ 1-01).', 400);
  const { url, key } = env();
  const folder = bookFolder(book);
  const raw = mp3Base64.replace(/^data:[^;,]+;base64,/, '');
  const mp3 = Buffer.from(raw, 'base64');
  if (mp3.length === 0) throw new StorageError('Tệp mp3 rỗng.', 400);
  if (mp3.length > MAX_AUDIO_BYTES) throw new StorageError('Tệp mp3 vượt quá 15 MB.', 413);
  // Kiểm tra đầu tệp: MP3 bắt đầu bằng "ID3" hoặc khung đồng bộ 0xFFF
  const isMp3 = mp3.subarray(0, 3).toString('latin1') === 'ID3' || (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0);
  if (!isMp3) throw new StorageError('Tệp không phải mp3.', 400);

  const put = async (path: string, body: Uint8Array, mime: string) => {
    const res = await fetch(`${url}/storage/v1/object/${TEXTBOOK_AUDIO_BUCKET}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': mime, 'x-upsert': 'true' },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      console.error('[textbook-audio] Upload thất bại:', res.status);
      throw new StorageError('Không lưu được âm thanh. Vui lòng thử lại.', 502);
    }
  };

  const mp3Path = `${folder}/${code}.mp3`;
  await put(mp3Path, mp3, 'audio/mpeg');
  let srtPath: string | null = null;
  if (srtText && srtText.trim()) {
    srtPath = `${folder}/${code}.srt`;
    await put(srtPath, Buffer.from(srtText, 'utf8'), 'application/x-subrip; charset=utf-8');
  }
  return { mp3Path, srtPath };
}

/** Link nghe tạm thời cho một tệp trong bucket textbook-audio. */
export async function signTextbookAudio(path: string, expiresIn = SIGNED_URL_SECONDS): Promise<string> {
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/sign/${TEXTBOOK_AUDIO_BUCKET}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  const data = (await res.json().catch(() => null)) as { signedURL?: string } | null;
  if (!res.ok || !data?.signedURL) {
    console.error('[textbook-audio] Tạo link nghe thất bại:', res.status);
    throw new StorageError('Không mở được âm thanh. Vui lòng thử lại.', 502);
  }
  return `${url}/storage/v1${data.signedURL}`;
}
