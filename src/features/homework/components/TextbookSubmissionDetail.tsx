import React from 'react';
import { JaText } from '../../../shared/components/JaText';
import type { Assignment, Submission, TextbookSubmissionContent } from '../../../shared/types';

// Bài làm giáo trình của một học viên: câu trả lời, kết quả tự chấm và đáp án mẫu (giáo viên xem lại câu "chưa khớp").
export const TextbookSubmissionDetail: React.FC<{ assignment: Assignment; submission: Submission }> = ({
  assignment,
  submission,
}) => {
  let content: TextbookSubmissionContent | null = null;
  try {
    const c = JSON.parse(submission.content || '{}');
    content = c?.kind === 'textbook' ? c : null;
  } catch {
    content = null;
  }
  if (!content || !assignment.payload) return null;
  const review = content.total - content.correct;

  return (
    <details className="mt-3 pt-2 border-t border-slate-100 text-xs" open={review > 0}>
      <summary className="cursor-pointer font-semibold text-slate-600">
        Bài làm (lần {content.attempts}): đúng {content.correct}/{content.total}
        {review > 0 && <span className="text-warning-700"> • {review} câu cần xem lại</span>}
      </summary>
      <div className="mt-2 space-y-3">
        {assignment.payload.exercises.map((ex) => (
          <div key={ex.id} className="space-y-1">
            <div className="font-bold text-slate-800">
              <JaText text={ex.title} />
            </div>
            {ex.items.map((item) => {
              const ok = content!.results[item.key] === 'correct';
              return (
                <div
                  key={item.key}
                  className={`p-2 rounded-lg border ${ok ? 'border-success-200 bg-success-50' : 'border-warning-200 bg-warning-50'}`}
                >
                  <div className="text-slate-600">
                    ({item.n}) <JaText text={item.prompt} />
                  </div>
                  <div className="text-slate-900">
                    Học viên: <span className="font-jp">{content!.answers[item.key] || '(bỏ trống)'}</span>
                  </div>
                  {!ok && item.answer && (
                    <div className="text-slate-600">
                      Đáp án mẫu: <JaText text={item.answer} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </details>
  );
};
