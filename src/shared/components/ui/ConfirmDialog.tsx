import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: thao tác xóa/khóa, nút xác nhận màu đỏ và focus mặc định ở nút Hủy */
  tone?: 'danger' | 'primary';
  /** Bắt người dùng gõ đúng chuỗi này mới cho xác nhận (cho thao tác không thể hoàn tác) */
  requireText?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'primary',
  requireText,
  onConfirm,
  onCancel,
}) => {
  const [typed, setTyped] = useState('');
  const isDanger = tone === 'danger';
  const canConfirm = !requireText || typed.trim() === requireText;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canConfirm) onConfirm();
  };

  return (
    <Modal title={title} size="sm" onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-3">
          {isDanger && (
            <div className="w-9 h-9 rounded-full bg-danger-50 text-danger-600 flex items-center justify-center shrink-0" aria-hidden="true">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          {message && <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{message}</div>}
        </div>

        {requireText && (
          <label className="block text-xs font-semibold text-slate-600">
            Gõ <span className="font-mono font-black text-slate-900">{requireText}</span> để xác nhận
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              data-autofocus
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:outline-hidden focus:border-primary-500"
            />
          </label>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            // Thao tác nguy hiểm: Enter mặc định rơi vào Hủy để tránh xác nhận nhầm
            data-autofocus={isDanger && !requireText ? '' : undefined}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            data-autofocus={!isDanger && !requireText ? '' : undefined}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDanger ? 'bg-danger-600 hover:bg-danger-700' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
