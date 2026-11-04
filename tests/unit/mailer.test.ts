import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendMail } from '../../server/lib/mailer';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.MAIL_FROM;
});

describe('sendMail', () => {
  it('lỗi từ Resend: trả false và ghi nội dung lỗi nhưng không lộ khóa API', async () => {
    process.env.RESEND_API_KEY = 're_secret_key';
    process.env.MAIL_FROM = 'EduScan <no-reply@x.vn>';
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 403,
      text: async () => '{"statusCode":403,"name":"validation_error","message":"The x.vn domain is not verified."}',
    }));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendMail('a@b.vn', 's', '<p>x</p>')).toBe(false);
    const logged = err.mock.calls.flat().join(' ');
    expect(logged).toContain('403');
    expect(logged).toContain('domain is not verified');
    expect(logged).not.toContain('re_secret_key');
  });

  it('thành công trả true; thiếu cấu hình trả false mà không gọi mạng', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await sendMail('a@b.vn', 's', 'h')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = 'k';
    process.env.MAIL_FROM = 'x@x.vn';
    expect(await sendMail('a@b.vn', 's', 'h')).toBe(true);
  });
});
