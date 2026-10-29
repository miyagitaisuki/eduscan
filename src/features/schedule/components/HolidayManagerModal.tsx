import React, { useCallback, useEffect, useId, useState } from 'react';
import { CalendarOff, Trash2 } from 'lucide-react';
import type { Holiday } from '../../../shared/types';
import { lessonService } from '../../../services';
import { Modal, useConfirm } from '../../../shared/components/ui';
import { errorDetail } from '../../../shared/utils/errorMessage';
import { shortLessonDate } from '../../../shared/utils/lessonDates';
import type { Notify } from '../../../hooks/data/types';

interface HolidayManagerModalProps {
  onClose: () => void;
  /** Thêm/xóa ngày nghỉ làm đổi lịch mọi lớp: màn hình ngoài cần tải lại */
  onChanged: () => void;
  notify?: Notify;
}

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white';
const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

const rangeLabel = (h: Holiday) =>
  h.start_date === h.end_date ? shortLessonDate(h.start_date) : `${shortLessonDate(h.start_date)} → ${shortLessonDate(h.end_date)}`;

export const HolidayManagerModal: React.FC<HolidayManagerModalProps> = ({ onClose, onChanged, notify }) => {
  const uid = useId();
  const confirm = useConfirm();
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setHolidays(await lessonService.getHolidays());
      setLoadError('');
    } catch (err) {
      setLoadError(errorDetail(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await lessonService.createHoliday({ name, start_date: startDate, ...(endDate ? { end_date: endDate } : {}) });
      notify?.('success', 'Đã thêm ngày nghỉ', created.removed_lessons > 0 ? `Bỏ ${created.removed_lessons} buổi chưa chốt trong các lớp` : name);
      setName('');
      setStartDate('');
      setEndDate('');
      await load();
      onChanged();
    } catch (err) {
      setError(errorDetail(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (h: Holiday) => {
    const ok = await confirm({
      title: `Xóa ngày nghỉ "${h.name}"?`,
      message: 'Các lớp sẽ được sinh lại buổi học trong những ngày này (theo lịch lặp của từng lớp).',
      confirmLabel: 'Xóa ngày nghỉ',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await lessonService.deleteHoliday(h.id);
      notify?.('info', 'Đã xóa ngày nghỉ', res.created_lessons > 0 ? `Sinh lại ${res.created_lessons} buổi học` : h.name);
      await load();
      onChanged();
    } catch (err) {
      setError(errorDetail(err));
    }
  };

  return (
    <Modal
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarOff className="w-5 h-5 text-warning-600" />
          Ngày nghỉ chung
        </span>
      }
      description="Áp dụng cho mọi lớp. Buổi chưa điểm danh và chưa sửa tay trong ngày nghỉ sẽ tự bị bỏ; buổi đã chốt được giữ nguyên."
      onClose={onClose}
      size="lg"
      closeOnBackdrop={false}
    >
      <form onSubmit={add} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <div>
          <label className={labelClass} htmlFor={`${uid}-name`}>Tên ngày nghỉ</label>
          <input id={`${uid}-name`} required maxLength={150} placeholder="VD: Tết Nguyên đán, Quốc khánh 2/9" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor={`${uid}-from`}>Từ ngày</label>
            <input id={`${uid}-from`} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${uid}-to`}>Đến ngày (bỏ trống nếu nghỉ một ngày)</label>
            <input id={`${uid}-to`} type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        {error && <p className="text-xs text-danger-700 font-medium">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer">
            {busy ? 'Đang thêm...' : 'Thêm ngày nghỉ'}
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-1.5">
        {loadError && <p className="text-xs text-danger-700 font-medium">{loadError}</p>}
        {!holidays && !loadError && <p className="text-xs text-slate-500">Đang tải...</p>}
        {holidays && holidays.length === 0 && <p className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">Chưa có ngày nghỉ chung nào.</p>}
        <ul className="space-y-1.5">
          {holidays?.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-2xl bg-white">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">{h.name}</p>
                <p className="text-xs text-slate-500">{rangeLabel(h)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(h)}
                aria-label={`Xóa ngày nghỉ ${h.name}`}
                className="p-1.5 text-slate-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};
