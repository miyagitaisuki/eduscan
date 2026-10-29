import type {
  Assignment,
  AttendanceRecord,
  AttendanceSession,
  ClassItem,
  NotificationItem,
  Submission,
  TuitionRecord,
  User,
} from '../../src/shared/types';

// Chuyển bản ghi DB (camelCase) sang dạng JSON mà frontend dùng (snake_case).
// Kiểu trả về lấy từ src/shared/types, là nguồn kiểu duy nhất của cả client và server:
// đổi DTO mà không đổi kiểu (hoặc ngược lại) sẽ bị tsc báo lỗi.
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
// Cột thời gian NOT NULL luôn có giá trị
const isoRequired = (d: Date | string) => new Date(d).toISOString();
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

// Chuẩn hóa giới tính từ request: 'male' | 'female' | null (xóa); undefined nếu giá trị không hợp lệ
export function parseGender(v: unknown): Gender | null | undefined {
  if (v === null || v === '') return null;
  return (GENDERS as readonly unknown[]).includes(v) ? (v as Gender) : undefined;
}

export function userDto(u: any): User {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    role: u.role,
    student_code: u.studentCode ?? '',
    gender: u.gender ?? null,
    avatar: u.avatar ?? '',
    phone: u.phone ?? '',
    status: u.status,
    must_change_password: !!u.mustChangePassword,
    created_at: iso(u.createdAt) ?? undefined,
  };
}

export function classDto(c: any, extra: Partial<ClassItem> = {}): ClassItem {
  return {
    id: c.id,
    name: c.name,
    code: c.code ?? '',
    teacher_id: c.teacherId,
    teacher_name: c.teacherName ?? '',
    description: c.description ?? '',
    schedule: c.schedule ?? '',
    level: c.level,
    monthly_fee: Number(c.monthlyFee),
    room: c.room ?? '',
    start_date: c.startDate ?? '',
    created_at: isoRequired(c.createdAt),
    ...extra,
  };
}

export function assignmentDto(a: any, extra: Partial<Assignment> = {}): Assignment {
  return {
    id: a.id,
    class_id: a.classId,
    title: a.title,
    description: a.description ?? '',
    sample_solution: a.sampleSolution ?? '',
    rubric: a.rubric ?? '',
    deadline: isoRequired(a.deadline),
    created_by: a.createdBy,
    created_at: isoRequired(a.createdAt),
    ...extra,
  };
}

export function submissionDto(s: any, extra: Partial<Submission> = {}): Submission {
  return {
    id: s.id,
    assignment_id: s.assignmentId,
    student_id: s.studentId,
    content: s.content ?? '',
    attachment_url: s.attachmentUrl ?? '',
    status: s.status,
    score: num(s.score),
    feedback: s.feedback ?? '',
    rubric_breakdown: s.rubricBreakdown ?? null,
    strengths: s.strengths ?? null,
    weaknesses: s.weaknesses ?? null,
    suggestions: s.suggestions ?? null,
    graded_by_ai: s.gradedByAi,
    ai_draft: s.aiDraft ?? null,
    ai_draft_at: iso(s.aiDraftAt),
    submitted_at: iso(s.submittedAt),
    graded_at: iso(s.gradedAt),
    ...extra,
  };
}

export function sessionDto(s: any, extra: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: s.id,
    class_id: s.classId,
    qr_code: s.qrCode,
    session_code: s.sessionCode,
    session_date: s.sessionDate,
    start_time: isoRequired(s.startTime),
    end_time: iso(s.endTime),
    is_active: s.isActive,
    created_at: isoRequired(s.createdAt),
    ...extra,
  };
}

// class_id và date (ngày của buổi học) là bắt buộc: lấy từ phiên điểm danh của bản ghi
export function attendanceDto(
  r: any,
  extra: Partial<AttendanceRecord> & Pick<AttendanceRecord, 'class_id' | 'date'>
): AttendanceRecord {
  return {
    id: r.id,
    session_id: r.sessionId,
    student_id: r.studentId,
    status: r.status,
    check_in_time: isoRequired(r.checkInTime),
    notes: r.notes ?? '',
    ...extra,
  };
}

export function tuitionDto(t: any, extra: Partial<TuitionRecord> = {}): TuitionRecord {
  return {
    id: t.id,
    student_id: t.studentId,
    class_id: t.classId ?? null,
    month: t.month,
    amount: Number(t.amount),
    paid_amount: Number(t.paidAmount),
    due_date: t.dueDate ?? null,
    paid_date: t.paidDate ?? null,
    status: t.status,
    notes: t.notes ?? '',
    ...extra,
  };
}

export function notificationDto(n: any): NotificationItem {
  return {
    id: n.id,
    user_id: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    is_read: n.isRead,
    created_at: isoRequired(n.createdAt),
  };
}
