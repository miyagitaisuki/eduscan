import { clickable } from '../../../shared/utils/a11y';
import React, { useState } from 'react';
import {
  Home,
  FileText,
  QrCode,
  CreditCard,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Calendar,
  Sparkles,
  ChevronRight,
  Send,
  FileCheck,
  User as UserIcon,
  BookOpen,
  Award,
} from 'lucide-react';
import {
  User,
  Assignment,
  Submission,
  AttendanceRecord,
  TuitionRecord,
  NotificationItem,
  StudentTab,
  ClassItem,
  Lesson,
} from '../../../shared/types';
import { LessonScheduleModal } from '../../schedule';
import { shortLessonDate } from '../../../shared/utils/lessonDates';
import { CameraQRScanner } from '../../../shared/components/CameraQRScanner';
import { Modal } from '../../../shared/components/ui';
import { compressImage } from '../../../shared/utils/compressImage';
import { formatScore, scoreGrade } from '../../../shared/utils/score';
import { studentGreeting } from '../../../shared/utils/greeting';
import { currentTuitionMonth } from '../../../shared/utils/tuitionMonth';
import { todayLocal } from '../../../shared/utils/date';

interface StudentPortalViewProps {
  currentUser: User;
  classes: ClassItem[];
  /** Buổi học sắp tới của lớp mình đang học */
  lessons?: Lesson[];
  assignments: Assignment[];
  submissions: Submission[];
  attendanceRecords: AttendanceRecord[];
  tuitionRecords: TuitionRecord[];
  notifications: NotificationItem[];
  onCheckinQR: (qrPayload: string) => Promise<any>;
  onSubmitHomework: (assignmentId: string, content: string, attachmentUrl?: string) => Promise<any>;
  onMarkNotificationRead: (id: string) => void;
  /** Tab đang mở, do đường dẫn quyết định (/home, /assignments...) */
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  currentUser,
  classes,
  lessons = [],
  assignments,
  submissions,
  attendanceRecords,
  tuitionRecords,
  notifications,
  onCheckinQR,
  onSubmitHomework,
  onMarkNotificationRead,
  activeTab,
  onTabChange: setActiveTab,
}) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Selected assignment for viewing details or submitting
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionContent, setSubmissionContent] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Selected submission for viewing AI feedback
  const [viewFeedbackSubmission, setViewFeedbackSubmission] = useState<Submission | null>(null);

  // Student specific records
  const mySubmissions = submissions.filter((s) => s.student_id === currentUser.id);
  const myAttendance = attendanceRecords.filter((r) => r.student_id === currentUser.id);
  const myTuition = tuitionRecords.filter((t) => t.student_id === currentUser.id);
  const myNotifs = notifications.filter((n) => !n.user_id || n.user_id === currentUser.id);
  const unreadNotifsCount = myNotifs.filter((n) => !n.is_read).length;

  // Lớp đang học (server chỉ trả các lớp học viên đã ghi danh); null nếu chưa được xếp lớp
  const myClass = classes[0] ?? null;

  // Calculations
  // Tỷ lệ = (tổng buổi trong lịch lớp − số buổi vắng) / tổng buổi trong lịch.
  // Buổi chưa điểm danh không bị tính vắng; buổi đã hủy không nằm trong lịch.
  const scheduledLessons = myClass ? lessons.filter((l) => l.class_id === myClass.id && l.status !== 'cancelled') : [];
  const totalLessons = scheduledLessons.length;
  const absentCount = myAttendance.filter((r) => r.status === 'absent').length;
  const attendanceRate =
    totalLessons > 0 ? Math.max(0, Math.round(((totalLessons - absentCount) / totalLessons) * 100)) : 100;

  // Học phí của tháng hiện tại; null nếu giáo viên chưa lập hồ sơ học phí tháng này
  const tuitionMonth = currentTuitionMonth();
  const currentMonthTuition = myTuition.find((t) => t.month === tuitionMonth) ?? null;
  const initials = currentUser.full_name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || '?';

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    setAttachmentBase64('');
    // Nén ảnh trước khi đọc thành base64 để tránh gửi ảnh chụp gốc vài MB
    const toSend = await compressImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentBase64(reader.result as string);
    };
    reader.readAsDataURL(toSend);
  };

  const handleOpenSubmit = (asg: Assignment) => {
    setSelectedAssignment(asg);
    const existing = mySubmissions.find((s) => s.assignment_id === asg.id);
    if (existing) {
      setSubmissionContent(existing.content || '');
      setAttachmentName(existing.attachment_url ? 'Tệp tin đã tải lên' : '');
    } else {
      setSubmissionContent('');
      setAttachmentName('');
      setAttachmentBase64('');
    }
    setSubmitError('');
    setIsSubmitModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    if (!submissionContent.trim() && !attachmentBase64) {
      setSubmitError('Vui lòng nhập nội dung bài làm hoặc đính kèm ảnh/tệp tin.');
      return;
    }
    setSubmitError('');

    setIsSubmitting(true);
    try {
      await onSubmitHomework(selectedAssignment.id, submissionContent, attachmentBase64 || attachmentName);
      setIsSubmitModalOpen(false);
      setSubmissionContent('');
      setAttachmentBase64('');
      setAttachmentName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white text-slate-900 flex flex-col shadow-2xl relative border-x border-slate-200">
      
      {/* Mobile App Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.full_name}
              className="w-10 h-10 rounded-full object-cover border-2 border-primary-500 shadow-md"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center text-base font-black border-2 border-primary-200 shadow-md"
            >
              {initials}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">{currentUser.full_name}</h2>
              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 border border-primary-200">
                Học viên
              </span>
            </div>
            <p className="text-xs text-slate-500">{currentUser.student_code ? `MSSV: ${currentUser.student_code}` : ''}{currentUser.student_code && myClass ? ' • ' : ''}{myClass ? myClass.name : !currentUser.student_code ? 'Chưa được xếp lớp' : ''}</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('notifications')}
          aria-label={unreadNotifsCount > 0 ? `Thông báo, ${unreadNotifsCount} chưa đọc` : 'Thông báo'}
          className="relative p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger-500 rounded-full ring-2 ring-white animate-pulse" />
          )}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto space-y-4">

        {/* 1. HOME SCREEN */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Greeting banner với ảnh đám mây, cùng kiểu với khung chào của giáo viên */}
            <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-primary-900/15">
              <img
                src="/images/welcome-banner.jpg"
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/70 to-primary-900/30 pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xl font-black tracking-tight">{studentGreeting(currentUser.full_name, currentUser.gender)} 👋</h3>
                <p className="text-xs text-primary-100/90 mt-1">Chúc bạn một buổi học hiệu quả hôm nay.</p>
              </div>
            </div>

            {/* Quick Action Banner: QR Attendance Check-in */}
            <div className="bg-gradient-to-br from-primary-600 via-accent-600 to-primary-700 rounded-3xl p-5 text-white shadow-xl shadow-primary-500/15 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-black tracking-widest text-primary-200">
                    EduScan Điểm Danh
                  </span>
                  <h3 className="text-base font-extrabold mt-0.5">Quét mã QR tại lớp</h3>
                  <p className="text-xs text-primary-100/90 mt-1">
                    Mở Camera để check-in tức thì trong vài giây.
                  </p>
                </div>

                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="flex flex-col items-center justify-center w-16 h-16 bg-white text-primary-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold text-xs shrink-0"
                >
                  <QrCode className="w-7 h-7 mb-0.5 text-primary-600" />
                  <span>Quét QR</span>
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div
                {...clickable(() => setActiveTab('attendance'))}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-4 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Chuyên cần</span>
                  <CheckCircle2 className="w-4 h-4 text-success-700" />
                </div>
                <div className="text-2xl font-black text-slate-900">{attendanceRate}%</div>
                <p className="text-xs text-slate-500 mt-1">
                  Vắng {absentCount}/{totalLessons} buổi
                </p>
              </div>

              <div
                {...clickable(() => setActiveTab('tuition'))}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-4 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Học phí T{Number(tuitionMonth.split('/')[0])}</span>
                  <CreditCard className="w-4 h-4 text-warning-700" />
                </div>
                {currentMonthTuition ? (
                  <>
                    <div className={`text-lg font-black ${currentMonthTuition.status === 'paid' ? 'text-success-700' : 'text-warning-700'}`}>
                      {currentMonthTuition.status === 'paid' ? 'Đã hoàn tất' : 'Chưa đóng'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {currentMonthTuition.amount.toLocaleString('vi-VN')} đ
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-500">Chưa có</div>
                    <p className="text-xs text-slate-500 mt-1">Chưa có học phí tháng này</p>
                  </>
                )}
              </div>
            </div>

            {/* Upcoming Assignments Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary-600" />
                  Bài tập mới nhất
                </h4>
                <button
                  onClick={() => setActiveTab('assignments')}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
                >
                  Xem tất cả
                </button>
              </div>

              {assignments.slice(0, 3).map((asg) => {
                const sub = mySubmissions.find((s) => s.assignment_id === asg.id);
                const isGraded = sub?.status === 'graded';
                const isSubmitted = sub?.status === 'submitted' || isGraded;

                return (
                  <div
                    key={asg.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 border border-primary-200">
                          {asg.class_name || 'Lớp học'}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Hạn: {asg.deadline.split('T')[0]}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 truncate">{asg.title}</h5>
                    </div>

                    {isGraded ? (
                      <button
                        onClick={() => setViewFeedbackSubmission(sub)}
                        className="px-2.5 py-1.5 bg-success-100 hover:bg-success-100 text-success-800 border border-success-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Sparkles className="w-3 h-3" />
                        {sub.score}đ • Xem AI
                      </button>
                    ) : isSubmitted ? (
                      <span className="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold shrink-0">
                        Đã nộp bài
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenSubmit(asg)}
                        className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/20 cursor-pointer shrink-0"
                      >
                        Nộp bài
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hôm nay học gì: buổi học của lớp mình trong ngày */}
            {myClass && (() => {
              const today = todayLocal();
              const todayLesson = lessons.find((l) => l.class_id === myClass.id && l.lesson_date === today);
              const cancelled = todayLesson?.status === 'cancelled';
              return (
                <div className="p-4 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/60 to-white space-y-1.5">
                  <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary-600" />
                    Hôm nay học gì
                  </p>
                  {!todayLesson ? (
                    <p className="text-xs text-slate-500">Hôm nay lớp không có buổi học.</p>
                  ) : cancelled ? (
                    <p className="text-xs font-bold text-danger-700">Buổi học hôm nay đã được hủy.</p>
                  ) : (
                    <>
                      <p className="text-sm font-extrabold text-slate-900">{todayLesson.title || 'Giáo viên chưa cập nhật nội dung'}</p>
                      <p className="text-xs text-slate-600">
                        {todayLesson.start_time} - {todayLesson.end_time}
                        {todayLesson.notes ? ` • ${todayLesson.notes}` : ''}
                      </p>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Schedule Card */}
            <div className="p-4 bg-slate-100/60 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <Calendar className="w-4 h-4 text-primary-600" />
                Lịch học lớp tiếng Nhật
              </div>
              {myClass ? (
                <>
                  <p className="text-xs text-slate-900 font-semibold">{myClass.name}</p>
                  <p className="text-xs text-primary-600 font-medium">{myClass.schedule || 'Chưa có lịch học'}</p>
                  {(() => {
                    const upcoming = lessons.filter((l) => l.class_id === myClass.id && l.state === 'upcoming').slice(0, 3);
                    return (
                      <>
                        {upcoming.length > 0 && (
                          <ul className="space-y-1.5 pt-1">
                            {upcoming.map((l) => (
                              <li key={l.id} className="flex items-start gap-2 text-xs p-2 bg-white rounded-xl border border-slate-200">
                                <span className="font-extrabold text-slate-800 w-16 shrink-0">{shortLessonDate(l.lesson_date)}</span>
                                <span className="text-slate-600">
                                  <span className="font-medium">{l.start_time} - {l.end_time}</span>
                                  {l.title ? ` • ${l.title}` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsScheduleOpen(true)}
                          className="text-xs font-bold text-primary-700 hover:text-primary-800 cursor-pointer"
                        >
                          Xem toàn bộ lịch học
                        </button>
                      </>
                    );
                  })()}
                </>
              ) : (
                <p className="text-xs text-slate-500">Bạn chưa được xếp vào lớp nào. Hãy liên hệ giáo viên.</p>
              )}
            </div>

          </div>
        )}

        {/* 2. ASSIGNMENTS TAB */}
        {activeTab === 'assignments' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                Danh sách bài tập ({assignments.length})
              </h3>
            </div>

            {assignments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Hiện tại chưa có bài tập nào được giao.
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((asg) => {
                  const sub = mySubmissions.find((s) => s.assignment_id === asg.id);
                  const isGraded = sub?.status === 'graded';
                  const isSubmitted = sub?.status === 'submitted' || isGraded;

                  return (
                    <div
                      key={asg.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary-50 text-primary-600">
                            {asg.class_name || 'Minna no Nihongo'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{asg.title}</h4>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isGraded
                            ? 'bg-success-100 text-success-800'
                            : isSubmitted
                            ? 'bg-primary-50 text-primary-700'
                            : 'bg-danger-100 text-danger-800'
                        }`}>
                          {isGraded ? 'Đã chấm điểm' : isSubmitted ? 'Đã nộp bài' : 'Chưa nộp'}
                        </span>
                      </div>

                      {asg.description && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          {asg.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/50">
                        <span>Hạn nộp: <strong className="text-slate-800">{asg.deadline.split('T')[0]}</strong></span>
                        
                        {isGraded ? (
                          <button
                            onClick={() => setViewFeedbackSubmission(sub)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-success-100 hover:bg-success-200 text-success-800 border border-success-200 rounded-xl font-bold cursor-pointer transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Điểm: {sub.score}/10 • Xem AI
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenSubmit(asg)}
                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold shadow-md cursor-pointer transition-all"
                          >
                            {isSubmitted ? 'Nộp lại bài' : 'Nộp bài ngay'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header Card */}
            <div className="bg-slate-100 border border-slate-200 rounded-3xl p-5 text-center space-y-3">
              <span className="text-xs font-semibold text-slate-500">Tỷ lệ chuyên cần học kỳ</span>
              <div className="text-4xl font-black text-primary-600">{attendanceRate}%</div>
              <p className="text-xs text-slate-600">
                Bạn vắng <strong className="text-danger-700">{absentCount}</strong> trên tổng số {totalLessons} buổi học trong lịch.
              </p>

              <button
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <QrCode className="w-5 h-5" />
                Quét mã QR Điểm danh hôm nay
              </button>
            </div>

            {/* Attendance History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Lịch sử điểm danh chi tiết
              </h4>

              {myAttendance.length === 0 ? (
                <div className="p-6 bg-slate-100/40 rounded-2xl text-center text-xs text-slate-500">
                  Chưa có lịch sử điểm danh.
                </div>
              ) : (
                myAttendance.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{rec.date || rec.check_in_time.split('T')[0]}</h5>
                      <p className="text-xs text-slate-500">Thời gian: {rec.check_in_time.replace('T', ' ').slice(0, 16)}</p>
                      {rec.notes && <p className="text-xs text-primary-600 italic mt-0.5">{rec.notes}</p>}
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
                        rec.status === 'present'
                          ? 'bg-success-100 text-success-800 border border-success-200'
                          : 'bg-danger-100 text-danger-800 border border-danger-200'
                      }`}
                    >
                      {rec.status === 'present' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {rec.status === 'present' ? 'Có mặt' : 'Vắng'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. TUITION TAB */}
        {activeTab === 'tuition' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-100 border border-slate-200 rounded-3xl p-5 space-y-3">
              <span className="text-xs font-semibold text-slate-500">Tình trạng học phí tháng hiện tại ({tuitionMonth})</span>
              {currentMonthTuition ? (
              <>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-black text-slate-900">
                  {currentMonthTuition.amount.toLocaleString('vi-VN')} đ
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    currentMonthTuition.status === 'paid'
                      ? 'bg-success-100 text-success-800 border border-success-200'
                      : 'bg-warning-100 text-warning-800 border border-warning-200'
                  }`}
                >
                  {currentMonthTuition.status === 'paid' ? '✅ Đã hoàn tất' : '⏳ Chưa thanh toán'}
                </span>
              </div>

              {currentMonthTuition.status === 'unpaid' && (
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <p className="font-bold text-slate-800">Thông tin chuyển khoản học phí:</p>
                  <p className="text-slate-600">Ngân hàng: <strong>Techcombank</strong></p>
                  <p className="text-slate-600">Số tài khoản: <strong>4221498665197589</strong></p>
                  <p className="text-slate-600">Chủ tài khoản: <strong>NGUYEN THANH QUANG</strong></p>
                  <p className="text-primary-600">Nội dung: <strong>HP {currentUser.student_code ? `${currentUser.student_code} ` : ''}{currentUser.full_name}</strong></p>
                </div>
              )}
              </>
              ) : (
                <p className="text-sm text-slate-500">Chưa có học phí cho tháng này.</p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Lịch sử thanh toán học phí
              </h4>
              {myTuition.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Tháng {t.month}</h5>
                    <p className="text-xs text-slate-500">{t.amount.toLocaleString('vi-VN')} đ</p>
                    {t.notes && <p className="text-xs text-slate-500">{t.notes}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                    t.status === 'paid' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
                  }`}>
                    {t.status === 'paid' ? 'Đã đóng' : 'Chưa đóng'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
              <Bell className="w-4 h-4 text-primary-600" />
              Thông báo ({myNotifs.length})
            </h3>

            {myNotifs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Không có thông báo mới nào.
              </div>
            ) : (
              myNotifs.map((n) => (
                <div
                  key={n.id}
                  {...clickable(() => onMarkNotificationRead(n.id))}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    !n.is_read
                      ? 'bg-primary-50 border-primary-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{n.title}</span>
                    <span className="text-xs text-slate-500">
                      {n.created_at?.split('T')[0] || 'Vừa xong'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                </div>
              ))
            )}
          </div>
        )}

      </main>

      {/* Student App Bottom Navigation (Capacitor/Android Style) */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 flex items-center justify-around z-40">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home' ? 'text-primary-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-xs">Trang chủ</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'assignments' ? 'text-primary-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-xs">Bài tập</span>
        </button>

        {/* Center QR Scan Button */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex flex-col items-center -mt-5 bg-gradient-to-tr from-primary-600 to-accent-600 text-white p-3 rounded-full shadow-lg shadow-primary-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-white"
          title="Quét mã QR điểm danh"
        >
          <QrCode className="w-6 h-6" />
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'attendance' ? 'text-primary-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs">Điểm danh</span>
        </button>

        <button
          onClick={() => setActiveTab('tuition')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'tuition' ? 'text-primary-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-xs">Học phí</span>
        </button>
      </nav>

      {/* Modal: Student Submit Assignment */}
      {isSubmitModalOpen && selectedAssignment && (
        <Modal
          title={
            <>
              <span className="block text-xs text-primary-600 font-bold">Nộp bài tập</span>
              {selectedAssignment.title}
            </>
          }
          onClose={() => setIsSubmitModalOpen(false)}
          size="sm"
          closeOnBackdrop={false}
        >
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1" htmlFor="student-portal-field-1">
                  Nội dung bài làm (soạn thảo):
                </label>
                <textarea id="student-portal-field-1"
                  rows={4}
                  placeholder="Nhập câu trả lời, dịch câu hoặc bài làm của em tại đây..."
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-primary-500 resize-none"
                />
              </div>

              {/* Upload Attachment (Photo / Document) */}
              <div>
                <span className="text-xs font-semibold text-slate-600 block mb-1">
                  Đính kèm hình ảnh hoặc tệp tin (PDF/DOCX/Ảnh):
                </span>
                <label className="flex items-center justify-center gap-2 w-full py-3 px-3 bg-slate-100/90 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-600 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-primary-600" />
                  <span className="truncate">{attachmentName || 'Chọn tệp hoặc chụp ảnh bài làm'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {submitError && (
                <p role="alert" className="text-xs font-semibold text-danger-600 bg-danger-50 border border-danger-200 rounded-xl px-3 py-2">
                  {submitError}
                </p>
              )}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Đang gửi...' : 'Nộp bài ngay'}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* Modal: View AI Feedback & Detailed Grading */}
      {viewFeedbackSubmission && (
        <Modal
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-600" aria-hidden="true" />
              Kết quả chấm & Nhận xét AI
            </span>
          }
          onClose={() => setViewFeedbackSubmission(null)}
          size="sm"
        >
          <div className="space-y-4">

            {/* Score Banner */}
            <div className="bg-accent-50 border border-accent-200 rounded-2xl p-4 text-center space-y-1">
              <span className="text-xs font-semibold text-accent-700">Điểm tổng kết</span>
              <div className="text-3xl font-black text-slate-900">{formatScore(viewFeedbackSubmission.score)}</div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-100 text-accent-800">
                {viewFeedbackSubmission.grade_classification || scoreGrade(viewFeedbackSubmission.score).replace('Xếp loại: ', '')}
              </span>
            </div>

            {/* Teacher / AI Detailed Feedback */}
            {viewFeedbackSubmission.feedback && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-600 block">Nhận xét chi tiết từ giảng viên & AI:</span>
                <p className="text-xs text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                  {viewFeedbackSubmission.feedback}
                </p>
              </div>
            )}

            {/* Strengths */}
            {viewFeedbackSubmission.strengths && viewFeedbackSubmission.strengths.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-success-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Điểm mạnh bài làm:
                </span>
                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  {viewFeedbackSubmission.strengths.map((str, idx) => (
                    <li key={idx}>{str}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {viewFeedbackSubmission.suggestions && viewFeedbackSubmission.suggestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-warning-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Gợi ý cải thiện:
                </span>
                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  {viewFeedbackSubmission.suggestions.map((sug, idx) => (
                    <li key={idx}>{sug}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setViewFeedbackSubmission(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </Modal>
      )}

      {isScheduleOpen && myClass && (
        <LessonScheduleModal cls={myClass} canEditSchedule={false} canEditContent={false} onClose={() => setIsScheduleOpen(false)} onChanged={() => {}} />
      )}

      {/* Live Camera QR Scanner Modal */}
      <CameraQRScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={async (payload) => {
          await onCheckinQR(payload);
        }}
      />

    </div>
  );
};
