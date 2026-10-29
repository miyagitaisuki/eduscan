import { useCallback, useState } from 'react';
import { AttendanceRecord } from '../../shared/types';
import { attendanceService } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

export function useAttendanceData(notify?: Notify) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  const load = useCallback<Loader>(async () => {
    try {
      setAttendanceRecords(await attendanceService.getHistory());
      return true;
    } catch {
      return false;
    }
  }, []);

  const createSession = async (classId: string) => {
    try {
      const session = await attendanceService.createSession(classId);
      notify?.('success', 'Đã phát sinh mã QR điểm danh động!', `Phiên học: ${session.session_code}`);
      return session;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo phiên điểm danh', errorDetail(err));
    }
  };

  const checkIn = async (studentId: string, qrPayload?: string, sessionId?: string) => {
    try {
      const res = await attendanceService.checkIn({
        student_id: studentId,
        qr_payload: qrPayload,
        session_id: sessionId,
      });

      if (res.alreadyCheckedIn) {
        notify?.('info', 'Đã ghi nhận điểm danh!', res.message);
      } else {
        notify?.('success', 'Điểm danh QR thành công!', res.message);
        setAttendanceRecords((prev) => [res.record, ...prev]);
      }
      return res;
    } catch (err: any) {
      notify?.('warning', 'Điểm danh không thành công', errorDetail(err));
      throw err;
    }
  };

  const saveBatch = async (classId: string, date: string, presentIds: string[], notesMap?: Record<string, string>) => {
    try {
      const { updated } = await attendanceService.saveBatchAttendance(classId, date, presentIds, notesMap);
      notify?.(
        'success',
        updated ? 'Đã cập nhật điểm danh' : 'Đã lưu điểm danh nhanh thành công!',
        `${presentIds.length} học viên có mặt.`
      );
      await load();
    } catch (err: any) {
      notify?.('warning', 'Lỗi lưu điểm danh', errorDetail(err));
    }
  };

  /** Xóa lượt điểm danh của học viên đã bị xóa khỏi hệ thống */
  const removeForStudent = (studentId: string) =>
    setAttendanceRecords((prev) => prev.filter((a) => a.student_id !== studentId));

  return { attendanceRecords, load, createSession, checkIn, saveBatch, removeForStudent };
}
