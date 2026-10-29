import React, { useState } from 'react';
import { GraduationCap, Plus, Pencil, KeyRound, Lock, Unlock, Copy, Check, X } from 'lucide-react';
import { TeacherAccount } from '../../../services';
import { Gender } from '../../../shared/types';
import { GenderSelect } from '../../../shared/components/GenderSelect';
import { useConfirm } from '../../../shared/components/ui';

interface TeacherManagementViewProps {
  teachers: TeacherAccount[];
  currentUserId: string;
  onCreate: (data: { email: string; full_name: string; phone?: string; gender?: Gender | null; generate?: boolean; password?: string }) => Promise<
    { temporary_password?: string } | undefined
  >;
  onUpdate: (id: string, data: { full_name?: string; phone?: string; gender?: Gender | null; email?: string }) => Promise<unknown>;
  onSetStatus: (id: string, status: 'active' | 'inactive') => Promise<unknown>;
  onSetPassword: (
    id: string,
    body: { new_password?: string; generate?: boolean }
  ) => Promise<{ ok: boolean; temporary_password?: string } | undefined>;
}

// Mật khẩu vừa được cấp, chỉ hiện một lần để admin gửi cho giáo viên
interface IssuedPassword {
  name: string;
  email: string;
  password: string;
}

type FormState = { mode: 'create' } | { mode: 'edit'; teacher: TeacherAccount } | null;
type PasswordState = { teacher: TeacherAccount } | null;

const inputClass = 'w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500';

