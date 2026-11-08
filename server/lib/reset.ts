import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { passwordResets } from '../db/schema';
import { hashToken, newId } from './security';
import { sendMail } from './mailer';

export const RESET_TTL_MS = 30 * 60 * 1000;

// Địa chỉ gốc của frontend để tạo link đặt lại mật khẩu.
// Production bắt buộc APP_URL (kiểm tra trong loadConfig); không lấy CORS_ORIGIN vì đó là
// danh sách nguồn được phép gọi API, không phải địa chỉ tin cậy để gửi trong email.
export function appBaseUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Tạo token mới (hủy các token chưa dùng cũ), lưu băm, rồi gửi link qua email.
export async function sendPasswordReset(
  db: AppDb,
  u: { id: string; email: string; fullName: string }
): Promise<boolean> {
  await db
    .delete(passwordResets)
    .where(and(eq(passwordResets.userId, u.id), isNull(passwordResets.usedAt)));

  const token = crypto.randomBytes(32).toString('base64url');
  await db.insert(passwordResets).values({
    id: newId('prs'),
    userId: u.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  const link = `${appBaseUrl()}/reset-password?token=${token}`;
  const html =
    `<p>Xin chào ${escapeHtml(u.fullName)},</p>` +
    `<p>Nhấn vào liên kết sau để đặt lại mật khẩu IMEJI日本語教室 (hiệu lực 30 phút):</p>` +
    `<p><a href="${link}">${link}</a></p>` +
    `<p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`;
  return sendMail(u.email, 'IMEJI日本語教室: Đặt lại mật khẩu', html);
}
