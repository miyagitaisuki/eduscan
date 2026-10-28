// Gửi email qua Resend (HTTP API). Thiếu cấu hình thì không gửi và trả về false, không làm hỏng luồng chính.
// Cần: RESEND_API_KEY và MAIL_FROM (địa chỉ đã xác minh domain, ví dụ "EduScan <no-reply@ten-mien.edu.vn>").
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.warn('[mail] Chưa cấu hình RESEND_API_KEY hoặc MAIL_FROM: không gửi được email.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      console.error('[mail] Gửi email thất bại, HTTP', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[mail] Lỗi kết nối tới dịch vụ email:', err);
    return false;
  }
}
