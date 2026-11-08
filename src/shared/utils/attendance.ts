import type { AttendanceRecord } from '../types';

// Một học viên có thể có nhiều bản ghi trong cùng một ngày của một lớp (phiên QR và phiên điểm danh nhanh).
// Thống kê phải đếm theo ngày học, không theo bản ghi, nếu không buổi đó bị tính hai lần.
const PRIORITY: Record<AttendanceRecord['status'], number> = { present: 3, late: 2, excused: 1, absent: 0 };

/** Giữ một bản ghi cho mỗi (học viên, lớp, ngày): ưu tiên có mặt > đi muộn > có phép > vắng */
export function dedupeAttendanceByDay<T extends Pick<AttendanceRecord, 'student_id' | 'class_id' | 'date' | 'status'>>(
  records: T[]
): T[] {
  const best = new Map<string, T>();
  for (const r of records) {
    const key = `${r.student_id}|${r.class_id}|${r.date}`;
    const cur = best.get(key);
    if (!cur || PRIORITY[r.status] > PRIORITY[cur.status]) best.set(key, r);
  }
  return [...best.values()];
}
