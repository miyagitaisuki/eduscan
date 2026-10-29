import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Các modal đang mở theo thứ tự; chỉ modal trên cùng xử lý phím Esc và Tab
const openModals: symbol[] = [];
let scrollLocks = 0;

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

export interface ModalProps {
  /** Tiêu đề, cũng là nhãn truy cập của hộp thoại */
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Mô tả ngắn dưới tiêu đề */
  description?: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** Cho phép đóng bằng Esc, bấm nền và nút X (mặc định true). Tắt khi đang bắt buộc phải xử lý. */
  dismissible?: boolean;
  /**
   * Bấm nền có đóng không (mặc định true). Đặt false cho form đang nhập liệu để bấm nhầm không mất dữ liệu;
   * Esc và nút X vẫn đóng được.
   */
  closeOnBackdrop?: boolean;
  /** bottom: bảng trượt từ đáy màn hình (menu trên điện thoại) */
  placement?: 'center' | 'bottom';
  /** dark: nền tối cho màn hình camera */
  variant?: 'light' | 'dark';
  /** Ghi đè lớp nền phủ phía sau (VD nền tối hơn khi chiếu mã QR) */
  overlayClassName?: string;
  /** Chân modal (thường là nút hành động) */
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  onClose,
  children,
  description,
  size = 'md',
  dismissible = true,
  closeOnBackdrop = true,
  variant = 'light',
  placement = 'center',
  overlayClassName = 'bg-slate-900/50 backdrop-blur-xs',
  footer,
}) => {
  const isDark = variant === 'dark';
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Luôn gọi bản onClose mới nhất mà không phải đăng ký lại sự kiện bàn phím
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = Symbol('modal');
    openModals.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden';

    // Đưa focus vào modal: ưu tiên phần tử có data-autofocus, sau đó là phần tử đầu tiên có thể focus
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== id) return;
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panel) {
        // Giữ focus bên trong modal
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!panel.contains(active)) {
          // Focus lạc ra ngoài modal: kéo về lại bên trong
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(id), 1);
      if (--scrollLocks === 0) document.body.style.overflow = '';
      // Trả focus về nút đã mở modal, trừ khi đã có modal khác mở ra (VD form đóng đúng lúc hộp thoại mới hiện)
      if (openModals.length === 0 && previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [dismissible]);

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center ${
        placement === 'bottom' ? 'items-end' : 'items-center p-4'
      } ${overlayClassName}`}
      onMouseDown={(e) => {
        // Chỉ đóng khi bấm thẳng vào nền, không phải khi kéo chuột từ trong modal ra ngoài
        if (dismissible && closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`shadow-2xl w-full ${SIZE_CLASS[size]} max-h-[92dvh] flex flex-col outline-hidden ${
          placement === 'bottom' ? 'rounded-t-3xl pb-[env(safe-area-inset-bottom)]' : 'rounded-3xl'
        } ${isDark ? 'bg-slate-900 text-white border border-slate-700' : 'bg-white'}`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className={`text-base font-extrabold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className={`p-1.5 -mr-1.5 -mt-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 pb-5 pt-1 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};
