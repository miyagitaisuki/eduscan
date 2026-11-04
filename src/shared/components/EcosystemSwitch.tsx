import React from 'react';
import { Gamepad2, House, LogIn } from 'lucide-react';
import { PRACTICE_URL, WEBSITE_URL } from '../config/ecosystem';

// Thanh chuyển 3 app (Trang chủ · Luyện tập · Học viên), cùng markup và kiểu dáng (.imeji-switch trong
// src/styles/imeji-brand.css) với website (imeji_newhorizon) và trang luyện tập (imeji_dominion).
// Ở cổng học viên nên mục "Học viên" luôn là mục đang chọn.
export const EcosystemSwitch: React.FC<{ onDark?: boolean }> = ({ onDark = false }) => (
  <nav className={`imeji-switch${onDark ? ' imeji-switch--on-dark' : ''}`} aria-label="IMEJI日本語教室">
    <a className="imeji-switch__item" href={`${WEBSITE_URL}/`} title="Trang chủ">
      <House aria-hidden="true" />
      <span className="imeji-switch__label">Trang chủ</span>
    </a>
    <a className="imeji-switch__item" href={PRACTICE_URL} title="Luyện tập">
      <Gamepad2 aria-hidden="true" />
      <span className="imeji-switch__label">Luyện tập</span>
    </a>
    <a className="imeji-switch__item" href="/" aria-current="page" title="Học viên">
      <LogIn aria-hidden="true" />
      <span className="imeji-switch__label">Học viên</span>
    </a>
  </nav>
);
