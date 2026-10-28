import { JlptLevel } from '../../shared/types/common';

export interface Student {
  id: string;
  full_name: string;
  phone: string;
  level: JlptLevel;
  class_id: string;
  join_date: string; // YYYY-MM-DD
  notes: string;
  // Học phí riêng (VNĐ/tháng); null = theo học phí của lớp
  tuition_fee?: number | null;
}
