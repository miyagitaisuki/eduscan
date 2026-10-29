import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import request from 'supertest';
import * as schema from '../server/db/schema';
import { createApp } from '../server/app';
import { loadConfig, AppConfig } from '../server/lib/config';
import { seedDatabase } from '../server/seed';
import { createQrSigner, QR_WINDOW_SECONDS } from '../server/lib/qr';
import type { AppDb } from '../server/db/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SEED_PASSWORD = '123456';

// Mỗi test dùng một Postgres trong bộ nhớ riêng (PGlite) với đầy đủ migration và dữ liệu demo.
export async function createTestContext(configOverrides: Partial<AppConfig> = {}) {
  const client = new PGlite();
  const drz = drizzle(client, { schema });
  await migrate(drz, { migrationsFolder: path.join(root, 'drizzle') });
  const db = drz as unknown as AppDb;

  await seedDatabase(db, { seedPassword: SEED_PASSWORD, demo: true, teacherName: 'ThS. Nguyễn Thanh Quang' });

  const config: AppConfig = { ...loadConfig({} as NodeJS.ProcessEnv), ...configOverrides };
  const app = createApp({ db, config, ai: null });
  const api = request(app);

  async function login(email: string, password = SEED_PASSWORD): Promise<string> {
    const res = await api.post('/api/auth/login').send({ email, password });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
    return res.body.token as string;
  }

  return { db, app, api, config, login, close: () => client.close() };
}

export const TEACHER = 'teacher@eduscan.edu.vn';
export const STUDENT_AN = 'student@qnu.edu.vn';
export const STUDENT_MAI = 'mai.le@qnu.edu.vn';
export const STUDENT_DUNG = 'dung.tran@qnu.edu.vn';
export const ADMIN = 'admin@eduscan.edu.vn';

// Mã QR được server ký cho một phiên, dịch lùi `offsetPeriods` chu kỳ (âm = chu kỳ tương lai)
export function signedQr(config: AppConfig, sessionId: string, offsetPeriods = 0) {
  return createQrSigner(config.jwtSecret).build(sessionId, Date.now() - offsetPeriods * QR_WINDOW_SECONDS * 1000).payload;
}
