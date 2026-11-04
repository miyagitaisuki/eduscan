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
};
