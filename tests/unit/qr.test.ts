import { describe, it, expect } from 'vitest';
import { createQrSigner, QR_WINDOW_SECONDS } from '../../server/lib/qr';

const SECRET = 'khoa-bi-mat-de-kiem-thu-0123456789abcdef';
const WINDOW = QR_WINDOW_SECONDS * 1000;
const T0 = 1_800_000_000_000 - (1_800_000_000_000 % WINDOW); // đầu một chu kỳ

describe('createQrSigner', () => {
  const qr = createQrSigner(SECRET);

  it('mã vừa tạo xác thực được và trả đúng sessionId', () => {
    const { payload } = qr.build('ses-abc', T0 + 1000);
    expect(qr.verify(payload, T0 + 1000)).toEqual({ ok: true, sessionId: 'ses-abc' });
  });

  it('refresh_in_ms là thời gian còn lại đến hết chu kỳ', () => {
    expect(qr.build('ses-abc', T0).refresh_in_ms).toBe(WINDOW);
    expect(qr.build('ses-abc', T0 + 4000).refresh_in_ms).toBe(WINDOW - 4000);
    expect(qr.build('ses-abc', T0 + WINDOW - 1).refresh_in_ms).toBe(1);
  });

  it('chấp nhận chu kỳ hiện tại và liền trước, từ chối từ chu kỳ thứ hai trở đi', () => {
    const { payload } = qr.build('ses-abc', T0);
    expect(qr.verify(payload, T0 + WINDOW - 1).ok).toBe(true);
    expect(qr.verify(payload, T0 + WINDOW).ok).toBe(true);
    expect(qr.verify(payload, T0 + 2 * WINDOW)).toEqual({ ok: false, reason: 'expired' });
    expect(qr.verify(payload, T0 - 1)).toEqual({ ok: false, reason: 'expired' });
  });

  it('đổi sessionId hoặc stamp thì chữ ký sai', () => {
    const [prefix, , stamp, sig] = qr.build('ses-abc', T0).payload.split(':');
    expect(qr.verify(`${prefix}:ses-khac:${stamp}:${sig}`, T0)).toEqual({ ok: false, reason: 'signature' });
    expect(qr.verify(`${prefix}:ses-abc:${Number(stamp) + 1}:${sig}`, T0)).toEqual({ ok: false, reason: 'signature' });
  });

  it('khóa khác thì không xác thực được', () => {
    const { payload } = createQrSigner('mot-khoa-khac-hoan-toan-0123456789abcdef').build('ses-abc', T0);
    expect(qr.verify(payload, T0)).toEqual({ ok: false, reason: 'signature' });
  });

  it('từ chối chuỗi sai định dạng', () => {
    for (const bad of ['', 'EDUSCAN_QR', 'EDUSCAN_QR:a:b', 'EDUSCAN_QR:a:1:b:c', 'OTHER:a:1:b', 'EDUSCAN_QR::1:b', 'EDUSCAN_QR:a:LIVE:b', 'EDUSCAN_QR:a:-1:b']) {
      expect(qr.verify(bad, T0)).toEqual({ ok: false, reason: 'format' });
    }
  });
});
