import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { loadConfig } from './server/lib/config';
import { createPgDb } from './server/db/client';
import { runMigrations } from './server/db/migrate';
import { seedDatabase } from './server/seed';
import { createApp } from './server/app';
import { createGoogleDocumentStore, parseServiceAccount } from './server/lib/documents';

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const config = loadConfig();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Thiếu DATABASE_URL (chuỗi kết nối Postgres/Supabase).');

  // Migration tự chạy khi khởi động, trừ khi AUTO_MIGRATE=false
  if (process.env.AUTO_MIGRATE !== 'false') {
    // Migration đi qua session pooler (DIRECT_URL, cổng 5432); DATABASE_URL có thể là transaction pooler (6543)
    await runMigrations(process.env.DIRECT_URL || databaseUrl);
  }

  const { db } = createPgDb(databaseUrl);
  const seeded = await seedDatabase(db, {
    seedPassword: config.seedPassword,
    demo: !config.isProd,
    teacherName: process.env.SEED_TEACHER_NAME || (config.isProd ? 'Giáo viên' : 'ThS. Nguyễn Thanh Quang'),
  });
  if (seeded && config.seedPasswordGenerated) {
    console.warn(`[EduScan] Đã tạo tài khoản ban đầu. Mật khẩu admin/teacher (ghi lại ngay): ${config.seedPassword}`);
  }

  const ai = config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;
  const documents = config.documents
    ? createGoogleDocumentStore({
        credentials: parseServiceAccount(config.documents.serviceAccountRaw),
        folderId: config.documents.folderId,
        sheetId: config.documents.sheetId,
      })
    : null;
  const app = createApp({ db, config, ai, documents });

  if (!config.isProd) {
    // Import động: vite là devDependency, không có trong image production
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    // Bản bundle (dist/server.js) có index.html ngay cạnh; chạy bằng tsx thì nằm trong dist/
    const dist = fs.existsSync(path.join(here, 'index.html')) ? here : path.resolve(here, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`EduScan AI running on http://0.0.0.0:${port} (${config.isProd ? 'production' : 'development'})`);
  });
}

main().catch((err) => {
  console.error('[EduScan] Khởi động thất bại:', err);
  process.exit(1);
});
