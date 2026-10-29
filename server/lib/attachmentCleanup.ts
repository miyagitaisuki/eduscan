import { and, inArray, isNotNull, lt, ne } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { submissions } from '../db/schema';
import { deleteHomeworkObjects, HOMEWORK_BUCKET_PREFIX } from './storage';

// Tệp đính kèm bài nộp chỉ giữ 14 ngày kể từ ngày nộp để không đầy bộ nhớ Storage.
// Bài chấm (điểm, nhận xét) vẫn giữ nguyên; chỉ xóa tệp và đường dẫn trong database.
export const ATTACHMENT_RETENTION_DAYS = 14;
const BATCH_SIZE = 200;
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function purgeExpiredAttachments(db: AppDb, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let total = 0;

  for (;;) {
    const rows = await db
      .select({ id: submissions.id, path: submissions.attachmentUrl })
      .from(submissions)
      .where(and(isNotNull(submissions.attachmentUrl), ne(submissions.attachmentUrl, ''), lt(submissions.submittedAt, cutoff)))
      .limit(BATCH_SIZE);
    if (rows.length === 0) break;

    const paths = rows.map((r) => r.path as string).filter((p) => p.startsWith(HOMEWORK_BUCKET_PREFIX));
    await deleteHomeworkObjects(paths.map((p) => p.slice(HOMEWORK_BUCKET_PREFIX.length)));
    // Đường dẫn không đúng định dạng cũng được xóa khỏi database để không bị quét lại mãi
    await db
      .update(submissions)
      .set({ attachmentUrl: '' })
      .where(inArray(submissions.id, rows.map((r) => r.id)));
    total += rows.length;
  }
  return total;
}

// Chạy dọn một lần khi khởi động rồi lặp mỗi 6 giờ. Lỗi chỉ ghi log, không làm dừng server.
export function startAttachmentCleanup(db: AppDb): void {
  const run = () =>
    purgeExpiredAttachments(db)
      .then((n) => n > 0 && console.log(`[cleanup] Đã xóa ${n} tệp đính kèm quá ${ATTACHMENT_RETENTION_DAYS} ngày.`))
      .catch((err) => console.error('[cleanup] Dọn tệp hết hạn thất bại:', err?.message || err));
  void run();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
