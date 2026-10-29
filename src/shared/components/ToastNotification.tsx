import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastNotification as ToastType } from '../types';

interface ToastNotificationProps {
  toast: ToastType | null;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div className="fixed bottom-18 md:bottom-6 right-4 sm:right-6 z-50 flex items-start gap-3 bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-slate-800 animate-in slide-in-from-bottom-5 max-w-sm">
      {toast.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
      ) : toast.type === 'warning' ? (
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      ) : (
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 pr-1">
        <p className="text-xs font-bold text-slate-100">{toast.title}</p>
        {toast.subtitle && (
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{toast.subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
