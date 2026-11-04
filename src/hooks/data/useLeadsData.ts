import { useCallback, useState } from 'react';
import { leadService } from '../../services';
import type { Lead } from '../../shared/types';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

interface Options {
  notify?: Notify;
  /** Đăng ký học thử chỉ dành cho admin */
  enabled: boolean;
}

export function useLeadsData({ notify, enabled }: Options) {
  const [leads, setLeads] = useState<Lead[]>([]);

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

  return { leads, load, update };
}