export const TeacherManagementView: React.FC<TeacherManagementViewProps> = ({
  teachers,
  currentUserId,
  onCreate,
  onUpdate,
  onSetStatus,
  onSetPassword,
}) => {
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(null);
  const [passwordFor, setPasswordFor] = useState<PasswordState>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [copied, setCopied] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [email, setEmail] = useState('');
  const [generate, setGenerate] = useState(true);
  const [password, setPassword] = useState('');
  const [newPasswordMode, setNewPasswordMode] = useState<'generate' | 'manual'>('generate');
  const [newPassword, setNewPassword] = useState('');

  const openCreate = () => {
    setFullName('');
    setPhone('');
    setGender(null);
    setEmail('');
    setGenerate(true);
    setPassword('');
    setForm({ mode: 'create' });
  };

  const openEdit = (t: TeacherAccount) => {
    setFullName(t.full_name);
    setPhone(t.phone ?? '');
    setGender(t.gender ?? null);
    setEmail(t.email);
    setForm({ mode: 'edit', teacher: t });
  };

  const openPassword = (t: TeacherAccount) => {
    setNewPasswordMode('generate');
    setNewPassword('');
    setPasswordFor({ teacher: t });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.mode === 'create') {
      const created = await onCreate({
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim(),
        gender,
        generate: generate || !password,
        password: generate ? undefined : password,
      });
      setForm(null);
      if (created?.temporary_password) {
        setIssued({ name: fullName.trim(), email: email.trim(), password: created.temporary_password });
      }
    } else {
      await onUpdate(form.teacher.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        gender,
        email: email.trim(),
      });
      setForm(null);
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordFor) return;
    const res = await onSetPassword(
      passwordFor.teacher.id,
      newPasswordMode === 'generate' ? { generate: true } : { new_password: newPassword }
    );
    setPasswordFor(null);
    if (res?.temporary_password) {
      setIssued({ name: passwordFor.teacher.full_name, email: passwordFor.teacher.email, password: res.temporary_password });
    }
  };

  const copyIssued = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(`Tên đăng nhập: ${issued.email}\nMật khẩu tạm: ${issued.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Trình duyệt chặn clipboard: admin vẫn đọc được mật khẩu trên màn hình
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Quản lý giáo viên
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chỉ admin mới đổi được tên đăng nhập và mật khẩu của giáo viên. Giáo viên tự đổi họ tên và SĐT trong hồ sơ.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm giáo viên
        </button>
      </div>

      {teachers.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs">
          Chưa có tài khoản giáo viên nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teachers.map((t) => {
            const isSelf = t.id === currentUserId;
            const active = t.status === 'active';
            return (
              <div key={t.id} className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 truncate">
                      {t.full_name}
                      {isSelf && <span className="ml-1.5 text-[10px] text-blue-600">(bạn)</span>}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">Tên đăng nhập: <span className="font-semibold text-slate-700">{t.email}</span></p>
                    <p className="text-xs text-slate-500">SĐT: {t.phone || 'Chưa có'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {active ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{t.class_count ?? 0} lớp phụ trách</span>
                  {t.must_change_password && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">Cần đổi mật khẩu khi đăng nhập</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => openEdit(t)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" /> Sửa
                  </button>
                  <button onClick={() => openPassword(t)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 cursor-pointer">
                    <KeyRound className="w-3.5 h-3.5" /> Đặt lại mật khẩu
                  </button>
                  {!isSelf && (
                    <button
                      onClick={async () => {
                        if (active) {
                          const ok = await confirm({
                            title: `Khóa tài khoản của ${t.full_name}?`,
                            message: 'Giáo viên sẽ bị đăng xuất ngay và không đăng nhập lại được cho đến khi bạn mở khóa.',
                            confirmLabel: 'Khóa tài khoản',
                            tone: 'danger',
                          });
                          if (!ok) return;
                        }
                        onSetStatus(t.id, active ? 'inactive' : 'active');
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        active ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      {active ? 'Khóa' : 'Mở khóa'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form thêm / sửa giáo viên */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleSubmitForm} className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[92dvh] overflow-y-auto border border-slate-200 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {form.mode === 'create' ? 'Thêm giáo viên' : 'Sửa thông tin giáo viên'}
              </h3>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên *</label>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên đăng nhập (email) *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giới tính</label>
              <GenderSelect value={gender} onChange={setGender} className={inputClass} />
            </div>

            {form.mode === 'create' && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} />
                  Tự sinh mật khẩu tạm
                </label>
                {!generate && (
                  <input
                    type="text"
                    required
                    minLength={8}
                    placeholder="Ít nhất 8 ký tự"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                )}
                <p className="text-[11px] text-slate-500">Giáo viên sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                Hủy
              </button>
              <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
                {form.mode === 'create' ? 'Tạo tài khoản' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Đặt lại mật khẩu */}
      {passwordFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleSubmitPassword} className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Đặt lại mật khẩu: {passwordFor.teacher.full_name}</h3>
              <button type="button" onClick={() => setPasswordFor(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewPasswordMode('generate')} className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer ${newPasswordMode === 'generate' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                Tự sinh
              </button>
              <button type="button" onClick={() => setNewPasswordMode('manual')} className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer ${newPasswordMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                Nhập tay
              </button>
            </div>
            {newPasswordMode === 'manual' && (
              <input type="text" required minLength={8} placeholder="Ít nhất 8 ký tự" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
            )}
            <p className="text-[11px] text-slate-500">Giáo viên đang đăng nhập sẽ bị đăng xuất và phải đổi mật khẩu ở lần đăng nhập sau.</p>
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setPasswordFor(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                Hủy
              </button>
              <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
                Đặt lại
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hiển thị mật khẩu tạm một lần */}
      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl space-y-3.5">
            <h3 className="text-base font-extrabold text-slate-900">Mật khẩu tạm cho {issued.name}</h3>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <p>Tên đăng nhập: <strong className="select-all">{issued.email}</strong></p>
              <p>Mật khẩu tạm: <strong className="select-all font-mono">{issued.password}</strong></p>
            </div>
            <p className="text-[11px] text-rose-600 font-semibold">Mật khẩu này chỉ hiện một lần. Hãy gửi cho giáo viên và không lưu lại ở nơi công khai.</p>
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={copyIssued} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Đã sao chép' : 'Sao chép'}
              </button>
              <button onClick={() => setIssued(null)} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
                Đã ghi nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
