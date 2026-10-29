// Chuyển bản ghi DB (camelCase) sang dạng JSON mà frontend đang dùng (snake_case).
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

// Chuẩn hóa giới tính từ request: 'male' | 'female' | null (xóa); undefined nếu giá trị không hợp lệ
export function parseGender(v: unknown): Gender | null | undefined {
  if (v === null || v === '') return null;
  return (GENDERS as readonly unknown[]).includes(v) ? (v as Gender) : undefined;
}

export function userDto(u: any) {
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
    created_at: iso(u.createdAt),
  };
}

export function classDto(c: any, extra: Record<string, unknown> = {}) {
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
    created_at: iso(c.createdAt),
    ...extra,
  };
}

export function assignmentDto(a: any, extra: Record<string, unknown> = {}) {
  return {
    id: a.id,
    class_id: a.classId,
    title: a.title,
    description: a.description ?? '',
    sample_solution: a.sampleSolution ?? '',
    rubric: a.rubric ?? '',
    deadline: iso(a.deadline),
    created_by: a.createdBy,
    created_at: iso(a.createdAt),
    ...extra,
  };
}

export function submissionDto(s: any, extra: Record<string, unknown> = {}) {
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

export function sessionDto(s: any, extra: Record<string, unknown> = {}) {
  return {
    id: s.id,
    class_id: s.classId,
    qr_code: s.qrCode,
    session_code: s.sessionCode,
    session_date: s.sessionDate,
    start_time: iso(s.startTime),
    end_time: iso(s.endTime),
    is_active: s.isActive,
    created_at: iso(s.createdAt),
    ...extra,
  };
}

export function attendanceDto(r: any, extra: Record<string, unknown> = {}) {
  return {
    id: r.id,
    session_id: r.sessionId,
    student_id: r.studentId,
    status: r.status,
    check_in_time: iso(r.checkInTime),
    notes: r.notes ?? '',
    ...extra,
  };
}

export function tuitionDto(t: any, extra: Record<string, unknown> = {}) {
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

export function notificationDto(n: any) {
  return {
    id: n.id,
    user_id: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    is_read: n.isRead,
    created_at: iso(n.createdAt),
  };
}
