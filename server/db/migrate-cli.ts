import 'dotenv/config';
import { runMigrations } from './migrate';

// Chạy migration: DIRECT_URL=... npm run db:migrate (rơi về DATABASE_URL nếu thiếu)
// Để ở file riêng: nếu đặt trong migrate.ts, bản bundle dist/server.js sẽ tự chạy migration thêm một lần nữa
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Thiếu DIRECT_URL hoặc DATABASE_URL');
  process.exit(1);
}
runMigrations(url).catch((err) => {
  console.error(err);
  process.exit(1);
});
