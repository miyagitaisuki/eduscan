import React, { useEffect, useState } from 'react';
import { documentService, DocType, DocumentFilters, LibraryDocument } from '../../../services/documentService';

const TYPE_LABEL: Record<DocType, string> = { exam: 'Đề thi', answer: 'Đáp án', material: 'Học liệu' };

interface DocumentsViewProps {
  canSync: boolean;
  onNotify: (type: 'success' | 'warning' | 'info', title: string, subtitle?: string) => void;
}

export function DocumentsView({ canSync, onNotify }: DocumentsViewProps) {
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<DocumentFilters>({ q: '', subject: '', year: undefined, type: '' });

  const load = async (f: DocumentFilters) => {
    setLoading(true);
    try {
      setDocs(await documentService.list(f));
    } catch (err: any) {
      onNotify('warning', 'Không tải được thư viện', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tìm kiếm có trễ nhẹ để không gọi API theo từng phím
  useEffect(() => {
    const t = setTimeout(() => load(filters), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.subject, filters.year, filters.type]);

  const sync = async () => {
    setLoading(true);
    try {
      const r = await documentService.sync();
      onNotify('success', 'Đã đồng bộ thư viện', `${r.total} tài liệu, ${r.added} mới, ${r.missing} đã mất`);
      await load(filters);
    } catch (err: any) {
      onNotify('warning', 'Đồng bộ thất bại', err.message);
      setLoading(false);
    }
  };

  const download = async (d: LibraryDocument) => {
    try {
      await documentService.download(d);
    } catch (err: any) {
      onNotify('warning', 'Tải file thất bại', err.message);
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-slate-800 mr-auto">Thư viện đề thi & học liệu</h2>
        {canSync && (
          <button onClick={sync} disabled={loading} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
            Đồng bộ từ Drive
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input
          className="col-span-2 md:col-span-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Tìm theo tên"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <input
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Môn"
          value={filters.subject}
          onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}
        />
        <input
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Năm"
          inputMode="numeric"
          value={filters.year ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value ? Number(e.target.value) : undefined }))}
        />
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as DocType | '' }))}
        >
          <option value="">Tất cả loại</option>
          {(Object.keys(TYPE_LABEL) as DocType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {!loading && docs.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Chưa có tài liệu phù hợp.</p>}
        {docs.map((d) => (
          <div key={d.drive_file_id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 truncate">{d.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {[d.subject, d.year, TYPE_LABEL[d.doc_type]].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button onClick={() => download(d)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50">
              Tải về
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
