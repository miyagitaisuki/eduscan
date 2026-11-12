import React from 'react';

const RUBY = /\{([^{}|]+)\|([^{}|]+)\}/g;

/** Hiện chữ Nhật có furigana viết {漢字|かな} (định dạng giáo trình) bằng thẻ <ruby>. */
export const JaText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const m of text.matchAll(RUBY)) {
    const at = m.index ?? 0;
    if (at > pos) parts.push(text.slice(pos, at));
    parts.push(
      <ruby key={at}>
        {m[1]}
        <rt>{m[2]}</rt>
      </ruby>
    );
    pos = at + m[0].length;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return <span className={`font-jp whitespace-pre-line ${className ?? ''}`}>{parts}</span>;
};
