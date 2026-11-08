import { Router } from 'express';
import * as s from '../db/schema';
import { ah } from '../lib/http';
import type { Deps } from './deps';

// Thứ tự bảng theo phụ thuộc khóa ngoại: xóa ngược, nạp xuôi
const TABLES = [
  ['users', s.users],
  ['classes', s.classes],
  ['enrollments', s.enrollments],
  ['lessons', s.lessons],
  ['holidays', s.holidays],
  ['assignments', s.assignments],
  ['submissions', s.submissions],
  ['attendance_sessions', s.attendanceSessions],
  ['attendance_records', s.attendanceRecords],
  ['tuition_records', s.tuitionRecords],
  ['notifications', s.notifications],
] as const;

const TIMESTAMP_FIELDS = new Set(['createdAt', 'checkInTime', 'startTime', 'endTime', 'deadline', 'submittedAt', 'gradedAt', 'aiDraftAt']);
const DATE_FIELDS = new Set(['joinDate', 'sessionDate']);

// JSON không có Date: nạp lại chuỗi thành Date cho các cột timestamp
function revive(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = TIMESTAMP_FIELDS.has(k) && typeof v === 'string' ? new Date(v) : v;
    if (DATE_FIELDS.has(k) && v) out[k] = String(v).slice(0, 10);
  }
  return out;
}

// BUG-01 fix: column whitelist for restore validation — prevents unexpected column injection via restore payload.
const RESTORE_ALLOWED_COLUMNS: Record<string, Set<string>> = {
  users: new Set(['id', 'email', 'passwordHash', 'fullName', 'role', 'studentCode', 'gender', 'avatar', 'phone', 'status', 'mustChangePassword', 'tokenVersion', 'createdAt']),
  classes: new Set(['id', 'name', 'code', 'teacherId', 'description', 'schedule', 'level', 'monthlyFee', 'room', 'startDate', 'weekdays', 'lessonStartTime', 'lessonEndTime', 'endDate', 'createdAt']),
  enrollments: new Set(['id', 'studentId', 'classId', 'joinDate', 'status']),
  lessons: new Set(['id', 'classId', 'lessonDate', 'startTime', 'endTime', 'title', 'notes', 'status', 'manuallyEdited', 'createdAt']),
  holidays: new Set(['id', 'name', 'startDate', 'endDate', 'createdAt']),
  assignments: new Set(['id', 'classId', 'title', 'description', 'sampleSolution', 'rubric', 'kind', 'minnaLesson', 'deadline', 'createdBy', 'createdAt']),
  submissions: new Set(['id', 'assignmentId', 'studentId', 'content', 'attachmentUrl', 'status', 'score', 'feedback', 'rubricBreakdown', 'strengths', 'weaknesses', 'suggestions', 'gradedByAi', 'aiDraft', 'aiDraftAt', 'submittedAt', 'gradedAt']),
  attendance_sessions: new Set(['id', 'classId', 'qrCode', 'sessionCode', 'sessionDate', 'startTime', 'endTime', 'isActive', 'createdAt']),
  attendance_records: new Set(['id', 'sessionId', 'studentId', 'status', 'checkInTime', 'notes']),
  tuition_records: new Set(['id', 'studentId', 'classId', 'month', 'amount', 'paidAmount', 'dueDate', 'paidDate', 'status', 'notes']),
  notifications: new Set(['id', 'userId', 'title', 'message', 'type', 'isRead', 'createdAt']),
};

function validateRestoreRow(tableName: string, row: Record<string, any>): string | null {
  const allowed = RESTORE_ALLOWED_COLUMNS[tableName];
  if (!allowed) return `Bảng không xác định: ${tableName}`;
  const bad = Object.keys(row).find((k) => !allowed.has(k));
  return bad ? `Cột không hợp lệ '${bad}' trong bảng '${tableName}'` : null;
}

export function adminRoutes({ db, auth }: Deps) {
  const r = Router();

  // Sao lưu: file chứa băm mật khẩu nên chỉ admin được tải về
  r.get(
    '/backup',
    auth.requireAdmin,
    ah(async (_req, res) => {
      const tables: Record<string, unknown[]> = {};
      for (const [name, table] of TABLES) {
        tables[name] = await db.select().from(table as any);
      }
      res.setHeader('Content-Disposition', `attachment; filename="eduscan-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      return res.json({ version: 2, exportedAt: new Date().toISOString(), tables });
    })
  );

  // Khôi phục: thay thế toàn bộ dữ liệu. Bắt buộc xác nhận chuỗi RESTORE.
  r.post(
    '/restore',
    auth.requireAdmin,
    ah(async (req, res) => {
      const { confirm, data } = req.body ?? {};
      if (confirm !== 'RESTORE') {
        return res.status(400).json({ error: 'Cần xác nhận bằng chuỗi "RESTORE" để khôi phục dữ liệu.' });
      }
      if (!data || data.version !== 2 || !data.tables || typeof data.tables !== 'object') {
        return res.status(400).json({ error: 'File sao lưu không đúng định dạng (version 2).' });
      }

      // BUG-01 fix: validate every row against the column whitelist before touching the DB.
      for (const [name] of TABLES) {
        const rows: Record<string, any>[] = data.tables[name] ?? [];
        for (const row of rows) {
          const err = validateRestoreRow(name, row);
          if (err) return res.status(400).json({ error: `Dữ liệu không hợp lệ: ${err}` });
        }
      }

      await db.transaction(async (tx) => {
        for (const [, table] of [...TABLES].reverse()) {
          await tx.delete(table as any);
        }
        for (const [name, table] of TABLES) {
          const rows: Record<string, any>[] = data.tables[name] ?? [];
          for (let i = 0; i < rows.length; i += 500) {
            await tx.insert(table as any).values(rows.slice(i, i + 500).map(revive));
          }
        }
      });
      const counts = Object.fromEntries(TABLES.map(([n]) => [n, (data.tables[n] ?? []).length]));
      return res.json({ success: true, counts });
    })
  );

  return r;
}
