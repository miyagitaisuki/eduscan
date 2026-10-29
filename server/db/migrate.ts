import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPgDb } from './client';

const here = path.dirname(fileURLToPath(import.meta.url));

// Tìm thư mục migration: chạy bằng tsx (server/db), bản bundle (dist/), hoặc từ thư mục gốc (Docker)
export function resolveMigrationsFolder(): string {
  const candidates = [
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(here, '../../drizzle'),
    path.resolve(here, '../drizzle'),
    path.resolve(here, 'drizzle'),
  ];
  const found = candidates.find((c) => fs.existsSync(path.join(c, 'meta', '_journal.json')));
  if (!found) throw new Error('Không tìm thấy thư mục migration (drizzle/).');
  return found;
}

// Khóa advisory để hai instance khởi động cùng lúc (deploy chồng nhau) không chạy migration song song
const MIGRATION_LOCK_ID = 727274;

export async function runMigrations(connectionString: string) {
  const { db, pool } = createPgDb(connectionString);
  // Kết nối riêng giữ khóa, để không chiếm chỗ của migration khi pool nhỏ
  const { pool: lockPool } = createPgDb(connectionString);
  const lock = await lockPool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await migrate(db, { migrationsFolder: resolveMigrationsFolder() });
    console.log('[db] Migration hoàn tất.');
  } finally {
    await lock.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    lock.release();
    await Promise.all([lockPool.end(), pool.end()]);
  }
}
