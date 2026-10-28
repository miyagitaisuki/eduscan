import type { AppDb } from '../db/client';
import { auditLogs } from '../db/schema';
import { newId } from './security';

// Ghi nhật ký thao tác quản trị. Tuyệt đối không đưa mật khẩu hay token vào meta.
export async function audit(
  db: AppDb,
  actorId: string | null,
  action: string,
  targetId: string | null,
  meta?: Record<string, unknown>
) {
  await db.insert(auditLogs).values({ id: newId('aud'), actorId, action, targetId, meta: meta ?? null });
}
