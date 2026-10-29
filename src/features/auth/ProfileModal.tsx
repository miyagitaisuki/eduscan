import React, { useState } from 'react';
import { Gender, User } from '../../shared/types';
import { GenderSelect } from '../../shared/components/GenderSelect';
import { Modal } from '../../shared/components/ui';
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
  const [gender, setGender] = useState<Gender | null>(user.gender ?? null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authService.updateProfile({ full_name: fullName.trim(), phone: phone.trim(), gender });
      onSaved(updated);
      onClose();
    } catch (err) {
      onError?.(errorDetail(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Hồ sơ cá nhân" onClose={onClose} size="md" closeOnBackdrop={false}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="profile-field-1">Họ và tên *</label>
          <input id="profile-field-1" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="profile-field-2">Số điện thoại</label>
          <input id="profile-field-2" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="profile-field-3">Giới tính</label>
          <GenderSelect id="profile-field-3" value={gender} onChange={setGender} />
        </div>
        <div>
          <span className="block text-xs font-bold text-slate-500 mb-1">Tên đăng nhập</span>
          <p className="px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600">{user.email}</p>
          <p className="text-xs text-slate-500 mt-1">Tên đăng nhập và mật khẩu do quản trị viên quản lý. Liên hệ admin nếu cần đổi.</p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
            Hủy
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
