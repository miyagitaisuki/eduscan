import {
  pgTable,
  pgEnum,
  text,
  varchar,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---- Enums ----
export const userRole = pgEnum('user_role', ['admin', 'teacher', 'student']);
export const userGender = pgEnum('user_gender', ['male', 'female']);
export const userStatus = pgEnum('user_status', ['active', 'suspended', 'inactive']);
export const enrollmentStatus = pgEnum('enrollment_status', ['active', 'dropped', 'completed']);
export const submissionStatus = pgEnum('submission_status', ['unsubmitted', 'submitted', 'graded']);
export const attendanceStatus = pgEnum('attendance_status', ['present', 'absent', 'late', 'excused']);
export const tuitionStatus = pgEnum('tuition_status', ['paid', 'unpaid', 'partial']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ---- Users ----
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  role: userRole('role').notNull().default('student'),
  studentCode: varchar('student_code', { length: 50 }),
  // Dùng để xưng hô (Thầy/Cô, anh/chị) trên màn hình chào; null = chưa khai báo
  gender: userGender('gender'),
  avatar: text('avatar'),
  phone: varchar('phone', { length: 30 }),
  status: userStatus('status').notNull().default('active'),
  // Buộc đổi mật khẩu ở lần đăng nhập kế tiếp (mật khẩu do admin đặt)
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  // Tăng mỗi khi đổi/đặt lại mật khẩu: token có tv cũ sẽ bị từ chối
  tokenVersion: integer('token_version').notNull().default(0),
  createdAt: createdAt(),
});

// ---- Classes ----
export const classes = pgTable('classes', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 50 }),
  teacherId: text('teacher_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  description: text('description'),
  schedule: varchar('schedule', { length: 255 }),
  level: varchar('level', { length: 10 }).notNull().default('N5'),
  monthlyFee: integer('monthly_fee').notNull().default(800000),
  room: varchar('room', { length: 100 }),
  startDate: date('start_date'),
  createdAt: createdAt(),
});

export const enrollments = pgTable(
  'enrollments',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    joinDate: date('join_date').notNull().defaultNow(),
    status: enrollmentStatus('status').notNull().default('active'),
  },
  (t) => [
    uniqueIndex('unique_student_class').on(t.studentId, t.classId),
    index('idx_enrollments_class').on(t.classId),
  ]
);

// ---- Homework ----
export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    sampleSolution: text('sample_solution'),
    rubric: text('rubric'),
    deadline: timestamp('deadline', { withTimezone: true }).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('idx_assignments_class').on(t.classId)]
);

export const submissions = pgTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content'),
    attachmentUrl: varchar('attachment_url', { length: 1000 }),
    status: submissionStatus('status').notNull().default('submitted'),
    score: numeric('score', { precision: 5, scale: 2 }),
    feedback: text('feedback'),
    rubricBreakdown: jsonb('rubric_breakdown'),
    strengths: jsonb('strengths'),
    weaknesses: jsonb('weaknesses'),
    suggestions: jsonb('suggestions'),
    gradedByAi: boolean('graded_by_ai').notNull().default(false),
    // Bản nháp AI chờ giáo viên duyệt. Không ghi vào điểm cho đến khi giáo viên chấm.
    aiDraft: jsonb('ai_draft'),
    aiDraftAt: timestamp('ai_draft_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('unique_submission_student_assignment').on(t.assignmentId, t.studentId),
    index('idx_submissions_student').on(t.studentId),
  ]
);

// ---- Attendance ----
export const attendanceSessions = pgTable(
  'attendance_sessions',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    qrCode: text('qr_code').notNull(),
    sessionCode: varchar('session_code', { length: 20 }).notNull(),
    sessionDate: date('session_date').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull().defaultNow(),
    endTime: timestamp('end_time', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_sessions_class_active').on(t.classId, t.isActive),
    index('idx_sessions_code').on(t.sessionCode),
  ]
);

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: attendanceStatus('status').notNull().default('present'),
    checkInTime: timestamp('check_in_time', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
  },
  (t) => [uniqueIndex('unique_attendance_session_student').on(t.sessionId, t.studentId)]
);

// ---- Tuition & notifications ----
export const tuitionRecords = pgTable(
  'tuition_records',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: text('class_id').references(() => classes.id, { onDelete: 'set null' }),
    month: varchar('month', { length: 20 }).notNull(),
    amount: integer('amount').notNull(),
    paidAmount: integer('paid_amount').notNull().default(0),
    dueDate: date('due_date'),
    paidDate: date('paid_date'),
    status: tuitionStatus('status').notNull().default('unpaid'),
    notes: text('notes'),
  },
  (t) => [index('idx_tuition_student_month').on(t.studentId, t.month)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 50 }).notNull().default('general'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('idx_notifications_user').on(t.userId)]
);

// ---- Đặt lại mật khẩu qua email & nhật ký thao tác ----
export const passwordResets = pgTable(
  'password_resets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Chỉ lưu băm SHA-256 của token, không lưu token gốc
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('idx_password_resets_user').on(t.userId)]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    targetId: text('target_id'),
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [index('idx_audit_target').on(t.targetId)]
);
