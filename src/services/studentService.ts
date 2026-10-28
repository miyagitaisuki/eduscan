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
    tuition_fee?: number | null;
  }): Promise<User> {
    return apiClient.post<User>('/students', data);
  },

  async deleteStudent(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/students/${id}`);
  },

  async updateStudent(id: string, data: Partial<User> & { class_id?: string }): Promise<User> {
    return apiClient.put<User>(`/students/${id}`, data);
  },

  // Chỉ admin: đặt mật khẩu (nhập tay hoặc tự sinh)
  async setStudentPassword(id: string, body: { new_password?: string; generate?: boolean }): Promise<{ ok: boolean; temporary_password?: string }> {
    return apiClient.put<{ ok: boolean; temporary_password?: string }>(`/students/${id}/password`, body);
  },

  // Chỉ admin: gửi email đặt lại mật khẩu tới địa chỉ đăng nhập của học viên
  async sendPasswordReset(id: string): Promise<{ ok: boolean; message: string }> {
    return apiClient.post<{ ok: boolean; message: string }>(`/students/${id}/send-reset`);
  },
};
