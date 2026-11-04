import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { homeworkService } from '../../../services/homeworkService';
import type { Assignment, Submission } from '../../../shared/types';

// Trang luyện tập (dominion) chạy ở website; nơi nhận kết quả chỉ tin đúng nguồn này.
const MINNA_ORIGIN = ((import.meta.env.VITE_MINNA_ORIGIN as string | undefined) || 'https://imejiquynhon.com').replace(/\/+$/, '');

interface Props {
  assignment: Assignment;
  onClose: () => void;
  /** Gọi sau mỗi lượt đã được ghi điểm */
  onResult: (sub: Submission) => void;
}

export const MinnaPracticeModal: React.FC<Props> = ({ assignment, onClose, onResult }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [message, setMessage] = useState('');
  const lesson = assignment.minna_lesson;

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      // Chỉ nhận từ đúng trang đã nhúng: kiểm tra cả nguồn lẫn cửa sổ gửi
      if (event.origin !== MINNA_ORIGIN || event.source !== frameRef.current?.contentWindow) return;
      const d = event.data;
      if (!d || d.type !== 'mnn:lesson-complete' || d.practice) return;
      if (d.lessonNo !== lesson) return;
      try {
        const sub = await homeworkService.submitMinnaResult(assignment.id, {
          lesson_no: d.lessonNo,
          game: d.game,
          total: d.total,
          correct: d.correct,
        });
        onResult(sub);
        setMessage(`Đã ghi điểm. Điểm cao nhất của bạn: ${sub.score}/10`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Không ghi được điểm. Hãy thử lại.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [assignment.id, lesson, onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-modal="true" aria-label={assignment.title}>
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">{assignment.title}</div>
          {message && <div className="text-xs font-semibold text-success-800">{message}</div>}
        </div>
        <button onClick={onClose} aria-label="Đóng" className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <iframe
        ref={frameRef}
        title={assignment.title}
        src={`${MINNA_ORIGIN}/luyen-tap/minna/${lesson}.html`}
        className="flex-1 w-full border-0"
      />
    </div>
  );
};
