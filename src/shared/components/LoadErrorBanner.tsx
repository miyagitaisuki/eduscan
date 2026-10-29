import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface LoadErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export const LoadErrorBanner: React.FC<LoadErrorBannerProps> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
  >
    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
    <p className="flex-1 text-xs leading-relaxed">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
    >
      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      Thử lại
    </button>
  </div>
);
