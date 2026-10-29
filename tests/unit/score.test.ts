import { describe, it, expect } from 'vitest';
import { averageScore, formatScore, scoreGrade } from '../../src/shared/utils/score';

describe('averageScore', () => {
  it('giữ một chữ số thập phân thay vì làm tròn về số nguyên', () => {
    expect(averageScore([8.5])).toBe(8.5);
    expect(averageScore([8, 9])).toBe(8.5);
    expect(averageScore([7, 8, 8])).toBe(7.7);
  });
  it('bỏ qua bài chưa có điểm', () => {
    expect(averageScore([null, undefined, 9])).toBe(9);
  });
  it('điểm 0 là điểm hợp lệ, khác với chưa có điểm', () => {
    expect(averageScore([0])).toBe(0);
    expect(averageScore([])).toBeNull();
    expect(averageScore([null])).toBeNull();
  });
});

describe('formatScore', () => {
  it('hiển thị trên thang 10', () => {
    expect(formatScore(8.5)).toBe('8.5/10');
    expect(formatScore(0)).toBe('0/10');
    expect(formatScore(null)).toBe('--');
    expect(formatScore(undefined, 'Chưa có điểm')).toBe('Chưa có điểm');
  });
});

describe('scoreGrade', () => {
  it('xếp loại theo thang 10', () => {
    expect(scoreGrade(9.5)).toMatch(/Xuất sắc/);
    expect(scoreGrade(8)).toMatch(/Giỏi/);
    expect(scoreGrade(7)).toMatch(/Khá/);
    expect(scoreGrade(5)).toMatch(/Trung bình/);
    expect(scoreGrade(3)).toMatch(/cố gắng/);
    expect(scoreGrade(null)).toBe('Chưa có điểm');
  });
});
