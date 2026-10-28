import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { notifications } from '../db/schema';
import { notificationDto } from '../lib/dto';
import { ah, AuthedRequest } from '../lib/http';
import type { Deps } from './deps';

export function notificationRoutes({ db, auth }: Deps) {
  const r = Router();

  // Luôn trả thông báo của người đang đăng nhập
  r.get(
    '/',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.user.id))
        .orderBy(desc(notifications.createdAt));
      return res.json(rows.map(notificationDto));
    })
  );

  r.put(
    '/:id/read',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user.id)));
      return res.json({ success: true });
    })
  );

  return r;
}
