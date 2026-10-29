import { useCallback, useState } from 'react';
import { Assignment, AssignmentInput, GradeInput, Submission } from '../../shared/types';
import { aiService, homeworkService } from '../../services';
import { errorDetail } from '../../shared/utils/errorMessage';
import type { Loader, Notify } from './types';

export function useHomeworkData(notify?: Notify) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const load = useCallback<Loader>(async () => {
    const [a, s] = await Promise.all([
      homeworkService.getAssignments().catch(() => undefined),
      homeworkService.getSubmissions().catch(() => undefined),
    ]);
    if (a) setAssignments(a);
    if (s) setSubmissions(s);
    return !!a && !!s;
  }, []);

  const replaceSubmission = (updated: Submission) =>
    setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  const createAssignment = async (data: AssignmentInput) => {
    try {
      const asg = await homeworkService.createAssignment(data);
      setAssignments((prev) => [asg, ...prev]);
      notify?.('success', 'Đã giao bài tập mới', asg.title);
      return asg;
    } catch (err: any) {
      notify?.('warning', 'Lỗi tạo bài tập', errorDetail(err));
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      await homeworkService.deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setSubmissions((prev) => prev.filter((s) => s.assignment_id !== id));
      notify?.('info', 'Đã xóa bài tập');
    } catch (err: any) {
      notify?.('warning', 'Lỗi xóa bài tập', errorDetail(err));
    }
  };

  const submit = async (assignmentId: string, studentId: string, content: string, attachmentUrl?: string) => {
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

  const grade = async (submissionId: string, gradeData: GradeInput) => {
    try {
      const updated = await homeworkService.gradeSubmission(submissionId, gradeData);
      replaceSubmission(updated);
      // Lưu nhận xét không kèm điểm thì updated.score vẫn là điểm cũ, nên lấy từ kết quả server
      notify?.('success', 'Đã lưu kết quả chấm điểm', updated.score == null ? 'Đã lưu nhận xét' : `Điểm: ${updated.score}/10`);
      return updated;
    } catch (err: any) {
      notify?.('warning', 'Lỗi lưu điểm', errorDetail(err));
    }
  };

  // Bản nháp AI: chỉ lưu nháp để giáo viên duyệt, không đổi điểm
  const requestAiDraft = async (submissionId: string) => {
    try {
      replaceSubmission(await aiService.createSubmissionDraft(submissionId));
      notify?.('success', 'AI đã tạo bản nháp', 'Hãy xem lại và duyệt trước khi chấm điểm.');
    } catch (err: any) {
      notify?.('warning', 'Không chấm được bằng AI', errorDetail(err));
    }
  };

  const discardAiDraft = async (submissionId: string) => {
    try {
      replaceSubmission(await aiService.discardSubmissionDraft(submissionId));
    } catch (err: any) {
      notify?.('warning', 'Lỗi bỏ bản nháp', errorDetail(err));
    }
  };

  const recordSubmission = async (
    assignmentId: string,
    studentId: string,
    status: 'submitted' | 'unsubmitted',
    score: number | null,
    feedback: string
  ) => {
    try {
      const rec = await homeworkService.recordSubmission({
        assignment_id: assignmentId,
        student_id: studentId,
        status,
        score,
        feedback,
      });
      setSubmissions((prev) =>
        prev.some((s) => s.id === rec.id) ? prev.map((s) => (s.id === rec.id ? { ...s, ...rec } : s)) : [...prev, rec]
      );
    } catch (err: any) {
      notify?.('warning', 'Lỗi lưu bài nộp', errorDetail(err));
    }
  };

  /** Xóa bài nộp của học viên đã bị xóa khỏi hệ thống */
  const removeForStudent = (studentId: string) =>
    setSubmissions((prev) => prev.filter((s) => s.student_id !== studentId));

  return {
    assignments,
    submissions,
    load,
    createAssignment,
    deleteAssignment,
    submit,
    grade,
    requestAiDraft,
    discardAiDraft,
    recordSubmission,
    removeForStudent,
  };
}
