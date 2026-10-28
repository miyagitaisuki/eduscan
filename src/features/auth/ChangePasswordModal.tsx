import { useState, type ChangeEvent, type FormEvent } from 'react';
import { authService } from '../../services/authService';

interface Props {
  /** Đóng modal. Khi required, nút này đăng xuất thay vì đóng */
  onClose: () => void;
  /** Bắt buộc đổi (mật khẩu do admin đặt): không đóng được nếu chưa đổi */
  required?: boolean;
  /** Gọi sau khi đổi thành công */
  onDone?: () => void;
}

const EMPTY = { current: '', next: '', confirm: '' };
const inputCls =
  'mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function ChangePasswordModal({ onClose, required = false, onDone }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await authService.changePassword(form.current, form.next, form.confirm);
      setSuccess(res.message || 'Đã đổi mật khẩu.');
      setForm(EMPTY);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 id="change-password-title" className="text-lg font-extrabold text-slate-900">
          {required ? 'Đổi mật khẩu để tiếp tục' : 'Đổi mật khẩu'}
        </h2>
        {required && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            Mật khẩu của bạn được quản trị viên đặt. Vui lòng đặt mật khẩu mới để sử dụng hệ thống.
          </p>
        )}

        <label className="block text-xs font-semibold text-slate-600">
          Mật khẩu hiện tại
          <input type="password" autoComplete="current-password" className={inputCls} value={form.current} onChange={set('current')} required />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Mật khẩu mới (ít nhất 8 ký tự)
          <input type="password" autoComplete="new-password" minLength={8} className={inputCls} value={form.next} onChange={set('next')} required />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Nhập lại mật khẩu mới
          <input type="password" autoComplete="new-password" minLength={8} className={inputCls} value={form.confirm} onChange={set('confirm')} required />
        </label>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
            {required ? 'Đăng xuất' : 'Đóng'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Đang lưu...' : 'Lưu mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
}
