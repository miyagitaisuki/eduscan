export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'suspended' | 'inactive';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type TuitionStatus = 'paid' | 'unpaid' | 'partial';
export type SubmissionStatus = 'unsubmitted' | 'submitted' | 'graded';
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  student_code?: string;
  status: UserStatus;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  full_name: string;
  phone: string;
  class_id: string;
  level: string | JlptLevel;
  join_date: string;
  notes?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  code?: string;
  teacher_id?: string;
  teacher_name?: string;
  description?: string;
  schedule?: string;
  scheduleDays?: number[];
  monthly_fee: number;
  level?: string | JlptLevel;
  student_count?: number;
  start_date?: string;
  room?: string;
  notes?: string;
  created_at?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  join_date: string;
  status: 'active' | 'dropped' | 'completed';
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
  ai_draft?: AiDraft | null;
  ai_draft_at?: string | null;
  student_id: string;
  student_name?: string;
  student_code?: string;
  content?: string;
  attachment_url?: string;
  status: SubmissionStatus;
  score: number | null;
  comment?: string;
  feedback?: string;
  grade_classification?: string;
  rubric_breakdown?: RubricItem[];
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  graded_by_ai?: boolean;
  submitted_at?: string;
  graded_at?: string;
}

export interface Attendance {
  id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent';
  notes?: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  class_name?: string;
  qr_code: string;
  session_code?: string;
  start_time: string;
  end_time?: string;
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
  class_id?: string;
  date?: string;
  status: AttendanceStatus;
  check_in_time: string;
  notes?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  month: string;
  amount: number;
  paid_date: string | null;
  status: 'paid' | 'unpaid';
  notes?: string;
}

export interface TuitionRecord {
  id: string;
  student_id: string;
  student_name?: string;
  class_id?: string;
  class_name?: string;
  month: string;
  amount: number;
  paid_amount: number;
  due_date?: string;
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

export type ActiveTab = 'dashboard' | 'attendance' | 'classes' | 'students' | 'tuition' | 'homework' | 'stats';
export type TeacherTab = ActiveTab;
export type StudentTab = 'home' | 'assignments' | 'attendance' | 'tuition' | 'notifications';
