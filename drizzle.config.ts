import { defineConfig } from 'drizzle-kit';

// Chỉ dùng để sinh migration (drizzle-kit generate). Chạy migration thật dùng server/db/migrate.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
});
