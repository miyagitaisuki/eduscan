import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Máy chủ miễn phí có thể ngủ và mất vài chục giây để khởi động lại.
// Sau ngần này giây thì giải thích cho người dùng thay vì để họ nhìn màn hình trống.
const SLOW_AFTER_MS = 6000;

export const LoadingScreen: React.FC = () => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-slate-100/70 flex flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <p className="text-sm font-bold text-slate-800">Đang tải dữ liệu...</p>
      {isSlow && (
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          Máy chủ đang khởi động lại sau thời gian không hoạt động, có thể mất thêm khoảng một phút. Vui lòng chờ.
        </p>
      )}
    </div>
  );
};
