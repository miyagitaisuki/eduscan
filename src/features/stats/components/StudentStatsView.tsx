import React, { useState } from 'react';
import { 
  GraduationCap, 
  CheckCircle2, 
  CreditCard, 
  FileText, 
  Award 
} from 'lucide-react';
import { 
  Student, 
  ClassItem, 
  Attendance, 
  Payment, 
  Assignment, 
  Submission 
} from '../../../shared/types';

interface StudentStatsViewProps {
  /** Học phí chỉ hiển thị với admin */
  isAdmin?: boolean;
  students: Student[];
  classes: ClassItem[];
  attendance: Attendance[];
  payments: Payment[];
  assignments: Assignment[];
  submissions: Submission[];
}

export const StudentStatsView: React.FC<StudentStatsViewProps> = ({
  isAdmin = false,
  students,
  classes,
  attendance,
  payments,
  assignments,
  submissions,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  const activeStudent = students.find((s) => s.id === selectedStudentId) || students[0];
  const activeClass = classes.find((c) => c.id === activeStudent?.class_id);

  // Compute metrics for active student
  const studentAtt = attendance.filter((a) => a.student_id === activeStudent?.id);
  const totalAttSessions = studentAtt.length;
  const presentSessions = studentAtt.filter((a) => a.status === 'present').length;
  const absentSessions = totalAttSessions - presentSessions;
  const attRate = totalAttSessions > 0 ? Math.round((presentSessions / totalAttSessions) * 100) : 100;

  // Payments for active student
  const studentPayments = payments.filter((p) => p.student_id === activeStudent?.id);
  const paidAmount = studentPayments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const unpaidAmount = studentPayments.filter((p) => p.status === 'unpaid').reduce((sum, p) => sum + p.amount, 0);

  // Assignments for active student
  const classAssignments = assignments.filter((a) => a.class_id === activeStudent?.class_id);
  const studentSubmissions = submissions.filter((s) => s.student_id === activeStudent?.id);
  const submittedCount = studentSubmissions.filter((s) => s.status === 'submitted').length;
  const scoredSubmissions = studentSubmissions.filter((s) => s.score !== null);
  const avgScore = scoredSubmissions.length > 0
    ? Math.round(scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / scoredSubmissions.length)
    : null;

  // Comparison list for all students
  const studentStatsList = students.map((st) => {
    const cls = classes.find((c) => c.id === st.class_id);
    const att = attendance.filter((a) => a.student_id === st.id);
    const total = att.length;
    const present = att.filter((a) => a.status === 'present').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;

    const pmts = payments.filter((p) => p.student_id === st.id);
    const unpaid = pmts.filter((p) => p.status === 'unpaid').reduce((sum, p) => sum + p.amount, 0);

    const subs = submissions.filter((s) => s.student_id === st.id);
    const scored = subs.filter((s) => s.score !== null);
    const avg = scored.length > 0 ? Math.round(scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length) : null;

    return {
      student: st,
      classItem: cls,
      attRate: rate,
      absentCount: total - present,
      unpaidDebt: unpaid,
      submittedCount: subs.filter((s) => s.status === 'submitted').length,
      avgScore: avg,
    };
  });

  const filteredStatsList = studentStatsList.filter(({ student }) => {
    const matchSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        student.phone.includes(searchQuery);
    const matchClass = classFilter === 'all' || student.class_id === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-xs">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-blue-600" />
          Thống kê kết quả & Dashboard từng học viên
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdmin ? 'Theo dõi tổng hợp chuyên cần, học phí, bài tập và điểm số cá nhân của học viên.' : 'Theo dõi tổng hợp chuyên cần, bài tập và điểm số cá nhân của học viên.'}
        </p>

        {/* Student Dropdown Switcher */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <label className="text-xs font-bold text-slate-700 shrink-0">Chọn học viên xem Dashboard:</label>
          <select
            value={activeStudent?.id}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-800"
          >
            {students.map((st) => {
              const cls = classes.find((c) => c.id === st.class_id);
              return (
                <option key={st.id} value={st.id}>
                  {st.full_name} ({cls?.name})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Individual Student Dashboard (Optimized for Mobile) */}
      {activeStudent && (
        <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-3xl p-5 sm:p-6 border border-blue-200 shadow-sm space-y-4">
          
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-blue-600 text-white">
                {activeStudent.level}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                {activeStudent.full_name}
              </h3>
              <p className="text-xs text-slate-500">
                {activeClass?.name} • SĐT: {activeStudent.phone} • Nhập học: {activeStudent.join_date}
              </p>
            </div>
          </div>

          {/* 4 Mobile-Friendly Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Metric 1: Attendance Rate */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold">Tỷ lệ đi học</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">{attRate}%</div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${attRate}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
                Vắng {absentSessions} trên {totalAttSessions} buổi
              </p>
            </div>

            {/* Metric 2: Unpaid Tuition (chỉ admin) */}
            {isAdmin && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold">Học phí còn thiếu</span>
                <CreditCard className="w-4 h-4 text-rose-500" />
              </div>
              <div className={`text-xl font-black ${unpaidAmount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {unpaidAmount > 0 ? `${unpaidAmount.toLocaleString('vi-VN')} đ` : 'Đã hoàn thành'}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                Đã đóng: {paidAmount.toLocaleString('vi-VN')} đ
              </p>
            </div>

            )}

            {/* Metric 3: Homework Submissions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold">Bài tập hoàn thành</span>
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-purple-700">
                {submittedCount}/{classAssignments.length}
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-purple-600 h-full rounded-full"
                  style={{ width: `${classAssignments.length > 0 ? (submittedCount / classAssignments.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
                Tỷ lệ: {classAssignments.length > 0 ? Math.round((submittedCount / classAssignments.length) * 100) : 0}% bài nộp
              </p>
            </div>

            {/* Metric 4: GPA Score */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold">Điểm trung bình</span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">
                {avgScore ? `${avgScore}/100` : '--'}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                {avgScore && avgScore >= 90 ? 'Xếp loại: Xuất sắc (優)' : avgScore && avgScore >= 80 ? 'Xếp loại: Giỏi (良)' : 'Đạt yêu cầu'}
              </p>
            </div>

          </div>

        </div>
      )}

      {/* Comparison Table / All Students Roster */}
      <div className="bg-white rounded-3xl p-5 border border-blue-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Bảng tổng hợp tất cả học viên ({students.length} học viên)
          </h3>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Tìm học viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-3">Học viên</th>
                <th className="py-2.5 px-3">Lớp</th>
                <th className="py-2.5 px-3 text-center">Chuyên cần</th>
                <th className="py-2.5 px-3 text-center">Số buổi vắng</th>
                {isAdmin && <th className="py-2.5 px-3 text-center">Học phí nợ</th>}
                <th className="py-2.5 px-3 text-center">Điểm TB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStatsList.map((row) => (
                <tr
                  key={row.student.id}
                  onClick={() => setSelectedStudentId(row.student.id)}
                  className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                    activeStudent?.id === row.student.id ? 'bg-blue-50/70 font-semibold' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-slate-900">{row.student.full_name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{row.classItem?.name}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      row.attRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {row.attRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600">{row.absentCount} buổi</td>
                  {isAdmin && (
                  <td className="py-2.5 px-3 text-center font-bold">
                    {row.unpaidDebt > 0 ? (
                      <span className="text-rose-600">{row.unpaidDebt.toLocaleString('vi-VN')} đ</span>
                    ) : (
                      <span className="text-emerald-700">Đã đủ</span>
                    )}
                  </td>
                  )}
                  <td className="py-2.5 px-3 text-center font-black text-amber-600">
                    {row.avgScore ? `${row.avgScore}/100` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
