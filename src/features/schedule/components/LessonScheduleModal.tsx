import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Loader2, Pencil } from 'lucide-react';
import type { ClassItem, Lesson, LessonPlanInput, LessonSyncResult } from '../../../shared/types';
import { lessonService } from '../../../services';
import { Modal, useConfirm } from '../../../shared/components/ui';
import { todayLocal } from '../../../shared/utils/date';
import { errorDetail } from '../../../shared/utils/errorMessage';
import { shortLessonDate, WEEKDAY_PICKER } from '../../../shared/utils/lessonDates';
import type { Notify } from '../../../hooks/data/types';
import { LessonCsvPanel } from './LessonCsvPanel';

interface LessonScheduleModalProps {
  cls: ClassItem;
  /** Chỉ admin được đặt lịch lặp và sửa từng buổi; giáo viên và học viên chỉ xem */
  /** Admin: đặt lịch lặp, đổi ngày/giờ, hủy hoặc xóa buổi */
  canEditSchedule: boolean;
  /** Admin hoặc giáo viên phụ trách: nội dung, ghi chú, dán hàng loạt, AI, CSV */
  canEditContent: boolean;
  onClose: () => void;
  /** Gọi sau khi lịch đổi để màn hình ngoài tải lại lớp và buổi học */
  onChanged: () => void;
  notify?: Notify;
}

type Filter = 'upcoming' | 'past' | 'all';
type EndMode = 'weeks' | 'date';

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white';
const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

const STATE_BADGE: Record<string, string> = {
  cancelled: 'bg-danger-50 text-danger-700 border-danger-200',
  done: 'bg-slate-100 text-slate-600 border-slate-200',
  upcoming: 'bg-primary-50 text-primary-700 border-primary-200',
};

