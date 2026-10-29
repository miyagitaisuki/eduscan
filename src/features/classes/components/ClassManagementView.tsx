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
  CalendarDays,
  CalendarOff,
} from 'lucide-react';
import { Student, AttendanceRecord, TuitionRecord, ClassInput, ClassItem, JlptLevel, ActiveTab } from '../../../shared/types';
import { currentTuitionMonth } from '../../../shared/utils/tuitionMonth';
import { todayLocal } from '../../../shared/utils/date';
import { Modal, useConfirm } from '../../../shared/components/ui';
import { HolidayManagerModal, LessonScheduleModal } from '../../schedule';
import type { Notify } from '../../../hooks/data/types';

interface ClassManagementViewProps {
  /** Học phí và chọn giáo viên phụ trách chỉ dành cho admin */
  isAdmin?: boolean;
  /** Danh sách giáo viên để admin chọn người phụ trách */
  teachers?: { id: string; full_name: string }[];
  classes: ClassItem[];
  students: Student[];
  attendance: AttendanceRecord[];
  payments: TuitionRecord[];
  onCreateClass: (cls: ClassInput) => void;
  onUpdateClass: (classId: string, cls: Partial<ClassInput>) => void;
  onDeleteClass: (classId: string) => void;
  onNavigateTab: (tab: ActiveTab, preselectedClassId?: string) => void;
  /** Gọi sau khi admin đổi lịch lặp, buổi học hoặc ngày nghỉ: tải lại lớp và buổi học */
  onScheduleChanged?: () => void;
  notify?: Notify;
  /** Giáo viên đăng nhập: được sửa nội dung buổi học của lớp mình phụ trách */
  currentUserId?: string;
}

