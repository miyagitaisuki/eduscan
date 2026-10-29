import React, { useEffect } from 'react';
import { Redirect, useLocation } from 'wouter';
import type { User } from '../shared/types';
import type { EcosystemData } from '../hooks/useEcosystemData';
import { LoadErrorBanner } from '../shared/components';
import { StudentPortalView } from '../features/student-portal';
import { DEFAULT_STUDENT_TAB, studentPath, studentTabFromPath } from './routes';

interface StudentAppProps {
  data: EcosystemData;
  currentUser: User;
}

// Cổng học viên: mỗi tab là một đường dẫn (/home, /assignments, /attendance, /tuition, /notifications)
// nên nút Back trên điện thoại quay về tab trước thay vì thoát ứng dụng.
export default function StudentApp({ data, currentUser }: StudentAppProps) {
  const [location, navigate] = useLocation();
  const tab = studentTabFromPath(location);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (!tab) return <Redirect to={studentPath(DEFAULT_STUDENT_TAB)} replace />;

  return (
    <div className="py-4 px-2 sm:px-4 flex-1 flex flex-col items-center">
      {data.loadError && (
        <div className="w-full max-w-md px-2">
          <LoadErrorBanner message={data.loadError} onRetry={data.refreshData} />
        </div>
      )}
      <StudentPortalView
        currentUser={currentUser}
        classes={data.classes}
        assignments={data.assignments}
        submissions={data.submissions}
        attendanceRecords={data.attendanceRecords}
        tuitionRecords={data.tuitionRecords}
        notifications={data.notifications}
        activeTab={tab}
        onTabChange={(next) => navigate(studentPath(next))}
        onCheckinQR={(payload) => data.handleStudentCheckin(currentUser.id, payload)}
        onSubmitHomework={(asgId, content, attachmentUrl) =>
          data.handleSubmitHomework(asgId, currentUser.id, content, attachmentUrl)
        }
        onMarkNotificationRead={data.handleMarkNotificationRead}
      />
    </div>
  );
}
