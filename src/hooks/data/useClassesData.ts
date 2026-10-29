import { useCallback, useState } from 'react';
import { ClassItem } from '../../shared/types';
import { classService } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

export function useClassesData(notify?: Notify) {
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const load = useCallback<Loader>(async () => {
    try {
      setClasses(await classService.getClasses());
      return true;
    } catch {
      return false;
    }
  }, []);

  const create = async (data: Partial<ClassItem>) => {
    try {
      const created = await classService.createClass(data);
      setClasses((prev) => [...prev, created]);
      notify?.('success', 'Đã tạo lớp học mới', created.name);
      return created;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo lớp học', errorDetail(err));
    }
  };

  const update = async (id: string, data: Partial<ClassItem>) => {
    try {
      const updated = await classService.updateClass(id, data);
      setClasses((prev) => prev.map((c) => (c.id === id ? updated : c)));
      notify?.('success', 'Đã cập nhật lớp học', updated.name);
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật lớp', errorDetail(err));
    }
  };

  const remove = async (id: string) => {
    try {
      await classService.deleteClass(id);
      setClasses((prev) => prev.filter((c) => c.id !== id));
      notify?.('info', 'Đã xóa lớp học thành công');
    } catch (err: any) {
      notify?.('warning', 'Lỗi xóa lớp', errorDetail(err));
    }
  };

  return { classes, load, create, update, remove };
}
