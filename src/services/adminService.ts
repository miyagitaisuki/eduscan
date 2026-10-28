import { apiClient } from './apiClient';

// Sao lưu/khôi phục toàn bộ dữ liệu (chỉ admin). File sao lưu có chứa băm mật khẩu: cần cất giữ an toàn.
export const adminService = {
  async getBackup(): Promise<unknown> {
    return apiClient.get<unknown>('/admin/backup');
  },

  async restore(data: unknown): Promise<{ success: boolean; counts: Record<string, number> }> {
    return apiClient.post('/admin/restore', { confirm: 'RESTORE', data });
  },
};
