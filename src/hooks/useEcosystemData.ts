import { useCallback, useEffect, useRef, useState } from 'react';
import { TuitionRecord } from '../shared/types';
import { useClassesData } from './data/useClassesData';
import { useStudentsData } from './data/useStudentsData';
import { useAttendanceData } from './data/useAttendanceData';
import { useHomeworkData } from './data/useHomeworkData';
import { useTuitionData } from './data/useTuitionData';
import { useTeachersData } from './data/useTeachersData';
import { useNotificationsData } from './data/useNotificationsData';
import { useLessonsData } from './data/useLessonsData';
import { useBackup } from './data/useBackup';
import type { Notify } from './data/types';

interface UseEcosystemDataOptions {
  onNotify?: Notify;
  currentUserId?: string;
  /** Admin mới tải danh sách giáo viên và học phí */
  isAdmin?: boolean;
}

/**
 * Ghép các hook dữ liệu theo tính năng (src/hooks/data) thành một nguồn dữ liệu cho cả ứng dụng.
 * Mỗi hook con tự giữ state, hàm tải và handler của tính năng mình; file này chỉ lo:
 *  - tải lần đầu và làm mới toàn bộ, gom trạng thái đang tải / lỗi
 *  - các thao tác chạm tới nhiều tính năng (xóa học viên kéo theo điểm danh, học phí, bài nộp...)
 */
export function useEcosystemData(options?: UseEcosystemDataOptions) {
  const notify = options?.onNotify;
  const currentUserId = options?.currentUserId;
  const isAdmin = options?.isAdmin ?? false;

  const [isLoading, setIsLoading] = useState(true);
  // Có ít nhất một yêu cầu tải dữ liệu thất bại (dữ liệu cũ vẫn được giữ nguyên)
  const [loadError, setLoadError] = useState<string | null>(null);

  // Học viên thêm/sửa làm thay đổi lớp, học phí... nên cần tải lại tất cả; ref để tránh phụ thuộc vòng
  const refreshRef = useRef<() => Promise<boolean>>(async () => true);

  const classes = useClassesData(notify);
  const students = useStudentsData({ notify, onChanged: () => refreshRef.current() });
  const attendance = useAttendanceData(notify);
  const homework = useHomeworkData(notify);
  const tuition = useTuitionData({ notify, enabled: isAdmin });
  const teachers = useTeachersData({ notify, enabled: isAdmin });
  const notifications = useNotificationsData(currentUserId);
  const lessons = useLessonsData();

  const loadClasses = classes.load;
  const loadStudents = students.load;
  const loadAttendance = attendance.load;
  const loadHomework = homework.load;
  const loadTuition = tuition.load;
  const loadTeachers = teachers.load;
  const loadNotifications = notifications.load;
  const loadLessons = lessons.load;

  // Tải lại toàn bộ dữ liệu. Yêu cầu lỗi giữ nguyên dữ liệu cũ và hiện banner "Thử lại".
  const refreshData = useCallback(async () => {
    const results = await Promise.all([
      loadClasses(),
      loadStudents(),
      loadAttendance(),
      loadHomework(),
      loadTuition(),
      loadTeachers(),
      loadNotifications(),
      loadLessons(),
    ]);
    const ok = results.every(Boolean);
    setLoadError(ok ? null : 'Không tải được một phần dữ liệu. Có thể máy chủ đang khởi động hoặc mạng không ổn định.');
    setIsLoading(false);
    return ok;
  }, [loadClasses, loadStudents, loadAttendance, loadHomework, loadTuition, loadTeachers, loadNotifications, loadLessons]);
  refreshRef.current = refreshData;

  // Chỉ tải khi đã đăng nhập; mỗi lần đổi tài khoản thì hiện lại màn hình đang tải
  useEffect(() => {
    setIsLoading(true);
    if (!currentUserId) return;
    refreshData();
  }, [currentUserId, refreshData]);

  // Xóa học viên: xóa luôn dữ liệu liên quan đang giữ trên máy
  const handleDeleteStudent = async (studentId: string) => {
    if (await students.remove(studentId)) {
      attendance.removeForStudent(studentId);
      tuition.removeForStudent(studentId);
      homework.removeForStudent(studentId);
    }
  };

  // Hồ sơ học phí mới cần biết lớp của học viên
  const handleSetTuitionAmount = (studentId: string, month: string, amount: number) => {
    const classId = (students.students.find((s) => s.id === studentId) as { class_id?: string } | undefined)?.class_id;
    return tuition.setAmount(studentId, month, amount, classId);
  };

  // Sau khi admin đổi lịch hoặc ngày nghỉ: chỉ tải lại lớp (chuỗi lịch) và buổi học, không tải lại toàn bộ
  const reloadSchedule = useCallback(async () => {
    await Promise.all([loadClasses(), loadLessons()]);
  }, [loadClasses, loadLessons]);

  const backup = useBackup(notify, refreshData);

  return {
    // Dữ liệu
    classes: classes.classes,
    students: students.students,
    assignments: homework.assignments,
    submissions: homework.submissions,
    attendanceRecords: attendance.attendanceRecords,
    tuitionRecords: tuition.tuitionRecords as TuitionRecord[],
    teachers: teachers.teachers,
    notifications: notifications.notifications,
    lessons: lessons.lessons,
    notify,
    reloadSchedule,
    isLoading,
    loadError,
    refreshData,

    // Lớp học
    handleCreateClass: classes.create,
    handleUpdateClass: classes.update,
    handleDeleteClass: classes.remove,

    // Học viên
    handleCreateStudent: students.create,
    handleUpdateStudent: students.update,
    handleDeleteStudent,

    // Điểm danh
    handleCreateAttendanceSession: attendance.createSession,
    handleStudentCheckin: attendance.checkIn,
    handleBatchAttendance: attendance.saveBatch,

    // Bài tập và chấm điểm
    handleCreateAssignment: homework.createAssignment,
    handleDeleteAssignment: homework.deleteAssignment,
    handleSubmitHomework: homework.submit,
    handleGradeSubmission: homework.grade,
    handleRequestAiDraft: homework.requestAiDraft,
    handleDiscardAiDraft: homework.discardAiDraft,
    handleRecordSubmission: homework.recordSubmission,

    // Học phí (admin)
    handleUpdateTuition: tuition.update,
    handleSetTuitionAmount,
    handleRecordPayment: tuition.recordPayment,

    // Giáo viên (admin)
    handleCreateTeacher: teachers.create,
    handleUpdateTeacher: teachers.update,
    handleSetTeacherStatus: teachers.setStatus,
    handleSetTeacherPassword: teachers.setPassword,

    // Thông báo
    handleMarkNotificationRead: notifications.markRead,

    // Sao lưu (admin)
    handleExportBackup: backup.exportBackup,
    handleRestoreBackup: backup.restoreBackup,
  };
}

export type EcosystemData = ReturnType<typeof useEcosystemData>;
