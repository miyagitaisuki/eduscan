import { useCallback, useState } from 'react';
import { teacherService, TeacherAccount } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

interface Options {
  notify?: Notify;
  /** Danh sách giáo viên chỉ dành cho admin */
  enabled: boolean;
}

export function useTeachersData({ notify, enabled }: Options) {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);

  const load = useCallback<Loader>(async () => {
    if (!enabled) return true;
    try {
      setTeachers(await teacherService.getTeachers());
      return true;
    } catch {
      return false;
    }
  }, [enabled]);

  const create = async (data: Parameters<typeof teacherService.createTeacher>[0]) => {
    try {
      const created = await teacherService.createTeacher(data);
      setTeachers((prev) => [...prev, { ...created, class_count: 0 }]);
      notify?.('success', 'Đã tạo tài khoản giáo viên', created.full_name);
      return created;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo giáo viên', errorDetail(err));
    }
  };

  const update = async (id: string, data: Parameters<typeof teacherService.updateTeacher>[1]) => {
    try {
      const updated = await teacherService.updateTeacher(id, data);
      setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
      notify?.('success', 'Đã cập nhật giáo viên', updated.full_name);
      return updated;
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật giáo viên', errorDetail(err));
    }
  };

  const setStatus = async (id: string, status: 'active' | 'inactive') => {
    try {
      const updated = await teacherService.setTeacherStatus(id, status);
      setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
      notify?.('success', status === 'active' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', updated.full_name);
    } catch (err: any) {
      notify?.('warning', 'Lỗi đổi trạng thái', errorDetail(err));
    }
  };

  const setPassword = async (id: string, body: Parameters<typeof teacherService.setTeacherPassword>[1]) => {
    try {
      const res = await teacherService.setTeacherPassword(id, body);
      setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, must_change_password: true } : t)));
      notify?.('success', 'Đã đặt lại mật khẩu giáo viên');
      return res;
    } catch (err: any) {
      notify?.('warning', 'Lỗi đặt lại mật khẩu', errorDetail(err));
    }
  };

  return { teachers, load, create, update, setStatus, setPassword };
}