export const LessonScheduleModal: React.FC<LessonScheduleModalProps> = ({ cls, canEditSchedule, canEditContent, onClose, onChanged, notify }) => {
  const uid = useId();
  const confirm = useConfirm();
  const today = todayLocal();

  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('upcoming');

  // Lịch lặp (admin)
  const [weekdays, setWeekdays] = useState<number[]>(cls.weekdays);
  const [startTime, setStartTime] = useState(cls.lesson_start_time || '18:00');
  const [endTime, setEndTime] = useState(cls.lesson_end_time || '19:30');
  const [startDate, setStartDate] = useState(cls.start_date || today);
  const [endMode, setEndMode] = useState<EndMode>(cls.end_date ? 'date' : 'weeks');
  const [weeks, setWeeks] = useState('12');
  const [endDate, setEndDate] = useState(cls.end_date);

  // Lớp đã có lịch lặp: thu gọn form thiết lập để danh sách buổi học là phần chính của modal
  const [setupOpen, setSetupOpen] = useState(cls.weekdays.length === 0);
  const [preview, setPreview] = useState<LessonSyncResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [allowConflicts, setAllowConflicts] = useState(false);
  const [applying, setApplying] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Sửa một buổi (admin)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Dán nội dung hàng loạt (admin)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');

  // Gợi ý cho đúng số buổi còn trống (hoặc 10 nếu đã đủ nội dung); kết quả chỉ điền vào ô, chưa lưu
  const suggestWithAi = async () => {
    const wanted = Math.min(Math.max(untitledCount, 10), 60);
    setAiBusy(true);
    setAiNote('');
    try {
      const res = await lessonService.suggestTitles(cls.id, wanted, aiHint);
      setBulkText(res.titles.join('\n'));
      setAiNote(`AI gợi ý ${res.titles.length} nội dung. Hãy đọc lại và sửa trước khi gán.`);
    } catch (err) {
      setAiNote(errorDetail(err));
    } finally {
      setAiBusy(false);
    }
  };

  const loadLessons = useCallback(async () => {
    try {
      setLessons(await lessonService.getClassLessons(cls.id));
      setLoadError('');
    } catch (err) {
      setLoadError(errorDetail(err));
    }
  }, [cls.id]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  // Lịch lặp hợp lệ để gửi lên server; null nếu form chưa đủ
  const plan = useMemo<LessonPlanInput | null>(() => {
    if (weekdays.length === 0 || !startTime || !endTime || startTime >= endTime || !startDate) return null;
    if (endMode === 'weeks') {
      const n = Number(weeks);
      if (!Number.isInteger(n) || n < 1 || n > 52) return null;
      return { weekdays, start_time: startTime, end_time: endTime, start_date: startDate, weeks: n };
    }
    if (!endDate || endDate < startDate) return null;
    return { weekdays, start_time: startTime, end_time: endTime, start_date: startDate, end_date: endDate };
  }, [weekdays, startTime, endTime, startDate, endMode, weeks, endDate]);
  const planKey = JSON.stringify(plan);

  // Xem trước tự chạy (trễ 450ms) mỗi khi form đổi, không ghi gì vào DB
  useEffect(() => {
    setAllowConflicts(false);
    if (!canEditSchedule || !setupOpen || !plan) {
      setPreview(null);
      setPreviewError('');
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(async () => {
      try {
        const result = await lessonService.planClass(cls.id, plan, { dryRun: true });
        if (cancelled) return;
        setPreview(result);
        setPreviewError('');
      } catch (err) {
        if (cancelled) return;
        setPreview(null);
        setPreviewError(errorDetail(err));
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // plan được theo dõi qua planKey để tránh chạy lại khi chỉ đổi tham chiếu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditSchedule, setupOpen, cls.id, planKey, refreshTick]);

  const reloadAll = async () => {
    await loadLessons();
    setRefreshTick((n) => n + 1);
    onChanged();
  };

  const toggleWeekday = (value: number) =>
    setWeekdays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));

  const applyPlan = async () => {
    if (!plan) return;
    setApplying(true);
    try {
      const result = await lessonService.planClass(cls.id, plan, { allowConflicts });
      notify?.('success', 'Đã áp dụng lịch học', `Thêm ${result.create.length} buổi, bỏ ${result.remove.length} buổi, đổi giờ ${result.update.length} buổi`);
      await reloadAll();
    } catch (err) {
      notify?.('warning', 'Không áp dụng được lịch', errorDetail(err));
    } finally {
      setApplying(false);
    }
  };

  const startEdit = (l: Lesson) => {
    setEditingId(l.id);
    setEditTitle(l.title);
    setEditNotes(l.notes);
    setEditDate(l.lesson_date);
    setEditStart(l.start_time);
    setEditEnd(l.end_time);
    setEditError('');
  };

  const saveEdit = async (l: Lesson) => {
    setSavingEdit(true);
    setEditError('');
    try {
      // Giáo viên chỉ gửi nội dung và ghi chú; server từ chối nếu có trường lịch
      await lessonService.updateLesson(l.id, {
        title: editTitle,
        notes: editNotes,
        ...(canEditSchedule ? { lesson_date: editDate, start_time: editStart, end_time: editEnd } : {}),
      });
      setEditingId(null);
      await reloadAll();
    } catch (err) {
      setEditError(errorDetail(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleCancel = async (l: Lesson) => {
    try {
      await lessonService.updateLesson(l.id, { status: l.status === 'cancelled' ? 'planned' : 'cancelled' });
      notify?.('info', l.status === 'cancelled' ? 'Đã khôi phục buổi học' : 'Đã hủy buổi học', shortLessonDate(l.lesson_date));
      setEditingId(null);
      await reloadAll();
    } catch (err) {
      setEditError(errorDetail(err));
    }
  };

  const removeLesson = async (l: Lesson) => {
    const ok = await confirm({
      title: `Xóa buổi ${shortLessonDate(l.lesson_date)}?`,
      message: 'Nếu ngày này vẫn nằm trong lịch lặp, lần áp lịch sau buổi sẽ được tạo lại. Muốn nghỉ hẳn, hãy dùng "Hủy buổi".',
      confirmLabel: 'Xóa buổi',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await lessonService.deleteLesson(l.id);
      setEditingId(null);
      await reloadAll();
    } catch (err) {
      setEditError(errorDetail(err));
    }
  };

  const submitBulk = async () => {
    const titles = bulkText.split('\n').map((t) => t.trim()).filter(Boolean);
    if (titles.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await lessonService.assignTitles(cls.id, titles, bulkOverwrite);
      notify?.(
        res.unassigned > 0 ? 'warning' : 'success',
        `Đã gán nội dung cho ${res.assigned} buổi`,
        res.unassigned > 0 ? `${res.unassigned} dòng chưa có buổi để gán` : undefined
      );
      setBulkText('');
      setBulkOpen(false);
      await reloadAll();
    } catch (err) {
      notify?.('warning', 'Không gán được nội dung', errorDetail(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const visible = (lessons ?? []).filter((l) =>
    filter === 'all' ? true : filter === 'upcoming' ? l.lesson_date >= today : l.lesson_date < today
  );
  const untitledCount = (lessons ?? []).filter((l) => l.status !== 'cancelled' && !l.title).length;

  return (
    <Modal
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-600" />
          Lịch học: {cls.name}
        </span>
      }
      description={cls.schedule ? `${cls.schedule}${cls.room ? ` • ${cls.room}` : ''}` : 'Lớp chưa có lịch học'}
      onClose={onClose}
      size="xl"
      closeOnBackdrop={false}
    >
      <div className="space-y-4">
        {canEditSchedule && !setupOpen && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <p className="text-xs text-slate-700">
              <strong>Lịch lặp:</strong> {cls.schedule}
              {cls.end_date ? `, đến ${cls.end_date.split('-').reverse().join('/')}` : ''}
            </p>
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              aria-expanded={false}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-50 text-primary-700 hover:bg-primary-100 cursor-pointer"
            >
              Đổi lịch lặp
            </button>
          </div>
        )}

        {canEditSchedule && setupOpen && (
          <section aria-label="Lịch lặp hàng tuần" className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-slate-800">Lịch lặp hàng tuần</h3>
              {cls.weekdays.length > 0 && (
                <button type="button" onClick={() => setSetupOpen(false)} aria-expanded className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                  Thu gọn
                </button>
              )}
            </div>

            <div>
              <span className={labelClass} id={`${uid}-days`}>Học các thứ</span>
              <div role="group" aria-labelledby={`${uid}-days`} className="flex flex-wrap gap-1.5">
                {WEEKDAY_PICKER.map((d) => {
                  const on = weekdays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleWeekday(d.value)}
                      className={`min-w-11 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        on ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelClass} htmlFor={`${uid}-start-time`}>Giờ bắt đầu</label>
                <input id={`${uid}-start-time`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`${uid}-end-time`}>Giờ kết thúc</label>
                <input id={`${uid}-end-time`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`${uid}-start-date`}>Ngày bắt đầu</label>
                <input id={`${uid}-start-date`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`${uid}-end-mode`}>Kết thúc theo</label>
                <select id={`${uid}-end-mode`} value={endMode} onChange={(e) => setEndMode(e.target.value as EndMode)} className={inputClass}>
                  <option value="weeks">Số tuần</option>
                  <option value="date">Ngày kết thúc</option>
                </select>
              </div>
            </div>

            <div className="max-w-xs">
              {endMode === 'weeks' ? (
                <>
                  <label className={labelClass} htmlFor={`${uid}-weeks`}>Lặp lại bao nhiêu tuần (kể từ ngày bắt đầu)</label>
                  <input id={`${uid}-weeks`} type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} className={inputClass} />
                </>
              ) : (
                <>
                  <label className={labelClass} htmlFor={`${uid}-end-date`}>Ngày kết thúc</label>
                  <input id={`${uid}-end-date`} type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                </>
              )}
            </div>

            <div aria-live="polite" className="text-xs">
              {!plan && <p className="text-slate-500">Chọn ít nhất một thứ, giờ học hợp lệ và thời điểm kết thúc để xem trước lịch.</p>}
              {plan && previewing && (
                <p className="text-slate-500 inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tính lịch...
                </p>
              )}
              {plan && !previewing && previewError && <p className="text-danger-700 font-medium">{previewError}</p>}
              {plan && !previewing && preview && (
                <div className="space-y-2">
                  <p className="text-slate-700">
                    Đến <strong>{preview.end_date.split('-').reverse().join('/')}</strong> lớp có <strong>{preview.total}</strong> buổi:
                    thêm <strong className="text-success-700">{preview.create.length}</strong>, bỏ{' '}
                    <strong className="text-danger-700">{preview.remove.length}</strong>, đổi giờ <strong>{preview.update.length}</strong>, giữ nguyên{' '}
                    <strong>{preview.keep}</strong>.
                  </p>
                  {preview.kept_off_schedule > 0 && (
                    <p className="text-slate-500">
                      Giữ lại {preview.kept_off_schedule} buổi nằm ngoài lịch mới vì đã qua, đã điểm danh, đã hủy hoặc đã sửa tay.
                    </p>
                  )}
                  {preview.skipped_holidays.length > 0 && (
                    <p className="text-warning-700">
                      Bỏ {preview.skipped_holidays.length} ngày nghỉ chung:{' '}
                      {preview.skipped_holidays.slice(0, 4).map((h) => `${shortLessonDate(h.date)} (${h.name})`).join(', ')}
                      {preview.skipped_holidays.length > 4 ? '…' : ''}
                    </p>
                  )}
                  {preview.conflicts.length > 0 && (
                    <div className="p-2.5 bg-warning-50 border border-warning-200 rounded-xl text-warning-800 space-y-1">
                      <p className="font-bold inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> {preview.conflicts.length} buổi bị trùng giáo viên hoặc phòng
                      </p>
                      <ul className="list-disc pl-4">
                        {preview.conflicts.slice(0, 4).map((c, i) => (
                          <li key={`${c.date}-${c.class_id}-${c.kind}-${i}`}>
                            {shortLessonDate(c.date)}: trùng {c.kind === 'teacher' ? 'giáo viên' : 'phòng học'} với lớp "{c.class_name}"
                          </li>
                        ))}
                      </ul>
                      {preview.conflicts.length > 4 && <p>và {preview.conflicts.length - 4} trường hợp khác.</p>}
                      <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                        <input type="checkbox" checked={allowConflicts} onChange={(e) => setAllowConflicts(e.target.checked)} />
                        Vẫn áp dụng dù bị trùng
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={applyPlan}
                disabled={!plan || !preview || previewing || applying || (preview.conflicts.length > 0 && !allowConflicts)}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 cursor-pointer"
              >
                {applying ? 'Đang áp dụng...' : 'Áp dụng lịch'}
              </button>
            </div>
          </section>
        )}

        <section aria-label="Danh sách buổi học" className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="Lọc buổi học">
              {([['upcoming', 'Sắp tới'], ['past', 'Đã qua'], ['all', 'Tất cả']] as [Filter, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filter === value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {canEditContent && (lessons?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setBulkOpen((v) => !v)}
                aria-expanded={bulkOpen}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-accent-50 text-accent-700 hover:bg-accent-100 cursor-pointer"
              >
                Dán nội dung các buổi {untitledCount > 0 ? `(${untitledCount} buổi trống)` : ''}
              </button>
            )}
            {canEditContent && (lessons?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setCsvOpen((v) => !v)}
                aria-expanded={csvOpen}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Xuất / nhập CSV
              </button>
            )}
          </div>

          {canEditContent && csvOpen && (
            <LessonCsvPanel cls={cls} onImported={() => reloadAll()} notify={notify} />
          )}

          {canEditContent && bulkOpen && (
            <div className="p-3 bg-accent-50/50 border border-accent-200 rounded-2xl space-y-2">
              <label className={labelClass} htmlFor={`${uid}-bulk`}>Mỗi dòng là nội dung một buổi, gán lần lượt theo ngày (bỏ qua buổi đã hủy)</label>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-48">
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-ai-hint`}>Ghi chú cho AI (tùy chọn)</label>
                  <input id={`${uid}-ai-hint`} type="text" maxLength={300} value={aiHint} onChange={(e) => setAiHint(e.target.value)} placeholder="VD: 25 bài Minna đầu, ưu tiên hội thoại" className={inputClass} />
                </div>
                <button
                  type="button"
                  onClick={suggestWithAi}
                  disabled={aiBusy}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-accent-300 text-accent-700 hover:bg-accent-100 disabled:opacity-60 cursor-pointer"
                >
                  {aiBusy ? 'AI đang soạn...' : 'Gợi ý bằng AI'}
                </button>
              </div>
              {aiNote && <p className="text-xs text-slate-600" aria-live="polite">{aiNote}</p>}
              <textarea
                id={`${uid}-bulk`}
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Bài 1: Hiragana hàng A - KA\nBài 2: Hiragana hàng SA - TA\n...'}
                className={inputClass}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={bulkOverwrite} onChange={(e) => setBulkOverwrite(e.target.checked)} />
                  Ghi đè cả buổi đã có nội dung
                </label>
                <button
                  type="button"
                  onClick={submitBulk}
                  disabled={bulkBusy || !bulkText.trim()}
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
                >
                  {bulkBusy ? 'Đang gán...' : 'Gán nội dung'}
                </button>
              </div>
            </div>
          )}

          {loadError && <p className="text-xs text-danger-700 font-medium">{loadError}</p>}
          {!lessons && !loadError && <p className="text-xs text-slate-500">Đang tải lịch...</p>}
          {lessons && visible.length === 0 && (
            <p className="p-5 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
              {lessons.length === 0
                ? canEditSchedule || canEditContent
                  ? 'Lớp chưa có buổi học nào. Chọn các thứ trong tuần ở trên để tạo lịch.'
                  : 'Lớp chưa có lịch học chi tiết.'
                : filter === 'upcoming'
                  ? 'Không còn buổi học sắp tới.'
                  : 'Không có buổi học nào.'}
            </p>
          )}

          <ul className="space-y-1.5">
            {visible.map((l) => {
              const editing = editingId === l.id;
              const isToday = l.lesson_date === today;
              return (
                <li key={l.id} className={`border rounded-2xl p-3 ${l.state === 'cancelled' ? 'border-danger-200 bg-danger-50/40' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-20 shrink-0">
                      <p className={`text-xs font-extrabold ${isToday ? 'text-primary-700' : 'text-slate-800'}`}>{shortLessonDate(l.lesson_date)}</p>
                      <p className="text-xs text-slate-500">{l.start_time} - {l.end_time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${l.title ? 'font-bold text-slate-900' : 'italic text-slate-400'} ${l.state === 'cancelled' ? 'line-through' : ''}`}>
                        {l.title || 'Chưa có nội dung'}
                      </p>
                      {l.notes && <p className="text-xs text-slate-500 mt-0.5">{l.notes}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isToday && <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-warning-50 text-warning-700 border-warning-200">Hôm nay</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${STATE_BADGE[l.state]}`}>
                          {l.state === 'cancelled' ? 'Đã hủy' : l.state === 'done' ? (l.has_attendance ? 'Đã điểm danh' : 'Đã qua') : 'Sắp tới'}
                        </span>
                        {canEditContent && l.manually_edited && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-accent-50 text-accent-700 border-accent-200" title="Đã nhập nội dung hoặc sửa riêng: đồng bộ lịch sẽ không ghi đè buổi này">
                            Đã chốt
                          </span>
                        )}
                      </div>
                    </div>
                    {canEditContent && (
                      <button
                        type="button"
                        onClick={() => (editing ? setEditingId(null) : startEdit(l))}
                        aria-label={`Sửa buổi ${shortLessonDate(l.lesson_date)}`}
                        aria-expanded={editing}
                        className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg cursor-pointer shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {canEditContent && editing && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                      <div>
                        <label className={labelClass} htmlFor={`${uid}-t-${l.id}`}>Nội dung buổi học</label>
                        <input id={`${uid}-t-${l.id}`} type="text" maxLength={255} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`${uid}-n-${l.id}`}>Ghi chú</label>
                        <textarea id={`${uid}-n-${l.id}`} rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={inputClass} />
                      </div>
                      {canEditSchedule && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                          <label className={labelClass} htmlFor={`${uid}-d-${l.id}`}>Ngày</label>
                          <input id={`${uid}-d-${l.id}`} type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`${uid}-s-${l.id}`}>Bắt đầu</label>
                          <input id={`${uid}-s-${l.id}`} type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`${uid}-e-${l.id}`}>Kết thúc</label>
                          <input id={`${uid}-e-${l.id}`} type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={inputClass} />
                        </div>
                      </div>
                      )}
                      {editError && <p className="text-xs text-danger-700 font-medium">{editError}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          {canEditSchedule && (
                          <>
                          <button type="button" onClick={() => toggleCancel(l)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-warning-50 text-warning-700 hover:bg-warning-100 cursor-pointer">
                            {l.status === 'cancelled' ? 'Khôi phục buổi' : 'Hủy buổi'}
                          </button>
                          <button type="button" onClick={() => removeLesson(l)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-danger-50 text-danger-700 hover:bg-danger-100 cursor-pointer">
                            Xóa
                          </button>
                          </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => saveEdit(l)}
                          disabled={savingEdit}
                          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          {savingEdit ? 'Đang lưu...' : 'Lưu buổi học'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Modal>
  );
};
