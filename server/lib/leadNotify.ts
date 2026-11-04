import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { users, type leads } from '../db/schema';
import { sendMail } from './mailer';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Người nhận: LEADS_NOTIFY_EMAIL (nhiều địa chỉ cách nhau dấu phẩy) hoặc email của các admin đang hoạt động.
export async function leadRecipients(db: AppDb, env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const configured = (env.LEADS_NOTIFY_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length) return configured;
  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
  return admins.map((a) => a.email);
}

// Báo email khi có đăng ký mới. Không bao giờ ném lỗi: việc nhận đăng ký không được phụ thuộc vào email.
export async function notifyNewLead(db: AppDb, lead: typeof leads.$inferSelect): Promise<void> {
  try {
    const to = await leadRecipients(db);
    if (!to.length) return;
    const row = (label: string, value: string | null) =>
      value ? `<tr><td><b>${label}</b></td><td>${escapeHtml(value)}</td></tr>` : '';
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const html =
      `<p>Có đăng ký học thử mới từ website.</p>` +
      `<table cellpadding="4">` +
      row('Họ tên', lead.fullName) +
      row('Số điện thoại', lead.phone) +
      row('Trình độ hiện tại', lead.currentLevel) +
      row('Mục tiêu', lead.targetJlpt) +
      row('Ghi chú', lead.notes) +
      row('Nguồn', lead.source) +
      `</table>` +
      (appUrl ? `<p><a href="${appUrl}/leads">Mở danh sách đăng ký</a></p>` : '');
    const results = await Promise.all(
      to.map((addr) => sendMail(addr, `[IMEJI日本語教室] Đăng ký học thử mới: ${lead.fullName}`, html))
    );
    if (!results.some(Boolean)) console.warn('[leads] Không gửi được email báo đăng ký mới.');
  } catch (err) {
    console.error('[leads] Lỗi khi báo đăng ký mới:', err);
  }
}
