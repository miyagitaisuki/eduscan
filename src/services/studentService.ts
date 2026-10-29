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

  // Xuất CSV học viên trong phạm vi người dùng được xem; classId lọc theo một lớp
  async exportStudents(classId?: string): Promise<{ blob: Blob; filename: string }> {
    return apiClient.download(`/students/export${classId ? `?class_id=${encodeURIComponent(classId)}` : ''}`);
  },

  // Nhập hàng loạt. dry_run: chỉ kiểm tra, không ghi. Ghi thì trả mật khẩu tạm của các dòng đã tạo
  async importStudents(data: { rows: unknown[]; class_id?: string; dry_run: boolean }): Promise<StudentImportResponse> {
    return apiClient.post<StudentImportResponse>('/students/import', data);
  },
};

export interface StudentImportLineResult {
  line: number;
  status: 'ok' | 'error';
  full_name: string;
  email: string;
  class_name: string;
  errors: string[];
}

export interface StudentImportResponse {
  dry_run: boolean;
  total: number;
  valid?: number;
  created?: number;
  invalid: number;
  results: StudentImportLineResult[];
  credentials?: { line: number; full_name: string; email: string; class_name: string; temporary_password: string }[];
}
