import { apiClient } from './apiClient';
import { ClassInput, ClassItem } from '../shared/types';

export const classService = {
  async getClasses(): Promise<ClassItem[]> {
    return apiClient.get<ClassItem[]>('/classes');
  },

  /** Học viên đang học của một lớp (để chấm bài của lớp không phụ trách) */
  async getRoster(id: string): Promise<{ id: string; full_name: string; student_code: string }[]> {
    return apiClient.get(`/classes/${id}/roster`);
  },

  async getClass(id: string): Promise<ClassItem> {
    return apiClient.get<ClassItem>(`/classes/${id}`);
  },

  async createClass(data: ClassInput): Promise<ClassItem> {
    return apiClient.post<ClassItem>('/classes', data);
  },

  async updateClass(id: string, data: Partial<ClassInput>): Promise<ClassItem> {
    return apiClient.put<ClassItem>(`/classes/${id}`, data);
  },

  async deleteClass(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/classes/${id}`);
  },
};
