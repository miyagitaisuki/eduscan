import type { KeyboardEvent } from 'react';

/**
 * Props cho phần tử không phải <button> nhưng bấm được (thẻ, hàng danh sách):
 * cho phép focus bằng Tab và kích hoạt bằng Enter hoặc Space. Phím gõ bên trong ô nhập lồng bên trong không bị chặn.
 */
export function clickable(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
