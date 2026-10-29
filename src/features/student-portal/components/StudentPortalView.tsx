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
  X,
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
} from '../../../shared/types';
import { CameraQRScanner } from '../../../shared/components/CameraQRScanner';
import { compressImage } from '../../../shared/utils/compressImage';
import { studentGreeting } from '../../../shared/utils/greeting';

interface StudentPortalViewProps {
  currentUser: User;
  classes: ClassItem[];
  assignments: Assignment[];
  submissions: Submission[];
  attendanceRecords: AttendanceRecord[];
  tuitionRecords: TuitionRecord[];
  notifications: NotificationItem[];
  onCheckinQR: (qrPayload: string) => Promise<any>;
  onSubmitHomework: (assignmentId: string, content: string, attachmentUrl?: string) => Promise<any>;
  onMarkNotificationRead: (id: string) => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  currentUser,
  classes,
  assignments,
  submissions,
  attendanceRecords,
  tuitionRecords,
  notifications,
  onCheckinQR,
  onSubmitHomework,
  onMarkNotificationRead,
}) => {
  const [activeTab, setActiveTab] = useState<StudentTab>('home');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Selected assignment for viewing details or submitting
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionContent, setSubmissionContent] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected submission for viewing AI feedback
  const [viewFeedbackSubmission, setViewFeedbackSubmission] = useState<Submission | null>(null);

  // Student specific records
  const mySubmissions = submissions.filter((s) => s.student_id === currentUser.id);
  const myAttendance = attendanceRecords.filter((r) => r.student_id === currentUser.id);
  const myTuition = tuitionRecords.filter((t) => t.student_id === currentUser.id);
  const myNotifs = notifications.filter((n) => !n.user_id || n.user_id === currentUser.id);
  const unreadNotifsCount = myNotifs.filter((n) => !n.is_read).length;

  // Enrolled class
  const myClass = classes[0] || {
    id: 'cls-n5-01',
    name: 'N5 Sơ cấp 1 (Minna no Nihongo)',
    schedule: 'Thứ 2 - 4 - 6 (18:00 - 19:30)',
  };

  // Calculations
  const presentCount = myAttendance.filter((r) => r.status === 'present').length;
  const attendanceRate = myAttendance.length > 0 ? Math.round((presentCount / myAttendance.length) * 100) : 100;

  const currentMonthTuition = myTuition[0] || {
    month: '10/2026',
    amount: 800000,
    paid_amount: 0,
    status: 'unpaid',
  };

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
    setIsSubmitModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    if (!submissionContent.trim() && !attachmentBase64) {
      alert('Vui lòng nhập nội dung bài làm hoặc đính kèm ảnh/tệp tin.');
      return;
    }

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
          <img
            src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
            alt={currentUser.full_name}
            className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-md"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">{currentUser.full_name}</h2>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                Học viên
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{currentUser.student_code ? `MSSV: ${currentUser.student_code} • ` : ''}{myClass.name}</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('notifications')}
          className="relative p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
          )}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto space-y-4">

        {/* 1. HOME SCREEN */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Greeting banner với ảnh đám mây, cùng kiểu với khung chào của giáo viên */}
            <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-blue-900/15">
              <img
                src="/images/welcome-banner.jpg"
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-900/70 to-blue-900/30 pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xl font-black tracking-tight">{studentGreeting(currentUser.full_name, currentUser.gender)} 👋</h3>
                <p className="text-xs text-blue-100/90 mt-1">Chúc bạn một buổi học hiệu quả hôm nay.</p>
              </div>
            </div>

            {/* Quick Action Banner: QR Attendance Check-in */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-5 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-blue-200">
                    EduScan Điểm Danh
                  </span>
                  <h3 className="text-base font-extrabold mt-0.5">Quét mã QR tại lớp</h3>
                  <p className="text-xs text-blue-100/90 mt-1">
                    Mở Camera để check-in tức thì trong vài giây.
                  </p>
                </div>

                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="flex flex-col items-center justify-center w-16 h-16 bg-white text-blue-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold text-xs shrink-0"
                >
                  <QrCode className="w-7 h-7 mb-0.5 text-blue-600" />
                  <span>Quét QR</span>
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setActiveTab('attendance')}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-4 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Chuyên cần</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-slate-900">{attendanceRate}%</div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Có mặt {presentCount}/{myAttendance.length} buổi
                </p>
              </div>

              <div
                onClick={() => setActiveTab('tuition')}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-4 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Học phí T10</span>
                  <CreditCard className="w-4 h-4 text-amber-400" />
                </div>
                <div className={`text-lg font-black ${currentMonthTuition.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {currentMonthTuition.status === 'paid' ? 'Đã hoàn tất' : 'Chưa đóng'}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {currentMonthTuition.amount.toLocaleString('vi-VN')} đ
                </p>
              </div>
            </div>

            {/* Upcoming Assignments Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Bài tập mới nhất
                </h4>
                <button
                  onClick={() => setActiveTab('assignments')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-300 cursor-pointer"
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
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                          {asg.class_name || 'Lớp học'}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Hạn: {asg.deadline.split('T')[0]}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 truncate">{asg.title}</h5>
                    </div>

                    {isGraded ? (
                      <button
                        onClick={() => setViewFeedbackSubmission(sub)}
                        className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Sparkles className="w-3 h-3" />
                        {sub.score}đ • Xem AI
                      </button>
                    ) : isSubmitted ? (
                      <span className="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold shrink-0">
                        Đã nộp bài
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenSubmit(asg)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
                      >
                        Nộp bài
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Schedule Card */}
            <div className="p-4 bg-slate-100/60 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <Calendar className="w-4 h-4 text-blue-600" />
                Lịch học lớp tiếng Nhật
              </div>
              <p className="text-xs text-slate-900 font-semibold">{myClass.name}</p>
              <p className="text-xs text-blue-600 font-medium">{myClass.schedule}</p>
            </div>

          </div>
        )}

        {/* 2. ASSIGNMENTS TAB */}
        {activeTab === 'assignments' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
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
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                            {asg.class_name || 'Minna no Nihongo'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{asg.title}</h4>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isGraded
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isSubmitted
                            ? 'bg-blue-50 text-blue-300'
                            : 'bg-rose-500/20 text-rose-300'
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
                        <span>Hạn nộp: <strong className="text-slate-200">{asg.deadline.split('T')[0]}</strong></span>
                        
                        {isGraded ? (
                          <button
                            onClick={() => setViewFeedbackSubmission(sub)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold cursor-pointer transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Điểm: {sub.score}/10 • Xem AI
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenSubmit(asg)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md cursor-pointer transition-all"
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
              <div className="text-4xl font-black text-blue-600">{attendanceRate}%</div>
              <p className="text-xs text-slate-600">
                Bạn đã có mặt <strong className="text-emerald-400">{presentCount}</strong> trên tổng số {myAttendance.length} buổi học.
              </p>

              <button
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
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
                      <p className="text-[10px] text-slate-500">Thời gian: {rec.check_in_time.replace('T', ' ').slice(0, 16)}</p>
                      {rec.notes && <p className="text-[10px] text-blue-600 italic mt-0.5">{rec.notes}</p>}
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
                        rec.status === 'present'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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
              <span className="text-xs font-semibold text-slate-500">Tình trạng học phí tháng hiện tại (10/2026)</span>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-black text-slate-900">
                  {currentMonthTuition.amount.toLocaleString('vi-VN')} đ
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    currentMonthTuition.status === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {currentMonthTuition.status === 'paid' ? '✅ Đã hoàn tất' : '⏳ Chưa thanh toán'}
                </span>
              </div>

              {currentMonthTuition.status === 'unpaid' && (
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <p className="font-bold text-slate-200">Thông tin chuyển khoản học phí:</p>
                  <p className="text-slate-600">Ngân hàng: <strong>Techcombank</strong></p>
                  <p className="text-slate-600">Số tài khoản: <strong>4221498665197589</strong></p>
                  <p className="text-slate-600">Chủ tài khoản: <strong>NGUYEN THANH QUANG</strong></p>
                  <p className="text-blue-600">Nội dung: <strong>HP {currentUser.student_code ? `${currentUser.student_code} ` : ''}{currentUser.full_name}</strong></p>
                </div>
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
                    <p className="text-[11px] text-slate-500">{t.amount.toLocaleString('vi-VN')} đ</p>
                    {t.notes && <p className="text-[10px] text-slate-500">{t.notes}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                    t.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
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
              <Bell className="w-4 h-4 text-blue-600" />
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
                  onClick={() => onMarkNotificationRead(n.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    !n.is_read
                      ? 'bg-blue-950/40 border-blue-500/50 shadow-sm ring-1 ring-blue-500/30'
                      : 'bg-slate-50 border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{n.title}</span>
                    <span className="text-[10px] text-slate-500">
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
            activeTab === 'home' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Trang chủ</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'assignments' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px]">Bài tập</span>
        </button>

        {/* Center QR Scan Button */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex flex-col items-center -mt-5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-3 rounded-full shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-white"
          title="Quét mã QR điểm danh"
        >
          <QrCode className="w-6 h-6" />
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'attendance' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-[10px]">Điểm danh</span>
        </button>

        <button
          onClick={() => setActiveTab('tuition')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'tuition' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px]">Học phí</span>
        </button>
      </nav>

      {/* Modal: Student Submit Assignment */}
      {isSubmitModalOpen && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-5 w-full max-w-sm space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] text-blue-600 font-bold">Nộp bài tập</span>
                <h4 className="text-sm font-bold text-slate-900 truncate">{selectedAssignment.title}</h4>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Nội dung bài làm (soạn thảo):
                </label>
                <textarea
                  rows={4}
                  placeholder="Nhập câu trả lời, dịch câu hoặc bài làm của em tại đây..."
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              {/* Upload Attachment (Photo / Document) */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Đính kèm hình ảnh hoặc tệp tin (PDF/DOCX/Ảnh):
                </label>
                <label className="flex items-center justify-center gap-2 w-full py-3 px-3 bg-slate-100/90 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-600 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span className="truncate">{attachmentName || 'Chọn tệp hoặc chụp ảnh bài làm'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

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
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Đang gửi...' : 'Nộp bài ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View AI Feedback & Detailed Grading */}
      {viewFeedbackSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold text-slate-900">Kết quả chấm & Nhận xét AI</h4>
              </div>
              <button
                onClick={() => setViewFeedbackSubmission(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Banner */}
            <div className="bg-gradient-to-r from-indigo-900/60 to-blue-900/60 border border-indigo-500/30 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[11px] font-semibold text-indigo-300">Điểm tổng kết</span>
              <div className="text-3xl font-black text-slate-900">{viewFeedbackSubmission.score}/10</div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200">
                {viewFeedbackSubmission.grade_classification || 'Xuất sắc'}
              </span>
            </div>

            {/* Teacher / AI Detailed Feedback */}
            {viewFeedbackSubmission.feedback && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Nhận xét chi tiết từ giảng viên & AI:</label>
                <p className="text-xs text-slate-200 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                  {viewFeedbackSubmission.feedback}
                </p>
              </div>
            )}

            {/* Strengths */}
            {viewFeedbackSubmission.strengths && viewFeedbackSubmission.strengths.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
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
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
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
        </div>
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
