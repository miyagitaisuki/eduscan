import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import request from 'supertest';
import * as schema from '../../server/db/schema';
import { createApp } from '../../server/app';
import { loadConfig } from '../../server/lib/config';
import { createPgDb, sslConfig, stripPrismaParams } from '../../server/db/client';
import { seedDatabase } from '../../server/seed';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../../server/db/client';

/**
 * Kiểm thử đồng thời trên Postgres thật (không phải PGlite).
 *
 * PGlite chỉ có một kết nối nên không thể tái hiện race condition thật. Test này
 * được bật khi đặt EDUSCAN_TEST_DATABASE_URL trỏ tới một Postgres dùng riêng cho test.
 *
 * An toàn: chỉ chạy khi tên database chứa "test"; test tự tạo một database con
 * (<tên>_it_<random>), chạy migration + seed, rồi xóa database đó sau khi xong.
 *
 * Ví dụ:
 *   EDUSCAN_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/eduscan_test \
 *     npm run test -- tests/integration/postgres-concurrency.test.ts
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_URL = process.env.EDUSCAN_TEST_DATABASE_URL;
const baseDbName = BASE_URL ? new URL(BASE_URL).pathname.replace(/^\//, '') : '';
const enabled = !!BASE_URL && /test/i.test(baseDbName);

const describePg = enabled ? describe : describe.skip;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

let adminPool: Pool | undefined;
let pool: Pool | undefined;
let db: AppDb | undefined;
let api: ReturnType<typeof request>;
let testDbName = '';
let adminToken = '';

beforeAll(async () => {
  if (!enabled) return;

  adminPool = new Pool({ connectionString: stripPrismaParams(BASE_URL!), ssl: sslConfig() });
  testDbName = `${baseDbName}_it_${crypto.randomBytes(4).toString('hex')}`.toLowerCase();
  await adminPool.query(`CREATE DATABASE ${quoteIdent(testDbName)}`);

  const url = new URL(BASE_URL!);
  url.pathname = `/${testDbName}`;
  const made = createPgDb(url.toString());
  pool = made.pool;
  db = made.db;

  await migrate(db, { migrationsFolder: path.join(root, 'drizzle') });
  await seedDatabase(db, { seedPassword: '123456', demo: true, teacherName: 'IT Postgres' });

  const app = createApp({ db, config: loadConfig({} as NodeJS.ProcessEnv), ai: null as any });
  api = request(app);
  const login = await api.post('/api/auth/login').send({ email: 'admin@eduscan.edu.vn', password: '123456' });
  expect(login.status).toBe(200);
  adminToken = login.body.token;
});

afterAll(async () => {
  await pool?.end();
  if (adminPool && testDbName) {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName]
    );
    await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdent(testDbName)}`);
  }
  await adminPool?.end();
});

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

describePg('Postgres thật: đồng thời và ràng buộc duy nhất', () => {
  it('hai lần thu học phí cùng tháng chỉ tạo một hồ sơ', async () => {
    const month = '05/2031';
    const [a, b] = await Promise.all([
      api.post('/api/tuition/payment').set(auth()).send({ student_id: 'usr-student-2', month, amount: 500000 }),
      api.post('/api/tuition/payment').set(auth()).send({ student_id: 'usr-student-2', month, amount: 500000 }),
    ]);
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);

    const rows = await db!
      .select()
      .from(schema.tuitionRecords)
      .where(and(eq(schema.tuitionRecords.studentId, 'usr-student-2'), eq(schema.tuitionRecords.month, month)));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('paid');
    expect(rows[0].paidAmount).toBe(500000);
  });

  it('hai yêu cầu tạo hồ sơ học phí cùng tháng: một thành công, một báo trùng', async () => {
    const month = '06/2031';
    const [a, b] = await Promise.all([
      api.post('/api/tuition').set(auth()).send({ student_id: 'usr-student-3', month, amount: 100000 }),
      api.post('/api/tuition').set(auth()).send({ student_id: 'usr-student-3', month, amount: 100000 }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const rows = await db!
      .select()
      .from(schema.tuitionRecords)
      .where(and(eq(schema.tuitionRecords.studentId, 'usr-student-3'), eq(schema.tuitionRecords.month, month)));
    expect(rows).toHaveLength(1);
  });

  it('hai lần mở điểm danh đồng thời chỉ để lại một phiên đang mở', async () => {
    const [a, b] = await Promise.all([
      api.post('/api/attendance/session').set(auth()).send({ class_id: 'cls-n5-01' }),
      api.post('/api/attendance/session').set(auth()).send({ class_id: 'cls-n5-01' }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);

    const active = await db!
      .select()
      .from(schema.attendanceSessions)
      .where(and(eq(schema.attendanceSessions.classId, 'cls-n5-01'), eq(schema.attendanceSessions.isActive, true)));
    expect(active).toHaveLength(1);
  });
});
