/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

import { Header, ToastNotification, LoadingScreen } from './shared/components';
import { LoginView } from './features/auth';
import { ChangePasswordModal } from './features/auth/ChangePasswordModal';
import { ProfileModal } from './features/auth/ProfileModal';
import { ResetPasswordView } from './features/auth/ResetPasswordView';
import { useAuth, useEcosystemData, useToast } from './hooks';
import { DEFAULT_TEACHER_TAB, teacherPath, teacherTabFromPath } from './app/routes';

// Tách bundle theo vai trò: học viên không phải tải mã giao diện của giáo viên và ngược lại
const TeacherApp = lazy(() => import('./app/TeacherApp'));
const StudentApp = lazy(() => import('./app/StudentApp'));

const PageFallback = () => (
  <div className="flex-1 flex items-center justify-center py-20" role="status" aria-label="Đang tải">
    <Loader2 className="w-7 h-7 text-blue-600 animate-spin motion-reduce:animate-none" aria-hidden="true" />
  </div>
);

export default function App() {
  const { toast, showToast, hideToast } = useToast();
  const { currentUser, switchRole, login, logout, isLoading: isAuthLoading, updateCurrentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isStudent = currentUser?.role === 'student';
  const [location, navigate] = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const data = useEcosystemData({ onNotify: showToast, currentUserId: currentUser?.id, isAdmin });

  // Trang đặt lại mật khẩu từ link trong email (không cần đăng nhập)
  if (location === '/reset-password') {
    return <ResetPasswordView />;
  }

  // Chưa đăng nhập: chỉ hiển thị màn hình đăng nhập. Sau khi đăng nhập vẫn ở đường dẫn đang mở.
  if (!currentUser) {
    return (
      <LoginView
        onLogin={login}
        isLoading={isAuthLoading}
        onDevQuickLogin={import.meta.env.DEV ? (r) => switchRole(r) : undefined}
      />
    );
  }

  // Mật khẩu do admin đặt: bắt buộc đổi trước khi dùng hệ thống
  if (currentUser.must_change_password) {
    return <ChangePasswordModal required onClose={logout} onDone={() => window.location.reload()} />;
  }

  // Đang tải dữ liệu lần đầu (kể cả lúc máy chủ khởi động lại): không hiện số liệu 0 gây hiểu nhầm
  if (data.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      <Header
        // Giao diện theo vai trò đăng nhập; công tắc dev đổi vai trò bằng cách đăng nhập tài khoản demo khác
        viewMode={isStudent ? 'student' : 'teacher'}
        onViewModeChange={() => {}}
        onChangePassword={() => setShowChangePassword(true)}
        currentUser={currentUser}
        onSwitchRole={switchRole}
        showAppSwitcher={import.meta.env.DEV}
        onLogout={logout}
        activeTab={teacherTabFromPath(location, isAdmin) ?? DEFAULT_TEACHER_TAB}
        onTabChange={(tab) => navigate(teacherPath(tab))}
        onExportData={data.handleExportBackup}
        onImportData={data.handleRestoreBackup}
        canBackup={isAdmin}
        isAdmin={isAdmin}
        onEditProfile={() => setShowProfile(true)}
      />

      <Suspense fallback={<PageFallback />}>
        {isStudent ? (
          <StudentApp data={data} currentUser={currentUser} />
        ) : (
          <TeacherApp data={data} currentUser={currentUser} isAdmin={isAdmin} />
        )}
      </Suspense>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showProfile && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfile(false)}
          onSaved={updateCurrentUser}
          onError={(message) => showToast('warning', 'Lỗi lưu hồ sơ', message)}
        />
      )}

      <ToastNotification toast={toast} onClose={hideToast} />

      <footer className="hidden md:block border-t border-slate-200 bg-white/70 py-4 text-center text-xs text-slate-500">
        <p>EduScan AI © 2026</p>
      </footer>
    </div>
  );
}
