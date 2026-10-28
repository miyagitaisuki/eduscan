import { useState, useCallback } from 'react';
import { ToastNotification as ToastType } from '../shared/types';

export function useToast() {
  const [toast, setToast] = useState<ToastType | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'warning' | 'info', title: string, subtitle?: string) => {
      setToast({ type, title, subtitle });
      setTimeout(() => {
        setToast((current) => (current?.title === title ? null : current));
      }, 3500);
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
}
