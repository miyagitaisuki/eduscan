import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Quy ước giao diện, kiểm tra tự động để không bị phá dần theo thời gian:
//  1. Dùng màu theo ngữ nghĩa (primary/success/warning/danger/accent), không dùng tên màu thô của Tailwind
//  2. Chữ không nhỏ hơn 12px (text-xs trở lên)
//  3. Không dùng <div>/<span> có onClick (dùng <button> hoặc clickable() để bàn phím dùng được)

const root = path.resolve(__dirname, '../../src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(root).map((file) => ({ file: path.relative(root, file), text: fs.readFileSync(file, 'utf8') }));

const violations = (re: RegExp) =>
  files.flatMap(({ file, text }) =>
    text.split('\n').flatMap((line, i) => (re.test(line) ? [`${file}:${i + 1}: ${line.trim().slice(0, 90)}`] : []))
  );

describe('quy ước giao diện', () => {
  it('không dùng tên màu thô của Tailwind (blue, emerald, amber, rose, red, indigo, purple...)', () => {
    const raw = /\b(?:bg|text|border|ring|from|via|to|shadow|fill|stroke|divide|outline|placeholder|decoration|caret)(?:-[trblxy])?-(?:blue|emerald|amber|rose|red|indigo|purple|green|orange|teal|pink|sky|violet|yellow|cyan)-\d/;
    expect(violations(raw)).toEqual([]);
  });

  it('không dùng cỡ chữ dưới 12px', () => {
    expect(violations(/text-\[(?:[0-9]|1[01])px\]/)).toEqual([]);
  });

  it('không có div/span/p có onClick trực tiếp', () => {
    expect(violations(/<(?:div|span|p|li)\b[^>]*\sonClick=/)).toEqual([]);
  });
});
