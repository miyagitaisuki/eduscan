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

  const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-slate-200 p-6 space-y-4">
        <h1 className="text-lg font-extrabold text-slate-900">Đặt lại mật khẩu</h1>

        {!token && <p className="text-sm text-rose-600">Liên kết không hợp lệ. Vui lòng yêu cầu gửi lại email.</p>}

        {token && done && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700">Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.</p>
            <a href="/" className="block text-center py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold">
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
            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold cursor-pointer">
              {loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
