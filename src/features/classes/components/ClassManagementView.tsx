import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  Users, 
  Clock, 
  CreditCard, 
  CheckSquare, 
  Search, 
  X
} from 'lucide-react';
import { Student, Attendance, Payment, JlptLevel, ActiveTab } from '../../../shared/types';
import { ClassItem } from '../types';

interface ClassManagementViewProps {
  classes: ClassItem[];
  students: Student[];
  attendance: Attendance[];
  payments: Payment[];
  onCreateClass: (cls: Omit<ClassItem, 'id'>) => void;
  onUpdateClass: (cls: ClassItem) => void;
  onDeleteClass: (classId: string) => void;
  onNavigateTab: (tab: ActiveTab, preselectedClassId?: string) => void;
}

export const ClassManagementView: React.FC<ClassManagementViewProps> = ({
  classes,
  students,
  attendance,
  payments,
  onCreateClass,
  onUpdateClass,
  onDeleteClass,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [schedule, setSchedule] = useState('Thứ 2 - 4 - 6 (18:00 - 19:30)');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 3, 5]);
  const [monthlyFee, setMonthlyFee] = useState<number>(800000);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [room, setRoom] = useState('Phòng 201 - Nhà Ngoại ngữ');

  const openCreateModal = () => {
    setEditingClass(null);
    setName('');
    setLevel('N5');
    setSchedule('Thứ 2 - 4 - 6 (18:00 - 19:30)');
    setScheduleDays([1, 3, 5]);
    setMonthlyFee(800000);
    setStartDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setRoom('Phòng 201 - Nhà Ngoại ngữ');
    setIsModalOpen(true);
  };

  const openEditModal = (cls: ClassItem) => {
    setEditingClass(cls);
    setName(cls.name);
    setLevel(cls.level);
    setSchedule(cls.schedule);
    setScheduleDays(cls.scheduleDays || [1, 3, 5]);
    setMonthlyFee(cls.monthly_fee);
    setStartDate(cls.start_date);
    setNotes(cls.notes);
    setRoom(cls.room || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingClass) {
      onUpdateClass({
        ...editingClass,
        name: name.trim(),
        level,
        schedule: schedule.trim(),
        scheduleDays,
        monthly_fee: Number(monthlyFee) || 0,
        start_date: startDate,
        notes: notes.trim(),
        room: room.trim(),
      });
    } else {
      onCreateClass({
        name: name.trim(),
        level,
        schedule: schedule.trim(),
        scheduleDays,
        monthly_fee: Number(monthlyFee) || 0,
        start_date: startDate,
        notes: notes.trim(),
        room: room.trim(),
      });
    }

    setIsModalOpen(false);
  };

  // Filter classes
  const filteredClasses = classes.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.schedule.toLowerCase().includes(searchQuery.toLowerCase());
    const matchLevel = selectedLevelFilter === 'all' || c.level === selectedLevelFilter;
    return matchSearch && matchLevel;
  });

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      
      {/* Top Action Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Quản lý Lớp học ({classes.length} lớp)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo và quản lý các lớp tiếng Nhật, lịch dạy và học phí theo tháng.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Tạo lớp mới
          </button>
        </div>

        {/* Search & Level Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm lớp học, lịch học..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {['all', 'N5', 'N4', 'N3', 'N2', 'N1'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevelFilter(lvl)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLevelFilter === lvl
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lvl === 'all' ? 'Tất cả' : lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredClasses.map((cls) => {
          const classStudents = students.filter((s) => s.class_id === cls.id);

          // Fee collection status for 10/2026
          const classStudentIds = new Set(classStudents.map((s) => s.id));
          const monthPayments = payments.filter((p) => p.month === '10/2026' && classStudentIds.has(p.student_id));
          const paidCount = monthPayments.filter((p) => p.status === 'paid').length;

          return (
            <div
              key={cls.id}
              className="bg-white rounded-3xl p-5 border border-blue-100 hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                {/* Header Badge & Level */}
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-blue-600 text-white tracking-wide">
                    {cls.level}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(cls)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Chỉnh sửa lớp"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Thầy có chắc chắn muốn xóa lớp "${cls.name}"?`)) {
                          onDeleteClass(cls.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa lớp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {cls.name}
                </h3>

                <div className="space-y-1.5 mt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{cls.schedule}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-700">
                      {cls.monthly_fee.toLocaleString('vi-VN')} VNĐ/tháng
                    </span>
                  </div>

                  {cls.room && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <span>📍</span>
                      <span>{cls.room}</span>
                    </div>
                  )}

                  {cls.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl mt-2 line-clamp-2">
                      {cls.notes}
                    </p>
                  )}
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Sĩ số</span>
                    <strong className="text-xs text-slate-800 font-extrabold">{classStudents.length} học viên</strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Học phí T10</span>
                    <strong className="text-xs text-emerald-700 font-extrabold">{paidCount}/{classStudents.length} đã đóng</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onNavigateTab('attendance', cls.id)}
                  className="flex-1 py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Điểm danh
                </button>

                <button
                  onClick={() => onNavigateTab('students', cls.id)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Xem danh sách học viên"
                >
                  <Users className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onNavigateTab('tuition', cls.id)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Xem học phí lớp"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingClass ? 'Chỉnh sửa Lớp học' : 'Tạo Lớp học tiếng Nhật mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: N5 Sơ cấp 1, N4 Cấp tốc..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trình độ JLPT</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as JlptLevel)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 bg-white"
                  >
                    <option value="N5">N5 (Sơ cấp 1)</option>
                    <option value="N4">N4 (Sơ cấp 2 / Cấp tốc)</option>
                    <option value="N3">N3 (Trung cấp)</option>
                    <option value="N2">N2 (Trung - Cao cấp)</option>
                    <option value="N1">N1 (Cao cấp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Học phí (VNĐ/tháng)</label>
                  <input
                    type="number"
                    step="50000"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lịch học</label>
                <input
                  type="text"
                  placeholder="VD: Thứ 2 - 4 - 6 (18:00 - 19:30)"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Địa điểm / Phòng học</label>
                  <input
                    type="text"
                    placeholder="VD: Phòng 201 - Nhà Ngoại ngữ"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú giáo trình / mục tiêu</label>
                <textarea
                  rows={2}
                  placeholder="Minna no Nihongo, Kanji, chuẩn bị thi tháng 12..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {editingClass ? 'Lưu thay đổi' : 'Tạo lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
