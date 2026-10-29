import React, { useState } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  RotateCcw, 
  Search, 
  Copy, 
  Check, 
  TrendingUp, 
  AlertCircle,
  Pencil
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Student, ClassItem } from '../../../shared/types';
import { Payment } from '../types';
import { currentTuitionMonth, tuitionMonthOptions } from '../../../shared/utils/tuitionMonth';

interface TuitionManagementViewProps {
  payments: Payment[];
  students: Student[];
  classes: ClassItem[];
  initialClassId?: string;
  onUpdatePayment: (paymentId: string, updates: Partial<Payment>) => void;
  onCreatePaymentRecord: (studentId: string, month: string, amount: number) => void;
  onSetAmount: (studentId: string, month: string, amount: number) => void;
  /** Họ tên giáo viên đang đăng nhập, ký dưới tin nhắn nhắc học phí */
  teacherName?: string;
}

export const TuitionManagementView: React.FC<TuitionManagementViewProps> = ({
  payments,
  students,
  classes,
  initialClassId,
  onUpdatePayment,
  onCreatePaymentRecord,
  onSetAmount,
  teacherName,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(currentTuitionMonth());
  const [selectedClassFilter, setSelectedClassFilter] = useState(initialClassId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  // Ô nhập số tiền đang mở: thu tiền ('pay') hoặc đổi học phí ('fee') cho một học viên
  const [editor, setEditor] = useState<{ studentId: string; mode: 'pay' | 'fee' } | null>(null);
  const [editorValue, setEditorValue] = useState('');

  // Month options
  const monthOptions = tuitionMonthOptions();

  // All student-payment rows for selected month
  const rows = students.map((st) => {
    const cls = classes.find((c) => c.id === st.class_id);
    const existingPayment = payments.find((p) => p.student_id === st.id && p.month === selectedMonth);
    const amount = existingPayment ? existingPayment.amount : (cls?.monthly_fee || 800000);
    const status = existingPayment ? existingPayment.status : 'unpaid';
    const paidDate = existingPayment ? existingPayment.paid_date : null;
    const notes = existingPayment ? existingPayment.notes : '';

    return {
      student: st,
      classItem: cls,
      payment: existingPayment,
      amount,
      status,
      paidDate,
      notes,
    };
  });

  // Filtered rows
  const filteredRows = rows.filter(({ student, status }) => {
    const matchSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        student.phone.includes(searchQuery);
    const matchClass = selectedClassFilter === 'all' || student.class_id === selectedClassFilter;
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    return matchSearch && matchClass && matchStatus;
  });

  // Overall financial statistics for selectedMonth
  const totalStudentsInMonth = rows.length;
  const paidRows = rows.filter((r) => r.status === 'paid');
  const unpaidRows = rows.filter((r) => r.status === 'unpaid');

  const totalCollectedAmount = paidRows.reduce((sum, r) => sum + r.amount, 0);
  const totalDebtAmount = unpaidRows.reduce((sum, r) => sum + r.amount, 0);
  const completionRate = totalStudentsInMonth > 0 ? Math.round((paidRows.length / totalStudentsInMonth) * 100) : 0;

  const openEditor = (row: typeof rows[0], mode: 'pay' | 'fee') => {
    setEditor({ studentId: row.student.id, mode });
    setEditorValue(String(row.amount));
  };

  // Xác nhận ô nhập: kiểm tra số tiền rồi thu tiền hoặc đổi học phí
  const handleConfirmEditor = (row: typeof rows[0]) => {
    if (!editor) return;
    const value = Number(editorValue);
    if (!Number.isInteger(value) || value <= 0) {
      alert('Số tiền phải là số nguyên dương.');
      return;
    }
    if (editor.mode === 'pay') {
      handleMarkPaid(row, value);
    } else {
      onSetAmount(row.student.id, selectedMonth, value);
    }
    setEditor(null);
  };

  // Đã thu: ghi nhận số tiền thực thu (mặc định bằng học phí)
  const handleMarkPaid = (row: typeof rows[0], paidAmount: number) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (row.payment) {
      onUpdatePayment(row.payment.id, {
        status: 'paid',
        paid_date: todayStr,
        paid_amount: paidAmount,
      });
    } else {
      onCreatePaymentRecord(row.student.id, selectedMonth, paidAmount);
    }
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
  };

  // Hoàn tác trạng thái đã thu, có xác nhận để tránh bấm nhầm
  const handleUndoPaid = (row: typeof rows[0]) => {
    if (!row.payment) return;
    if (!window.confirm(`Hoàn tác trạng thái đã thu học phí tháng ${selectedMonth} của ${row.student.full_name}?`)) return;
    onUpdatePayment(row.payment.id, {
      status: 'unpaid',
      paid_date: null,
    });
  };

  // Copy polite reminder message for Zalo / SMS
  const handleCopyReminder = (row: typeof rows[0]) => {
    const sender = teacherName ? `${teacherName} gửi` : 'Giáo viên gửi';
    const message = `Chào bạn ${row.student.full_name}, ${sender} thông báo học phí lớp tiếng Nhật ${row.classItem?.name || ''} tháng ${selectedMonth} là ${row.amount.toLocaleString('vi-VN')} đ. Bạn vui lòng hoàn thành sớm nhé. Cảm ơn bạn!`;
    navigator.clipboard.writeText(message);
    setCopiedMessageId(row.student.id);
    setTimeout(() => setCopiedMessageId(null), 3000);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner & Month Selector */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Quản lý Học phí theo tháng
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi công nợ, đánh dấu đã thu và sao chép tin nhắn nhắc học phí nhanh.
            </p>
          </div>

          {/* Month Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {monthOptions.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedMonth === m
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tháng {m}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold mb-1">
              <span>Đã thu (Doanh thu)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800">
              {totalCollectedAmount.toLocaleString('vi-VN')} đ
            </div>
            <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
              {paidRows.length}/{totalStudentsInMonth} học viên ({completionRate}%)
            </p>
          </div>

          <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-100">
            <div className="flex items-center justify-between text-rose-800 text-xs font-bold mb-1">
              <span>Công nợ còn thiếu</span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-700">
              {totalDebtAmount.toLocaleString('vi-VN')} đ
            </div>
            <p className="text-[11px] text-rose-600 mt-1 font-semibold">
              {unpaidRows.length} học viên chưa hoàn thành
            </p>
          </div>

          <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-800 text-xs font-bold mb-1">
              <span>Tiến độ thu tháng {selectedMonth}</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="w-full bg-blue-200/60 h-2.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-700 mt-1.5 font-bold text-right">
                {completionRate}% hoàn thành
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên học viên, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả các lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chưa đóng ({unpaidRows.length})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã đóng ({paidRows.length})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({rows.length})
            </button>
          </div>
        </div>

      </div>

      {/* Tuition Roster Table / Card List */}
      <div className="space-y-2.5">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs">
            {statusFilter === 'unpaid'
              ? '🎉 Tuyệt vời! Không còn học viên nào nợ học phí trong danh mục này.'
              : 'Không có dữ liệu phù hợp.'}
          </div>
        ) : (
          filteredRows.map((row) => {
            const isPaid = row.status === 'paid';
            const isCopied = copiedMessageId === row.student.id;

            return (
              <React.Fragment key={row.student.id}>
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isPaid
                    ? 'bg-white border-slate-200/80 shadow-xs'
                    : 'bg-amber-50/40 border-amber-200 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isPaid ? '✓' : '!'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">
                        {row.student.full_name}
                      </h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-800">
                        {row.classItem?.name}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>SĐT: <a href={`tel:${row.student.phone}`} className="text-blue-600 font-semibold">{row.student.phone}</a></span>
                      <span>• Tháng {selectedMonth}</span>
                    </p>

                    {row.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-0.5">
                        Ghi chú: {row.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-black text-slate-900">
                      {row.amount.toLocaleString('vi-VN')} đ
                    </div>
                    <span className={`inline-block text-[10px] font-bold ${isPaid ? 'text-emerald-700' : 'text-rose-600 font-extrabold'}`}>
                      {isPaid ? (row.paidDate ? `Đã đóng (${row.paidDate})` : 'Đã đóng') : 'Chưa đóng'}
                    </span>
                    {isPaid && row.payment?.paid_amount !== undefined && row.payment.paid_amount !== row.amount && (
                      <p className="text-[10px] text-slate-500 font-semibold">
                        Đã thu: {row.payment.paid_amount.toLocaleString('vi-VN')} đ
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Mark Paid Button */}
                    {!isPaid ? (
                      <button
                        onClick={() => openEditor(row, 'pay')}
                        className="flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã thu
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUndoPaid(row)}
                        title="Hoàn tác trạng thái chưa thu"
                        className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Hoàn tác
                      </button>
                    )}

                    {/* Đổi học phí tháng này */}
                    <button
                      onClick={() => openEditor(row, 'fee')}
                      title="Đổi học phí tháng này"
                      aria-label={`Đổi học phí tháng ${selectedMonth} của ${row.student.full_name}`}
                      className="flex items-center gap-1 px-2.5 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Copy Reminder Message */}
                    {!isPaid && (
                      <button
                        onClick={() => handleCopyReminder(row)}
                        title="Sao chép tin nhắn nhắc học phí gửi Zalo/SMS"
                        className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopied ? 'Đã copy' : 'Nhắc học phí'}
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {editor?.studentId === row.student.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleConfirmEditor(row);
                  }}
                  className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-2xl border border-blue-200 shadow-xs"
                >
                  <span className="text-xs font-bold text-slate-700">
                    {editor.mode === 'pay'
                      ? `Số tiền thu tháng ${selectedMonth}:`
                      : `Học phí tháng ${selectedMonth}:`}
                  </span>
                  <input
                    type="number"
                    required
                    min={1}
                    step={1000}
                    value={editorValue}
                    onChange={(e) => setEditorValue(e.target.value)}
                    autoFocus
                    className="w-36 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">đ</span>
                  <button
                    type="submit"
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Xác nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditor(null)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                </form>
              )}
              </React.Fragment>
            );
          })
        )}
      </div>

    </div>
  );
};
