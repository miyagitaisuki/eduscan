import type { ActiveTab } from '../shared/types/common';
import type { StudentTab } from '../shared/types';

// Địa chỉ trang: mỗi tab là một đường dẫn riêng để F5 giữ nguyên tab, gửi được link,
// và nút Back của trình duyệt/Android quay về tab trước thay vì thoát ứng dụng.

export const TEACHER_TABS: ActiveTab[] = ['dashboard', 'attendance', 'classes', 'students', 'tuition', 'homework', 'stats', 'teachers'];
export const ADMIN_ONLY_TABS: ActiveTab[] = ['tuition', 'teachers'];
export const DEFAULT_TEACHER_TAB: ActiveTab = 'dashboard';

export const STUDENT_TABS: StudentTab[] = ['home', 'assignments', 'attendance', 'tuition', 'notifications'];
export const DEFAULT_STUDENT_TAB: StudentTab = 'home';

const segment = (pathname: string) => pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();

/** Tab giáo viên của một đường dẫn; null nếu không có hoặc không đủ quyền (để chuyển về trang mặc định) */
export function teacherTabFromPath(pathname: string, isAdmin: boolean): ActiveTab | null {
  const tab = segment(pathname) as ActiveTab;
  if (!TEACHER_TABS.includes(tab)) return null;
  if (ADMIN_ONLY_TABS.includes(tab) && !isAdmin) return null;
  return tab;
}

/** Đường dẫn của một tab giáo viên, kèm lớp được chọn sẵn (VD từ thẻ lớp trên Tổng quan) */
export function teacherPath(tab: ActiveTab, classId?: string): string {
  return classId ? `/${tab}?class=${encodeURIComponent(classId)}` : `/${tab}`;
}

export function classIdFromSearch(search: string): string | undefined {
  return new URLSearchParams(search).get('class') || undefined;
}

export function studentTabFromPath(pathname: string): StudentTab | null {
  const tab = segment(pathname) as StudentTab;
  return STUDENT_TABS.includes(tab) ? tab : null;
}

export function studentPath(tab: StudentTab): string {
  return `/${tab}`;
}
