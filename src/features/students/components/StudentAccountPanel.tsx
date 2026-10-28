import { useEffect, useState } from 'react';
import { studentService } from '../../../services/studentService';

// Khối quản trị tài khoản học viên (chỉ admin thấy): email đăng nhập, mật khẩu, email đặt lại.
export function StudentAccountPanel({ studentId }: { studentId: string }) {
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [pw, setPw] = useState('');
  const [tempPw, setTempPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    studentService
      .getStudent(studentId)
      .then((u) => {
        setEmail(u.email);
        setNewEmail(u.email);
      })
      .catch(() => setErr('Không tải được thông tin tài khoản.'));
  }, [studentId]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setBusy(false);
    }
  };

  const saveEmail = () =>
    run(async () => {
      const value = newEmail.trim().toLowerCase();
      await studentService.updateStudent(studentId, { email: value });
      setEmail(value);
    }, 'Đã cập nhật email đăng nhập.');

  const setPassword = () =>
    run(async () => {
      await studentService.setStudentPassword(studentId, { new_password: pw });
      setPw('');
    }, 'Đã đặt mật khẩu. Học viên sẽ phải đổi mật khẩu khi đăng nhập.');

  const generate = () =>
    run(async () => {
      const r = await studentService.setStudentPassword(studentId, { generate: true });
      setTempPw(r.temporary_password || '');
    }, 'Đã tạo mật khẩu tạm. Mật khẩu chỉ hiện một lần, hãy sao chép ngay.');

  const sendReset = () =>
    run(async () => {
      await studentService.sendPasswordReset(studentId);
    }, 'Đã gửi email đặt lại mật khẩu tới học viên.');

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium';
  const btnCls = 'px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer';

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
      <p className="text-xs font-extrabold text-amber-800">Tài khoản đăng nhập (chỉ admin)</p>
      <p className="text-[11px] text-slate-600">Email hiện tại: <strong>{email || '...'}</strong></p>

      <div className="flex gap-2">
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} placeholder="Email đăng nhập" />
        <button type="button" disabled={busy || !newEmail.trim()} onClick={saveEmail} className={btnCls}>Lưu email</button>
      </div>

      <div className="flex gap-2">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder="Mật khẩu mới (≥ 8 ký tự)" autoComplete="new-password" />
        <button type="button" disabled={busy || pw.length < 8} onClick={setPassword} className={btnCls}>Đặt mật khẩu</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={generate} className={btnCls}>Tự sinh mật khẩu tạm</button>
        <button type="button" disabled={busy} onClick={sendReset} className={btnCls}>Gửi email đặt lại mật khẩu</button>
      </div>

      {tempPw && (
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <code className="text-xs font-mono font-bold text-blue-700 flex-1 select-all">{tempPw}</code>
          <button type="button" className={btnCls} onClick={() => navigator.clipboard?.writeText(tempPw)}>Sao chép</button>
        </div>
      )}

      {msg && <p className="text-[11px] text-emerald-700 font-semibold">{msg}</p>}
      {err && <p className="text-[11px] text-rose-600 font-semibold">{err}</p>}
    </div>
  );
}
