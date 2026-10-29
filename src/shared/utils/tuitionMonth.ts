// Tháng học phí theo định dạng "MM/YYYY" (ví dụ "10/2026"), theo giờ địa phương

export function formatTuitionMonth(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function currentTuitionMonth(): string {
  return formatTuitionMonth(new Date());
}

// Các tháng quanh tháng hiện tại: 2 tháng trước đến 2 tháng sau
export function tuitionMonthOptions(): string[] {
  const now = new Date();
  return [-2, -1, 0, 1, 2].map((offset) => formatTuitionMonth(new Date(now.getFullYear(), now.getMonth() + offset, 1)));
}
