import type { Submission } from '../types';

// Trạng thái bài nộp: server dùng 'unsubmitted' | 'submitted' | 'graded'.
// Bài đã chấm vẫn là bài đã nộp; điểm cho biết đã chấm hay chưa.

type SubmissionLike = Pick<Submission, 'status' | 'score'>;

/** Học viên đã nộp bài (kể cả bài đã được chấm) */
export const isSubmitted = (s: Pick<Submission, 'status'>): boolean => s.status === 'submitted' || s.status === 'graded';

/** Đã nộp nhưng chưa có điểm */
export const needsGrading = (s: SubmissionLike): boolean => s.status === 'submitted' && s.score === null;
