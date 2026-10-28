import crypto from 'crypto';

const HASH_PREFIX = 'scrypt$';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${HASH_PREFIX}${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.startsWith(HASH_PREFIX)) return false;
  const [, salt, hash] = stored.split('$');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function signJwt(payload: Record<string, unknown>, secret: string, ttlSeconds = 7 * 24 * 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): Record<string, any> | null {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
    const a = Buffer.from(s);
    const e = Buffer.from(expected);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function randomPassword(): string {
  return crypto.randomBytes(5).toString('base64url');
}

// Độ dài tối thiểu cho mật khẩu mới (đổi mật khẩu, đặt lại, admin đặt)
export const MIN_PASSWORD_LENGTH = 8;

// Mật khẩu tự sinh dài 12 ký tự, đủ mạnh và đạt độ dài tối thiểu
export function generatePassword(): string {
  return crypto.randomBytes(9).toString('base64url');
}

// Băm token đặt lại mật khẩu: chỉ lưu băm, không lưu token gốc
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newSessionCode(): string {
  return `ES-${crypto.randomInt(1000, 10000)}`;
}
