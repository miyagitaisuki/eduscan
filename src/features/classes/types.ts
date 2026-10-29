import { JlptLevel } from '../../shared/types/common';

export interface ClassItem {
  id: string;
  name: string;
  level: JlptLevel;
  schedule: string; // e.g. "Thứ 2 - 4 - 6 (18:00 - 19:30)"
  scheduleDays?: number[]; // suy ra từ `schedule` (parseScheduleDays); 1=Mon ... 6=Sat, 0=Sun
  monthly_fee: number; // e.g. 800000
  start_date: string; // YYYY-MM-DD
  notes: string;
  room?: string;
  teacher_id?: string; // giáo viên phụ trách
}
