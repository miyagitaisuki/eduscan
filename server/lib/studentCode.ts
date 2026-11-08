import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { AppDb } from '../db/client';
import { users } from '../db/schema';

// Mã học viên tự sinh, không trùng mã đang có (cột không có unique index nên phải tự kiểm tra)
export async function newStudentCode(db: AppDb, reserved: Set<string> = new Set()): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = `STU${crypto.randomInt(100000, 1000000)}`;
    if (reserved.has(code)) continue;
    const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.studentCode, code)).limit(1);
    if (!dup) {
      reserved.add(code);
      return code;
    }
  }
  return `STU${Date.now()}`.slice(0, 50);
}
