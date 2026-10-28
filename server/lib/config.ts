import crypto from 'crypto';

export interface AppConfig {
  isProd: boolean;
  jwtSecret: string;
  seedPassword: string;
  /** true khi SEED_PASSWORD được sinh ngẫu nhiên (chỉ production, cần in ra một lần) */
  seedPasswordGenerated: boolean;
  corsOrigins: string[];
  trustProxy: boolean | number;
  geminiApiKey?: string;
  geminiModel: string;
}

// Đọc và kiểm tra cấu hình. Production thiếu biến bắt buộc thì dừng ngay thay vì chạy với giá trị mặc định.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProd = env.NODE_ENV === 'production';

  if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET là bắt buộc khi NODE_ENV=production và phải dài ít nhất 32 ký tự.');
  }

  const seedGenerated = !env.SEED_PASSWORD && isProd;
  const seedPassword = env.SEED_PASSWORD || (isProd ? crypto.randomBytes(9).toString('base64url') : '123456');

  return {
    isProd,
    jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
    seedPassword,
    seedPasswordGenerated: seedGenerated,
    corsOrigins: (env.CORS_ORIGIN || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    // Sau reverse proxy / nền tảng cloud (Cloud Run, Render...) để lấy đúng IP cho rate limit
    trustProxy: env.TRUST_PROXY ? (env.TRUST_PROXY === 'true' ? true : Number(env.TRUST_PROXY)) : isProd ? 1 : false,
    geminiApiKey: env.GEMINI_API_KEY || undefined,
    geminiModel: env.GEMINI_MODEL || 'gemini-3.8-flash',
  };
}
