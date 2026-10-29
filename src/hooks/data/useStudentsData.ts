import { useCallback, useState } from 'react';
import { Student, StudentInput } from '../../shared/types';
import { studentService } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

interface Options {
  notify?: Notify;
  /** Gọi sau khi thêm/sửa học viên: lớp, học phí... có thể thay đổi theo nên cần tải lại */
  onChanged?: () => Promise<unknown>;
}

export function useStudentsData({ notify, onChanged }: Options) {
  const [students, setStudents] = useState<Student[]>([]);

  const load = useCallback<Loader>(async () => {
    try {
      setStudents(await studentService.getStudents());
      return true;
    } catch {
      return false;
    }
  }, []);

  const create = async (data: StudentInput) => {
    try {
      const created = await studentService.createStudent(data);
      setStudents((prev) => [...prev, created]);
      // Server trả mật khẩu tạm một lần; giáo viên cần ghi lại để gửi cho học viên
      const tempPassword = created.temporary_password;
      notify?.(
        'success',
        'Đã thêm học viên mới',
        tempPassword ? `${created.full_name} — mật khẩu tạm: ${tempPassword}` : created.full_name
      );
      await onChanged?.();
      return created;
    } catch (err: any) {
      notify?.('warning', 'Lỗi thêm học viên', errorDetail(err));
    }
  };

  const update = async (id: string, data: Partial<StudentInput>) => {
    try {
      const updated = await studentService.updateStudent(id, data);
      setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)));
      notify?.('success', 'Đã cập nhật học viên', updated.full_name);
      await onChanged?.();
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật học viên', errorDetail(err));
    }
  };

  /** Trả true khi xóa thành công để nơi gọi dọn dữ liệu liên quan (điểm danh, học phí, bài nộp) */
  const remove = async (id: string): Promise<boolean> => {
    const target = students.find((s) => s.id === id);
    try {
      await studentService.deleteStudent(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      notify?.('info', 'Đã xóa học viên khỏi hệ thống', target?.full_name);
      return true;
    } catch (err: any) {
      notify?.('warning', 'Lỗi xóa học viên', errorDetail(err));
      return false;
    }
  };

  return { students, load, create, update, remove };
}
