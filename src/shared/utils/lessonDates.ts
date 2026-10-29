import type { Lesson } from '../types';

// Ngày học là chuỗi YYYY-MM-DD thuần. Phân tích bằng UTC chỉ để lấy thứ trong tuần,
// không phụ thuộc múi giờ của trình duyệt.

const SHORT_DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const LONG_DAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Thứ trong tuần của một ngày: 0 = Chủ Nhật ... 6 = Thứ Bảy */
export const weekdayOfDate = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** "T2 07/01" */
export function shortLessonDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${SHORT_DAY[weekdayOfDate(date)]} ${d}/${m}`;
}

/** "Thứ Hai, 07/01/2030" */
export function longLessonDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${LONG_DAY[weekdayOfDate(date)]}, ${d}/${m}/${y}`;
}

/** Thứ tự hiển thị chọn thứ: Thứ 2 ... Thứ 7, Chủ Nhật */
export const WEEKDAY_PICKER: { value: number; label: string }[] = [1, 2, 3, 4, 5, 6, 0].map((value) => ({
  value,
  label: SHORT_DAY[value],
}));

/** Buổi học đang diễn ra hôm nay của một lớp (không tính buổi đã hủy) */
export function lessonOnDate(lessons: Lesson[], classId: string, date: string): Lesson | undefined {
  return lessons.find((l) => l.class_id === classId && l.lesson_date === date && l.status !== 'cancelled');
}
