import React, { useEffect, useMemo, useState } from 'react';
import { Paperclip, X, Loader2, ExternalLink, Search } from 'lucide-react';
import { homeworkService } from '../../../services/homeworkService';
import { Submission } from '../../../shared/types';

interface SubmissionAttachmentsModalProps {
  onClose: () => void;
}

// Danh sách mọi bài nộp có tệp đính kèm, để giáo viên xem bài của học viên ở mọi lớp.
export const SubmissionAttachmentsModal: React.FC<SubmissionAttachmentsModalProps> = ({ onClose }) => {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    homeworkService
      .getAttachmentSubmissions()
      .then((rows) => !cancelled && setItems(rows))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Không tải được danh sách.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      [s.student_name, s.assignment_title, s.class_name].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [items, query]);

  const openAttachment = async (submissionId: string) => {
    // Mở tab trước (đồng bộ với thao tác bấm) để trình duyệt iOS không chặn popup sau khi chờ mạng
    const win = window.open('', '_blank');
    setOpeningId(submissionId);
    try {
      const { url } = await homeworkService.getAttachmentUrl(submissionId);
      if (win) win.location.href = url;
      else window.open(url, '_blank');
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : 'Không mở được tệp.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-2xl max-h-[92dvh] flex flex-col border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-blue-600" />
            Tệp nộp bài của học viên ({items.length})
          </h3>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo học viên, bài tập hoặc lớp"
            className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
          />
        </div>

        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        <div className="overflow-y-auto space-y-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
              {items.length === 0 ? 'Chưa có học viên nào nộp tệp.' : 'Không có kết quả phù hợp.'}
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 bg-white"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{s.student_name || 'Học viên'}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {s.assignment_title || 'Bài tập'} • {s.class_name || ''}
                  </p>
                </div>
                <button
                  onClick={() => openAttachment(s.id)}
                  disabled={openingId === s.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {openingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Xem tệp
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
