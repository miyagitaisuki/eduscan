import { describe, it, expect } from 'vitest';
import { parseScheduleDays } from '../../src/shared/utils/schedule';

describe('parseScheduleDays', () => {
  it('đọc dạng "Thứ 2 - 4 - 6" và bỏ phần giờ trong ngoặc', () => {
    expect(parseScheduleDays('Thứ 2 - 4 - 6 (18:00 - 19:30)')).toEqual([1, 3, 5]);
  });
  it('đọc Chủ Nhật', () => {
    expect(parseScheduleDays('Chủ Nhật (08:30 - 11:30)')).toEqual([0]);
  });
  it('đọc thứ 7 là thứ Bảy', () => {
    expect(parseScheduleDays('Thứ 7')).toEqual([6]);
  });
  it('đọc kết hợp thứ và chủ nhật', () => {
    expect(parseScheduleDays('Thứ 7 & Chủ nhật')).toEqual([0, 6]);
  });
  it('đọc dạng chữ', () => {
    expect(parseScheduleDays('Thứ Ba, Thứ Năm')).toEqual([2, 4]);
  });
  it('đọc dạng T2, T4', () => {
    expect(parseScheduleDays('T2, T4')).toEqual([1, 3]);
  });
  it('chuỗi rỗng hoặc không nhận ra thì trả mảng rỗng, không đoán', () => {
    expect(parseScheduleDays('')).toEqual([]);
    expect(parseScheduleDays(undefined)).toEqual([]);
    expect(parseScheduleDays('Linh hoạt (18:00 - 19:30)')).toEqual([]);
  });
});
