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
  footer,
}) => {
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
        if (e.shiftKey && (active === first || active === panel)) {
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
      // Trả focus về nút đã mở modal
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [dismissible]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onMouseDown={(e) => {
        // Chỉ đóng khi bấm thẳng vào nền, không phải khi kéo chuột từ trong modal ra ngoài
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`bg-white rounded-3xl shadow-2xl w-full ${SIZE_CLASS[size]} max-h-[90vh] flex flex-col outline-hidden`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-extrabold text-slate-900 leading-snug">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-xs text-slate-500 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
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
