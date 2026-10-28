import React, { useRef } from 'react';
import {
  BarChart3,
  CheckSquare,
  BookOpen,
  Users,
  CreditCard,
  FileText,
  GraduationCap,
  Download,
  Upload,
  Smartphone,
  Laptop,
  QrCode,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { User, UserRole } from '../types';

export type EcosystemViewMode = 'teacher' | 'student';
export type EcosystemTeacherTab = 'dashboard' | 'attendance' | 'classes' | 'students' | 'tuition' | 'homework' | 'documents' | 'stats';

interface HeaderProps {
  onChangePassword?: () => void;
  viewMode: EcosystemViewMode;
  onViewModeChange: (mode: EcosystemViewMode) => void;
  currentUser: User | null;
  onSwitchRole: (role: UserRole) => void;
  activeTab: EcosystemTeacherTab;
  onTabChange: (tab: EcosystemTeacherTab) => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Sao lưu/khôi phục chỉ dành cho admin */
  canBackup?: boolean;
  /** Công tắc chuyển giao diện/vai trò: chỉ hiển thị ở chế độ dev */
  showAppSwitcher?: boolean;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  currentUser,
  onSwitchRole,
  activeTab,
  onTabChange,
  onExportData,
  onImportData,
  canBackup = false,
  showAppSwitcher = false,
  onLogout,
  onChangePassword,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const teacherNavItems: { id: EcosystemTeacherTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'attendance', label: 'Điểm danh QR & Nhanh', icon: CheckSquare },
    { id: 'classes', label: 'Quản lý Lớp', icon: BookOpen },
    { id: 'students', label: 'Học viên', icon: Users },
    { id: 'tuition', label: 'Học phí', icon: CreditCard },
    { id: 'homework', label: 'Bài tập & AI', icon: FileText },
    { id: 'documents', label: 'Thư viện', icon: FileText },
    { id: 'stats', label: 'Báo cáo', icon: GraduationCap },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">

      {/* Ecosystem Top Switcher Bar */}
      <div className="bg-slate-900 text-white text-xs px-4 py-2 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">

          {/* Ecosystem Title & Indicator */}
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold tracking-wide text-slate-200">
              EDUSCAN ECOSYSTEM
            </span>
            <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              REST API • JWT Auth • PostgreSQL Ready
            </span>
          </div>

          {/* App Switcher (Teacher Web vs Student Mobile) - chỉ ở chế độ dev */}
          <div className={`flex items-center gap-2 ${showAppSwitcher ? '' : 'hidden'}`}>
            <span className="text-[11px] text-slate-400 hidden md:inline">Chuyển ứng dụng:</span>
            <div className="inline-flex p-0.5 bg-slate-800 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  onViewModeChange('teacher');
                  onSwitchRole('teacher');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'teacher'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>EduScan Teacher (Web)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onViewModeChange('student');
                  onSwitchRole('student');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'student'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-300" />
                <span>EduScan Student (Android)</span>
              </button>
            </div>

            {/* Persona Switcher Quick Dropdown */}
            <div className="hidden lg:flex items-center gap-1 ml-2 pl-2 border-l border-slate-700">
              <span className="text-[10px] text-slate-400">Đang là:</span>
              <span className="text-[11px] font-bold text-amber-300">
                {currentUser?.role === 'student' ? 'Sinh viên' : 'Giáo viên'}
              </span>
              {onChangePassword && (
                <button
                  type="button"
                  onClick={onChangePassword}
                  className="ml-2 text-[11px] font-semibold text-slate-300 hover:text-white underline cursor-pointer"
                >
                  Đổi mật khẩu
                </button>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="ml-2 text-[11px] font-semibold text-slate-300 hover:text-white underline cursor-pointer"
                >
                  Đăng xuất
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Teacher Navigation Header (visible when in Teacher View Mode) */}
      {viewMode === 'teacher' && (
        <>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-2.5">
            <div className="flex items-center justify-between gap-3">
              {/* Brand & User Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 font-black text-sm">
                  ES
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                      EduScan Teacher Portal
                    </h1>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                      Giáo viên
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {currentUser?.full_name || 'ThS. Nguyễn Thanh Quang'} • ĐH Quy Nhơn
                  </p>
                </div>
              </div>

              {/* Tools & Export */}
              <div className={`flex items-center gap-1.5 ${canBackup ? '' : 'hidden'}`}>
                <button
                  onClick={onExportData}
                  title="Sao lưu toàn bộ dữ liệu (JSON)"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sao lưu</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Nạp dữ liệu từ tệp tin JSON"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Phục hồi</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={onImportData}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="border-t border-slate-100 bg-slate-50/70">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <nav className="flex items-center space-x-1 py-1.5 overflow-x-auto scrollbar-none">
                {teacherNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      {item.label}
                      {item.id === 'attendance' && (
                        <span className="text-[10px] bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded-md font-extrabold ml-0.5">
                          QR Live
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </>
      )}

    </header>
  );
};
