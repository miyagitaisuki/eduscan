// Điểm bài tập dùng thang 10 (xem server/routes/homework.ts và HomeworkManagementView)

export const SCORE_MAX = 10;

/** Điểm trung bình làm tròn 1 chữ số thập phân; null nếu chưa có điểm nào */
export function averageScore(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  if (valid.length === 0) return null;
  const avg = valid.reduce((sum, s) => sum + s, 0) / valid.length;
  return Math.round(avg * 10) / 10;
}

/** "8.5/10", "9/10"; chưa có điểm thì trả chuỗi thay thế */
export function formatScore(score: number | null | undefined, fallback = '--'): string {
  return typeof score === 'number' && Number.isFinite(score) ? `${score}/${SCORE_MAX}` : fallback;
}

/** Xếp loại theo điểm trung bình thang 10 */
export function scoreGrade(avg: number | null): string {
  if (avg === null) return 'Chưa có điểm';
  if (avg >= 9) return 'Xếp loại: Xuất sắc (優)';
  if (avg >= 8) return 'Xếp loại: Giỏi (良)';
  if (avg >= 6.5) return 'Xếp loại: Khá';
  if (avg >= 5) return 'Xếp loại: Trung bình';
  return 'Cần cố gắng thêm';
}
