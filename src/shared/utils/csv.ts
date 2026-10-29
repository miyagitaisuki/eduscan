// Đọc và ghi CSV ở phía trình duyệt. Excel tiếng Việt hay lưu với dấu chấm phẩy, nên tự nhận dấu phân cách.

/** Tách văn bản CSV thành bảng ô. Hỗ trợ BOM, CRLF, ô có dấu nháy kép và xuống dòng trong ô. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Dấu phân cách xuất hiện nhiều nhất ở dòng đầu (ngoài dấu nháy) */
function detectDelimiter(src: string): string {
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  let inQuotes = false;
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

/** Ghi bảng ô ra CSV có BOM (Excel đọc đúng tiếng Việt), chống công thức như phía server */
export function toCsvText(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

// Tên cột chấp nhận: tiếng Việt có hoặc không dấu, hoặc tiếng Anh. Khóa là tên đã bỏ dấu, viết thường, không khoảng trắng.
const HEADER_ALIASES: Record<string, string> = {
  hoten: 'full_name', ten: 'full_name', fullname: 'full_name', name: 'full_name',
  email: 'email', mail: 'email',
  sdt: 'phone', sodienthoai: 'phone', dienthoai: 'phone', phone: 'phone',
  gioitinh: 'gender', gender: 'gender',
  mssv: 'student_code', maso: 'student_code', mahocvien: 'student_code', studentcode: 'student_code',
  lop: 'class_name', tenlop: 'class_name', class: 'class_name', classname: 'class_name', malop: 'class_name',
  ngayvaolop: 'join_date', ngaythamgia: 'join_date', joindate: 'join_date',
};

export interface StudentCsvRow {
  line: number;
  full_name: string;
  email: string;
  phone: string;
  gender: string;
  student_code: string;
  class_name: string;
  join_date: string;
}

/** Biến bảng CSV thành danh sách học viên theo tên cột. Báo lỗi nếu không có cột họ tên. */
export function studentRowsFromCsv(text: string): { rows: StudentCsvRow[]; error?: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], error: 'File không có dòng dữ liệu nào (cần một dòng tiêu đề và ít nhất một học viên).' };
  const keys = table[0].map((h) => {
    const folded = h.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[\s_]/g, '');
    return HEADER_ALIASES[folded] ?? '';
  });
  if (!keys.includes('full_name')) return { rows: [], error: 'Không tìm thấy cột "Họ tên" ở dòng đầu tiên.' };

  const rows = table.slice(1).map((cells, i) => {
    const row: Record<string, string> = {};
    keys.forEach((key, col) => {
      if (key) row[key] = (cells[col] ?? '').trim();
    });
    return {
      line: i + 2,
      full_name: row.full_name ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      gender: row.gender ?? '',
      student_code: row.student_code ?? '',
      class_name: row.class_name ?? '',
      join_date: row.join_date ?? '',
    };
  });
  return { rows };
}
