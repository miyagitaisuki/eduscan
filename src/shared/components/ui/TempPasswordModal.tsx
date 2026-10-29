import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Modal } from './Modal';
import { buildCredentialMessage, copyText, Credentials, roleLabel } from '../../utils/credentials';

interface TempPasswordModalProps {
  credentials: Credentials;
  onClose: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

// Mật khẩu tạm chỉ hiện một lần: không đóng được bằng Esc hay bấm nền, chỉ bằng nút "Đã ghi lại".
export const TempPasswordModal: React.FC<TempPasswordModalProps> = ({ credentials, onClose }) => {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const who = roleLabel(credentials.role);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async () => {
    const ok = await copyText(buildCredentialMessage(credentials, window.location.origin));
    setCopyState(ok ? 'copied' : 'failed');
    clearTimeout(resetTimer.current);
    if (ok) resetTimer.current = setTimeout(() => setCopyState('idle'), 2500);
  };

  return (
    <Modal
      title={<>Mật khẩu tạm cho {credentials.name}</>}
      description={`Gửi thông tin này cho ${who}. Họ sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.`}
      onClose={onClose}
      size="md"
      dismissible={false}
    >
      <div className="space-y-4">
        <dl className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div>
            <dt className="text-xs font-bold text-slate-500">Tên đăng nhập</dt>
            <dd className="text-sm font-bold text-slate-900 break-all select-all">{credentials.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-slate-500">Mật khẩu tạm</dt>
            <dd className="text-xl font-mono font-black tracking-wide text-primary-700 break-all select-all">
              {credentials.password}
            </dd>
          </div>
        </dl>

        <p className="text-xs font-semibold text-danger-600 leading-relaxed">
          Mật khẩu chỉ hiện một lần. Sau khi đóng cửa sổ này sẽ không xem lại được; nếu quên, hãy đặt lại mật khẩu.
        </p>

        <div role="status" aria-live="polite" className="min-h-4 text-xs font-semibold">
          {copyState === 'copied' && <span className="text-success-700">Đã sao chép thông tin đăng nhập.</span>}
          {copyState === 'failed' && (
            <span className="text-warning-800">
              Trình duyệt không cho sao chép tự động. Hãy chọn và sao chép mật khẩu ở trên.
            </span>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            data-autofocus
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {copyState === 'copied' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            {copyState === 'copied' ? 'Đã sao chép' : 'Sao chép thông tin đăng nhập'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Đã ghi lại
          </button>
        </div>
      </div>
    </Modal>
  );
};
