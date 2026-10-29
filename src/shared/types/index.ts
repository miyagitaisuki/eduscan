export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'suspended' | 'inactive';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type TuitionStatus = 'paid' | 'unpaid' | 'partial';
export type SubmissionStatus = 'unsubmitted' | 'submitted' | 'graded';
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type Gender = 'male' | 'female';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  gender?: Gender | null;
  avatar?: string;
  phone?: string;
  student_code?: string;
  status: UserStatus;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Học viên trong danh sách của giáo viên (GET /students): tài khoản + lớp đang học
export interface Student extends User {
  phone: string;
  student_code: string;
  class_id: string;
  class_name: string;
  /** Cấp độ của lớp đang học; rỗng nếu chưa xếp lớp */
  level: JlptLevel | '';
  /** Ngày vào lớp hiện tại (YYYY-MM-DD) */
  join_date: string;
}

export interface ClassItem {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  teacher_name: string;
  /** Ghi chú giáo trình / mục tiêu của lớp */
  description: string;
  /** Lịch học tự do, VD "Thứ 2 - 4 - 6 (18:00 - 19:30)"; ngày học suy ra bằng parseScheduleDays */
  schedule: string;
  level: JlptLevel;
  /** Chỉ admin nhận được học phí lớp */
  monthly_fee?: number;
  /** Phòng học / địa điểm */
  room: string;
  /** Ngày bắt đầu khóa (YYYY-MM-DD); rỗng nếu chưa đặt */
  start_date: string;
  /** Lịch lặp hàng tuần (0 = Chủ Nhật ... 6 = Thứ Bảy); mảng rỗng nếu lớp chưa dùng lịch tự động */
  weekdays: number[];
  /** Giờ học HH:MM của lịch lặp; rỗng nếu chưa đặt */
  lesson_start_time: string;
  lesson_end_time: string;
  /** Ngày kết thúc lịch lặp (YYYY-MM-DD); rỗng nếu chưa đặt */
  end_date: string;
  created_at: string;
  student_count?: number;
}

/** Buổi học theo kế hoạch. Ngày YYYY-MM-DD và giờ HH:MM là giờ địa phương, không có múi giờ */
export interface Lesson {
  id: string;
  class_id: string;
  class_name?: string;
  lesson_date: string;
  start_time: string;
  end_time: string;
  /** Nội dung buổi học; rỗng nếu chưa nhập */
  title: string;
  notes: string;
  status: 'planned' | 'cancelled';
  /** Admin đã sửa tay nên đồng bộ lại lịch không ghi đè */
  manually_edited: boolean;
  has_attendance: boolean;
  /** done: đã qua ngày học hoặc đã có điểm danh */
  state: 'upcoming' | 'done' | 'cancelled';
}

export interface Holiday {
  id: string;
  name: string;
  /** YYYY-MM-DD, bao gồm cả ngày đầu và ngày cuối */
  start_date: string;
  end_date: string;
}

export interface HolidayInput {
  name: string;
  start_date: string;
  /** Bỏ trống = nghỉ một ngày */
  end_date?: string;
}

export interface LessonConflictInfo {
  date: string;
  class_id: string;
  class_name: string;
  kind: 'teacher' | 'room';
}

/** Lịch lặp admin đặt cho một lớp. Cần một trong hai: weeks (số tuần kể từ start_date) hoặc end_date */
export interface LessonPlanInput {
  weekdays: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date?: string;
  weeks?: number;
}

/** Kết quả xem trước hoặc áp lịch */
export interface LessonSyncResult {
  applied: boolean;
  end_date: string;
  total: number;
  create: string[];
  update: string[];
  remove: string[];
  keep: number;
  kept_off_schedule: number;
  skipped_holidays: { date: string; name: string }[];
  conflicts: LessonConflictInfo[];
}

export interface LessonUpdateInput {
  title?: string;
  notes?: string;
  lesson_date?: string;
  start_time?: string;
  end_time?: string;
  status?: 'planned' | 'cancelled';
}

// Dữ liệu các biểu mẫu gửi lên server (khớp với trường server đọc trong server/routes)
export interface ClassInput {
  name: string;
  level: JlptLevel;
  schedule: string;
  description: string;
  room: string;
  /** YYYY-MM-DD; chuỗi rỗng để xóa */
  start_date: string;
  /** Chỉ admin được đặt học phí và giáo viên phụ trách; lịch lặp đặt riêng qua LessonPlanInput */
  monthly_fee?: number;
  teacher_id?: string;
}

export interface StudentInput {
  full_name: string;
  email?: string;
  phone?: string;
  gender?: Gender | null;
  student_code?: string;
  class_id?: string;
  /** YYYY-MM-DD */
  join_date?: string;
}

export interface AssignmentInput {
  class_id: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  deadline: string;
}

/** Chấm điểm / nhận xét một bài nộp; không có score thì chỉ lưu nhận xét */
export interface GradeInput {
  score?: number;
  feedback?: string;
  rubric_breakdown?: RubricItem[];
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  graded_by_ai?: boolean;
}

export interface Assignment {
  id: string;
  class_id: string;
  class_name?: string;
  title: string;
  description: string;
  sample_solution?: string;
  rubric?: string;
  deadline: string;
  created_by?: string;
  created_at: string;
  /** Số bài đã nộp (có trong danh sách bài tập) */
  submitted_count?: number;
}

export interface RubricItem {
  criterion: string;
  maxScore: number;
  earnedScore: number;
  comment: string;
}

// Bản nháp AI chờ giáo viên duyệt (thang điểm 10). Chưa ghi vào điểm.
export interface AiDraft {
  score: number;
  gradeClassification: string;
  rubricBreakdown: RubricItem[];
  strengths: string[];
  weaknesses: string[];
  detailedFeedback: string;
  suggestions: string[];
}

export interface Submission {
  id: string;
  assignment_id: string;
  assignment_title?: string;
  class_name?: string;
  ai_draft?: AiDraft | null;
  ai_draft_at?: string | null;
  student_id: string;
  student_name?: string;
  student_code?: string;
  content?: string;
  attachment_url?: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string;
  grade_classification?: string;
  rubric_breakdown?: RubricItem[] | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  suggestions?: string[] | null;
  graded_by_ai?: boolean;
  submitted_at?: string | null;
  graded_at?: string | null;
  /** Hạn nộp của bài tập (có trong danh sách bài nộp của học viên) */
  deadline?: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  class_name?: string;
  qr_code: string;
  session_code?: string;
  session_date?: string;
  start_time: string;
  end_time?: string | null;
  is_active?: boolean;
  created_at: string;
  total_present?: number;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  student_name?: string;
  student_code?: string;
  class_id: string;
  class_name?: string;
  /** Ngày của buổi học (YYYY-MM-DD) */
  date: string;
  status: AttendanceStatus;
  check_in_time: string;
  notes?: string;
}

export interface TuitionRecord {
  id: string;
  student_id: string;
  student_name?: string;
  student_code?: string;
  class_id?: string | null;
  class_name?: string;
  month: string;
  amount: number;
  paid_amount: number;
  due_date?: string | null;
  paid_date?: string | null;
  status: TuitionStatus;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'assignment' | 'attendance' | 'tuition' | 'grade' | 'general';
  is_read: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ToastNotification {
  type: 'success' | 'warning' | 'info';
  title: string;
  subtitle?: string;
}

export type ActiveTab = 'dashboard' | 'attendance' | 'classes' | 'students' | 'tuition' | 'homework' | 'stats' | 'teachers';
export type StudentTab = 'home' | 'assignments' | 'attendance' | 'tuition' | 'notifications';
