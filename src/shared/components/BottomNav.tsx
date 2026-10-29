import React from 'react';
import { 
  BarChart3, 
  CheckSquare, 
  BookOpen, 
  Users, 
  CreditCard,
  FileText,
  GraduationCap
} from 'lucide-react';
import { ActiveTab } from '../types/common';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  unpaidCount: number;
  ungradedCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unpaidCount,
  ungradedCount,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: BarChart3 },
    { id: 'attendance', label: 'Điểm danh', icon: CheckSquare },
    { id: 'classes', label: 'Lớp học', icon: BookOpen },
    { id: 'students', label: 'Học viên', icon: Users },
    { id: 'tuition', label: 'Học phí', icon: CreditCard },
    { id: 'homework', label: 'Bài tập', icon: FileText },
    { id: 'stats', label: 'Báo cáo', icon: GraduationCap },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
      <div className="grid grid-cols-7 h-15">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center relative py-1 transition-colors cursor-pointer ${
                isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-blue-600' : ''}`} />
                {tab.id === 'tuition' && unpaidCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unpaidCount > 9 ? '9+' : unpaidCount}
                  </span>
                )}
                {tab.id === 'homework' && ungradedCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {ungradedCount > 9 ? '9+' : ungradedCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-blue-600' : 'font-medium'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
