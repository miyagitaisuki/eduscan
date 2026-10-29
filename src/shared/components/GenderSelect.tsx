import React from 'react';
import { Gender } from '../types';

interface GenderSelectProps {
  value: Gender | null | undefined;
  onChange: (value: Gender | null) => void;
  className?: string;
}

// Chọn giới tính để xưng hô đúng trên màn hình chào (Thầy/Cô, anh/chị)
export const GenderSelect: React.FC<GenderSelectProps> = ({ value, onChange, className }) => (
  <select
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as Gender))}
    className={className ?? 'w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white'}
  >
    <option value="">Chưa chọn</option>
    <option value="male">Nam</option>
    <option value="female">Nữ</option>
  </select>
);
