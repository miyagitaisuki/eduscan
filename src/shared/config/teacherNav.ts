import type { ComponentType } from 'react';
import {
  BarChart3,
  CheckSquare,
  BookOpen,
  Users,
  CreditCard,
  FileText,
  GraduationCap,
  UserCog,
} from 'lucide-react';
import type { ActiveTab } from '../types/common';

export interface TeacherNavItem {
  id: ActiveTab;
  /** Nhãn đầy đủ, dùng trên thanh tab desktop */
  label: string;
  /** Nhãn ngắn, dùng trên bottom nav mobile */
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

/** Nguồn duy nhất cho menu giáo viên: dùng chung bởi Header (desktop) và BottomNav (mobile) */
export const TEACHER_NAV_ITEMS: TeacherNavItem[] = [
  { id: 'dashboard', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: BarChart3 },
  { id: 'attendance', label: 'Điểm danh QR & Nhanh', shortLabel: 'Điểm danh', icon: CheckSquare },
  { id: 'classes', label: 'Lớp học', shortLabel: 'Lớp', icon: BookOpen },
  { id: 'students', label: 'Học viên', shortLabel: 'Học viên', icon: Users },
  { id: 'tuition', label: 'Học phí', shortLabel: 'Học phí', icon: CreditCard, adminOnly: true },
  { id: 'homework', label: 'Bài tập & AI', shortLabel: 'Bài tập', icon: FileText },
  { id: 'stats', label: 'Báo cáo', shortLabel: 'Báo cáo', icon: GraduationCap },
  { id: 'teachers', label: 'Giáo viên', shortLabel: 'GV', icon: UserCog, adminOnly: true },
];

/** Lọc menu theo quyền: mục adminOnly chỉ hiện với admin */
export const getTeacherNavItems = (isAdmin: boolean): TeacherNavItem[] =>
  TEACHER_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
