import React, { useState } from 'react';
import { X } from 'lucide-react';
import { User } from '../../shared/types';
import { authService } from '../../services/authService';
import { errorDetail } from '../../shared/utils/errorMessage';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
  onError?: (message: string) => void;
}

// Giáo viên/admin tự sửa họ tên và SĐT. Tên đăng nhập do admin quản lý, chỉ hiển thị.
export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onSaved, onError }) => {
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authService.updateProfile({ full_name: fullName.trim(), phone: phone.trim() });
      onSaved(updated);
      onClose();
    } catch (err) {
      onError?.(errorDetail(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900">Hồ sơ cá nhân</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên *</label>
          <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Tên đăng nhập</label>
          <p className="px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600">{user.email}</p>
          <p className="text-[11px] text-slate-500 mt-1">Tên đăng nhập và mật khẩu do quản trị viên quản lý. Liên hệ admin nếu cần đổi.</p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
            Hủy
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  );
};
