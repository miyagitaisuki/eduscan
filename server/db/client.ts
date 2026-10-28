import fs from 'fs';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export type AppDb = NodePgDatabase<typeof schema>;

// Kết nối Postgres (Supabase). Supabase yêu cầu SSL.
// Chứng chỉ pooler của Supabase do CA riêng của Supabase ký (Node không tin mặc định):
// đặt DATABASE_CA_CERT để xác thực đầy đủ. Chấp nhận hai dạng:
//  - nội dung PEM của file .crt (dán vào biến môi trường, dùng được khi deploy; "\n" được đổi thành xuống dòng)
//  - đường dẫn tới file .crt (dùng khi chạy local)
// Thiếu CA thì vẫn mã hóa nhưng không xác thực máy chủ.
// Đặt DATABASE_SSL=false chỉ khi chạy Postgres cục bộ không có SSL.

export function sslConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.DATABASE_SSL === 'false') {
    return false;
  }

  if (env.DATABASE_CA_CERT) {
    const value = env.DATABASE_CA_CERT.trim();
    // Nội dung PEM (có header), đường dẫn file có thật, hoặc nội dung thô với \\n được đổi thành xuống dòng
    let ca: string;
    if (value.includes('BEGIN CERTIFICATE')) ca = value.replace(/\\n/g, '\n');
    else if (fs.existsSync(value)) ca = fs.readFileSync(value, 'utf8');
    else ca = value.replace(/\\n/g, '\n');
    return {
      ca,
      rejectUnauthorized: true,
    };
  }

  return {
    rejectUnauthorized: false,
  };
}
export function createPgDb(connectionString: string): {
  db: AppDb;
  pool: Pool;
} {
  const pool = new Pool({
    connectionString: stripPrismaParams(connectionString),
    ssl: sslConfig(),
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}
// Bỏ tham số chỉ dành cho Prisma (pgbouncer, connection_limit...) mà pg không hiểu
export function stripPrismaParams(url: string): string {
  try {
    const u = new URL(url);
    for (const k of ['pgbouncer', 'connection_limit', 'pool_timeout', 'schema']) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}
