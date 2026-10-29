import { describe, it, expect } from 'vitest';
import { toClasses, toStudents, toAttendance, toSubmissions, toAssignments, toPayments } from '../../src/app/viewModels';

const cls = { id: 'c1', name: 'N5', level: 'N5', schedule: 'Thứ 2 - 4 - 6 (18:00)', monthly_fee: 800000, created_at: '2026-09-01T03:00:00Z', description: 'ghi chú' } as any;

describe('toClasses', () => {
  it('suy ra ngày học từ chuỗi lịch, không bịa lịch mặc định', () => {
    const [c] = toClasses([cls, { ...cls, id: 'c2', schedule: '' }]);
    expect(c.scheduleDays).toEqual([1, 3, 5]);
    expect(toClasses([{ ...cls, schedule: '' }])[0].scheduleDays).toEqual([]);
  });
  it('giáo viên không nhận học phí lớp thì là 0, không phải số bịa', () => {
    const { monthly_fee: _omit, ...noFee } = cls;
    expect(toClasses([noFee as any])[0].monthly_fee).toBe(0);
  });
  it('lấy ngày bắt đầu từ ngày tạo, rỗng nếu thiếu', () => {
    expect(toClasses([cls])[0].start_date).toBe('2026-09-01');
    expect(toClasses([{ ...cls, created_at: undefined }])[0].start_date).toBe('');
  });
});

describe('toStudents', () => {
  it('lấy cấp độ từ lớp của học viên; không có lớp thì để trống thay vì N5', () => {
    const students = [
      { id: 's1', full_name: 'An', class_id: 'c1', created_at: '2026-09-05T00:00:00Z', student_code: '225' },
      { id: 's2', full_name: 'Mai' },
    ] as any;
    const [a, b] = toStudents(students, [cls]);
    expect(a.level).toBe('N5');
    expect(a.class_id).toBe('c1');
    expect(a.notes).toBe('MSSV: 225');
    expect(b.level).toBe('');
    expect(b.class_id).toBe('');
    expect(b.join_date).toBe('');
  });
});

describe('toSubmissions', () => {
  it('bài đã chấm (graded) được tính là đã nộp; chưa nộp giữ nguyên', () => {
    const subs = [
      { id: '1', assignment_id: 'a', student_id: 's', status: 'graded', score: 8 },
      { id: '2', assignment_id: 'a', student_id: 's', status: 'submitted', score: null },
      { id: '3', assignment_id: 'a', student_id: 's', status: 'unsubmitted', score: null },
    ] as any;
    expect(toSubmissions(subs).map((s) => s.status)).toEqual(['submitted', 'submitted', 'unsubmitted']);
  });
});

describe('các chuyển đổi khác', () => {
  it('điểm danh lấy ngày từ check_in_time khi thiếu date', () => {
    const [r] = toAttendance([{ id: 'r', student_id: 's', status: 'present', check_in_time: '2026-10-05T01:00:00Z' } as any]);
    expect(r.date).toBe('2026-10-05');
    expect(r.class_id).toBe('');
  });
  it('bài tập cắt phần giờ của hạn nộp', () => {
    expect(toAssignments([{ id: 'a', class_id: 'c1', title: 't', description: '', deadline: '2026-11-05T23:59:59Z', created_at: '2026-10-01T00:00:00Z' }])[0].deadline).toBe('2026-11-05');
  });
  it('học phí giữ ngày đóng rỗng là null', () => {
    expect(toPayments([{ id: 't', student_id: 's', month: '10/2026', amount: 1, paid_amount: 0, status: 'unpaid' } as any])[0].paid_date).toBeNull();
  });
});
