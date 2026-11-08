import { useCallback, useRef, useState } from 'react';
import { NotificationItem } from '../../shared/types';
import { notificationService } from '../../services';
import type { Loader } from './types';

export function useNotificationsData(currentUserId?: string) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const requestRef = useRef(0);

  const reset = useCallback(() => {
    requestRef.current++;
    setNotifications([]);
  }, []);

  const load = useCallback<Loader>(async () => {
    const request = ++requestRef.current;
    try {
      const data = await notificationService.getNotifications(currentUserId);
      if (request !== requestRef.current) return false;
      setNotifications(data);
      return true;
    } catch {
      return false;
    }
  }, [currentUserId]);

  const markRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      console.warn(err);
    }
  };

  return { notifications, load, markRead, reset };
}
