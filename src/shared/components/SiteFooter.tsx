import React from 'react';
import { ADDRESS, EMAIL, PHONE, PHONE_DISPLAY, PRACTICE_URL, WEBSITE_URL, ZALO_URL } from '../config/ecosystem';

// Chân trang chung, cùng nội dung với website và trang luyện tập (bản gọn cho ứng dụng).
export const SiteFooter: React.FC<{ className?: string }> = ({ className = '' }) => (
  <footer className={`text-xs text-slate-500 space-y-1.5 ${className}`}>
    <p className="font-semibold text-sm text-slate-800">IMEJI日本語教室</p>
    <p>Lớp học tiếng Nhật thầy Quang ・ {ADDRESS}</p>
    <p>
      <a href={`tel:${PHONE}`} className="hover:text-primary-600">{PHONE_DISPLAY}</a> ・{' '}
      <a href={ZALO_URL} target="_blank" rel="noreferrer" className="hover:text-primary-600">Zalo</a> ・{' '}
      <a href={`mailto:${EMAIL}`} className="hover:text-primary-600">{EMAIL}</a>
    </p>
    <p>
      <a href={`${WEBSITE_URL}/`} className="hover:text-primary-600">Trang chủ</a> ・{' '}
      <a href={PRACTICE_URL} className="hover:text-primary-600">Luyện tập Minna (miễn phí)</a> ・{' '}
      <a href={`${WEBSITE_URL}/posts/`} className="hover:text-primary-600">Bài viết</a>
    </p>
  </footer>
);
