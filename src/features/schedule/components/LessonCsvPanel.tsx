import React, { useId, useState } from 'react';
import { Download, FileUp, Loader2 } from 'lucide-react';
import type { ClassItem } from '../../../shared/types';
import { lessonService } from '../../../services';
import { errorDetail } from '../../../shared/utils/errorMessage';
import { lessonRowsFromCsv, LessonCsvRow } from '../../../shared/utils/csv';
import { shortLessonDate } from '../../../shared/utils/lessonDates';
import type { Notify } from '../../../hooks/data/types';

interface LessonCsvPanelProps {
  cls: ClassItem;
  /** Gọi sau khi ghi để modal tải lại buổi học */
  onImported: () => void;
  notify?: Notify;
}

type Preview = Awaited<ReturnType<typeof lessonService.importLessonsCsv>>;

/** Xuất lịch ra CSV (làm file mẫu), điền nội dung trong Excel, rồi nhập lại. Dùng khi không bật AI. */
export const LessonCsvPanel: React.FC<LessonCsvPanelProps> = ({ cls, onImported, notify }) => {
  const uid = useId();
  const [exporting, setExporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<LessonCsvRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const { blob, filename } = await lessonService.exportLessonsCsv(cls.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorDetail(err));
    } finally {
      setExporting(false);
    }
  };

  const check = async (list: LessonCsvRow[]) => {
    setBusy(true);
    setError('');
    try {
      setPreview(await lessonService.importLessonsCsv(cls.id, list, true));
    } catch (err) {
      setPreview(null);
      setError(errorDetail(err));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    setPreview(null);
    setError('');
    if (!file) return;
    setFileName(file.name);
    const parsed = lessonRowsFromCsv(await file.text());
    if (parsed.error) {
      setRows([]);
      setError(parsed.error);
      return;
    }
    setRows(parsed.rows);
    await check(parsed.rows);
  };

  const apply = async () => {
    if (!preview || (preview.valid ?? 0) === 0) return;
    const okLines = new Set(preview.results.filter((r) => r.status === 'ok').map((r) => r.line));
    setBusy(true);
    setError('');
    try {
      const res = await lessonService.importLessonsCsv(cls.id, rows.filter((r) => okLines.has(r.line)), false);
      notify?.('success', `Đã cập nhật ${res.updated ?? 0} buổi học`, res.invalid ? `Bỏ qua ${res.invalid} dòng lỗi` : undefined);
      setPreview(null);
      setRows([]);
      setFileName('');
      onImported();
    } catch (err) {
      setError(errorDetail(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 bg-accent-50/50 border border-accent-200 rounded-2xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-700">
          <strong>Không dùng AI?</strong> Xuất lịch ra CSV, điền cột <em>Nội dung</em> và <em>Ghi chú</em> trong Excel, rồi nhập lại. Khớp theo cột Ngày; đừng đổi cột Ngày.
        </p>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-accent-300 text-accent-700 hover:bg-accent-100 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Đang xuất...' : 'Xuất CSV (file mẫu)'}
        </button>
      </div>

      <div>
        <label htmlFor={`${uid}-file`} className="flex items-center gap-2 px-3 py-2 border border-dashed border-accent-300 rounded-xl text-xs font-bold text-accent-700 bg-white hover:bg-accent-50 cursor-pointer">
          <FileUp className="w-4 h-4" />
          {fileName || 'Chọn file CSV đã điền để nhập'}
        </label>
        <input id={`${uid}-file`} type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} className="sr-only" />
      </div>

      {busy && (
        <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang kiểm tra...
        </p>
      )}
      {error && <p className="text-xs text-danger-700 font-medium">{error}</p>}

      {preview && !busy && (
        <div className="space-y-2">
          <p className="text-xs text-slate-700">
            Tổng <strong>{preview.total}</strong> dòng: <strong className="text-success-700">{(preview.valid ?? 0)} sẽ cập nhật</strong>,{' '}
            <strong>{preview.skipped} bỏ qua</strong> (trống), <strong className="text-danger-700">{preview.invalid} lỗi</strong>.
          </p>
          {preview.results.some((r) => r.status === 'error') && (
            <ul className="max-h-40 overflow-y-auto text-xs text-danger-700 font-medium list-disc pl-5 space-y-0.5">
              {preview.results
                .filter((r) => r.status === 'error')
                .map((r) => (
                  <li key={r.line}>
                    Dòng {r.line} ({r.lesson_date || 'trống'}): {r.errors.join(' ')}
                  </li>
                ))}
            </ul>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={apply}
              disabled={!(preview.valid ?? 0)}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
            >
              Cập nhật {(preview.valid ?? 0)} buổi
            </button>
          </div>
          {(preview.valid ?? 0) > 0 && (
            <p className="text-xs text-slate-500">
              Ví dụ: {shortLessonDate(preview.results.find((r) => r.status === 'ok')!.lesson_date)} → "{preview.results.find((r) => r.status === 'ok')!.title}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};
