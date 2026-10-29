import React from 'react';
import { currentTuitionMonth } from '../../../shared/utils/tuitionMonth';
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
  Attendance, 
  Payment, 
  Assignment, 
  Submission, 
  ActiveTab 
} from '../../../shared/types';

interface DashboardViewProps {
  classes: ClassItem[];
  students: Student[];
  attendance: Attendance[];
  payments: Payment[];
  assignments: Assignment[];
  submissions: Submission[];
  onNavigateTab: (tab: ActiveTab, preselectedClassId?: string) => void;
  onOpenCreateClass: () => void;
  onOpenCreateStudent: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  classes,
  students,
  attendance,
  payments,
  assignments,
  submissions,
  onNavigateTab,
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
  const ungradedSubmissionsCount = submissions.filter((s) => s.status === 'submitted' && s.score === null).length;
  const totalAssignmentsCount = assignments.length;

  // Today schedule check (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  const todayDayIndex = new Date().getDay();
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const todayName = dayNames[todayDayIndex];

  // Classes that have schedule on today
  const todayClasses = classes.filter((c) => (c.scheduleDays as number[] | undefined)?.includes(todayDayIndex));

  // Today's date YYYY-MM-DD
  const todayDateStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5 pb-16 md:pb-6">
      
      {/* Welcome Banner Card */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg shadow-blue-900/15 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/15 text-blue-100 backdrop-blur-xs mb-2 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Quản lý lớp học cá nhân • ThS. Nguyễn Thanh Quang
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Xin chào Thầy Quang 👋
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-xl leading-relaxed">
              Hôm nay là <span className="font-bold text-white">{todayName}</span>. 
              {todayClasses.length > 0 
                ? ` Thầy có ${todayClasses.length} lớp học tiếng Nhật cần điểm danh.`
                : ' Không có lịch học cố định hôm nay. Thầy có thể kiểm tra học phí và chấm bài tập.'}
            </p>
          </div>

          {/* Quick Action in Header */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('attendance')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-amber-900/20 active:scale-95 cursor-pointer"
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
          onClick={() => onNavigateTab('classes')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-100/80 shadow-xs hover:border-blue-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Lớp học</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalClasses}</div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1 flex items-center justify-between">
            <span>Đang hoạt động</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

        {/* Card 2: Students */}
        <div 
          onClick={() => onNavigateTab('students')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-100/80 shadow-xs hover:border-blue-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Học viên</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalStudents}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center justify-between">
            <span>Tổng số học viên</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

        {/* Card 3: Tuition Unpaid */}
        <div 
          onClick={() => onNavigateTab('tuition')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-100/80 shadow-xs hover:border-amber-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Học phí</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              unpaidCount > 0 ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl sm:text-3xl font-black ${unpaidCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {unpaidCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">chưa đóng</span>
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center justify-between">
            <span>Tháng {currentMonth}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

        {/* Card 4: Assignments */}
        <div 
          onClick={() => onNavigateTab('homework')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-100/80 shadow-xs hover:border-purple-300 transition-all cursor-pointer group active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Bài tập</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {totalAssignmentsCount}
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-1 flex items-center justify-between">
            <span>
              {ungradedSubmissionsCount > 0 ? `${ungradedSubmissionsCount} bài chưa chấm` : 'Đã chấm đầy đủ'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>

      </div>

      {/* Lịch học hôm nay & Lớp học trong ngày */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-blue-100 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Lịch học hôm nay ({todayName})
              </h3>
              <p className="text-xs text-slate-500">
                {todayClasses.length > 0
                  ? `Có ${todayClasses.length} lớp diễn ra hôm nay. Thầy bấm nút để vào điểm danh ngay.`
                  : 'Không có lớp cố định hôm nay. Thầy có thể xem toàn bộ các lớp bên dưới.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('classes')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            Tất cả lớp ({classes.length})
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayClasses.length === 0 ? (
          <div className="p-6 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Hôm nay ({todayName}) không có lịch dạy cố định</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Thầy có thể chọn lớp bất kỳ trong tab Lớp học hoặc thực hiện điểm danh bù.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={() => onNavigateTab('attendance')}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors"
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
                  className="p-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/30 to-white hover:border-blue-300 transition-all flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-600 text-white">
                        {cls.level}
                      </span>
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Đã điểm danh: {presentTodayCount}/{classStudents.length}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Chưa điểm danh hôm nay
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{cls.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {cls.schedule}
                    </p>
                    {cls.room && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
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
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95'
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
        
        {/* Tuition Debt Widget */}
        <div className="bg-white rounded-3xl p-5 border border-blue-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Học phí chưa đóng ({currentMonth})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {unpaidCount} học viên còn nợ học phí tháng này
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('tuition')}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>

            {unpaidPayments.length === 0 ? (
              <div className="p-4 bg-emerald-50 rounded-2xl text-center text-xs text-emerald-800 font-medium">
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
                      className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-amber-50/50 rounded-xl border border-slate-100 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{student?.full_name}</p>
                        <p className="text-[10px] text-slate-500">{cls?.name} • SĐT: {student?.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-amber-700">
                          {p.amount.toLocaleString('vi-VN')} đ
                        </span>
                        <p className="text-[10px] text-rose-500 font-semibold">Chưa đóng</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Tổng công nợ cần thu:</span>
            <span className="font-extrabold text-rose-600 text-sm">
              {unpaidAmount.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        {/* Assignments & Homework Widget */}
        <div className="bg-white rounded-3xl p-5 border border-blue-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Bài tập các lớp gần đây
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {assignments.length} bài tập đã giao
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('homework')}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Quản lý bài tập
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {assignments.slice(0, 3).map((asg) => {
                const cls = classes.find((c) => c.id === asg.class_id);
                const classStudentCount = students.filter((s) => s.class_id === asg.class_id).length;
                const submittedCount = submissions.filter((s) => s.assignment_id === asg.id && s.status === 'submitted').length;

                return (
                  <div 
                    key={asg.id}
                    className="p-2.5 bg-slate-50 hover:bg-purple-50/50 rounded-xl border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800">
                        {cls?.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Hạn: {asg.deadline}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{asg.title}</h4>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>Đã nộp: <strong className="text-purple-700">{submittedCount}/{classStudentCount}</strong></span>
                      <span className="text-blue-600 font-semibold cursor-pointer" onClick={() => onNavigateTab('homework')}>
                        Chấm điểm →
                      </span>
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
              className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              + Tạo bài tập mới
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
