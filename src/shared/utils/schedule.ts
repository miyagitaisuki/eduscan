// Suy ra các ngày học trong tuần từ chuỗi lịch học do giáo viên nhập.
// Server chỉ lưu chuỗi tự do (VD "Thứ 2 - 4 - 6 (18:00 - 19:30)", "Chủ Nhật (08:30 - 11:30)"),
// nên dashboard dựa vào hàm này để biết lớp nào học hôm nay.
// Quy ước trả về giống Date.getDay(): 0 = Chủ Nhật, 1 = Thứ Hai ... 6 = Thứ Bảy.

const WORD_TO_DAY: Record<string, number> = {
  hai: 1,
  ba: 2,
  tư: 3,
  tu: 3,
  năm: 4,
  nam: 4,
  sáu: 5,
  sau: 5,
  bảy: 6,
  bay: 6,
};

export function parseScheduleDays(schedule?: string | null): number[] {
  if (!schedule) return [];
  // Bỏ phần giờ trong ngoặc để "18:00" không bị đọc thành số ngày
  const text = schedule.replace(/\([^)]*\)/g, ' ').toLowerCase();
  const days = new Set<number>();

  if (/chủ\s*nhật|chu\s*nhat|\bcn\b/.test(text)) days.add(0);

  // "Thứ 2 - 4 - 6", "T2, T4, T6", "Thứ 3 & 5"
  for (const m of text.matchAll(/(?:thứ|thu|\bt)\s*([2-7](?:\s*(?:-|,|\/|&|và|va|\+)\s*(?:thứ\s*|thu\s*|t)?[2-7])*)/g)) {
    for (const d of m[1].match(/[2-7]/g) ?? []) days.add(Number(d) - 1);
  }

  // "Thứ Hai", "Thứ Tư"
  for (const m of text.matchAll(/thứ\s+(hai|ba|tư|năm|sáu|bảy)/g)) {
    days.add(WORD_TO_DAY[m[1]]);
  }

  return [...days].sort((a, b) => a - b);
}
