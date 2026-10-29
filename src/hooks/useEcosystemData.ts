import { useState, useEffect, useCallback, useMemo } from 'react';
import { errorDetail } from '../shared/utils/errorMessage';
import {
  ClassItem,
  User,
  Assignment,
  Submission,
  AttendanceSession,
  AttendanceRecord,
  TuitionRecord,
  NotificationItem,
} from '../shared/types';
import {
  classService,
  studentService,
  attendanceService,
  homeworkService,
  tuitionService,
  notificationService,
  aiService,
  adminService,
} from '../services';

interface UseEcosystemDataOptions {
  onNotify?: (type: 'success' | 'warning' | 'info', title: string, subtitle?: string) => void;
  currentUserId?: string;
}

export function useEcosystemData(options?: UseEcosystemDataOptions) {
  const notify = options?.onNotify;
  const currentUserId = options?.currentUserId;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [tuitionRecords, setTuitionRecords] = useState<TuitionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch all data from API
  const refreshData = useCallback(async () => {
    try {
      const [
        fetchedClasses,
        fetchedStudents,
        fetchedAssignments,
        fetchedSubmissions,
        fetchedAttendance,
        fetchedTuition,
        fetchedNotifs,
      ] = await Promise.all([
        classService.getClasses().catch(() => []),
        studentService.getStudents().catch(() => []),
        homeworkService.getAssignments().catch(() => []),
        homeworkService.getSubmissions().catch(() => []),
        attendanceService.getHistory().catch(() => []),
        tuitionService.getTuitionRecords().catch(() => []),
        notificationService.getNotifications(currentUserId).catch(() => []),
      ]);

      setClasses(fetchedClasses);
      setStudents(fetchedStudents);
      setAssignments(fetchedAssignments);
      setSubmissions(fetchedSubmissions);
      setAttendanceRecords(fetchedAttendance);
      setTuitionRecords(fetchedTuition);
      setNotifications(fetchedNotifs);
    } catch (err: any) {
      console.warn('Could not sync with EduScan REST API:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 1. Classes Handlers
  const handleCreateClass = async (data: Partial<ClassItem>) => {
    try {
      const created = await classService.createClass(data);
      setClasses((prev) => [...prev, created]);
      notify?.('success', 'Đã tạo lớp học mới', created.name);
      return created;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo lớp học', errorDetail(err));
    }
  };

  const handleUpdateClass = async (id: string, data: Partial<ClassItem>) => {
    try {
      const updated = await classService.updateClass(id, data);
      setClasses((prev) => prev.map((c) => (c.id === id ? updated : c)));
      notify?.('success', 'Đã cập nhật lớp học', updated.name);
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật lớp', errorDetail(err));
    }
  };

  const handleDeleteClass = async (id: string) => {
    try {
      await classService.deleteClass(id);
      setClasses((prev) => prev.filter((c) => c.id !== id));
      notify?.('info', 'Đã xóa lớp học thành công');
    } catch (err: any) {
      notify?.('warning', 'Lỗi xóa lớp', errorDetail(err));
    }
  };

  // 2. Students Handlers
  const handleCreateStudent = async (data: { full_name: string; email?: string; phone?: string; student_code?: string; class_id?: string }) => {
    try {
      const created = await studentService.createStudent(data);
      setStudents((prev) => [...prev, created]);
      // Server trả mật khẩu tạm một lần; giáo viên cần ghi lại để gửi cho học viên
      const tempPassword = (created as any).temporary_password;
      notify?.(
        'success',
        'Đã thêm học viên mới',
        tempPassword ? `${created.full_name} — mật khẩu tạm: ${tempPassword}` : created.full_name
      );
      await refreshData();
      return created;
    } catch (err: any) {
      notify?.('warning', 'Lỗi thêm học viên', errorDetail(err));
    }
  };

  const handleUpdateStudent = async (id: string, data: Partial<User> & { class_id?: string }) => {
    try {
      const updated = await studentService.updateStudent(id, data);
      setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)));
      notify?.('success', 'Đã cập nhật học viên', updated.full_name);
      await refreshData();
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật học viên', errorDetail(err));
    }
  };

  // 3. Attendance Handlers
  const handleCreateAttendanceSession = async (classId: string) => {
    try {
      const session = await attendanceService.createSession(classId);
      setActiveSession(session);
      notify?.('success', 'Đã phát sinh mã QR điểm danh động!', `Phiên học: ${session.session_code}`);
      return session;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo phiên điểm danh', errorDetail(err));
    }
  };

  const handleStudentCheckin = async (studentId: string, qrPayload?: string, sessionId?: string) => {
    try {
      const res = await attendanceService.checkIn({
        student_id: studentId,
        qr_payload: qrPayload,
        session_id: sessionId,
      });

      if (res.alreadyCheckedIn) {
        notify?.('info', 'Đã ghi nhận điểm danh!', res.message);
      } else {
        notify?.('success', 'Điểm danh QR thành công!', res.message);
        setAttendanceRecords((prev) => [res.record, ...prev]);
      }
      return res;
    } catch (err: any) {
      notify?.('warning', 'Điểm danh không thành công', errorDetail(err));
      throw err;
    }
  };

  const handleBatchAttendance = async (classId: string, date: string, presentIds: string[], notesMap?: Record<string, string>) => {
    try {
      await attendanceService.saveBatchAttendance(classId, date, presentIds, notesMap);
      notify?.('success', 'Đã lưu điểm danh nhanh thành công!', `${presentIds.length} học viên có mặt.`);
      await refreshData();
    } catch (err: any) {
      notify?.('warning', 'Lỗi lưu điểm danh', errorDetail(err));
    }
  };

  // 4. Homework & Grading Handlers
  const handleCreateAssignment = async (data: Partial<Assignment>) => {
    try {
      const asg = await homeworkService.createAssignment(data);
      setAssignments((prev) => [asg, ...prev]);
      notify?.('success', 'Đã giao bài tập mới', asg.title);
      return asg;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo bài tập', errorDetail(err));
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      await homeworkService.deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setSubmissions((prev) => prev.filter((s) => s.assignment_id !== id));
      notify?.('info', 'Đã xóa bài tập');
    } catch (err: any) {
      notify?.('warning', 'Lỗi xóa bài tập', errorDetail(err));
    }
  };

  const handleSubmitHomework = async (assignmentId: string, studentId: string, content: string, attachmentUrl?: string) => {
    try {
      const sub = await homeworkService.submitHomework({
        assignment_id: assignmentId,
        student_id: studentId,
        content,
        attachment_url: attachmentUrl,
      });

      setSubmissions((prev) => {
        const filtered = prev.filter((s) => !(s.assignment_id === assignmentId && s.student_id === studentId));
        return [sub, ...filtered];
      });

      notify?.('success', 'Nộp bài tập thành công!', 'Bài làm đã được gửi đến giáo viên & hệ thống chấm AI.');
      return sub;
    } catch (err: any) {
      notify?.('warning', 'Lỗi nộp bài', errorDetail(err));
      throw err;
    }
  };

  const handleGradeSubmission = async (
    submissionId: string,
    gradeData: {
      score: number;
      feedback?: string;
      rubric_breakdown?: any[];
      strengths?: string[];
      weaknesses?: string[];
      suggestions?: string[];
      graded_by_ai?: boolean;
    }
  ) => {
    try {
      const updated = await homeworkService.gradeSubmission(submissionId, gradeData);
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updated : s)));
      notify?.('success', 'Đã lưu kết quả chấm điểm', `Điểm: ${gradeData.score}/10`);
      return updated;
    } catch (err: any) {
      notify?.('warning', 'Lỗi lưu điểm', errorDetail(err));
    }
  };

  // Bản nháp AI: chỉ lưu nháp để giáo viên duyệt, không đổi điểm
  const handleRequestAiDraft = async (submissionId: string) => {
    try {
      const updated = await aiService.createSubmissionDraft(submissionId);
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updated : s)));
      notify?.('success', 'AI đã tạo bản nháp', 'Hãy xem lại và duyệt trước khi chấm điểm.');
    } catch (err: any) {
      notify?.('warning', 'Không chấm được bằng AI', errorDetail(err));
    }
  };

  const handleDiscardAiDraft = async (submissionId: string) => {
    try {
      const updated = await aiService.discardSubmissionDraft(submissionId);
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updated : s)));
    } catch (err: any) {
      notify?.('warning', 'Lỗi bỏ bản nháp', errorDetail(err));
    }
  };

  // 5. Tuition Handlers
  const handleUpdateTuition = async (id: string, updates: Partial<TuitionRecord>) => {
    try {
      const updated = await tuitionService.updatePayment(id, updates);
      setTuitionRecords((prev) => prev.map((t) => (t.id === id ? updated : t)));
      notify?.('success', 'Đã cập nhật học phí');
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật học phí', errorDetail(err));
    }
  };

  // Admin đặt học phí tháng cho học viên: sửa hồ sơ cùng tháng nếu có, không thì tạo mới
  const handleSetTuitionAmount = async (studentId: string, month: string, amount: number) => {
    try {
      const existing = tuitionRecords.find((t) => t.student_id === studentId && t.month === month);
      if (existing) {
        const updated = await tuitionService.updatePayment(existing.id, { amount });
        setTuitionRecords((prev) => prev.map((t) => (t.id === existing.id ? updated : t)));
      } else {
        const classId = (students.find((s) => s.id === studentId) as { class_id?: string } | undefined)?.class_id;
        const created = await tuitionService.createTuitionRecord({ student_id: studentId, class_id: classId, month, amount });
        setTuitionRecords((prev) => [...prev, created]);
      }
      notify?.('success', 'Đã cập nhật học phí', `Tháng ${month}: ${amount.toLocaleString('vi-VN')} đ`);
    } catch (err: any) {
      notify?.('warning', 'Lỗi cập nhật học phí', errorDetail(err));
    }
  };

  // 6. Notification Handlers
  const handleMarkNotificationRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    const target = students.find((s) => s.id === studentId);
    try {
      await studentService.deleteStudent(studentId);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setAttendanceRecords((prev) => prev.filter((a) => a.student_id !== studentId));
      setTuitionRecords((prev) => prev.filter((t) => t.student_id !== studentId));
      setSubmissions((prev) => prev.filter((s) => s.student_id !== studentId));
      notify?.('info', 'Đã xóa học viên khỏi hệ thống', target?.full_name);
    } catch (err: any) {
      notify?.('warning', 'Lỗi xóa học viên', errorDetail(err));
    }
  };

  const handleRecordPayment = async (studentId: string, month: string, amount: number) => {
    try {
      const rec = await tuitionService.recordPayment({ student_id: studentId, month, amount });
      setTuitionRecords((prev) =>
        prev.some((t) => t.id === rec.id) ? prev.map((t) => (t.id === rec.id ? { ...t, ...rec } : t)) : [...prev, rec]
      );
      notify?.('success', 'Đã ghi nhận thu học phí thành công!');
    } catch (err: any) {
      notify?.('warning', 'Lỗi ghi nhận học phí', errorDetail(err));
    }
  };

  const handleRecordSubmission = async (
    assignmentId: string,
    studentId: string,
    status: 'submitted' | 'unsubmitted',
    score: number | null,
    comment: string
  ) => {
    try {
      const rec = await homeworkService.recordSubmission({
        assignment_id: assignmentId,
        student_id: studentId,
        status,
        score,
        comment,
      });
      setSubmissions((prev) =>
        prev.some((s) => s.id === rec.id) ? prev.map((s) => (s.id === rec.id ? { ...s, ...rec } : s)) : [...prev, rec]
      );
    } catch (err: any) {
      notify?.('warning', 'Lỗi lưu bài nộp', errorDetail(err));
    }
  };

  // Sao lưu: tải file JSON từ server (chỉ admin)
  const handleExportBackup = async () => {
    try {
      const data = await adminService.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eduscan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify?.('success', 'Đã xuất file sao lưu!', 'File có chứa băm mật khẩu, hãy cất giữ an toàn.');
    } catch (err: any) {
      notify?.('warning', 'Không thể sao lưu', errorDetail(err));
    }
  };

  // Khôi phục: thay thế TOÀN BỘ dữ liệu bằng file sao lưu (chỉ admin, có xác nhận)
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Khôi phục sẽ THAY THẾ TOÀN BỘ dữ liệu hiện tại bằng file sao lưu. Tiếp tục?')) return;
    try {
      const data = JSON.parse(await file.text());
      await adminService.restore(data);
      await refreshData();
      notify?.('success', 'Khôi phục dữ liệu thành công!');
    } catch (err: any) {
      notify?.('warning', 'Không thể khôi phục', errorDetail(err));
    }
  };

  // Calculated Stats
  const stats = useMemo(() => {
    const totalClasses = classes.length;
    const totalStudents = students.length;
    const totalRevenue = tuitionRecords.filter((t) => t.status === 'paid').reduce((acc, t) => acc + (t.paid_amount || t.amount), 0);
    const unpaidCount = tuitionRecords.filter((t) => t.status === 'unpaid').length;
    const pendingHomeworkCount = submissions.filter((s) => s.status === 'submitted' && s.score === null).length;

    const presentAtt = attendanceRecords.filter((r) => r.status === 'present').length;
    const totalAtt = attendanceRecords.length;
    const overallAttendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

    return {
      totalClasses,
      totalStudents,
      totalRevenue,
      unpaidCount,
      pendingHomeworkCount,
      overallAttendanceRate,
    };
  }, [classes, students, tuitionRecords, submissions, attendanceRecords]);

  return {
    classes,
    students,
    assignments,
    submissions,
    attendanceRecords,
    tuitionRecords,
    notifications,
    activeSession,
    isLoading,
    stats,
    refreshData,
    handleCreateClass,
    handleUpdateClass,
    handleDeleteClass,
    handleCreateStudent,
    handleUpdateStudent,
    handleCreateAttendanceSession,
    handleStudentCheckin,
    handleBatchAttendance,
    handleCreateAssignment,
    handleDeleteAssignment,
    handleSubmitHomework,
    handleGradeSubmission,
    handleRequestAiDraft,
    handleDiscardAiDraft,
    handleUpdateTuition,
    handleSetTuitionAmount,
    handleMarkNotificationRead,
    handleDeleteStudent,
    handleRecordPayment,
    handleRecordSubmission,
    handleExportBackup,
    handleRestoreBackup,
  };
}
