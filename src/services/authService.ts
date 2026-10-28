import { apiClient } from './apiClient';
import { User, AuthResponse } from '../shared/types';

export const authService = {
  async login(email: string, password = 'password123'): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    if (res.token) {
      apiClient.setToken(res.token);
      apiClient.setCurrentUser(res.user);
    }
    return res;
  },
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ ok: boolean; message?: string }> {
    return apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
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
