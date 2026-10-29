import React from 'react';
import { adminService } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import { todayLocal } from '../../shared/utils/date';
import { useConfirm } from '../../shared/components/ui';
import type { Notify } from './types';

// Sao lưu và khôi phục toàn bộ dữ liệu (chỉ admin)
export function useBackup(notify: Notify | undefined, refreshAll: () => Promise<unknown>) {
  const confirm = useConfirm();

  // Sao lưu: tải file JSON từ server
  const exportBackup = async () => {
    try {
      const data = await adminService.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eduscan-backup-${todayLocal()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify?.('success', 'Đã xuất file sao lưu!', 'File có chứa băm mật khẩu, hãy cất giữ an toàn.');
    } catch (err: any) {
      notify?.('warning', 'Không thể sao lưu', errorDetail(err));
    }
  };

  // Khôi phục: thay thế TOÀN BỘ dữ liệu bằng file sao lưu (có xác nhận gõ chữ)
  const restoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const confirmed = await confirm({
      title: 'Khôi phục dữ liệu từ file sao lưu?',
      message: `Khôi phục sẽ THAY THẾ TOÀN BỘ dữ liệu hiện tại bằng nội dung file "${file.name}" và không thể hoàn tác.`,
      confirmLabel: 'Khôi phục',
      tone: 'danger',
      requireText: 'KHOI PHUC',
    });
    if (!confirmed) return;
    try {
      const data = JSON.parse(await file.text());
      await adminService.restore(data);
      await refreshAll();
      notify?.('success', 'Khôi phục dữ liệu thành công!');
    } catch (err: any) {
      notify?.('warning', 'Không thể khôi phục', errorDetail(err));
    }
  };

  return { exportBackup, restoreBackup };
}
