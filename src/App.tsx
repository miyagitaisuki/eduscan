/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

// Shared UI Components
import { Header, BottomNav, ToastNotification } from './shared/components';
import { currentTuitionMonth } from './shared/utils/tuitionMonth';
import { EcosystemViewMode, EcosystemTeacherTab } from './shared/components/Header';

// Feature Modules: Teacher App
import { DashboardView } from './features/dashboard';
import { QuickAttendanceView } from './features/attendance';
import { ClassManagementView } from './features/classes';
import { StudentManagementView } from './features/students';
import { TuitionManagementView } from './features/tuition';
import { HomeworkManagementView } from './features/homework';
import { StudentStatsView } from './features/stats';

// Feature Modules: Student App (Android / Web)
import { StudentPortalView } from './features/student-portal';

// Feature Module: Đăng nhập
import { LoginView } from './features/auth';
import { ChangePasswordModal } from './features/auth/ChangePasswordModal';
import { ProfileModal } from './features/auth/ProfileModal';
import { TeacherManagementView } from './features/teachers';
import { ResetPasswordView } from './features/auth/ResetPasswordView';

// Custom Hooks (State & REST API Integration Layer)
import { useAuth, useEcosystemData, useToast } from './hooks';

export default function App() {
  const { toast, showToast, hideToast } = useToast();
  const { currentUser, role, switchRole, login, logout, isLoading: isAuthLoading, updateCurrentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [showProfile, setShowProfile] = useState(false);
  
  // Ecosystem App View Mode: 'teacher' (Web App) vs 'student' (Android/Web App)
  const [viewMode, setViewMode] = useState<EcosystemViewMode>('teacher');
  // Học viên luôn vào giao diện học viên; giáo viên/admin vào giao diện giáo viên
  const effectiveViewMode: EcosystemViewMode = currentUser?.role === 'student' ? 'student' : viewMode;
  const [activeTab, setActiveTab] = useState<EcosystemTeacherTab>('dashboard');
  const [preselectedClassId, setPreselectedClassId] = useState<string | undefined>(undefined);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // REST API Ecosystem Data
  const {
    classes,
    students,
    assignments,
    submissions,
    attendanceRecords,
    tuitionRecords,
    teachers,
    handleCreateTeacher,
    handleUpdateTeacher,
    handleSetTeacherStatus,
    handleSetTeacherPassword,
    notifications,
    handleCreateClass,
    handleUpdateClass,
    handleDeleteClass,
    handleCreateStudent,
    handleUpdateStudent,
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
  } = useEcosystemData({ onNotify: showToast, currentUserId: currentUser?.id, isAdmin });

  const navigateToTab = (tab: EcosystemTeacherTab, classId?: string) => {
    setActiveTab(tab);
    if (classId) {
      setPreselectedClassId(classId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Convert ecosystem models to component props format
  const formattedClasses = classes.map((c) => ({
    id: c.id,
    name: c.name,
    level: (c.level as any) || 'N5',
    scheduleDays: c.scheduleDays || [1, 3, 5],
    monthly_fee: c.monthly_fee || 800000,
    schedule: c.schedule || 'Thứ 2 - 4 - 6',
    start_date: c.created_at?.split('T')[0] || '2026-09-01',
    notes: c.description || '',
    room: c.room || '',
    teacher_id: c.teacher_id,
  }));

  const formattedStudents = students.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    phone: s.phone || '',
    class_id: (s as any).class_id || classes[0]?.id || 'cls-n5-01',
    level: (s as any).level || 'N5',
    join_date: s.created_at?.split('T')[0] || '2026-09-01',
    notes: s.student_code ? `MSSV: ${s.student_code}` : '',
  }));

  const formattedAttendance = attendanceRecords.map((r) => ({
    id: r.id,
    class_id: r.class_id || classes[0]?.id || 'cls-n5-01',
    student_id: r.student_id,
    date: r.date || r.check_in_time.split('T')[0],
    status: r.status as 'present' | 'absent',
    notes: r.notes,
  }));

  const formattedPayments = tuitionRecords.map((t) => ({
    id: t.id,
    student_id: t.student_id,
    month: t.month,
    amount: t.amount,
    paid_amount: t.paid_amount,
    paid_date: t.paid_date || null,
    status: t.status as 'paid' | 'unpaid',
    notes: t.notes || '',
  }));

  const formattedAssignments = assignments.map((a) => ({
    id: a.id,
    class_id: a.class_id,
    title: a.title,
    description: a.description,
    deadline: a.deadline.split('T')[0],
    created_at: a.created_at.split('T')[0],
  }));

  const formattedSubmissions = submissions.map((s) => ({
    id: s.id,
    assignment_id: s.assignment_id,
    student_id: s.student_id,
    status: s.status as 'submitted' | 'unsubmitted',
    score: s.score,
    comment: s.feedback || '',
    ai_draft: s.ai_draft ?? null,
    submitted_at: s.submitted_at?.split('T')[0],
  }));

  // Trang đặt lại mật khẩu từ link trong email (không cần đăng nhập)
  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordView />;
  }

  // Chưa đăng nhập: chỉ hiển thị màn hình đăng nhập
  if (!currentUser) {
    return (
      <LoginView
        onLogin={login}
        isLoading={isAuthLoading}
        onDevQuickLogin={import.meta.env.DEV ? (r) => switchRole(r) : undefined}
      />
    );
  }

  // Mật khẩu do admin đặt: bắt buộc đổi trước khi dùng hệ thống
  if (currentUser.must_change_password) {
    return <ChangePasswordModal required onClose={logout} onDone={() => window.location.reload()} />;
  }

  // Số học viên chưa đóng học phí tháng hiện tại (kể cả chưa có hồ sơ)
  const currentMonth = currentTuitionMonth();
  const unpaidTuitionCount = formattedStudents.filter(
    (s) => !formattedPayments.some((p) => p.student_id === s.id && p.month === currentMonth && p.status === 'paid')
  ).length;
  const ungradedHomeworkCount = submissions.filter((s) => s.status === 'submitted' && s.score === null).length;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      
      {/* Ecosystem Global Header & App Switcher */}
      <Header
        viewMode={effectiveViewMode}
        onViewModeChange={(mode) => setViewMode(mode)}
        onChangePassword={() => setShowChangePassword(true)}
        currentUser={currentUser}
        onSwitchRole={switchRole}
        showAppSwitcher={import.meta.env.DEV}
        onLogout={logout}
        activeTab={activeTab}
        onTabChange={(tab) => navigateToTab(tab)}
        onExportData={handleExportBackup}
        onImportData={handleRestoreBackup}
        canBackup={isAdmin}
        isAdmin={isAdmin}
        onEditProfile={() => setShowProfile(true)}
      />

      {/* Main Ecosystem Body */}
      {effectiveViewMode === 'student' ? (
        /* =========================================================================
           EDUSCAN STUDENT (ANDROID APP / WEB)
           ========================================================================= */
        <div className="py-4 px-2 sm:px-4 flex-1 flex flex-col items-center">
          {import.meta.env.DEV && (
            <div className="mb-2 text-center">
              <span className="text-[11px] font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                📱 Mô phỏng Giao diện EduScan Student Android (React + Capacitor)
              </span>
            </div>
          )}
          <StudentPortalView
            currentUser={
              currentUser || {
                id: 'usr-student-1',
                email: 'student@qnu.edu.vn',
                full_name: 'Nguyễn Văn An',
                role: 'student',
                status: 'active',
                student_code: '',
              }
            }
            classes={classes}
            assignments={assignments}
            submissions={submissions}
            attendanceRecords={attendanceRecords}
            tuitionRecords={tuitionRecords}
            notifications={notifications}
            onCheckinQR={async (payload) => {
              const res = await handleStudentCheckin(currentUser?.id || 'usr-student-1', payload);
              return res;
            }}
            onSubmitHomework={async (asgId, content, attachmentUrl) => {
              const res = await handleSubmitHomework(
                asgId,
                currentUser?.id || 'usr-student-1',
                content,
                attachmentUrl
              );
              return res;
            }}
            onMarkNotificationRead={handleMarkNotificationRead}
          />
        </div>
      ) : (
        /* =========================================================================
           EDUSCAN TEACHER (WEB APP)
           ========================================================================= */
        <>
          <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 pb-20 md:pb-6">
            {activeTab === 'dashboard' && (
              <DashboardView
                isAdmin={isAdmin}
                classes={formattedClasses}
                students={formattedStudents}
                attendance={formattedAttendance}
                payments={formattedPayments}
                assignments={formattedAssignments}
                submissions={formattedSubmissions}
                onNavigateTab={(tab, classId) => navigateToTab(tab as EcosystemTeacherTab, classId)}
                onOpenCreateClass={() => setActiveTab('classes')}
                onOpenCreateStudent={() => setActiveTab('students')}
                teacherName={currentUser?.full_name}
              />
            )}

            {activeTab === 'attendance' && (
              <QuickAttendanceView
                classes={formattedClasses}
                students={formattedStudents}
                attendance={formattedAttendance}
                initialClassId={preselectedClassId}
                onSaveAttendance={(classId, date, presentStudentIds, notesMap) => {
                  handleBatchAttendance(classId, date, presentStudentIds, notesMap);
                }}
              />
            )}

            {activeTab === 'classes' && (
              <ClassManagementView
                isAdmin={isAdmin}
                teachers={teachers}
                classes={formattedClasses}
                students={formattedStudents}
                attendance={formattedAttendance}
                payments={formattedPayments}
                onCreateClass={(cls) => handleCreateClass(cls as any)}
                onUpdateClass={(cls) => handleUpdateClass(cls.id, cls as any)}
                onDeleteClass={(clsId) => handleDeleteClass(clsId)}
                onNavigateTab={(tab, classId) => navigateToTab(tab as EcosystemTeacherTab, classId)}
              />
            )}

            {activeTab === 'students' && (
              <StudentManagementView
                isAdmin={isAdmin}
                students={formattedStudents}
                classes={formattedClasses}
                attendance={formattedAttendance}
                payments={formattedPayments}
                assignments={formattedAssignments}
                submissions={formattedSubmissions}
                initialClassId={preselectedClassId}
                onCreateStudent={(st) => handleCreateStudent({ ...st, student_code: st.phone })}
                onUpdateStudent={(st) => handleUpdateStudent(st.id, st)}
                onDeleteStudent={handleDeleteStudent}
                onTransferClass={(stId, newClassId) => handleUpdateStudent(stId, { class_id: newClassId })}
                onChangeTuition={(stId, amount) => handleSetTuitionAmount(stId, currentTuitionMonth(), amount)}
              />
            )}

            {activeTab === 'teachers' && isAdmin && (
              <TeacherManagementView
                teachers={teachers}
                currentUserId={currentUser?.id ?? ''}
                onCreate={handleCreateTeacher}
                onUpdate={handleUpdateTeacher}
                onSetStatus={handleSetTeacherStatus}
                onSetPassword={handleSetTeacherPassword}
              />
            )}

            {activeTab === 'tuition' && isAdmin && (
              <TuitionManagementView
                payments={formattedPayments}
                students={formattedStudents}
                classes={formattedClasses}
                initialClassId={preselectedClassId}
                onUpdatePayment={(id, updates) => handleUpdateTuition(id, updates)}
                onCreatePaymentRecord={handleRecordPayment}
                onSetAmount={handleSetTuitionAmount}
                teacherName={currentUser?.full_name}
              />
            )}

            {activeTab === 'homework' && (
              <HomeworkManagementView
                assignments={formattedAssignments}
                submissions={formattedSubmissions}
                students={formattedStudents}
                classes={formattedClasses}
                initialClassId={preselectedClassId}
                onCreateAssignment={(asg) => handleCreateAssignment(asg)}
                onDeleteAssignment={(asgId) => handleDeleteAssignment(asgId)}
                onUpdateSubmission={(subId, updates) => handleGradeSubmission(subId, updates as any)}
                onCreateSubmissionRecord={handleRecordSubmission}
                onRequestAiDraft={(subId) => handleRequestAiDraft(subId)}
                onDiscardAiDraft={(subId) => handleDiscardAiDraft(subId)}
                onApproveAiDraft={(subId, score, feedback, draft) =>
                  handleGradeSubmission(subId, {
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

            {activeTab === 'stats' && (
              <StudentStatsView
                isAdmin={isAdmin}
                students={formattedStudents}
                classes={formattedClasses}
                attendance={formattedAttendance}
                payments={formattedPayments}
                assignments={formattedAssignments}
                submissions={formattedSubmissions}
              />
            )}
          </main>

          {/* Teacher Mobile Bottom Navigation Bar */}
          <BottomNav
            activeTab={activeTab}
            onTabChange={(tab) => navigateToTab(tab as EcosystemTeacherTab)}
            unpaidCount={unpaidTuitionCount}
            ungradedCount={ungradedHomeworkCount}
            isAdmin={isAdmin}
          />
        </>
      )}
{showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showProfile && currentUser && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfile(false)}
          onSaved={updateCurrentUser}
          onError={(message) => showToast('warning', 'Lỗi lưu hồ sơ', message)}
        />
      )}
      {/* Shared Toast Notification */}
      <ToastNotification toast={toast} onClose={hideToast} />

      {/* Footer */}
      <footer className="hidden md:block border-t border-slate-200 bg-white/70 py-4 text-center text-xs text-slate-500">
        <p>
          EduScan AI Ecosystem © 2026 • Teacher Web & Student Android Platform • Trường Đại học Quy Nhơn
        </p>
      </footer>
    </div>
  );
}
