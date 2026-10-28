import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { users } from '../db/schema';
import { verifyJwt } from '../lib/security';

export interface AuthUser {
  id: string;
  role: 'admin' | 'teacher' | 'student';
  email: string;
  full_name: string;
}

// Xác thực bằng JWT, nhưng kiểm tra lại người dùng trong DB ở mỗi request:
// tài khoản bị xóa hoặc khóa sẽ mất quyền ngay, không chờ token hết hạn.
export function createAuth(db: AppDb, jwtSecret: string) {
  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    // Đã xác thực ở cổng toàn cục: không kiểm tra DB lần thứ hai
    if ((req as any).user) return next();
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu token xác thực.' });
      }
      const payload = verifyJwt(header.slice(7).trim(), jwtSecret);
      if (!payload?.id) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc token không hợp lệ.' });
      }
      const [u] = await db
        .select({ id: users.id, role: users.role, email: users.email, fullName: users.fullName, status: users.status })
        .from(users)
        .where(eq(users.id, payload.id))
        .limit(1);
      if (!u || u.status !== 'active') {
        return res.status(401).json({ error: 'Tài khoản không còn hoạt động.' });
      }
      (req as any).user = { id: u.id, role: u.role, email: u.email, full_name: u.fullName } satisfies AuthUser;
      next();
    } catch (err) {
      next(err);
    }
  }

  function requireRole(...roles: AuthUser['role'][]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user as AuthUser | undefined;
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
      }
      next();
    };
  }

  return {
    requireAuth,
    requireRole,
    requireTeacher: requireRole('teacher', 'admin'),
    requireAdmin: requireRole('admin'),
  };
}
