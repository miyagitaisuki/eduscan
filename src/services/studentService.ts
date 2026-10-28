import { apiClient } from './apiClient';
import { User } from '../shared/types';

export const studentService = {
  async getStudents(): Promise<User[]> {
    return apiClient.get<User[]>('/students');
  },

  async getStudent(id: string): Promise<User> {
    return apiClient.get<User>(`/students/${id}`);
  },

  async createStudent(data: {
    full_name: string;
    email?: string;
    phone?: string;
    student_code?: string;
    class_id?: string;
  }): Promise<User> {
    return apiClient.post<User>('/students', data);
  },

  async deleteStudent(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/students/${id}`);
  },

  async updateStudent(id: string, data: Partial<User> & { class_id?: string }): Promise<User> {
    return apiClient.put<User>(`/students/${id}`, data);
  },
};
