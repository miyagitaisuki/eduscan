import { useState, type FormEvent } from 'react';
import { authService } from '../../services/authService';

// Trang đặt lại mật khẩu từ link trong email: /reset-password?token=...
export function ResetPasswordView() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (pw.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (pw !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, pw);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-primary-500';

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-800">
      {/* Nền mây dùng chung với màn hình đăng nhập */}
      <img src="/brand/clouds.jpg" alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/35 to-slate-900/60 pointer-events-none" />
      <div className="relative w-full max-w-sm glass-panel rounded-3xl shadow-pop p-6 space-y-4">
        <div className="flex items-center gap-3">
          <img src="/brand/logo.png" alt="Logo IMEJI日本語教室" width={40} height={40} className="w-10 h-10 object-contain" />
          <div>
            <p className="text-xs font-semibold text-primary-700">IMEJI日本語教室</p>
            <h1 className="text-lg font-extrabold text-slate-900">Đặt lại mật khẩu</h1>
          </div>
        </div>

        {!token && <p className="text-sm text-danger-600">Liên kết không hợp lệ. Vui lòng yêu cầu gửi lại email.</p>}

        {token && done && (
          <div className="space-y-3">
            <p className="text-sm text-success-700">Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.</p>
            <a href="/" className="block text-center py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold">
              Về trang đăng nhập
            </a>
          </div>
        )}

        {token && !done && (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600">Mật khẩu mới (ít nhất 8 ký tự)</span>
              <input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600">Nhập lại mật khẩu mới</span>
              <input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
            </label>
            {error && <p className="text-xs text-danger-600 font-medium">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-bold cursor-pointer">
              {loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
