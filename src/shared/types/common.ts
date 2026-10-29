export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type ActiveTab = 
  | 'dashboard' 
  | 'attendance' 
  | 'classes' 
  | 'students' 
  | 'tuition' 
  | 'homework' 
  | 'stats'
  | 'teachers';

export interface ToastNotification {
  type: 'success' | 'warning' | 'info';
  title: string;
  subtitle?: string;
}
