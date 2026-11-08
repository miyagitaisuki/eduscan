import { describe, it, expect } from 'vitest';
import { tuitionCollected, tuitionDebt } from '../../src/shared/utils/tuition';
import { dedupeAttendanceByDay } from '../../src/shared/utils/attendance';

describe('học phí: đóng một phần', () => {
  it('nợ và đã thu tính theo paid_amount', () => {
    const partial = { status: 'partial' as const, amount: 800000, paid_amount: 300000 };
    expect(tuitionDebt(partial)).toBe(500000);
    expect(tuitionCollected(partial)).toBe(300000);
    expect(tuitionDebt({ status: 'unpaid', amount: 800000, paid_amount: 0 })).toBe(800000);
    expect(tuitionDebt({ status: 'paid', amount: 800000, paid_amount: 800000 })).toBe(0);
    expect(tuitionCollected({ status: 'paid', amount: 800000, paid_amount: 700000 })).toBe(700000);
  });
});

describe('điểm danh: một ngày chỉ tính một lần', () => {
  it('gộp bản ghi QR và điểm danh nhanh cùng ngày, ưu tiên có mặt', () => {
    const base = { student_id: 's1', class_id: 'c1', date: '2026-11-01' };
    const out = dedupeAttendanceByDay([
      { ...base, status: 'absent' as const },
      { ...base, status: 'present' as const },
      { ...base, date: '2026-11-02', status: 'absent' as const },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.date === '2026-11-01')?.status).toBe('present');
  });
});
