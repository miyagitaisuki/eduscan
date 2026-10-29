import React, { useEffect } from 'react';
import { Redirect, useLocation, useSearch } from 'wouter';
import type { User } from '../shared/types';
import type { ActiveTab } from '../shared/types';
import type { EcosystemData } from '../hooks/useEcosystemData';
import { BottomNav, LoadErrorBanner } from '../shared/components';
import { currentTuitionMonth } from '../shared/utils/tuitionMonth';
import { DashboardView } from '../features/dashboard';
import { QuickAttendanceView } from '../features/attendance';
import { ClassManagementView } from '../features/classes';
import { StudentManagementView } from '../features/students';
import { TuitionManagementView } from '../features/tuition';
import { HomeworkManagementView } from '../features/homework';
import { StudentStatsView } from '../features/stats';
import { TeacherManagementView } from '../features/teachers';
import { needsGrading } from '../shared/utils/submission';
import { classIdFromSearch, DEFAULT_TEACHER_TAB, teacherPath, teacherTabFromPath } from './routes';

interface TeacherAppProps {
  data: EcosystemData;
  currentUser: User;
  isAdmin: boolean;
}

// Giao diện giáo viên/admin: mỗi tab là một đường dẫn (/classes, /homework?class=...)
export default function TeacherApp({ data, currentUser, isAdmin }: TeacherAppProps) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const tab = teacherTabFromPath(location, isAdmin);
  // Lớp được chọn sẵn khi đi từ thẻ lớp; mất khi sang tab khác nên không còn "dính" bộ lọc cũ
  const preselectedClassId = classIdFromSearch(search);

  const { classes, students, attendanceRecords, tuitionRecords, assignments, submissions } = data;

  // Đổi tab thì cuộn lên đầu trang
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (!tab) return <Redirect to={teacherPath(DEFAULT_TEACHER_TAB)} replace />;

  const goTo = (target: ActiveTab, classId?: string) => navigate(teacherPath(target, classId));

  // Số học viên chưa đóng học phí tháng hiện tại (kể cả chưa có hồ sơ) và số bài chờ chấm, cho huy hiệu menu
  const currentMonth = currentTuitionMonth();
  const unpaidTuitionCount = students.filter(
    (s) => !tuitionRecords.some((p) => p.student_id === s.id && p.month === currentMonth && p.status === 'paid')
  ).length;
  const ungradedHomeworkCount = submissions.filter(needsGrading).length;

  // key theo tab và lớp: đổi lớp bằng nút Back thì màn hình dựng lại với bộ lọc mới
  const viewKey = `${tab}:${preselectedClassId ?? ''}`;

  return (
    <>
      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 pb-20 md:pb-6">
        {data.loadError && <LoadErrorBanner message={data.loadError} onRetry={data.refreshData} />}

        {tab === 'dashboard' && (
          <DashboardView
            key={viewKey}
            isAdmin={isAdmin}
            classes={classes}
            lessons={data.lessons}
            students={students}
            attendance={attendanceRecords}
            payments={tuitionRecords}
            assignments={assignments}
            submissions={submissions}
            onNavigateTab={goTo}
            onOpenCreateClass={() => goTo('classes')}
            onOpenCreateStudent={() => goTo('students')}
            teacherName={currentUser.full_name}
            teacherGender={currentUser.gender}
          />
        )}

        {tab === 'attendance' && (
          <QuickAttendanceView
            key={viewKey}
            classes={classes}
            students={students}
            attendance={attendanceRecords}
            initialClassId={preselectedClassId}
            onOpenSession={data.handleCreateAttendanceSession}
            onRefreshAttendance={data.refreshData}
            onSaveAttendance={(classId, date, presentStudentIds, notesMap) => {
              data.handleBatchAttendance(classId, date, presentStudentIds, notesMap);
            }}
          />
        )}

        {tab === 'classes' && (
          <ClassManagementView
            key={viewKey}
            isAdmin={isAdmin}
            teachers={data.teachers}
            classes={classes}
            students={students}
            attendance={attendanceRecords}
            payments={tuitionRecords}
            onCreateClass={data.handleCreateClass}
            onUpdateClass={data.handleUpdateClass}
            onDeleteClass={(clsId) => data.handleDeleteClass(clsId)}
            onNavigateTab={goTo}
            onScheduleChanged={data.reloadSchedule}
            notify={data.notify}
            currentUserId={currentUser.id}
          />
        )}

        {tab === 'students' && (
          <StudentManagementView
            key={viewKey}
            isAdmin={isAdmin}
            students={students}
            classes={classes}
            attendance={attendanceRecords}
            payments={tuitionRecords}
            assignments={assignments}
            submissions={submissions}
            initialClassId={preselectedClassId}
            onImported={data.refreshData}
            notify={data.notify}
            onCreateStudent={(st) => data.handleCreateStudent({ ...st, student_code: st.phone })}
            onUpdateStudent={data.handleUpdateStudent}
            onDeleteStudent={data.handleDeleteStudent}
            onTransferClass={(stId, newClassId) => data.handleUpdateStudent(stId, { class_id: newClassId })}
            onChangeTuition={(stId, amount) => data.handleSetTuitionAmount(stId, currentTuitionMonth(), amount)}
          />
        )}

        {tab === 'teachers' && (
          <TeacherManagementView
            teachers={data.teachers}
            currentUserId={currentUser.id}
            onCreate={data.handleCreateTeacher}
            onUpdate={data.handleUpdateTeacher}
            onSetStatus={data.handleSetTeacherStatus}
            onSetPassword={data.handleSetTeacherPassword}
          />
        )}

        {tab === 'tuition' && (
          <TuitionManagementView
            key={viewKey}
            payments={tuitionRecords}
            students={students}
            classes={classes}
            initialClassId={preselectedClassId}
            onUpdatePayment={(id, updates) => data.handleUpdateTuition(id, updates)}
            onCreatePaymentRecord={data.handleRecordPayment}
            onSetAmount={data.handleSetTuitionAmount}
            teacherName={currentUser.full_name}
          />
        )}

        {tab === 'homework' && (
          <HomeworkManagementView
            key={viewKey}
            assignments={assignments}
            submissions={submissions}
            students={students}
            classes={classes}
            initialClassId={preselectedClassId}
            onCreateAssignment={(asg) => data.handleCreateAssignment(asg)}
            onDeleteAssignment={(asgId) => data.handleDeleteAssignment(asgId)}
            onUpdateSubmission={data.handleGradeSubmission}
            onCreateSubmissionRecord={data.handleRecordSubmission}
            onRequestAiDraft={(subId) => data.handleRequestAiDraft(subId)}
            onDiscardAiDraft={(subId) => data.handleDiscardAiDraft(subId)}
            onApproveAiDraft={(subId, score, feedback, draft) =>
              data.handleGradeSubmission(subId, {
                score,
                feedback,
                rubric_breakdown: draft.rubricBreakdown,
                strengths: draft.strengths,
                weaknesses: draft.weaknesses,
                suggestions: draft.suggestions,
                graded_by_ai: true,
              })
            }
          />
        )}

        {tab === 'stats' && (
          <StudentStatsView
            key={viewKey}
            isAdmin={isAdmin}
            students={students}
            classes={classes}
            attendance={attendanceRecords}
            payments={tuitionRecords}
            assignments={assignments}
            submissions={submissions}
          />
        )}
      </main>

      {/* Thanh điều hướng dưới (điện thoại) */}
      <BottomNav
        activeTab={tab}
        onTabChange={(next) => goTo(next)}
        unpaidCount={unpaidTuitionCount}
        ungradedCount={ungradedHomeworkCount}
        isAdmin={isAdmin}
      />
    </>
  );
}
