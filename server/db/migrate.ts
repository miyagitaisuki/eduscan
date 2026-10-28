import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPgDb } from './client';

// Chạy migration: DIRECT_URL=... npm run db:migrate (rơi về DATABASE_URL nếu thiếu)
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

export async function runMigrations(connectionString: string) {
  const { db, pool } = createPgDb(connectionString);
  try {
    await migrate(db, { migrationsFolder: resolveMigrationsFolder() });
    console.log('[db] Migration hoàn tất.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DIRECT_URL hoặc DATABASE_URL');
    process.exit(1);
  }
  runMigrations(url).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
