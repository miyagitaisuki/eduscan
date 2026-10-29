import { useCallback, useState } from 'react';
import { TuitionRecord } from '../../shared/types';
import { tuitionService } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

interface Options {
  notify?: Notify;
  /** Học phí chỉ admin được xem; không phải admin thì không tải */
  enabled: boolean;
}

export function useTuitionData({ notify, enabled }: Options) {
  const [tuitionRecords, setTuitionRecords] = useState<TuitionRecord[]>([]);

  const load = useCallback<Loader>(async () => {
    if (!enabled) return true;
    try {
      setTuitionRecords(await tuitionService.getTuitionRecords());
      return true;
    } catch {
      return false;
    }
  }, [enabled]);

  const update = async (id: string, updates: Partial<TuitionRecord>) => {
    try {
      const updated = await tuitionService.updatePayment(id, updates);
      setTuitionRecords((prev) => prev.map((t) => (t.id === id ? updated : t)));
      notify?.('success', 'Đã cập nhật học phí');
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật học phí', errorDetail(err));
    }
  };

  // Admin đặt học phí tháng cho học viên: sửa hồ sơ cùng tháng nếu có, không thì tạo mới
  const setAmount = async (studentId: string, month: string, amount: number, classId?: string) => {
    try {
      const existing = tuitionRecords.find((t) => t.student_id === studentId && t.month === month);
      if (existing) {
        const updated = await tuitionService.updatePayment(existing.id, { amount });
        setTuitionRecords((prev) => prev.map((t) => (t.id === existing.id ? updated : t)));
      } else {
        const created = await tuitionService.createTuitionRecord({ student_id: studentId, class_id: classId, month, amount });
        setTuitionRecords((prev) => [...prev, created]);
      }
      notify?.('success', 'Đã cập nhật học phí', `Tháng ${month}: ${amount.toLocaleString('vi-VN')} đ`);
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật học phí', errorDetail(err));
    }
  };

  const recordPayment = async (studentId: string, month: string, amount: number) => {
    try {
      const rec = await tuitionService.recordPayment({ student_id: studentId, month, amount });
      setTuitionRecords((prev) =>
        prev.some((t) => t.id === rec.id) ? prev.map((t) => (t.id === rec.id ? { ...t, ...rec } : t)) : [...prev, rec]
      );
      notify?.('success', 'Đã ghi nhận thu học phí thành công!');
    } catch (err: any) {
      notify?.('warning', 'Lỗi ghi nhận học phí', errorDetail(err));
    }
  };

  /** Xóa hồ sơ học phí của học viên đã bị xóa khỏi hệ thống */
  const removeForStudent = (studentId: string) =>
    setTuitionRecords((prev) => prev.filter((t) => t.student_id !== studentId));

  return { tuitionRecords, load, update, setAmount, recordPayment, removeForStudent };
}
