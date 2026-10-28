export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
  notes?: string;
}
