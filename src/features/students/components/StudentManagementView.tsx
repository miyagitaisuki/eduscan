import React, { useEffect, useState } from 'react';
import { GenderSelect } from '../../../shared/components/GenderSelect';
import { Gender } from '../../../shared/types';
import { isSubmitted } from '../../../shared/utils/submission';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Phone, 
  ArrowRightLeft, 
  ChevronRight
} from 'lucide-react';
import { 
  ClassItem, 
  AttendanceRecord, 
  TuitionRecord, 
  Assignment, 
  Submission, 
  Student,
  StudentInput
} from '../../../shared/types';
import { currentTuitionMonth } from '../../../shared/utils/tuitionMonth';
import { averageScore as averageScoreOf, formatScore } from '../../../shared/utils/score';
import { todayLocal } from '../../../shared/utils/date';
import { Modal, useConfirm } from '../../../shared/components/ui';
import { StudentAccountPanel } from './StudentAccountPanel';

interface StudentManagementViewProps {
  students: Student[];
  classes: ClassItem[];
  attendance: AttendanceRecord[];
  payments: TuitionRecord[];
  assignments: Assignment[];
  submissions: Submission[];
  initialClassId?: string;
  onCreateStudent: (student: StudentInput) => void;
  onUpdateStudent: (studentId: string, student: Partial<StudentInput>) => void;
  onDeleteStudent: (studentId: string) => void;
  onTransferClass: (studentId: string, newClassId: string) => void;
  /** Đổi học phí tháng hiện tại của học viên (chỉ admin) */
  onChangeTuition?: (studentId: string, amount: number) => void;
  /** Admin mới thấy khối quản lý tài khoản đăng nhập */
  isAdmin?: boolean;
}

