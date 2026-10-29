import { apiClient } from './apiClient';
import { Gender, User, AuthResponse } from '../shared/types';

export const authService = {
  async login(email: string, password = 'password123'): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    if (res.token) {
      apiClient.setToken(res.token);
      apiClient.setCurrentUser(res.user);
    }
    return res;
  },
  // Đổi mật khẩu: server trả token mới (token cũ đã vô hiệu) và user đã cập nhật cờ bắt buộc đổi
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ ok: boolean; message?: string }> {
    const res = await apiClient.post<{ ok: boolean; message?: string; token?: string; user?: User }>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    if (res.token) apiClient.setToken(res.token);
    if (res.user) apiClient.setCurrentUser(res.user);
    return res;
  },

  // Tự cập nhật họ tên và SĐT. Tên đăng nhập và vai trò do admin quản lý.
  async updateProfile(data: { full_name?: string; phone?: string; gender?: Gender | null }): Promise<User> {
    const user = await apiClient.put<User>('/auth/profile', data);
    apiClient.setCurrentUser(user);
    return user;
  },

  async forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
    return apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
    return apiClient.post('/auth/reset-password', { token, new_password: newPassword });
  },
  async register(data: {
    email: string;
    password?: string;
    full_name: string;
    role?: 'teacher' | 'student';
    phone?: string;
    student_code?: string;
  }): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/register', {
      ...data,
      password: data.password || '123456',
    });
    if (res.token) {
      apiClient.setToken(res.token);
      apiClient.setCurrentUser(res.user);
    }
    return res;
  },

  async getProfile(): Promise<User> {
    const user = await apiClient.get<User>('/auth/profile');
    apiClient.setCurrentUser(user);
    return user;
  },

  logout() {
    apiClient.removeToken();
  },

  getCurrentUser(): User | null {
    return apiClient.getCurrentUser();
  },

  getToken(): string | null {
    return apiClient.getToken();
  },
};
