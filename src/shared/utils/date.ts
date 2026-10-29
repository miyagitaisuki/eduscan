// Ngày theo giờ địa phương, định dạng YYYY-MM-DD.
// Không dùng toISOString(): nó trả về giờ UTC nên từ 0h đến 7h sáng giờ Việt Nam sẽ ra ngày hôm qua.

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayLocal(): string {
  return formatLocalDate(new Date());
}

/** Ngày cách hôm nay `days` ngày (giờ địa phương) */
export function addDaysLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}
