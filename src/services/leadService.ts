import { apiClient } from './apiClient';
import type { Lead, LeadStatus } from '../shared/types';

// Chỉ admin: đăng ký học thử gửi từ website
export const leadService = {
  async getLeads(): Promise<Lead[]> {
    return apiClient.get<Lead[]>('/leads');
  },

  async updateLead(id: string, data: { status?: LeadStatus; admin_note?: string }): Promise<Lead> {
    return apiClient.patch<Lead>(`/leads/${id}`, data);
  },

  // Tạo tài khoản học viên từ đăng ký và ghi danh vào lớp; mật khẩu tạm chỉ trả về một lần
  async convertLead(
    id: string,
    data: { class_id: string; email?: string; join_date?: string }
  ): Promise<{
    lead: Lead;
    student: { id: string; full_name: string; email: string; class_id: string; class_name: string };
    temporary_password: string;
  }> {
    return apiClient.post(`/leads/${id}/convert`, data);
  },
};
