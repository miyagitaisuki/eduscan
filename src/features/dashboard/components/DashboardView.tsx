import { clickable } from '../../../shared/utils/a11y';
import React from 'react';
import { currentTuitionMonth } from '../../../shared/utils/tuitionMonth';
import { teacherGreeting, teacherTitle } from '../../../shared/utils/greeting';
import { localDateOf, todayLocal } from '../../../shared/utils/date';
import { parseScheduleDays } from '../../../shared/utils/schedule';
import { isSubmitted, needsGrading } from '../../../shared/utils/submission';
import type { Gender } from '../../../shared/types';
import { 
  BookOpen, 
  Users, 
  CreditCard, 
  FileText, 
  CheckSquare, 
  Clock, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Calendar 
} from 'lucide-react';
import { 
  ClassItem, 
  Student, 
  AttendanceRecord, 
  TuitionRecord, 
  Assignment, 
  Submission, 
  ActiveTab 
} from '../../../shared/types';

interface DashboardViewProps {
  /** Học phí chỉ hiển thị với admin */
  isAdmin?: boolean;
  classes: ClassItem[];
  students: Student[];
  attendance: AttendanceRecord[];
  payments: TuitionRecord[];
  assignments: Assignment[];
  submissions: Submission[];
  onNavigateTab: (tab: ActiveTab, preselectedClassId?: string) => void;
  onOpenCreateClass: () => void;
  onOpenCreateStudent: () => void;
  /** Họ tên giáo viên đang đăng nhập, dùng cho lời chào */
  teacherName?: string;
  teacherGender?: Gender | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  classes,
  students,
  attendance,
  payments,
  assignments,
  submissions,
  onNavigateTab,
  isAdmin = false,
  teacherName,
  teacherGender,
}) => {
  // Tháng hiện tại, ví dụ "10/2026"
  const currentMonth = currentTuitionMonth();
  
  // 1. Total active classes
  const totalClasses = classes.length;

  // 2. Total students
  const totalStudents = students.length;

  // 3. Students with unpaid tuition for current month
  const currentMonthPayments = payments.filter((p) => p.month === currentMonth);
  const unpaidPayments = currentMonthPayments.filter((p) => p.status === 'unpaid');
  const unpaidCount = unpaidPayments.length;
  const unpaidAmount = unpaidPayments.reduce((sum, p) => sum + p.amount, 0);

  // 4. Ungraded assignments / Submissions needing review
  const ungradedSubmissionsCount = submissions.filter(needsGrading).length;
  const totalAssignmentsCount = assignments.length;

  // Today schedule check (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  const todayDayIndex = new Date().getDay();
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const todayName = dayNames[todayDayIndex];

  // Classes that have schedule on today
  const todayClasses = classes.filter((c) => parseScheduleDays(c.schedule).includes(todayDayIndex));

  // Today's date YYYY-MM-DD
  const todayDateStr = todayLocal();
  const honorific = teacherTitle(teacherGender);

  return (
    <div className="space-y-5">
      
      {/* Welcome Banner Card */}
      <div className="bg-gradient-to-r from-primary-700 via-primary-800 to-accent-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg shadow-primary-900/15 relative overflow-hidden">
        {/* Background photo, darkened on the left so the white greeting stays readable */}
        <img
          src="/images/welcome-banner.jpg"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/70 to-primary-900/30 pointer-events-none" />
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-primary-100 backdrop-blur-xs mb-2 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-warning-300" />
              Quản lý lớp học cá nhân{teacherName ? ` • ${teacherName}` : ''}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {teacherGreeting(teacherName, teacherGender)} 👋
            </h2>
            <p className="text-xs sm:text-sm text-primary-100/90 mt-1 max-w-xl leading-relaxed">
              Hôm nay là <span className="font-bold text-white">{todayName}</span>. 
              {todayClasses.length > 0 
                ? ` ${honorific} có ${todayClasses.length} lớp học tiếng Nhật cần điểm danh.`
                : isAdmin ? ` Không có lịch học cố định hôm nay. ${honorific} có thể kiểm tra học phí và chấm bài tập.` : ` Không có lịch học cố định hôm nay. ${honorific} có thể chấm bài tập.`}
            </p>
          </div>

          {/* Quick Action in Header */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('attendance')}
              className="flex items-center gap-2 px-4 py-2.5 bg-warning-400 hover:bg-warning-300 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-warning-900/20 active:scale-95 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-slate-950" />
              Điểm danh nhanh
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Classes */}
        <div 
          {...clickable(() => onNavigateTab('classes'))}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-primary-100/80 shadow-xs hover:border-primary-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Lớp học</span>
            <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalClasses}</div>
          <div className="text-xs text-primary-700 font-semibold mt-1 flex items-center justify-between">
            <span>Đang hoạt động</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

        {/* Card 2: Students */}
        <div 
          {...clickable(() => onNavigateTab('students'))}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-primary-100/80 shadow-xs hover:border-primary-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Học viên</span>
            <div className="w-8 h-8 rounded-xl bg-success-50 text-success-600 flex items-center justify-center group-hover:bg-success-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalStudents}</div>
          <div className="text-xs text-success-700 font-semibold mt-1 flex items-center justify-between">
            <span>Tổng số học viên</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

        {/* Card 3: Tuition Unpaid (chỉ admin) */}
        {isAdmin && (
        <div 
          {...clickable(() => onNavigateTab('tuition'))}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-primary-100/80 shadow-xs hover:border-warning-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Học phí</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              unpaidCount > 0 ? 'bg-warning-50 text-warning-600 group-hover:bg-warning-500 group-hover:text-white' : 'bg-success-50 text-success-600'
            }`}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl sm:text-3xl font-black ${unpaidCount > 0 ? 'text-warning-600' : 'text-success-600'}`}>
              {unpaidCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">chưa đóng</span>
          </div>
          <div className="text-xs text-warning-700 font-semibold mt-1 flex items-center justify-between">
            <span>Tháng {currentMonth}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

        )}

        {/* Card 4: Assignments */}
        <div 
          {...clickable(() => onNavigateTab('homework'))}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-primary-100/80 shadow-xs hover:border-accent-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bài tập</span>
            <div className="w-8 h-8 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center group-hover:bg-accent-600 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {totalAssignmentsCount}
          </div>
          <div className="text-xs text-accent-700 font-semibold mt-1 flex items-center justify-between">
            <span>
              {ungradedSubmissionsCount > 0 ? `${ungradedSubmissionsCount} bài chưa chấm` : 'Đã chấm đầy đủ'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

      </div>

      {/* Lịch học hôm nay & Lớp học trong ngày */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-primary-100 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Lịch học hôm nay ({todayName})
              </h3>
              <p className="text-xs text-slate-500">
                {todayClasses.length > 0
                  ? `Có ${todayClasses.length} lớp diễn ra hôm nay. ${honorific} bấm nút để vào điểm danh ngay.`
                  : `Không có lớp cố định hôm nay. ${honorific} có thể xem toàn bộ các lớp bên dưới.`}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('classes')}
            className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 cursor-pointer"
          >
            Tất cả lớp ({classes.length})
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayClasses.length === 0 ? (
          <div className="p-6 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl">
            <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Hôm nay ({todayName}) không có lịch dạy cố định</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {honorific} có thể chọn lớp bất kỳ trong tab Lớp học hoặc thực hiện điểm danh bù.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={() => onNavigateTab('attendance')}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-primary-700 transition-colors"
              >
                Mở điểm danh lớp khác
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {todayClasses.map((cls) => {
              const classStudents = students.filter((s) => s.class_id === cls.id);
              const todayAtt = attendance.filter((a) => a.class_id === cls.id && a.date === todayDateStr);
              const isDone = todayAtt.length > 0;
              const presentTodayCount = todayAtt.filter((a) => a.status === 'present').length;

              return (
                <div
                  key={cls.id}
                  className="p-4 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/30 to-white hover:border-primary-300 transition-all flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black bg-primary-600 text-white">
                        {cls.level}
                      </span>
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-success-700 bg-success-50 px-2 py-0.5 rounded-full border border-success-200">
                          <CheckCircle2 className="w-3 h-3 text-success-600" />
                          Đã điểm danh: {presentTodayCount}/{classStudents.length}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-warning-700 bg-warning-50 px-2 py-0.5 rounded-full border border-warning-200">
                          <Clock className="w-3 h-3 text-warning-600" />
                          Chưa điểm danh hôm nay
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{cls.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-primary-600" />
                      {cls.schedule}
                    </p>
                    {cls.room && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        📍 {cls.room}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-medium">
                      👥 <strong className="text-slate-900">{classStudents.length}</strong> học viên
                    </span>

                    <button
                      onClick={() => onNavigateTab('attendance', cls.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                        isDone
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20 active:scale-95'
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      {isDone ? 'Sửa điểm danh' : 'Điểm danh ngay'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2-Column Section: Pending Tuition Alert & Quick Homework Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Tuition Debt Widget (chỉ admin) */}
        {isAdmin && (
        <div className="bg-white rounded-3xl p-5 border border-primary-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Học phí chưa đóng ({currentMonth})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {unpaidCount} học viên còn nợ học phí tháng này
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('tuition')}
                className="text-xs font-bold text-primary-600 hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>

            {unpaidPayments.length === 0 ? (
              <div className="p-4 bg-success-50 rounded-2xl text-center text-xs text-success-800 font-medium">
                🎉 Tất cả học viên đã hoàn thành học phí tháng {currentMonth}!
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {unpaidPayments.slice(0, 4).map((p) => {
                  const student = students.find((s) => s.id === p.student_id);
                  const cls = classes.find((c) => c.id === student?.class_id);
                  return (
                    <div 
                      key={p.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-warning-50/50 rounded-xl border border-slate-100 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{student?.full_name}</p>
                        <p className="text-xs text-slate-500">{cls?.name} • SĐT: {student?.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-warning-700">
                          {p.amount.toLocaleString('vi-VN')} đ
                        </span>
                        <p className="text-xs text-danger-600 font-semibold">Chưa đóng</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Tổng công nợ cần thu:</span>
            <span className="font-extrabold text-danger-600 text-sm">
              {unpaidAmount.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        )}

        {/* Assignments & Homework Widget */}
        <div className="bg-white rounded-3xl p-5 border border-primary-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Bài tập các lớp gần đây
                  </h3>
                  <p className="text-xs text-slate-500">
                    {assignments.length} bài tập đã giao
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('homework')}
                className="text-xs font-bold text-primary-600 hover:underline cursor-pointer"
              >
                Quản lý bài tập
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {assignments.slice(0, 3).map((asg) => {
                const cls = classes.find((c) => c.id === asg.class_id);
                const classStudentCount = students.filter((s) => s.class_id === asg.class_id).length;
                const submittedCount = submissions.filter((s) => s.assignment_id === asg.id && isSubmitted(s)).length;

                return (
                  <div 
                    key={asg.id}
                    className="p-2.5 bg-slate-50 hover:bg-accent-50/50 rounded-xl border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-primary-100 text-primary-800">
                        {cls?.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        Hạn: {localDateOf(asg.deadline)}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{asg.title}</h4>
                    <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                      <span>Đã nộp: <strong className="text-accent-700">{submittedCount}/{classStudentCount}</strong></span>
                      <button type="button" className="text-primary-600 font-semibold cursor-pointer hover:underline" onClick={() => onNavigateTab('homework')}>
                        Chấm điểm →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Thao tác nhanh:</span>
            <button
              onClick={() => onNavigateTab('homework')}
              className="text-xs font-bold text-primary-600 hover:text-primary-800 cursor-pointer"
            >
              + Tạo bài tập mới
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
