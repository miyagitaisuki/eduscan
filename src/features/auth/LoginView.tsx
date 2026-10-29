import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { authService } from '../../services/authService';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  isLoading: boolean;
  /** Chỉ truyền ở chế độ dev: đăng nhập nhanh bằng tài khoản demo */
  onDevQuickLogin?: (role: 'teacher' | 'student') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, isLoading, onDevQuickLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotBusy(true);
    try {
      const res = await authService.forgotPassword(forgotEmail.trim());
      setForgotMsg(res.message);
    } catch (err: any) {
      setForgotMsg(err?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setForgotBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onLogin(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-slate-200 p-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="mx-auto w-11 h-11 rounded-xl bg-primary-600 text-white flex items-center justify-center">
            <LogIn className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">EduScan AI</h1>
          <p className="text-xs text-slate-500">Đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-primary-500"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Mật khẩu</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-primary-500"
            />
          </label>

          {error && <p className="text-xs text-danger-600 font-medium">{error}</p>}

          <button type="button" onClick={() => setShowForgot((v) => !v)} className="w-full text-xs font-semibold text-primary-600 hover:underline cursor-pointer">
            Quên mật khẩu?
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {showForgot && (
          <form onSubmit={handleForgot} className="border-t border-slate-200 pt-4 space-y-2">
            <p className="text-xs text-slate-600">Nhập email đăng nhập. Nếu email tồn tại, hệ thống sẽ gửi liên kết đặt lại mật khẩu (hiệu lực 30 phút).</p>
            <input
              type="email"
              required
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-primary-500"
            />
            {forgotMsg && <p className="text-xs text-success-700 font-medium">{forgotMsg}</p>}
            <button type="submit" disabled={forgotBusy} className="w-full py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
              {forgotBusy ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
            </button>
          </form>
        )}

        {onDevQuickLogin && (
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <p className="text-xs text-center text-warning-600 font-semibold">Chỉ hiển thị khi chạy dev</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onDevQuickLogin('teacher')}
                className="py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Demo giáo viên
              </button>
              <button
                type="button"
                onClick={() => onDevQuickLogin('student')}
                className="py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Demo học viên
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
