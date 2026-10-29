import { useCallback, useState } from 'react';
import { NotificationItem } from '../../shared/types';
import { notificationService } from '../../services';
import type { Loader } from './types';

export function useNotificationsData(currentUserId?: string) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const load = useCallback<Loader>(async () => {
    try {
      setNotifications(await notificationService.getNotifications(currentUserId));
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

  return { notifications, load, markRead };
}
