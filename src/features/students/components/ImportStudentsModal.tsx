import React, { useId, useState } from 'react';
import { Download, FileUp, Loader2 } from 'lucide-react';
import type { ClassItem } from '../../../shared/types';
import { studentService, StudentImportResponse } from '../../../services';
import { Modal } from '../../../shared/components/ui';
import { errorDetail } from '../../../shared/utils/errorMessage';
import { studentRowsFromCsv, StudentCsvRow, toCsvText } from '../../../shared/utils/csv';
import { todayLocal } from '../../../shared/utils/date';
import type { Notify } from '../../../hooks/data/types';

interface ImportStudentsModalProps {
  classes: ClassItem[];
  /** Lớp đang lọc trên màn hình, mặc định cho các dòng không ghi lớp */
  defaultClassId?: string;
  onClose: () => void;
  /** Gọi sau khi ghi xong để màn hình ngoài tải lại danh sách */
  onImported: () => void;
  notify?: Notify;
}

const selectClass = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white';
const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

/** File mẫu: đúng tên cột để nhập ngay, dùng tiếng Việt có dấu */
const TEMPLATE_HEADER = ['Họ tên', 'Email', 'Điện thoại', 'Giới tính', 'Mã số', 'Lớp', 'Ngày vào lớp'];
const TEMPLATE_ROW = ['Nguyễn Văn An', '', '0905111222', 'Nam', '', '', todayLocal()];

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({ classes, defaultClassId = '', onClose, onImported, notify }) => {
  const uid = useId();
  const [classId, setClassId] = useState(defaultClassId);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<StudentCsvRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [preview, setPreview] = useState<StudentImportResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [created, setCreated] = useState<StudentImportResponse | null>(null);
  const [requestError, setRequestError] = useState('');

  const runCheck = async (list: StudentCsvRow[], cls: string) => {
    if (list.length === 0) return;
    setChecking(true);
    setRequestError('');
    try {
      setPreview(await studentService.importStudents({ rows: list, class_id: cls || undefined, dry_run: true }));
    } catch (err) {
      setPreview(null);
      setRequestError(errorDetail(err));
    } finally {
      setChecking(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    setPreview(null);
    setCreated(null);
    setParseError('');
    if (!file) return;
    setFileName(file.name);
    const parsed = studentRowsFromCsv(await file.text());
    if (parsed.error) {
      setRows([]);
      setParseError(parsed.error);
      return;
    }
    setRows(parsed.rows);
    await runCheck(parsed.rows, classId);
  };

  const changeClass = (next: string) => {
    setClassId(next);
    if (rows.length > 0 && !created) runCheck(rows, next);
  };

  const doImport = async () => {
    if (!preview || preview.valid === undefined || preview.valid === 0) return;
    setImporting(true);
    setRequestError('');
    try {
      // Chỉ gửi các dòng hợp lệ; dòng lỗi đã được báo trong bảng xem trước
      const okLines = new Set(preview.results.filter((r) => r.status === 'ok').map((r) => r.line));
      const result = await studentService.importStudents({
        rows: rows.filter((r) => okLines.has(r.line)),
        class_id: classId || undefined,
        dry_run: false,
      });
      setCreated(result);
      notify?.('success', `Đã nhập ${result.created ?? 0} học viên`, result.invalid ? `Bỏ qua ${result.invalid} dòng lỗi` : undefined);
      onImported();
    } catch (err) {
      setRequestError(errorDetail(err));
    } finally {
      setImporting(false);
    }
  };

  const downloadBlob = (content: string, name: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => downloadBlob(toCsvText(TEMPLATE_HEADER, [TEMPLATE_ROW]), 'mau-nhap-hoc-vien.csv');

  const downloadCredentials = () => {
    if (!created?.credentials) return;
    downloadBlob(
      toCsvText(
        ['Họ tên', 'Email đăng nhập', 'Mật khẩu tạm', 'Lớp'],
        created.credentials.map((c) => [c.full_name, c.email, c.temporary_password, c.class_name])
      ),
      `mat-khau-tam-${todayLocal()}.csv`
    );
  };

  const okCount = preview?.results.filter((r) => r.status === 'ok').length ?? 0;
  const errorCount = preview?.results.filter((r) => r.status === 'error').length ?? 0;

  return (
    <Modal
      title="Nhập học viên từ file CSV"
      description="Mỗi dòng là một học viên. Kiểm tra xem trước, dòng lỗi sẽ được bỏ qua khi nhập."
      onClose={onClose}
      size="xl"
      closeOnBackdrop={false}
    >
      {created ? (
        <div className="space-y-4">
          <div className="p-4 bg-success-50 border border-success-200 rounded-2xl">
            <p className="text-sm font-extrabold text-success-800">Đã nhập {created.created ?? 0} học viên.</p>
            {(created.invalid ?? 0) > 0 && <p className="text-xs text-success-800 mt-1">Bỏ qua {created.invalid} dòng lỗi.</p>}
          </div>
          <div className="p-4 bg-warning-50 border border-warning-200 rounded-2xl space-y-2">
            <p className="text-xs font-bold text-warning-800">
              Mật khẩu tạm chỉ hiện một lần. Tải file dưới đây, phát cho từng học viên, rồi xóa file. Học viên phải tự đổi mật khẩu ở lần đăng nhập đầu.
            </p>
            <button
              type="button"
              onClick={downloadCredentials}
              disabled={!created.credentials?.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-300"
            >
              <Download className="w-3.5 h-3.5" />
              Tải file mật khẩu tạm (CSV)
            </button>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold cursor-pointer">
              Đóng
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor={`${uid}-class`}>Lớp cho các dòng không ghi lớp</label>
              <select id={`${uid}-class`} value={classId} onChange={(e) => changeClass(e.target.value)} className={selectClass}>
                <option value="">Không xếp lớp</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${uid}-file`}>File CSV</label>
              <label
                htmlFor={`${uid}-file`}
                className="flex items-center gap-2 px-3 py-2 border border-dashed border-primary-300 rounded-xl text-xs font-bold text-primary-700 bg-primary-50/40 hover:bg-primary-50 cursor-pointer"
              >
                <FileUp className="w-4 h-4" />
                {fileName || 'Chọn file .csv'}
              </label>
              <input id={`${uid}-file`} type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} className="sr-only" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-slate-500">
              Cột: Họ tên (bắt buộc), Email, Điện thoại, Giới tính, Mã số, Lớp, Ngày vào lớp. Tối đa 200 học viên mỗi lần. Email để trống sẽ tự sinh.
            </p>
            <button type="button" onClick={downloadTemplate} className="font-bold text-primary-700 hover:text-primary-800 cursor-pointer">
              Tải file mẫu
            </button>
          </div>

          {parseError && <p className="text-xs text-danger-700 font-medium">{parseError}</p>}
          {requestError && <p className="text-xs text-danger-700 font-medium">{requestError}</p>}
          {checking && (
            <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang kiểm tra từng dòng...
            </p>
          )}

          {preview && !checking && (
            <>
              <p className="text-xs text-slate-700">
                Tổng <strong>{preview.total}</strong> dòng: <strong className="text-success-700">{okCount} hợp lệ</strong>,{' '}
                <strong className="text-danger-700">{errorCount} lỗi</strong>.
              </p>
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs">
                  <caption className="sr-only">Kết quả kiểm tra từng dòng</caption>
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-slate-600">
                      <th scope="col" className="px-3 py-2 font-bold">Dòng</th>
                      <th scope="col" className="px-3 py-2 font-bold">Họ tên</th>
                      <th scope="col" className="px-3 py-2 font-bold">Email</th>
                      <th scope="col" className="px-3 py-2 font-bold">Lớp</th>
                      <th scope="col" className="px-3 py-2 font-bold">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.results.map((r) => (
                      <tr key={r.line} className={`border-t border-slate-100 align-top ${r.status === 'error' ? 'bg-danger-50/40' : ''}`}>
                        <td className="px-3 py-2 text-slate-500">{r.line}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{r.full_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 break-all">{r.email || <span className="text-slate-400">tự sinh</span>}</td>
                        <td className="px-3 py-2 text-slate-600">{r.class_name || '—'}</td>
                        <td className="px-3 py-2">
                          {r.status === 'ok' ? (
                            <span className="font-bold text-success-700">Hợp lệ</span>
                          ) : (
                            <ul className="text-danger-700 font-medium list-disc pl-4">
                              {r.errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
              Hủy
            </button>
            <button
              type="button"
              onClick={doImport}
              disabled={!preview || okCount === 0 || importing || checking}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 cursor-pointer"
            >
              {importing ? 'Đang nhập...' : `Nhập ${okCount} học viên hợp lệ`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
