import { useCallback, useRef, useState } from 'react';
import { AttendanceRecord } from '../../shared/types';
import { attendanceService } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

function isSameAttendanceRecords(a: AttendanceRecord[], b: AttendanceRecord[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const r1 = a[i];
    const r2 = b[i];
    if (
      r1.id !== r2.id ||
      r1.status !== r2.status ||
      r1.check_in_time !== r2.check_in_time ||
      r1.date !== r2.date ||
      r1.notes !== r2.notes ||
      r1.class_id !== r2.class_id ||
      r1.student_id !== r2.student_id
    ) {
      return false;
    }
  }
  return true;
}

export function useAttendanceData(notify?: Notify) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const requestRef = useRef(0);

  const reset = useCallback(() => {
    requestRef.current++;
    setAttendanceRecords([]);
  }, []);

  const load = useCallback<Loader>(async () => {
    const request = ++requestRef.current;
    try {
      const data = await attendanceService.getHistory();
      if (request !== requestRef.current) return false;
      // Giữ nguyên tham chiếu khi dữ liệu không đổi: màn hình điểm danh nhanh nạp lại ô tick mỗi khi mảng này đổi,
      // nên làm mới tự động không được ghi đè các ô giáo viên đang tick dở
      setAttendanceRecords((prev) => (isSameAttendanceRecords(prev, data) ? prev : data));
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
      return true;
    } catch (err: any) {
      notify?.('warning', 'Lỗi lưu điểm danh', errorDetail(err));
      return false;
    }
  };

  /** Xóa lượt điểm danh của học viên đã bị xóa khỏi hệ thống */
  const removeForStudent = (studentId: string) =>
    setAttendanceRecords((prev) => prev.filter((a) => a.student_id !== studentId));

  return { attendanceRecords, load, createSession, checkIn, saveBatch, removeForStudent, reset };
}
