import { apiClient } from './apiClient';
import { Student, StudentInput } from '../shared/types';

export const studentService = {
  async getStudents(): Promise<Student[]> {
    return apiClient.get<Student[]>('/students');
  },

  async getStudent(id: string): Promise<Student> {
    return apiClient.get<Student>(`/students/${id}`);
  },

  // Server trả mật khẩu tạm một lần trong phản hồi tạo học viên
  async createStudent(data: StudentInput): Promise<Student & { temporary_password?: string }> {
    return apiClient.post<Student & { temporary_password?: string }>('/students', data);
  },

  async deleteStudent(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/students/${id}`);
  },

  async updateStudent(id: string, data: Partial<StudentInput>): Promise<Student> {
    return apiClient.put<Student>(`/students/${id}`, data);
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
