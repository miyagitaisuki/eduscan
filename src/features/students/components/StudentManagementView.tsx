import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Phone, 
  ArrowRightLeft, 
  X
} from 'lucide-react';
import { 
  ClassItem, 
  Attendance, 
  Payment, 
  Assignment, 
  Submission, 
  JlptLevel 
} from '../../../shared/types';
import { Student } from '../types';
import { StudentAccountPanel } from './StudentAccountPanel';

interface StudentManagementViewProps {
  students: Student[];
  classes: ClassItem[];
  attendance: Attendance[];
  payments: Payment[];
  assignments: Assignment[];
  submissions: Submission[];
  initialClassId?: string;
  onCreateStudent: (student: Omit<Student, 'id'>) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onTransferClass: (studentId: string, newClassId: string) => void;
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
  isAdmin = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(initialClassId || 'all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Student Profile Detail Drawer
  const [activeProfileStudent, setActiveProfileStudent] = useState<Student | null>(null);

  // Transfer Class Modal
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [classId, setClassId] = useState<string>(classes[0]?.id || '');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [tuitionFee, setTuitionFee] = useState('');

  const openCreateModal = () => {
    setEditingStudent(null);
    setFullName('');
    setPhone('');
    setLevel('N5');
    setClassId(classes[0]?.id || '');
    setJoinDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setTuitionFee('');
    setIsModalOpen(true);
  };

  const openEditModal = (st: Student) => {
    setEditingStudent(st);
    setFullName(st.full_name);
    setPhone(st.phone);
    setLevel(st.level);
    setClassId(st.class_id);
    setJoinDate(st.join_date);
    setNotes(st.notes);
    setTuitionFee(st.tuition_fee != null ? String(st.tuition_fee) : '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    // Để trống = dùng học phí của lớp
    const tuition_fee = tuitionFee.trim() === '' ? null : Math.round(Number(tuitionFee));

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        full_name: fullName.trim(),
        phone: phone.trim(),
        level,
        class_id: classId,
        join_date: joinDate,
        notes: notes.trim(),
        tuition_fee,
      });
    } else {
      onCreateStudent({
        full_name: fullName.trim(),
        phone: phone.trim(),
        level,
        class_id: classId,
        join_date: joinDate,
        notes: notes.trim(),
        tuition_fee,
      });
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
    const currentMonthPayment = studentPayments.find((p) => p.month === '10/2026');
    const isPaidOctober = currentMonthPayment?.status === 'paid';

    // Assignments
    const studentSubmissions = submissions.filter((s) => s.student_id === st.id);
    const submittedCount = studentSubmissions.filter((s) => s.status === 'submitted').length;
    const scoredSubmissions = studentSubmissions.filter((s) => s.score !== null);
    const averageScore = scoredSubmissions.length > 0
      ? Math.round(scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / scoredSubmissions.length)
      : null;

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
    <div className="space-y-4 pb-16 md:pb-6">
      
      {/* Top Header & Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Quản lý Học viên ({students.length} học viên)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hồ sơ học tập, theo dõi chuyên cần, bài tập và học phí từng học viên.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Thêm học viên mới
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo họ tên, số điện thoại..."
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
              value={selectedLevelFilter}
              onChange={(e) => setSelectedLevelFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả trình độ JLPT</option>
              <option value="N5">N5 (Sơ cấp 1)</option>
              <option value="N4">N4 (Sơ cấp 2)</option>
              <option value="N3">N3 (Trung cấp)</option>
              <option value="N2">N2 (Cao cấp)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs">
            Không tìm thấy học viên nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          filteredStudents.map((st) => {
            const cls = classes.find((c) => c.id === st.class_id);
            const metrics = getStudentMetrics(st);

            return (
              <div
                key={st.id}
                onClick={() => setActiveProfileStudent(st)}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-blue-100 hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between cursor-pointer group active:scale-99"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800">
                      {st.level}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                      {cls?.name || 'Chưa xếp lớp'}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {st.full_name}
                  </h3>

                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <a
                      href={`tel:${st.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-semibold"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {st.phone}
                    </a>
                    <p className="text-[11px] text-slate-400">
                      Tham gia: {st.join_date}
                    </p>
                  </div>

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-1.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">Chuyên cần</span>
                      <strong className={`text-xs font-black ${metrics.attRate >= 80 ? 'text-emerald-700' : 'text-amber-600'}`}>
                        {metrics.attRate}%
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">Học phí T10</span>
                      <strong className={`text-[11px] font-black ${metrics.isPaidOctober ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {metrics.isPaidOctober ? '✅ Đã đóng' : '❌ Chưa đóng'}
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">Điểm TB</span>
                      <strong className="text-xs font-black text-purple-700">
                        {metrics.averageScore ? `${metrics.averageScore}/100` : '--'}
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
                    className="text-blue-600 font-bold hover:underline flex items-center gap-1"
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
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => openEditModal(st)}
                      title="Chỉnh sửa thông tin"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`Xóa học viên "${st.full_name}"?`)) {
                          onDeleteStudent(st.id);
                        }
                      }}
                      title="Xóa học viên"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-5 sm:p-7 w-full max-w-lg border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
              
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-blue-600 text-white">
                      {activeProfileStudent.level}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {cls?.name}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                    {activeProfileStudent.full_name}
                  </h3>
                  <a
                    href={`tel:${activeProfileStudent.phone}`}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {activeProfileStudent.phone}
                  </a>
                </div>

                <button
                  onClick={() => setActiveProfileStudent(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Chuyên cần</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {metrics.attRate}%
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Có mặt {metrics.presentSessions}/{metrics.totalSessions} buổi (Vắng {metrics.absentSessions})
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Học phí tháng này</span>
                  <div className={`text-base font-black mt-0.5 ${metrics.isPaidOctober ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {metrics.isPaidOctober ? '✅ Đã hoàn thành' : '❌ Chưa đóng'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {(activeProfileStudent.tuition_fee ?? cls?.monthly_fee ?? 0).toLocaleString('vi-VN')} đ/tháng
                    {activeProfileStudent.tuition_fee != null && ' (học phí riêng)'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Bài tập hoàn thành</span>
                  <div className="text-lg font-black text-purple-700 mt-0.5">
                    {metrics.submittedCount} bài nộp
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Điểm TB: {metrics.averageScore ? `${metrics.averageScore}/100` : 'Chưa có điểm'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Ngày nhập học</span>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {activeProfileStudent.join_date}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ghi chú: {activeProfileStudent.notes || 'Không có'}
                  </p>
                </div>
              </div>

              {/* Attendance Log for this student */}
              <div className="mb-5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Lịch sử điểm danh ({studentAtt.length} buổi)
                </h4>
                {studentAtt.length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có dữ liệu điểm danh.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {studentAtt.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs">
                        <span className="font-medium text-slate-700">📅 {att.date}</span>
                        <div className="flex items-center gap-1.5">
                          {att.notes && <span className="text-[10px] text-slate-400">({att.notes})</span>}
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            att.status === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
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
                          <span className={`font-bold ${sub?.status === 'submitted' ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {sub?.status === 'submitted' ? (sub.score !== null ? `${sub.score}/100` : 'Đã nộp') : 'Chưa nộp'}
                          </span>
                        </div>
                        {sub?.comment && (
                          <p className="text-[11px] text-blue-700 mt-1 italic">
                            💬 Nhận xét: "{sub.comment}"
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
                  className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
          </div>
        );
      })()}

      {/* Transfer Class Modal */}
      {transferringStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 mb-2">
              Chuyển lớp cho học viên
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Học viên: <strong className="text-slate-900">{transferringStudent.full_name}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chọn lớp mới:</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 bg-white"
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Xác nhận chuyển lớp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingStudent ? 'Chỉnh sửa thông tin học viên' : 'Thêm học viên mới'}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên học viên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn An"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  placeholder="VD: 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Học phí riêng (VNĐ/tháng)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Để trống = theo học phí lớp"
                  value={tuitionFee}
                  onChange={(e) => setTuitionFee(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lớp học</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trình độ</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as JlptLevel)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="N5">N5</option>
                    <option value="N4">N4</option>
                    <option value="N3">N3</option>
                    <option value="N2">N2</option>
                    <option value="N1">N1</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ngày tham gia lớp</label>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  placeholder="Mục tiêu thi JLPT, công việc, đặc điểm học viên..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {editingStudent ? 'Cập nhật' : 'Thêm học viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
