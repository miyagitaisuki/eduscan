import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../shared/components/ui';
import { JaText } from '../../../shared/components/JaText';
import { homeworkService } from '../../../services/homeworkService';
import type { Assignment, Submission, TextbookSubmissionContent } from '../../../shared/types';

interface Props {
  assignment: Assignment;
  /** Lần nộp gần nhất (nếu có) để điền lại câu trả lời và hiện kết quả */
  submission?: Submission | null;
  onClose: () => void;
  onResult: (sub: Submission) => void;
}

function parseContent(sub?: Submission | null): TextbookSubmissionContent | null {
  if (!sub?.content) return null;
  try {
    const c = JSON.parse(sub.content);
    return c?.kind === 'textbook' ? c : null;
  } catch {
    return null;
  }
}

// Học viên làm bài giáo trình ngay trong cổng; server chấm và trả kết quả từng câu.
export const TextbookPracticeModal: React.FC<Props> = ({ assignment, submission, onClose, onResult }) => {
  const payload = assignment.payload;
  const [last, setLast] = useState<TextbookSubmissionContent | null>(() => parseContent(submission));
  const [score, setScore] = useState<number | null>(submission?.score ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(() => last?.answers ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = useMemo(() => payload?.exercises.reduce((n, e) => n + e.items.length, 0) ?? 0, [payload]);

  if (!payload) return null;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const sub = await homeworkService.submitTextbook(assignment.id, answers);
      setLast(parseContent(sub));
      setScore(sub.score ?? null);
      onResult(sub);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không nộp được bài. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={assignment.title}
      description={<JaText text={`第${payload.source.lesson_no}課　${payload.source.title_ja}`} />}
      onClose={onClose}
      size="xl"
      closeOnBackdrop={false}
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            {last ? `Lần ${last.attempts}: đúng ${last.correct}/${last.total} câu • ${score ?? 0}/10` : `${total} câu`}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {last ? 'Nộp lại' : 'Nộp bài'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <p className="text-xs font-semibold text-danger-700">{error}</p>}
        {!payload.answers_visible && (
          <p className="text-xs text-slate-500">
            Đáp án mẫu hiện sau hạn nộp. Câu "chưa khớp" có thể vẫn đúng ý, giáo viên sẽ xem lại.
          </p>
        )}
        {payload.exercises.map((ex) => (
          <section key={ex.id} className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">
              <JaText text={ex.title} />
            </h3>
            {ex.instruction && <p className="text-xs text-slate-700">{ex.instruction}</p>}
            {ex.example.length > 0 && (
              <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-2.5 space-y-0.5">
                {ex.example.map((line, i) => (
                  <div key={i}>
                    <JaText text={line} />
                  </div>
                ))}
              </div>
            )}
            {ex.passage && (
              <div className="text-sm text-slate-800 border border-slate-200 rounded-xl p-3 leading-loose">
                <JaText text={ex.passage} />
              </div>
            )}
            <ol className="space-y-2.5">
              {ex.items.map((item) => {
                const result = last?.results[item.key];
                return (
                  <li key={item.key} className="space-y-1">
                    <div className="text-sm text-slate-900 leading-loose">
                      <span className="text-xs font-bold text-slate-500 mr-1.5">({item.n})</span>
                      <JaText text={item.prompt} />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        lang="ja"
                        aria-label={`Câu ${item.n}: ${ex.title}`}
                        value={answers[item.key] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [item.key]: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-jp focus:ring-2 focus:ring-primary-500"
                      />
                      {result === 'correct' && <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-label="Đúng" />}
                      {result === 'review' && <AlertCircle className="w-4 h-4 text-warning-600 shrink-0" aria-label="Chưa khớp" />}
                    </div>
                    {payload.answers_visible && item.answer && (
                      <div className="text-xs text-success-800">
                        Đáp án mẫu: <JaText text={item.answer} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </Modal>
  );
};
