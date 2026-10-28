import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AuthUser } from '../middleware/auth';

export type AuthedRequest = Request & { user: AuthUser };

// Express 4 không tự bắt lỗi của handler async: bọc để lỗi đi vào middleware xử lý lỗi.
export const ah =
  (fn: (req: any, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const TEACHER_ROLES = ['teacher', 'admin'] as const;
export const isStudent = (req: AuthedRequest) => req.user.role === 'student';

// Ngày hiện tại theo giờ địa phương (mặc định Việt Nam), không phải UTC
export const todayStr = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TZ || 'Asia/Ho_Chi_Minh' }).format(d);
