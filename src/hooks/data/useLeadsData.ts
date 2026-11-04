import { useCallback, useState } from 'react';
import { leadService } from '../../services';
import type { Lead } from '../../shared/types';
import { useIssuedPassword } from '../../shared/components/ui';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

interface Options {
  notify?: Notify;
  /** Đăng ký học thử chỉ dành cho admin */
  enabled: boolean;
  /** Gọi sau khi tạo học viên để tải lại danh sách học viên, học phí... */
  onConverted?: () => unknown;
}

export function useLeadsData({ notify, enabled, onConverted }: Options) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const showIssuedPassword = useIssuedPassword();

  const load = useCallback<Loader>(async () => {
    if (!enabled) return true;
    try {
      setLeads(await leadService.getLeads());
      return true;
    } catch {
      return false;
    }
  }, [enabled]);

  const update = async (id: string, data: Parameters<typeof leadService.updateLead>[1]) => {
    try {
      const updated = await leadService.updateLead(id, data);
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      return updated;
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật đăng ký', errorDetail(err));
    }
  };

  const convert = async (id: string, data: Parameters<typeof leadService.convertLead>[1]) => {
    try {
      const res = await leadService.convertLead(id, data);
      setLeads((prev) => prev.map((l) => (l.id === id ? res.lead : l)));
      notify?.('success', 'Đã tạo học viên và ghi danh', `${res.student.full_name} · ${res.student.class_name}`);
      // Mật khẩu tạm chỉ hiện một lần, trong hộp thoại dùng chung ở cấp ứng dụng
      showIssuedPassword({
        role: 'student',
        name: res.student.full_name,
        email: res.student.email,
        password: res.temporary_password,
      });
      onConverted?.();
      return res;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo học viên', errorDetail(err));
    }
  };

  return { leads, load, update, convert };
}
