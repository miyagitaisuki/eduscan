import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../shared/types';
import { authService } from '../services/authService';

// Chế độ dev cho phép chuyển nhanh vai trò demo bằng tài khoản seed.
// Production không có đường vào tự động: bắt buộc đăng nhập.
const IS_DEV = import.meta.env.DEV;

export function useAuth() {
  // Không còn người dùng mặc định: chỉ dùng phiên đã lưu khi có token
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return authService.getToken() ? authService.getCurrentUser() : null;
  });

  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authService.login(email, password);
      setCurrentUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
  }, []);

  // Token hết hạn ở bất kỳ request nào -> quay về màn hình đăng nhập
  useEffect(() => {
    const onUnauthorized = () => setCurrentUser(null);
    window.addEventListener('eduscan:unauthorized', onUnauthorized);
    return () => window.removeEventListener('eduscan:unauthorized', onUnauthorized);
  }, []);

  // Chỉ dev: chuyển vai trò demo. Production: chuyển vai trò = đăng xuất để đăng nhập lại.
  const switchRole = useCallback(async (targetRole: UserRole) => {
    if (!IS_DEV) {
      logout();
      return;
    }
    setIsLoading(true);
    try {
      const email =
        targetRole === 'student' ? 'student@qnu.edu.vn' : targetRole === 'admin' ? 'admin@eduscan.edu.vn' : 'teacher@eduscan.edu.vn';
      const res = await authService.login(email, '123456');
      setCurrentUser(res.user);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  return {
    currentUser,
    role: currentUser?.role || 'teacher',
    isTeacher: currentUser?.role === 'teacher' || currentUser?.role === 'admin',
    isStudent: currentUser?.role === 'student',
    isAdmin: currentUser?.role === 'admin',
    isLoading,
    login,
    logout,
    switchRole,
    updateCurrentUser: setCurrentUser,
  };
}
