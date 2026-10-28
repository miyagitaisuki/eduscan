import { apiClient } from './apiClient';
import { NotificationItem } from '../shared/types';

export const notificationService = {
  async getNotifications(userId?: string): Promise<NotificationItem[]> {
    const query = userId ? `?user_id=${userId}` : '';
    return apiClient.get<NotificationItem[]>(`/notifications${query}`);
  },

  async markAsRead(id: string): Promise<{ success: boolean }> {
    return apiClient.put<{ success: boolean }>(`/notifications/${id}/read`);
  },
};
