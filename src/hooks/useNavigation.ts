import { useState, useCallback } from 'react';
import { ActiveTab } from '../shared/types';

export function useNavigation(defaultTab: ActiveTab = 'dashboard') {
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab);
  const [preselectedClassId, setPreselectedClassId] = useState<string | undefined>(undefined);

  const navigateToTab = useCallback((tab: ActiveTab, classId?: string) => {
    setActiveTab(tab);
    if (classId) {
      setPreselectedClassId(classId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return {
    activeTab,
    setActiveTab,
    preselectedClassId,
    setPreselectedClassId,
    navigateToTab,
  };
}
