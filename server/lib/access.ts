import { and, eq, inArray } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { classes, enrollments } from '../db/schema';
import type { AuthUser } from '../middleware/auth';

// Phân quyền theo lớp: admin xem và sửa mọi lớp; giáo viên chỉ thao tác trên lớp mình phụ trách
// (classes.teacherId). Học viên không đi qua các hàm này.

export const isAdmin = (user: AuthUser) => user.role === 'admin';

// Danh sách lớp giáo viên được quản lý. Trả về null nếu là admin (không giới hạn).
export async function manageableClassIds(db: AppDb, user: AuthUser): Promise<string[] | null> {
  if (isAdmin(user)) return null;
  const rows = await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, user.id));
  return rows.map((r) => r.id);
}

export async function canManageClass(db: AppDb, user: AuthUser, classId: string | null | undefined): Promise<boolean> {
  if (!classId) return false;
  if (isAdmin(user)) return true;
  const [row] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, user.id)))
    .limit(1);
  return !!row;
}

// Chấm bài và nhận xét: mọi giáo viên/admin đều chấm được bài của mọi lớp.
export const canGradeSubmissions = (user: AuthUser) => user.role === 'teacher' || user.role === 'admin';

// Giáo viên chỉ quản lý học viên đang ghi danh (active) trong một lớp mình phụ trách.
export async function canManageStudent(db: AppDb, user: AuthUser, studentId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  const owned = await manageableClassIds(db, user);
  if (!owned || owned.length === 0) return false;
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, 'active'),
        inArray(enrollments.classId, owned)
      )
    )
    .limit(1);
  return !!row;
}
