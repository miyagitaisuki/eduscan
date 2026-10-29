import crypto from 'crypto';

// Mã QR điểm danh có chữ ký: EDUSCAN_QR:<sessionId>:<stamp>:<chữ ký>
// - stamp đổi mỗi QR_WINDOW_SECONDS giây (theo đồng hồ server)
// - chữ ký = HMAC-SHA256(khóa riêng, `${sessionId}.${stamp}`), nên chỉ server mới tạo được mã hợp lệ.
//   Học viên không thể tự dựng mã từ classId hay sessionId như định dạng cũ.
// - mã gắn với đúng một phiên: mở phiên mới thì mã của phiên cũ không còn dùng được.

export const QR_WINDOW_SECONDS = 15;
export const QR_PREFIX = 'EDUSCAN_QR';
const SIGNATURE_LENGTH = 22; // 22 ký tự base64url = 132 bit, đủ chống đoán mà QR vẫn thưa

export type QrVerifyResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: 'format' | 'signature' | 'expired' };

export function createQrSigner(secret: string) {
  // Khóa riêng cho QR, tách khỏi khóa ký JWT
  const key = crypto.createHmac('sha256', secret).update('eduscan:attendance-qr:v1').digest();
  const windowMs = QR_WINDOW_SECONDS * 1000;

  const sign = (sessionId: string, stamp: number) =>
    crypto.createHmac('sha256', key).update(`${sessionId}.${stamp}`).digest('base64url').slice(0, SIGNATURE_LENGTH);

  const stampAt = (nowMs: number) => Math.floor(nowMs / windowMs);

  return {
    /** Mã QR hiện hành của phiên, kèm số mili giây còn lại trước khi phải lấy mã mới */
    build(sessionId: string, nowMs: number = Date.now()) {
      const stamp = stampAt(nowMs);
      return {
        payload: `${QR_PREFIX}:${sessionId}:${stamp}:${sign(sessionId, stamp)}`,
        refresh_in_ms: (stamp + 1) * windowMs - nowMs,
      };
    },

    verify(payload: string, nowMs: number = Date.now()): QrVerifyResult {
      const parts = payload.split(':');
      if (parts.length !== 4 || parts[0] !== QR_PREFIX) return { ok: false, reason: 'format' };
      const [, sessionId, stampStr, signature] = parts;
      if (!sessionId || !/^\d+$/.test(stampStr)) return { ok: false, reason: 'format' };
      const stamp = Number(stampStr);

      const expected = Buffer.from(sign(sessionId, stamp));
      const actual = Buffer.from(signature);
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return { ok: false, reason: 'signature' };
      }

      // Chỉ nhận chu kỳ hiện tại hoặc chu kỳ trước (bù độ trễ mạng)
      const now = stampAt(nowMs);
      if (stamp !== now && stamp !== now - 1) return { ok: false, reason: 'expired' };
      return { ok: true, sessionId };
    },
  };
}

export type QrSigner = ReturnType<typeof createQrSigner>;
