export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Chuẩn hóa ngày dạng YYYY-MM-DD từ request:
 * trả chuỗi ngày hợp lệ; null nếu để trống (xóa giá trị); undefined nếu không hợp lệ.
 */
export function parseDateOnly(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !DATE_ONLY.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  // Từ chối ngày không tồn tại như 2026-02-31 (JS tự cuộn sang tháng sau)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) ? v : undefined;
}