export const ClassManagementView: React.FC<ClassManagementViewProps> = ({
  isAdmin = false,
  teachers = [],
  classes,
  students,
  attendance,
  payments,
  onCreateClass,
  onUpdateClass,
  onDeleteClass,
  onNavigateTab,
  onScheduleChanged,
  notify,
  currentUserId,
}) => {
  // Lịch học của lớp nào đang mở (null = đóng); lưu id để modal luôn lấy dữ liệu lớp mới nhất
  const [scheduleClassId, setScheduleClassId] = useState<string | null>(null);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const scheduleClass = classes.find((c) => c.id === scheduleClassId) ?? null;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [level, setLevel] = useState<JlptLevel>('N5');
  const confirm = useConfirm();
  const [schedule, setSchedule] = useState('Thứ 2 - 4 - 6 (18:00 - 19:30)');
  const [monthlyFee, setMonthlyFee] = useState<number>(800000);
  const [teacherId, setTeacherId] = useState<string>('');
  const [startDate, setStartDate] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [room, setRoom] = useState('');

  const openCreateModal = () => {
    setEditingClass(null);
    setName('');
    setLevel('N5');
    setSchedule('Thứ 2 - 4 - 6 (18:00 - 19:30)');
    setMonthlyFee(800000);
    setStartDate(todayLocal());
    setDescription('');
    setRoom('');
    setTeacherId(teachers[0]?.id ?? '');
    setIsModalOpen(true);
  };

  const openEditModal = (cls: ClassItem) => {
    setEditingClass(cls);
    setName(cls.name);
    setLevel(cls.level);
    setSchedule(cls.schedule);
    setMonthlyFee(cls.monthly_fee ?? 800000);
    setStartDate(cls.start_date);
    setDescription(cls.description);
    setRoom(cls.room);
    setTeacherId(cls.teacher_id ?? '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const input: ClassInput = {
      name: name.trim(),
      level,
      schedule: schedule.trim(),
      start_date: startDate,
      description: description.trim(),
      room: room.trim(),
      // Học phí và giáo viên phụ trách chỉ admin được đặt
      ...(isAdmin ? { monthly_fee: Number(monthlyFee) || 0 } : {}),
      ...(isAdmin && teacherId ? { teacher_id: teacherId } : {}),
    };
    if (editingClass) {
      onUpdateClass(editingClass.id, input);
    } else {
      onCreateClass(input);
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
    <div className="space-y-4">
      
      {/* Top Action Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-primary-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-600" />
              Quản lý Lớp học ({classes.length} lớp)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo và quản lý các lớp tiếng Nhật, lịch dạy và học phí theo tháng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {isAdmin && (
              <button
                onClick={() => setHolidaysOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-warning-50 hover:bg-warning-100 text-warning-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <CalendarOff className="w-4 h-4" />
                Ngày nghỉ chung
              </button>
            )}
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tạo lớp mới
            </button>
          </div>
        </div>

        {/* Search & Level Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Tìm lớp học theo tên hoặc lịch học"
              placeholder="Tìm kiếm lớp học, lịch học..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {['all', 'N5', 'N4', 'N3', 'N2', 'N1'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevelFilter(lvl)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLevelFilter === lvl
                    ? 'bg-primary-600 text-white shadow-xs'
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

          // Tình trạng thu học phí tháng hiện tại (chỉ admin)
          const classStudentIds = new Set(classStudents.map((s) => s.id));
          const monthPayments = payments.filter((p) => p.month === currentTuitionMonth() && classStudentIds.has(p.student_id));
          const paidCount = monthPayments.filter((p) => p.status === 'paid').length;

          return (
            <div
              key={cls.id}
              className="bg-white rounded-3xl p-5 border border-primary-100 hover:border-primary-300 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                {/* Header Badge & Level */}
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-primary-600 text-white tracking-wide">
                    {cls.level}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(cls)}
                      className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                      title="Chỉnh sửa lớp"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Xóa lớp "${cls.name}"?`,
                          message: 'Học viên, điểm danh và bài tập của lớp có thể bị ảnh hưởng. Không thể hoàn tác.',
                          confirmLabel: 'Xóa lớp',
                          tone: 'danger',
                        });
                        if (ok) onDeleteClass(cls.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors cursor-pointer"
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
                    <Clock className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span>
                      {cls.schedule}
                      {cls.end_date && cls.weekdays.length > 0 ? ` • đến ${cls.end_date.split('-').reverse().join('/')}` : ''}
                    </span>
                  </div>

                  {isAdmin && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-success-600 shrink-0" />
                    <span className="font-bold text-success-700">
                      {(cls.monthly_fee ?? 0).toLocaleString('vi-VN')} VNĐ/tháng
                    </span>
                  </div>
                  )}

                  {cls.room && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <span>📍</span>
                      <span>{cls.room}</span>
                    </div>
                  )}

                  {cls.description && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl mt-2 line-clamp-2">
                      {cls.description}
                    </p>
                  )}
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-xs text-slate-500 uppercase font-bold block">Sĩ số</span>
                    <strong className="text-xs text-slate-800 font-extrabold">{classStudents.length} học viên</strong>
                  </div>
                  {isAdmin && (
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-xs text-slate-500 uppercase font-bold block">Học phí T{Number(currentTuitionMonth().split('/')[0])}</span>
                    <strong className="text-xs text-success-700 font-extrabold">{paidCount}/{classStudents.length} đã đóng</strong>
                  </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onNavigateTab('attendance', cls.id)}
                  className="flex-1 py-2 px-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Điểm danh
                </button>

                <button
                  onClick={() => setScheduleClassId(cls.id)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Xem lịch học và nội dung từng buổi"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Lịch
                </button>

                <button
                  onClick={() => onNavigateTab('students', cls.id)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Xem danh sách học viên"
                >
                  <Users className="w-3.5 h-3.5" />
                </button>

                {isAdmin && (
                <button
                  onClick={() => onNavigateTab('tuition', cls.id)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Xem học phí lớp"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {scheduleClass && (
        <LessonScheduleModal
          cls={scheduleClass}
          canEditSchedule={isAdmin}
          canEditContent={isAdmin || scheduleClass.teacher_id === currentUserId}
          onClose={() => setScheduleClassId(null)}
          onChanged={() => onScheduleChanged?.()}
          notify={notify}
        />
      )}
      {holidaysOpen && (
        <HolidayManagerModal onClose={() => setHolidaysOpen(false)} onChanged={() => onScheduleChanged?.()} notify={notify} />
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <Modal title={editingClass ? 'Chỉnh sửa Lớp học' : 'Tạo Lớp học tiếng Nhật mới'} onClose={() => setIsModalOpen(false)} size="lg" closeOnBackdrop={false}>
          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-1">Giáo viên phụ trách</label>
                <select id="class-management-field-1"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white"
                >
                  {teachers.length === 0 && <option value="">Chưa có giáo viên</option>}
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-2">Tên lớp *</label>
              <input id="class-management-field-2"
                type="text"
                required
                placeholder="VD: N5 Sơ cấp 1, N4 Cấp tốc..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-3">Trình độ JLPT</label>
                <select id="class-management-field-3"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as JlptLevel)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-primary-700 bg-white"
                >
                  <option value="N5">N5 (Sơ cấp 1)</option>
                  <option value="N4">N4 (Sơ cấp 2 / Cấp tốc)</option>
                  <option value="N3">N3 (Trung cấp)</option>
                  <option value="N2">N2 (Trung - Cao cấp)</option>
                  <option value="N1">N1 (Cao cấp)</option>
                </select>
              </div>

              {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-4">Học phí (VNĐ/tháng)</label>
                <input id="class-management-field-4"
                  type="number"
                  step="50000"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-success-700"
                />
              </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-5">Lịch học</label>
              <input id="class-management-field-5"
                type="text"
                placeholder="VD: Thứ 2 - 4 - 6 (18:00 - 19:30)"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                disabled={!!editingClass && editingClass.weekdays.length > 0}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium disabled:bg-slate-100 disabled:text-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                {editingClass && editingClass.weekdays.length > 0
                  ? 'Lịch này do lịch lặp tự sinh. Muốn đổi, mở "Lịch" của lớp.'
                  : isAdmin
                    ? 'Ghi chú tự do. Muốn tự sinh lịch từng buổi, lưu lớp rồi mở "Lịch" trên thẻ lớp.'
                    : 'Ghi rõ thứ trong tuần (VD: Thứ 2 - 4 - 6, Chủ Nhật) để trang Tổng quan hiện đúng lớp học hôm nay.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-6">Ngày bắt đầu</label>
                <input id="class-management-field-6"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-7">Địa điểm / Phòng học</label>
                <input id="class-management-field-7"
                  type="text"
                  placeholder="VD: Phòng 201 - Nhà Ngoại ngữ"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="class-management-field-8">Ghi chú giáo trình / mục tiêu</label>
              <textarea id="class-management-field-8"
                rows={2}
                placeholder="Minna no Nihongo, Kanji, chuẩn bị thi tháng 12..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 cursor-pointer"
              >
                {editingClass ? 'Lưu thay đổi' : 'Tạo lớp học'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
