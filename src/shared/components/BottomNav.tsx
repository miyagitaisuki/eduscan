import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Modal } from './ui';
import { ActiveTab } from '../types';
import { getTeacherNavItems, TeacherNavItem } from '../config/teacherNav';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  unpaidCount: number;
  ungradedCount: number;
  isAdmin?: boolean;
}

const badgeClass = (tone: 'rose' | 'amber') =>
  `absolute -top-1 -right-2 ${tone === 'rose' ? 'bg-rose-500' : 'bg-amber-500'} text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center`;

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unpaidCount,
  ungradedCount,
  isAdmin = false,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const allItems = getTeacherNavItems(isAdmin);
  const primaryItems = allItems.filter((item) => item.mobilePrimary);
  const overflowItems = allItems.filter((item) => !item.mobilePrimary);

  const badgeFor = (id: ActiveTab) => {
    if (id === 'tuition' && unpaidCount > 0) return { count: unpaidCount, tone: 'rose' as const };
    if (id === 'homework' && ungradedCount > 0) return { count: ungradedCount, tone: 'amber' as const };
    return null;
  };
  const formatCount = (count: number) => (count > 9 ? '9+' : String(count));

  // Nút "Thêm" hiện huy hiệu tổng khi có mục ẩn đang cần chú ý
  const overflowBadgeCount = overflowItems.reduce((sum, item) => sum + (badgeFor(item.id)?.count ?? 0), 0);
  const isOverflowActive = overflowItems.some((item) => item.id === activeTab);

  const handleSelect = (tab: ActiveTab) => {
    onTabChange(tab);
    setIsMoreOpen(false);
  };

  const renderItem = (tab: TeacherNavItem, isActive: boolean) => {
    const Icon = tab.icon;
    const badge = badgeFor(tab.id);
    return (
      <>
        <div className="relative">
          <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-blue-600' : ''}`} />
          {badge && <span className={badgeClass(badge.tone)}>{formatCount(badge.count)}</span>}
        </div>
        <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-blue-600' : 'font-medium'}`}>
          {tab.shortLabel}
        </span>
      </>
    );
  };

  const itemClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center relative py-1 transition-colors cursor-pointer ${
      isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
          {primaryItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => handleSelect(tab.id)} className={itemClass(isActive)}>
                {renderItem(tab, isActive)}
                {isActive && <span className="absolute top-0 w-8 h-0.5 bg-blue-600 rounded-full" />}
              </button>
            );
          })}

          {overflowItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              aria-expanded={isMoreOpen}
              aria-label="Thêm mục điều hướng"
              className={itemClass(isOverflowActive)}
            >
              <div className="relative">
                <MoreHorizontal className="w-5 h-5" />
                {overflowBadgeCount > 0 && (
                  <span className={badgeClass('rose')}>{formatCount(overflowBadgeCount)}</span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isOverflowActive ? 'font-bold text-blue-600' : 'font-medium'}`}>
                Thêm
              </span>
              {isOverflowActive && <span className="absolute top-0 w-8 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          )}
        </div>
      </div>

      {isMoreOpen && (
        <Modal title="Thêm mục" onClose={() => setIsMoreOpen(false)} size="xl" placement="bottom">
          <div className="grid grid-cols-3 gap-2">
              {overflowItems.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                const badge = badgeFor(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelect(tab.id)}
                    className={`relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border cursor-pointer transition-colors ${
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{tab.shortLabel}</span>
                    {badge && <span className={badgeClass(badge.tone)}>{formatCount(badge.count)}</span>}
                  </button>
                );
              })}
          </div>
        </Modal>
      )}
    </>
  );
};
