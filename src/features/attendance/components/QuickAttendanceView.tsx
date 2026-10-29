import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, 
  Calendar, 
  CheckCircle2, 
  History, 
  Sparkles,
  QrCode,
  RefreshCw,
  Maximize2,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { Modal } from '../../../shared/components/ui';
import { attendanceService } from '../../../services/attendanceService';
import { errorDetail } from '../../../shared/utils/errorMessage';
import { AttendanceSession, ClassItem, Student } from '../../../shared/types';
import { Attendance } from '../types';
import { todayLocal } from '../../../shared/utils/date';

interface QuickAttendanceViewProps {
  classes: ClassItem[];
  students: Student[];
  attendance: Attendance[];
  initialClassId?: string;
  onOpenSession: (classId: string) => Promise<AttendanceSession | undefined>;
  /** Gọi khi đóng màn hình QR Live để tải lại điểm danh (các lượt học viên đã quét) */
  onRefreshAttendance?: () => void | Promise<void>;
  onSaveAttendance: (classId: string, date: string, presentStudentIds: string[], notesMap: Record<string, string>) => void;
}

export const QuickAttendanceView: React.FC<QuickAttendanceViewProps> = ({
  classes,
  students,
  attendance,
  initialClassId,
  onOpenSession,
  onRefreshAttendance,
  onSaveAttendance,
}) => {
  // Selected class
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return initialClassId && classes.some((c) => c.id === initialClassId)
      ? initialClassId
      : classes[0]?.id || '';
  });

  // Selected date (YYYY-MM-DD), default today
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return todayLocal();
  });

  // View mode: 'take_attendance' or 'history'
  const [viewMode, setViewMode] = useState<'take_attendance' | 'history'>('take_attendance');

  // Local checked student IDs for current session
  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [isSavedFeedback, setIsSavedFeedback] = useState<boolean>(false);

  // Dynamic QR Code Projector State
  const [isQROpen, setIsQROpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [countdown, setCountdown] = useState(15);
  const [sessionCode, setSessionCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [qrError, setQrError] = useState('');
  // Số học viên đã quét/nhập mã trong phiên QR Live, lấy từ server
  const [liveCheckedIn, setLiveCheckedIn] = useState(0);

  // Sync when initialClassId changes
  useEffect(() => {
    if (initialClassId && classes.some((c) => c.id === initialClassId)) {
      setSelectedClassId(initialClassId);
    }
  }, [initialClassId, classes]);

  // Current class students
  const activeClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const activeClassId = activeClass?.id;
  const classStudents = students.filter((s) => s.class_id === activeClassId);

  // Load existing attendance for this class and date
  useEffect(() => {
    if (!activeClass) return;
    const existing = attendance.filter((a) => a.class_id === activeClass.id && a.date === selectedDate);
    
    if (existing.length > 0) {
      // Existing records exist for this date
      const presentIds = new Set<string>();
      const existingNotes: Record<string, string> = {};
      existing.forEach((rec) => {
        if (rec.status === 'present') {
          presentIds.add(rec.student_id);
        }
        if (rec.notes) {
          existingNotes[rec.student_id] = rec.notes;
        }
      });
      setCheckedStudentIds(presentIds);
      setNotesMap(existingNotes);
    } else {
      // Default: mark all present for fast 1-tap check
      const allIds = new Set<string>(classStudents.map((s) => s.id));
      setCheckedStudentIds(allIds);
      setNotesMap({});
    }
    setIsSavedFeedback(false);
  }, [selectedClassId, selectedDate, activeClass, attendance, classStudents.length]);

  // Mã QR do server ký và đổi mỗi chu kỳ; trình duyệt chỉ hiển thị, hỏi lại đúng lúc hết chu kỳ.
  // Dùng thời gian còn lại do server trả về nên không phụ thuộc đồng hồ của máy giáo viên.
  useEffect(() => {
    if (!isQROpen || !sessionId) return;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let tickTimer: ReturnType<typeof setInterval> | undefined;

    const loadQr = async () => {
      try {
        const { payload, refresh_in_ms } = await attendanceService.getSessionQr(sessionId);
        const url = await QRCode.toDataURL(payload, {
          width: 340,
          margin: 2,
          color: { dark: '#1e3a8a', light: '#ffffff' },
        });
        if (cancelled) return;
        setQrCodeUrl(url);
        setQrError('');
        const deadline = Date.now() + refresh_in_ms;
        setCountdown(Math.max(1, Math.ceil(refresh_in_ms / 1000)));
        clearInterval(tickTimer);
        tickTimer = setInterval(() => {
          setCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        }, 250);
        // Chờ thêm một chút để chắc chắn đã sang chu kỳ mới
        refreshTimer = setTimeout(loadQr, refresh_in_ms + 150);
      } catch (err) {
        if (cancelled) return;
        // Mã cũ hết hạn sau tối đa 2 chu kỳ nên không để hiển thị mã không còn dùng được
        setQrCodeUrl('');
        setQrError(errorDetail(err));
        clearInterval(tickTimer);
        refreshTimer = setTimeout(loadQr, 3000);
      }
    };

    loadQr();
    return () => {
      cancelled = true;
      clearTimeout(refreshTimer);
      clearInterval(tickTimer);
    };
  }, [isQROpen, sessionId]);

  // Cập nhật số học viên đã điểm danh khi đang chiếu QR (học viên quét trên điện thoại của họ)
  useEffect(() => {
    if (!isQROpen || !sessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { count } = await attendanceService.getSessionCheckins(sessionId);
        if (!cancelled) setLiveCheckedIn(count);
      } catch {
        // Lỗi mạng thoáng qua: giữ số cũ và thử lại ở lượt sau
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isQROpen, sessionId]);

  // Đóng QR Live: kết thúc phiên trên server (mã nhập tay hết hiệu lực) rồi tải lại điểm danh
  // để danh sách bên dưới phản ánh các lượt đã quét
  const closeQr = async () => {
    setIsQROpen(false);
    try {
      if (sessionId) await attendanceService.closeSession(sessionId);
    } catch {
      // Không đóng được (mạng): phiên sẽ tự đóng khi mở phiên mới
    }
    await onRefreshAttendance?.();
  };

  // Toggle student present / absent
  const handleToggleStudent = (studentId: string) => {
    setCheckedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
    setIsSavedFeedback(false);
  };

  // Mark all present
  const handleSelectAll = () => {
    const all = new Set(classStudents.map((s) => s.id));
    setCheckedStudentIds(all);
    setIsSavedFeedback(false);
  };

  // Uncheck all
  const handleDeselectAll = () => {
    setCheckedStudentIds(new Set());
    setIsSavedFeedback(false);
  };

  // Save Attendance
  const handleSave = () => {
    if (!activeClass) return;
    onSaveAttendance(
      activeClass.id,
      selectedDate,
      Array.from(checkedStudentIds),
      notesMap
    );
    setIsSavedFeedback(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
  };

  // Past dates history of this class
  const classAttendanceRecords = attendance.filter((a) => a.class_id === activeClass?.id);
  const uniqueDates = Array.from(new Set(classAttendanceRecords.map((a) => a.date))).sort().reverse();

  const presentCount = checkedStudentIds.size;
  const totalCount = classStudents.length;
  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      
      {/* Top Class Selector & Date Header */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-xs space-y-4">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              Điểm danh 1 chạm • Dưới 10 giây
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Điểm danh lớp tiếng Nhật
            </h2>
          </div>

          {/* Subtab Toggle: Take Attendance vs History */}
          <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setViewMode('take_attendance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'take_attendance'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Điểm danh
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'history'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Lịch sử ({uniqueDates.length})
            </button>
            <button
              onClick={async () => {
                if (!activeClass) return;
                // Phải mở phiên trên server trước, nếu không học viên quét sẽ bị báo "chưa mở"
                const session = await onOpenSession(activeClass.id);
                if (!session) return;
                setSessionCode(session.session_code ?? '');
                setSessionId(session.id);
                setLiveCheckedIn(0);
                setQrCodeUrl('');
                setQrError('');
                setIsQROpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ml-1"
            >
              <QrCode className="w-3.5 h-3.5" />
              Tạo QR Live
            </button>
          </div>
        </div>

        {/* Horizontal Class Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {classes.map((cls) => {
            const isSelected = cls.id === activeClass?.id;
            const count = students.filter((s) => s.class_id === cls.id).length;
            return (
              <button
                key={cls.id}
                onClick={() => {
                  setSelectedClassId(cls.id);
                  setIsSavedFeedback(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-white hover:border-slate-300'
                }`}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  {cls.level}
                </span>
                <span>{cls.name}</span>
                <span className={`text-[11px] font-medium opacity-80 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                  ({count} học viên)
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Selector & Class schedule info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              Ngày học:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setSelectedDate(todayLocal())}
              className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              Hôm nay
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Lịch học: <strong className="text-slate-800">{activeClass?.schedule}</strong>
            {activeClass?.room && ` • ${activeClass.room}`}
          </div>
        </div>

      </div>

      {viewMode === 'take_attendance' ? (
        /* Take Attendance Screen */
        <div className="space-y-3">
          
          {/* Quick Bulk Select Bar */}
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-blue-100 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Có mặt: <span className="text-blue-600 text-sm">{presentCount}/{totalCount}</span> ({rate}%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tất cả có mặt
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Bỏ chọn hết
              </button>
            </div>
          </div>

          {/* Student Roster Checkbox Cards (Big Thumb Targets) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {classStudents.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                Lớp này hiện chưa có học viên nào. Vui lòng vào tab "Học viên" để thêm học viên vào lớp.
              </div>
            ) : (
              classStudents.map((student, idx) => {
                const isChecked = checkedStudentIds.has(student.id);
                const note = notesMap[student.id] || '';

                return (
                  <div
                    key={student.id}
                    onClick={() => handleToggleStudent(student.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'bg-blue-50/50 border-blue-400/80 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox Icon */}
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                        isChecked 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'border-2 border-slate-300 text-transparent bg-white'
                      }`}>
                        {isChecked && <CheckSquare className="w-4 h-4 text-white" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-slate-400 font-medium">#{idx + 1}</span>
                          <h4 className={`text-sm font-bold ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                            {student.full_name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          SĐT: {student.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isChecked
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {isChecked ? 'Có mặt' : 'Vắng'}
                      </span>

                      {!isChecked && (
                        <input
                          type="text"
                          placeholder="Lý do vắng..."
                          value={note}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            setNotesMap({ ...notesMap, [student.id]: e.target.value });
                          }}
                          className="text-[10px] px-2 py-0.5 border border-slate-200 rounded-lg max-w-[120px] bg-white"
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Giant Prominent Save Button */}
          <div className="sticky bottom-18 md:bottom-4 z-20 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${
                isSavedFeedback
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
              }`}
            >
              {isSavedFeedback ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-white animate-bounce" />
                  ĐÃ LƯU ĐIỂM DANH THÀNH CÔNG! ({presentCount}/{totalCount} CÓ MẶT)
                </>
              ) : (
                <>
                  <CheckSquare className="w-5 h-5" />
                  LƯU ĐIỂM DANH NGÀY {selectedDate} ({presentCount}/{totalCount} CÓ MẶT)
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* History of Class Attendance */
        <div className="bg-white rounded-3xl p-5 border border-blue-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Lịch sử các buổi điểm danh lớp {activeClass?.name}
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Tổng cộng {uniqueDates.length} buổi học
            </span>
          </div>

          {uniqueDates.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Chưa có dữ liệu điểm danh nào của lớp này.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {uniqueDates.map((dateStr) => {
                const sessionRecords = classAttendanceRecords.filter((a) => a.date === dateStr);
                const sessionPresent = sessionRecords.filter((a) => a.status === 'present').length;
                const sessionAbsent = sessionRecords.filter((a) => a.status === 'absent');
                const sessionTotal = sessionRecords.length;
                const sessionRate = sessionTotal > 0 ? Math.round((sessionPresent / sessionTotal) * 100) : 0;

                return (
                  <div key={dateStr} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          📅 {dateStr}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
                          {sessionPresent}/{sessionTotal} có mặt ({sessionRate}%)
                        </span>
                      </div>
                      {sessionAbsent.length > 0 && (
                        <p className="text-[11px] text-rose-600 mt-1">
                          Vắng: {sessionAbsent.map((a) => {
                            const st = students.find((s) => s.id === a.student_id);
                            return st ? `${st.full_name}${a.notes ? ` (${a.notes})` : ''}` : '';
                          }).filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setViewMode('take_attendance');
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl text-xs font-bold transition-colors self-start sm:self-auto cursor-pointer"
                    >
                      Xem & Sửa buổi này →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dynamic QR Live Projector Modal */}
      {isQROpen && activeClass && (
        <Modal
          title={activeClass.name}
          description={
            <>
              Học viên mở ứng dụng <strong>EduScan Student</strong> trên điện thoại để quét mã bên dưới.
            </>
          }
          onClose={closeQr}
          size="md"
          overlayClassName="bg-slate-950/85 backdrop-blur-md"
        >
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping motion-reduce:animate-none" />
              PHIÊN ĐIỂM DANH ĐỘNG LIVE
            </div>

            {/* QR Code Container */}
            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-blue-300 inline-block mx-auto relative shadow-inner">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="EduScan Dynamic Attendance QR"
                  className="w-64 h-64 mx-auto rounded-xl shadow-md"
                />
              ) : (
                <div
                  role={qrError ? 'alert' : 'status'}
                  className="w-64 h-64 flex items-center justify-center text-center px-4 text-xs text-slate-500"
                >
                  {qrError ? `Không lấy được mã QR (${qrError}). Đang thử lại...` : 'Đang khởi tạo mã QR...'}
                </div>
              )}

              {/* Countdown badge */}
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-700">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Mã làm mới tự động sau: <span className="font-mono text-sm font-black text-rose-600">{countdown}s</span>
              </div>
            </div>

            {/* Session code fallback for students without camera */}
            <div className="bg-slate-100 p-3 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Mã nhập thủ công:</span>
              <span className="font-mono text-sm font-black text-blue-700 tracking-wider">
                {sessionCode || '—'}
              </span>
            </div>

            {/* Live Count: số học viên đã quét thật, không phải danh sách tick tay bên dưới */}
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 py-2 rounded-xl border border-emerald-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              Đã điểm danh: {liveCheckedIn}/{classStudents.length} học viên
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
