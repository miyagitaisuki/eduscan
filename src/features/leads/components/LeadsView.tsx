import React, { useState } from 'react';
import { UserPlus, Phone, MessageCircle, RefreshCw, GraduationCap } from 'lucide-react';
import type { ClassItem, Lead, LeadStatus } from '../../../shared/types';
import { Modal } from '../../../shared/components/ui';

interface LeadsViewProps {
  leads: Lead[];
  classes: ClassItem[];
  onConvert: (id: string, data: { class_id: string; email?: string }) => Promise<unknown>;
  onUpdate: (id: string, data: { status?: LeadStatus; admin_note?: string }) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  trial: 'Học thử',
  enrolled: 'Đã ghi danh',
  declined: 'Không tham gia',
};
const STATUSES = Object.keys(LEAD_STATUS_LABEL) as LeadStatus[];

const STATUS_TONE: Record<LeadStatus, string> = {
  new: 'bg-warning-50 text-warning-800 border-warning-200',
  contacted: 'bg-primary-50 text-primary-700 border-primary-200',
  trial: 'bg-accent-50 text-accent-700 border-accent-200',
  enrolled: 'bg-success-50 text-success-700 border-success-200',
  declined: 'bg-slate-100 text-slate-600 border-slate-200',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function LeadCard({ lead, onUpdate, onEnroll }: { lead: Lead; onUpdate: LeadsViewProps['onUpdate']; onEnroll: (lead: Lead) => void }) {
  const [note, setNote] = useState(lead.admin_note);
  const [saving, setSaving] = useState(false);
  const noteChanged = note.trim() !== lead.admin_note;
  const zaloPhone = lead.phone.replace(/^0/, '84');

  const saveNote = async () => {
    setSaving(true);
    await onUpdate(lead.id, { admin_note: note });
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-extrabold text-slate-900 text-sm truncate">{lead.full_name}</h3>
          <p className="text-xs text-slate-500">{formatTime(lead.created_at)}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full border text-xs font-bold ${STATUS_TONE[lead.status]}`}>
          {LEAD_STATUS_LABEL[lead.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${lead.phone}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-50 text-primary-700 text-xs font-bold hover:bg-primary-100 min-h-[36px]"
        >
          <Phone className="w-3.5 h-3.5" />
          {lead.phone}
        </a>
        <a
          href={`https://zalo.me/${zaloPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 min-h-[36px]"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Zalo
        </a>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
        {lead.current_level && (
          <div>
            <dt className="inline font-semibold text-slate-500">Trình độ: </dt>
            <dd className="inline">{lead.current_level}</dd>
          </div>
        )}
        {lead.target_jlpt && (
          <div>
            <dt className="inline font-semibold text-slate-500">Mục tiêu: </dt>
            <dd className="inline">{lead.target_jlpt}</dd>
          </div>
        )}
        {lead.notes && (
          <div className="sm:col-span-2">
            <dt className="inline font-semibold text-slate-500">Ghi chú của người đăng ký: </dt>
            <dd className="inline">{lead.notes}</dd>
          </div>
        )}
        {lead.source && (
          <div className="sm:col-span-2 break-all">
            <dt className="inline font-semibold text-slate-500">Nguồn: </dt>
            <dd className="inline">{lead.source}</dd>
          </div>
        )}
      </dl>

      {lead.student_id ? (
        <p className="text-xs font-semibold text-success-700 bg-success-50 border border-success-200 rounded-xl px-3 py-2">
          Đã tạo tài khoản học viên. Xem trong mục Học viên.
        </p>
      ) : (
        <button
          onClick={() => onEnroll(lead)}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-success-600 hover:bg-success-700 text-white text-xs font-bold cursor-pointer min-h-[36px]"
        >
          <GraduationCap className="w-4 h-4" />
          Tạo học viên và ghi danh
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 pt-2 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-600">
          Trạng thái
          <select
            value={lead.status}
            onChange={(e) => onUpdate(lead.id, { status: e.target.value as LeadStatus })}
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-primary-500 min-h-[36px]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs font-semibold text-slate-600">
          <label htmlFor={`note-${lead.id}`}>Ghi chú xử lý</label>
          <div className="mt-1 flex gap-2">
            <textarea
              id={`note-${lead.id}`}
              rows={2}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: đã gọi, hẹn học thử thứ 4"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={saveNote}
              disabled={!noteChanged || saving}
              className="self-end px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold disabled:opacity-40 cursor-pointer min-h-[36px]"
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldClass = 'w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500 bg-white';

function EnrollModal({
  lead,
  classes,
  onClose,
  onConvert,
}: {
  lead: Lead;
  classes: ClassItem[];
  onClose: () => void;
  onConvert: LeadsViewProps['onConvert'];
}) {
  const [classId, setClassId] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await onConvert(lead.id, { class_id: classId, email: email.trim() || undefined });
    setSaving(false);
    // Chỉ đóng khi tạo thành công; lỗi thì giữ nguyên để sửa (VD email đã dùng)
    if (res) onClose();
  };

  return (
    <Modal
      title={<>Tạo học viên: {lead.full_name}</>}
      description="Tạo tài khoản học viên, ghi danh vào lớp và tạo học phí tháng này. Mật khẩu tạm hiện một lần sau khi tạo."
      onClose={onClose}
      size="md"
      closeOnBackdrop={false}
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label htmlFor="enroll-class" className="block text-xs font-bold text-slate-700 mb-1">
            Lớp ghi danh *
          </label>
          <select id="enroll-class" required value={classId} onChange={(e) => setClassId(e.target.value)} className={fieldClass}>
            <option value="">Chọn lớp...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.level})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="enroll-email" className="block text-xs font-bold text-slate-700 mb-1">
            Email đăng nhập (không bắt buộc)
          </label>
          <input
            id="enroll-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Để trống: hệ thống tự sinh tên đăng nhập"
            className={fieldClass}
          />
        </div>
        <p className="text-xs text-slate-500">Số điện thoại {lead.phone} được lưu vào hồ sơ học viên.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !classId}
            className="px-4 py-2 rounded-xl bg-success-600 hover:bg-success-700 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Đang tạo...' : 'Tạo học viên'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export const LeadsView: React.FC<LeadsViewProps> = ({ leads, classes, onUpdate, onConvert, onRefresh }) => {
  const [enrolling, setEnrolling] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('new');
  const [refreshing, setRefreshing] = useState(false);

  const count = (s: LeadStatus) => leads.filter((l) => l.status === s).length;
  const shown = filter === 'all' ? leads : leads.filter((l) => l.status === filter);

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-primary-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-600" />
            Đăng ký học thử
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Người đăng ký từ website. Gọi hoặc nhắn Zalo, rồi cập nhật trạng thái để không bỏ sót ai.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map((s) => {
          const active = filter === s;
          const n = s === 'all' ? leads.length : count(s);
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${
                active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'Tất cả' : LEAD_STATUS_LABEL[s]} ({n})
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-500 text-xs">
          {filter === 'new' ? 'Không có đăng ký mới nào đang chờ.' : 'Không có đăng ký nào ở trạng thái này.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {shown.map((l) => (
            <LeadCard key={`${l.id}:${l.admin_note}:${l.student_id}`} lead={l} onUpdate={onUpdate} onEnroll={setEnrolling} />
          ))}
        </div>
      )}

      {enrolling && <EnrollModal lead={enrolling} classes={classes} onClose={() => setEnrolling(null)} onConvert={onConvert} />}
    </div>
  );
};