export const StudentManagementView: React.FC<StudentManagementViewProps> = ({
  students,
  classes,
  attendance,
  payments,
  assignments,
  submissions,
  initialClassId,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
  onTransferClass,
  onChangeTuition,
  isAdmin = false,
}) => {
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(initialClassId || 'all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Student Profile Detail Drawer
  const [activeProfileStudent, setActiveProfileStudent] = useState<Student | null>(null);
  // Số tiền đang nhập khi admin đổi học phí; null = đang đóng form
  const [tuitionEditAmount, setTuitionEditAmount] = useState<string | null>(null);
  const [tuitionEditError, setTuitionEditError] = useState('');

  useEffect(() => {
    setTuitionEditAmount(null);
    setTuitionEditError('');
  }, [activeProfileStudent]);

  const handleSaveTuitionAmount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileStudent || !onChangeTuition || tuitionEditAmount === null) return;
    const amount = Number(tuitionEditAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setTuitionEditError('Số tiền học phí phải là số nguyên dương.');
      return;
    }
    setTuitionEditError('');
    onChangeTuition(activeProfileStudent.id, amount);
    setTuitionEditAmount(null);
  };

  // Transfer Class Modal
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [classId, setClassId] = useState<string>(classes[0]?.id || '');
  const [joinDate, setJoinDate] = useState(todayLocal());

  const openCreateModal = () => {
    setEditingStudent(null);
    setFullName('');
    setPhone('');
    setGender(null);
    setClassId(classes[0]?.id || '');
    setJoinDate(todayLocal());
    setIsModalOpen(true);
  };

  const openEditModal = (st: Student) => {
    setEditingStudent(st);
    setFullName(st.full_name);
    setPhone(st.phone);
    setGender(st.gender ?? null);
    setClassId(st.class_id);
    setJoinDate(st.join_date);
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    // Cấp độ của học viên lấy từ lớp đang học nên không nhập riêng
    const input: StudentInput = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      gender,
      class_id: classId,
      join_date: joinDate,
    };
    if (editingStudent) {
      onUpdateStudent(editingStudent.id, input);
    } else {
      onCreateStudent(input);
    }

    setIsModalOpen(false);
  };

  const handleConfirmTransfer = () => {
    if (!transferringStudent || !targetClassId) return;
    onTransferClass(transferringStudent.id, targetClassId);
    setTransferringStudent(null);
  };

  // Filter students
  const filteredStudents = students.filter((st) => {
    const matchSearch = st.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        st.phone.includes(searchQuery);
    const matchClass = selectedClassFilter === 'all' || st.class_id === selectedClassFilter;
    const matchLevel = selectedLevelFilter === 'all' || st.level === selectedLevelFilter;
    return matchSearch && matchClass && matchLevel;
  });

  // Calculate profile metrics for a given student
  const getStudentMetrics = (st: Student) => {
    const studentAtt = attendance.filter((a) => a.student_id === st.id);
    const totalSessions = studentAtt.length;
    const presentSessions = studentAtt.filter((a) => a.status === 'present').length;
    const absentSessions = totalSessions - presentSessions;
    const attRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 100;

    // Payments
    const studentPayments = payments.filter((p) => p.student_id === st.id);
    const currentMonthPayment = studentPayments.find((p) => p.month === currentTuitionMonth());
    const isPaidOctober = currentMonthPayment?.status === 'paid';

    // Assignments
    const studentSubmissions = submissions.filter((s) => s.student_id === st.id);
    const submittedCount = studentSubmissions.filter(isSubmitted).length;
    const scoredSubmissions = studentSubmissions.filter((s) => s.score !== null);
    const averageScore = averageScoreOf(scoredSubmissions.map((s) => s.score));

    return {
      totalSessions,
      presentSessions,
      absentSessions,
      attRate,
      studentPayments,
      currentMonthPayment,
      isPaidOctober,
      submittedCount,
      averageScore,
    };
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header & Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-primary-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Quản lý Học viên ({students.length} học viên)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin ? 'Hồ sơ học tập, theo dõi chuyên cần, bài tập và học phí từng học viên.' : 'Hồ sơ học tập, theo dõi chuyên cần và bài tập từng học viên.'}
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/20 active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Thêm học viên mới
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Tìm học viên theo họ tên hoặc số điện thoại"
              placeholder="Tìm theo họ tên, số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <select
              aria-label="Lọc theo lớp"
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả các lớp ({classes.length})</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              aria-label="Lọc theo trình độ JLPT"
              value={selectedLevelFilter}
              onChange={(e) => setSelectedLevelFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả trình độ JLPT</option>
              <option value="N5">N5 (Sơ cấp 1)</option>
              <option value="N4">N4 (Sơ cấp 2)</option>
              <option value="N3">N3 (Trung cấp)</option>
              <option value="N2">N2 (Cao cấp)</option>
              <option value="N1">N1 (Thượng cấp)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-500 text-xs">
            Không tìm thấy học viên nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          filteredStudents.map((st) => {
            const cls = classes.find((c) => c.id === st.class_id);
            const metrics = getStudentMetrics(st);

            return (
              <div
                key={st.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveProfileStudent(st)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveProfileStudent(st);
                  }
                }}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-primary-100 hover:border-primary-300 transition-all shadow-xs flex flex-col justify-between cursor-pointer group active:scale-99"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-primary-100 text-primary-800">
                      {st.level}
                    </span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                      {cls?.name || 'Chưa xếp lớp'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 shrink-0" aria-hidden />
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-primary-600 transition-colors">
                    {st.full_name}
                  </h3>

                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <a
                      href={`tel:${st.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-primary-600 hover:underline font-semibold"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {st.phone}
                    </a>
                    <p className="text-xs text-slate-500">
                      Tham gia: {st.join_date}
                    </p>
                  </div>

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-1.5 rounded-xl">
                      <span className="text-xs text-slate-500 uppercase font-bold block">Chuyên cần</span>
                      <strong className={`text-xs font-black ${metrics.attRate >= 80 ? 'text-success-700' : 'text-warning-600'}`}>
                        {metrics.attRate}%
                      </strong>
                    </div>

                    {isAdmin && (
                    <div className="bg-slate-50 p-1.5 rounded-xl">
                      <span className="text-xs text-slate-500 uppercase font-bold block">Học phí T{Number(currentTuitionMonth().split('/')[0])}</span>
                      <strong className={`text-xs font-black ${metrics.isPaidOctober ? 'text-success-700' : 'text-danger-600'}`}>
                        {metrics.isPaidOctober ? '✅ Đã đóng' : '❌ Chưa đóng'}
                      </strong>
                    </div>
                    )}

                    <div className="bg-slate-50 p-1.5 rounded-xl">
                      <span className="text-xs text-slate-500 uppercase font-bold block">Điểm TB</span>
                      <strong className="text-xs font-black text-accent-700">
                        {formatScore(metrics.averageScore)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div 
                  className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setActiveProfileStudent(st)}
                    className="text-primary-600 font-bold hover:underline flex items-center gap-1"
                  >
                    Xem hồ sơ chi tiết →
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setTransferringStudent(st);
                        setTargetClassId(st.class_id);
                      }}
                      title="Chuyển lớp cho học viên"
                      className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => openEditModal(st)}
                      title="Chỉnh sửa thông tin"
                      className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Xóa học viên "${st.full_name}"?`,
                          message: 'Toàn bộ điểm danh, học phí và bài nộp của học viên này cũng sẽ bị xóa. Không thể hoàn tác.',
                          confirmLabel: 'Xóa học viên',
                          tone: 'danger',
                        });
                        if (ok) onDeleteStudent(st.id);
                      }}
                      title="Xóa học viên"
                      className="p-1.5 text-slate-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detailed Student Profile Modal / Drawer */}
      {activeProfileStudent && (() => {
        const metrics = getStudentMetrics(activeProfileStudent);
        const cls = classes.find((c) => c.id === activeProfileStudent.class_id);
        const studentAtt = attendance.filter((a) => a.student_id === activeProfileStudent.id);

        return (
          <Modal title={activeProfileStudent.full_name} onClose={() => setActiveProfileStudent(null)} size="lg">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span className="px-2 py-0.5 rounded-md text-xs font-black bg-primary-600 text-white">
                  {activeProfileStudent.level}
                </span>
                <span className="text-xs font-bold text-slate-500">{cls?.name}</span>
                <a
                  href={`tel:${activeProfileStudent.phone}`}
                  className="ml-auto text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {activeProfileStudent.phone}
                </a>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Chuyên cần</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {metrics.attRate}%
                  </div>
                  <p className="text-xs text-slate-500">
                    Có mặt {metrics.presentSessions}/{metrics.totalSessions} buổi (Vắng {metrics.absentSessions})
                  </p>
                </div>

                {isAdmin && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Học phí tháng này</span>
                  <div className={`text-base font-black mt-0.5 ${metrics.isPaidOctober ? 'text-success-700' : 'text-danger-600'}`}>
                    {metrics.isPaidOctober ? '✅ Đã hoàn thành' : '❌ Chưa đóng'}
                  </div>
                  <p className="text-xs text-slate-500">
                    {(cls?.monthly_fee ?? 0).toLocaleString('vi-VN')} đ/tháng
                  </p>
                </div>
                )}

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Bài tập hoàn thành</span>
                  <div className="text-lg font-black text-accent-700 mt-0.5">
                    {metrics.submittedCount} bài nộp
                  </div>
                  <p className="text-xs text-slate-500">
                    Điểm TB: {formatScore(metrics.averageScore, 'Chưa có điểm')}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Ngày nhập học</span>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {activeProfileStudent.join_date}
                  </div>
                  <p className="text-xs text-slate-500">
                    MSSV: {activeProfileStudent.student_code || 'Chưa có'}
                  </p>
                </div>
              </div>

              {/* Admin: đổi học phí tháng hiện tại */}
              {isAdmin && onChangeTuition && (
                <div className="mb-5 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  {tuitionEditAmount === null ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">
                        Học phí tháng {currentTuitionMonth()}: {(payments.find((p) => p.student_id === activeProfileStudent.id && p.month === currentTuitionMonth())?.amount ?? cls?.monthly_fee ?? 0).toLocaleString('vi-VN')} đ
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTuitionEditAmount(String(payments.find((p) => p.student_id === activeProfileStudent.id && p.month === currentTuitionMonth())?.amount ?? cls?.monthly_fee ?? 0))
                        }
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Thay đổi học phí
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveTuitionAmount} className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        required
                        min={0}
                        step={1000}
                        value={tuitionEditAmount}
                        onChange={(e) => {
                          setTuitionEditAmount(e.target.value);
                          setTuitionEditError('');
                        }}
                        aria-invalid={!!tuitionEditError}
                        aria-describedby={tuitionEditError ? 'tuition-edit-error' : undefined}
                        className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                      />
                      <span className="text-xs text-slate-500">đ</span>
                      <button
                        type="submit"
                        className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setTuitionEditAmount(null)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        Hủy
                      </button>
                      {tuitionEditError && (
                    <p id="tuition-edit-error" role="alert" className="w-full text-xs font-semibold text-danger-600">
                      {tuitionEditError}
                    </p>
                  )}
                    </form>
                  )}
                </div>
              )}

              {/* Attendance Log for this student */}
              <div className="mb-5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Lịch sử điểm danh ({studentAtt.length} buổi)
                </h4>
                {studentAtt.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có dữ liệu điểm danh.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {studentAtt.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs">
                        <span className="font-medium text-slate-700">📅 {att.date}</span>
                        <div className="flex items-center gap-1.5">
                          {att.notes && <span className="text-xs text-slate-500">({att.notes})</span>}
                          <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                            att.status === 'present' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-700'
                          }`}>
                            {att.status === 'present' ? 'Có mặt' : 'Vắng'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submissions & Homework for this student */}
              <div className="mb-5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Kết quả bài tập tiếng Nhật
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {assignments.filter((a) => a.class_id === activeProfileStudent.class_id).map((asg) => {
                    const sub = submissions.find((s) => s.assignment_id === asg.id && s.student_id === activeProfileStudent.id);
                    return (
                      <div key={asg.id} className="p-2.5 bg-slate-50 rounded-xl text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-800">{asg.title}</strong>
                          <span className={`font-bold ${sub && isSubmitted(sub) ? 'text-success-700' : 'text-slate-500'}`}>
                            {sub && isSubmitted(sub) ? (sub.score !== null ? formatScore(sub.score) : 'Đã nộp') : 'Chưa nộp'}
                          </span>
                        </div>
                        {sub?.feedback && (
                          <p className="text-xs text-primary-700 mt-1 italic">
                            💬 Nhận xét: "{sub.feedback}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    const st = activeProfileStudent;
                    setActiveProfileStudent(null);
                    openEditModal(st);
                  }}
                  className="px-4 py-2 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Chỉnh sửa hồ sơ
                </button>
                <button
                  onClick={() => setActiveProfileStudent(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  Đóng
                </button>
              </div>

            </div>
          </Modal>
        );
      })()}

      {/* Transfer Class Modal */}
      {transferringStudent && (
        <Modal
          title="Chuyển lớp cho học viên"
          description={<>Học viên: <strong className="text-slate-900">{transferringStudent.full_name}</strong></>}
          onClose={() => setTransferringStudent(null)}
          size="md"
          closeOnBackdrop={false}
        >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="student-management-field-1">Chọn lớp mới:</label>
                <select id="student-management-field-1"
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-primary-700 bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.level}) - {c.schedule}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  onClick={() => setTransferringStudent(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-md shadow-primary-500/20"
                >
                  Xác nhận chuyển lớp
                </button>
              </div>
            </div>
        </Modal>
      )}

      {/* Create / Edit Student Modal */}
      {isModalOpen && (
        <Modal title={editingStudent ? 'Chỉnh sửa thông tin học viên' : 'Thêm học viên mới'} onClose={() => setIsModalOpen(false)} size="md" closeOnBackdrop={false}>
          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="student-management-field-2">Họ và tên học viên *</label>
              <input id="student-management-field-2"
                type="text"
                required
                placeholder="VD: Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="student-management-field-3">Số điện thoại *</label>
              <input id="student-management-field-3"
                type="tel"
                required
                placeholder="VD: 0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="student-management-field-4">Giới tính</label>
              <GenderSelect id="student-management-field-4" value={gender} onChange={setGender} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white" />
            </div>

            <div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="student-management-field-5">Lớp học</label>
                <select id="student-management-field-5"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-primary-700 bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-slate-500 mt-1">Cấp độ của học viên là cấp độ của lớp đang học.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="student-management-field-6">Ngày tham gia lớp</label>
              <input id="student-management-field-6"
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>

            {editingStudent && isAdmin && <StudentAccountPanel studentId={editingStudent.id} />}

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
                {editingStudent ? 'Cập nhật' : 'Thêm học viên'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
