import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { GoogleGenAI } from '@google/genai';
import type { AppDb } from './db/client';
import type { AppConfig } from './lib/config';
import { createAuth } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { classRoutes } from './routes/classes';
import { studentRoutes } from './routes/students';
import { attendanceRoutes } from './routes/attendance';
import { homeworkRoutes } from './routes/homework';
import { tuitionRoutes } from './routes/tuition';
import { notificationRoutes } from './routes/notifications';
import { aiRoutes } from './routes/ai';
import { adminRoutes } from './routes/admin';
import { teacherRoutes } from './routes/teachers';

export const PUBLIC_API_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

export interface CreateAppOptions {
  db: AppDb;
  config: AppConfig;
  ai?: GoogleGenAI | null;
}

// Tạo app Express (không listen). Dùng chung cho server thật và kiểm thử.
export function createApp({ db, config, ai = null }: CreateAppOptions) {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // CSP bật ở production. Dev tắt vì Vite HMR cần script inline và websocket.
  // Ảnh đại diện có thể đến từ bất kỳ https nào (dicebear, unsplash, ảnh do người dùng nhập).
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'"],
              workerSrc: ["'self'", 'blob:'],
              manifestSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    })
  );
  // Không có CORS_ORIGIN thì chỉ cho phép cùng nguồn
  app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', system: 'EduScan AI Ecosystem API', version: '3.0', hasApiKey: !!ai, time: new Date().toISOString() });
  });

  const auth = createAuth(db, config.jwtSecret);
  const deps = { db, config, auth, ai };

  // Cổng toàn cục: mọi /api đều cần token, trừ các route công khai
  app.use('/api', (req, res, next) => {
    if (PUBLIC_API_PATHS.has(req.originalUrl.split('?')[0])) return next();
    return auth.requireAuth(req, res, next);
  });

  app.use('/api/auth', authRoutes(deps));
  app.use('/api/classes', classRoutes(deps));
  app.use('/api/students', studentRoutes(deps));
  app.use('/api/attendance', attendanceRoutes(deps));
  app.use('/api', homeworkRoutes(deps));
  app.use('/api/tuition', tuitionRoutes(deps));
  app.use('/api/notifications', notificationRoutes(deps));
  app.use('/api/ai', aiRoutes(deps));
  app.use('/api/admin', adminRoutes(deps));
  app.use('/api/teachers', teacherRoutes(deps));

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Không tìm thấy API này.' });
  });

  // Xử lý lỗi tập trung: không lộ chi tiết lỗi nội bộ ra ngoài
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
    console.error('[server] Lỗi không xử lý được:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' });
  });

  return app;
}
