// CSV cho xuất và nhập học viên. Excel trên Windows đọc đúng tiếng Việt nhờ BOM UTF-8.

/** Ô bắt đầu bằng = + - @ hoặc tab/CR bị Excel hiểu thành công thức: thêm ' phía trước để vô hiệu hóa */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Bỏ dấu tiếng Việt và viết thường để so khớp tên cột, tên lớp, giới tính */
export const foldVi = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
