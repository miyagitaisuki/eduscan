import { describe, it, expect } from 'vitest';
import { parseCsv, studentRowsFromCsv, toCsvText } from '../../src/shared/utils/csv';

describe('đọc CSV', () => {
  it('bỏ BOM, nhận CRLF và ô có dấu phẩy, dấu nháy kép, xuống dòng', () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n"nhiều\ndòng",z\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['nhiều\ndòng', 'z'],
    ]);
  });

  it('tự nhận dấu chấm phẩy của Excel tiếng Việt', () => {
    expect(parseCsv('Họ tên;Email\nAn;an@x.vn')).toEqual([
      ['Họ tên', 'Email'],
      ['An', 'an@x.vn'],
    ]);
  });

  it('bỏ dòng trống', () => {
    expect(parseCsv('a,b\n\n,\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('chuyển bảng thành học viên', () => {
  it('nhận tên cột tiếng Việt có và không dấu, bỏ khoảng trắng và dấu gạch dưới', () => {
    const { rows, error } = studentRowsFromCsv('Họ Tên,Điện thoại,Giới_Tính,MSSV,Lớp\nTrần Thị Hoa,0907,Nữ,225,N5\n');
    expect(error).toBeUndefined();
    expect(rows).toEqual([
      { line: 2, full_name: 'Trần Thị Hoa', email: '', phone: '0907', gender: 'Nữ', student_code: '225', class_name: 'N5', join_date: '' },
    ]);
  });

  it('báo lỗi khi thiếu cột họ tên hoặc không có dòng dữ liệu', () => {
    expect(studentRowsFromCsv('Email,Lớp\na@b.c,N5').error).toContain('Họ tên');
    expect(studentRowsFromCsv('Họ tên\n').error).toContain('không có dòng dữ liệu');
  });

  it('dòng báo lỗi có số dòng đúng trong file (dòng tiêu đề là dòng 1)', () => {
    const { rows } = studentRowsFromCsv('Họ tên\nAn\n\nBình\n');
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
  });
});

describe('ghi CSV', () => {
  it('có BOM, chống công thức và bọc ô có ký tự đặc biệt', () => {
    const out = toCsvText(['Tên', 'Ghi chú'], [['=1+1', 'a, b'], ['+x', '"q"']]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("'=1+1,\"a, b\"");
    expect(out).toContain("'+x,\"\"\"q\"\"\"");
  });

  it('ghi rồi đọc lại được cùng nội dung', () => {
    const rows = [['Nguyễn Văn An', 'an@qnu.edu.vn', 'Pw, "x"']];
    expect(parseCsv(toCsvText(['Họ tên', 'Email', 'Mật khẩu'], rows))).toEqual([['Họ tên', 'Email', 'Mật khẩu'], rows[0]]);
  });
});
