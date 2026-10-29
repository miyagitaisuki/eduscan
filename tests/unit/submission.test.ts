import { describe, it, expect } from 'vitest';
import { isSubmitted, needsGrading } from '../../src/shared/utils/submission';
import { localDateOf } from '../../src/shared/utils/date';

describe('isSubmitted / needsGrading', () => {
  it('bài đã chấm vẫn là bài đã nộp', () => {
    expect(isSubmitted({ status: 'graded' })).toBe(true);
    expect(isSubmitted({ status: 'submitted' })).toBe(true);
    expect(isSubmitted({ status: 'unsubmitted' })).toBe(false);
  });
  it('chỉ bài đã nộp mà chưa có điểm mới cần chấm', () => {
    expect(needsGrading({ status: 'submitted', score: null })).toBe(true);
    expect(needsGrading({ status: 'submitted', score: 0 })).toBe(false);
    expect(needsGrading({ status: 'graded', score: 8 })).toBe(false);
    expect(needsGrading({ status: 'unsubmitted', score: null })).toBe(false);
  });
});

describe('localDateOf', () => {
  it('trả ngày theo giờ địa phương, rỗng khi thiếu hoặc sai', () => {
    expect(localDateOf('')).toBe('');
    expect(localDateOf(null)).toBe('');
    expect(localDateOf('không phải ngày')).toBe('');
    const d = new Date(2026, 10, 5, 23, 30); // 05/11/2026 23:30 giờ máy
    expect(localDateOf(d.toISOString())).toBe('2026-11-05');
  });
});
