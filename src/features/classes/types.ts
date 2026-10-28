import { JlptLevel } from '../../shared/types/common';

export interface ClassItem {
  id: string;
  name: string;
  level: JlptLevel;
  schedule: string; // e.g. "Thứ 2 - 4 - 6 (18:00 - 19:30)"
  scheduleDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  monthly_fee: number; // e.g. 800000
  start_date: string; // YYYY-MM-DD
  notes: string;
  room?: string;
}
