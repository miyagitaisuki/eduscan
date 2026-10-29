import { apiClient } from './apiClient';
import { User } from '../shared/types';

// Tài khoản giáo viên kèm số lớp đang phụ trách (chỉ admin xem được)
export type TeacherAccount = User & { class_count?: number };

// Chỉ admin: quản lý tài khoản giáo viên
export const teacherService = {
  async getTeachers(): Promise<TeacherAccount[]> {
    return apiClient.get<TeacherAccount[]>('/teachers');
  },

  // Không nhập mật khẩu thì server tự sinh và trả về temporary_password một lần
  async createTeacher(data: {
    email: string;
    full_name: string;
    phone?: string;
    password?: string;
    generate?: boolean;
  }): Promise<TeacherAccount & { temporary_password?: string }> {
    return apiClient.post<TeacherAccount & { temporary_password?: string }>('/teachers', data);
  },

  // Đổi họ tên, SĐT hoặc tên đăng nhập (email)
  async updateTeacher(id: string, data: { full_name?: string; phone?: string; email?: string }): Promise<TeacherAccount> {
    return apiClient.put<TeacherAccount>(`/teachers/${id}`, data);
  },

  async setTeacherStatus(id: string, status: 'active' | 'inactive'): Promise<TeacherAccount> {
    return apiClient.put<TeacherAccount>(`/teachers/${id}/status`, { status });
  },

  async setTeacherPassword(
    id: string,
    body: { new_password?: string; generate?: boolean }
  ): Promise<{ ok: boolean; temporary_password?: string }> {
    return apiClient.put<{ ok: boolean; temporary_password?: string }>(`/teachers/${id}/password`, body);
  },
};
