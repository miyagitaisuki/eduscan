import { apiClient } from './apiClient';
import { TuitionRecord } from '../shared/types';

export const tuitionService = {
  async getTuitionRecords(): Promise<TuitionRecord[]> {
    return apiClient.get<TuitionRecord[]>('/tuition');
  },

  async createTuitionRecord(data: Partial<TuitionRecord>): Promise<TuitionRecord> {
    return apiClient.post<TuitionRecord>('/tuition', data);
  },

  // Ghi nhận thu học phí tại lớp (cập nhật hồ sơ cùng tháng nếu có)
  async recordPayment(data: { student_id: string; month: string; amount: number }): Promise<TuitionRecord> {
    return apiClient.post<TuitionRecord>('/tuition/payment', data);
  },

  async updatePayment(id: string, updates: Partial<TuitionRecord>): Promise<TuitionRecord> {
    return apiClient.put<TuitionRecord>(`/tuition/${id}`, updates);
  },
};
