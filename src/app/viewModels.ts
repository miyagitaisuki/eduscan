import type { Assignment as ApiAssignment, AttendanceRecord, ClassItem as ApiClass, Submission as ApiSubmission, TuitionRecord, User } from '../shared/types';
import type { ClassItem } from '../features/classes/types';
import type { Student } from '../features/students/types';
import type { Attendance } from '../features/attendance/types';
import type { Payment } from '../features/tuition/types';
import type { Assignment, Submission } from '../features/homework/types';
import { parseScheduleDays } from '../shared/utils/schedule';

// Chuyển dữ liệu từ API sang dạng các màn hình giáo viên cần.
// Hàm thuần (không React) để dễ kiểm thử; không bịa dữ liệu mặc định khi server không trả.

export interface ApiData {
  classes: ApiClass[];
  students: User[];
  attendanceRecords: AttendanceRecord[];
  tuitionRecords: TuitionRecord[];
  assignments: ApiAssignment[];
  submissions: ApiSubmission[];
}

const dateOnly = (iso?: string | null) => iso?.split('T')[0] ?? '';

export function toClasses(classes: ApiClass[]): ClassItem[] {
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    level: (c.level as ClassItem['level']) || ('' as ClassItem['level']),
    // Server chỉ lưu chuỗi lịch học, nên suy ra các ngày học từ chuỗi đó
    scheduleDays: parseScheduleDays(c.schedule),
    // Giáo viên (không phải admin) không nhận học phí lớp từ server
    monthly_fee: c.monthly_fee ?? 0,
    schedule: c.schedule || '',
    start_date: dateOnly(c.created_at),
    notes: c.description || '',
    room: c.room || '',
    teacher_id: c.teacher_id,
  }));
}

export function toStudents(students: User[], classes: ApiClass[]): Student[] {
  return students.map((s) => {
    const classId = (s as User & { class_id?: string }).class_id || '';
    return {
      id: s.id,
      full_name: s.full_name,
      phone: s.phone || '',
      gender: s.gender ?? null,
      class_id: classId,
      level: (classes.find((c) => c.id === classId)?.level || '') as Student['level'],
      join_date: dateOnly(s.created_at),
      notes: s.student_code ? `MSSV: ${s.student_code}` : '',
    };
  });
}

export function toAttendance(records: AttendanceRecord[]): Attendance[] {
  return records.map((r) => ({
    id: r.id,
    class_id: r.class_id || '',
    student_id: r.student_id,
    date: r.date || dateOnly(r.check_in_time),
    status: r.status as 'present' | 'absent',
    notes: r.notes,
  }));
}

export function toPayments(records: TuitionRecord[]): Payment[] {
  return records.map((t) => ({
    id: t.id,
    student_id: t.student_id,
    month: t.month,
    amount: t.amount,
    paid_amount: t.paid_amount,
    paid_date: t.paid_date || null,
    status: t.status as 'paid' | 'unpaid',
    notes: t.notes || '',
  }));
}

export function toAssignments(assignments: ApiAssignment[]): Assignment[] {
  return assignments.map((a) => ({
    id: a.id,
    class_id: a.class_id,
    title: a.title,
    description: a.description,
    deadline: dateOnly(a.deadline),
    created_at: dateOnly(a.created_at),
  }));
}

export function toSubmissions(submissions: ApiSubmission[]): Submission[] {
  return submissions.map((s) => ({
    id: s.id,
    assignment_id: s.assignment_id,
    student_id: s.student_id,
    // Server dùng thêm trạng thái 'graded' cho bài đã chấm; với giáo viên bài đã chấm vẫn là bài đã nộp
    // (điểm cho biết đã chấm)
    status: s.status === 'unsubmitted' ? 'unsubmitted' : 'submitted',
    score: s.score,
    comment: s.feedback || '',
    ai_draft: s.ai_draft ?? null,
    submitted_at: s.submitted_at?.split('T')[0],
  }));
}

export function buildViewModels(data: ApiData) {
  return {
    classes: toClasses(data.classes),
    students: toStudents(data.students, data.classes),
    attendance: toAttendance(data.attendanceRecords),
    payments: toPayments(data.tuitionRecords),
    assignments: toAssignments(data.assignments),
    submissions: toSubmissions(data.submissions),
  };
}

export type ViewModels = ReturnType<typeof buildViewModels>;
