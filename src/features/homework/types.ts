export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string;
  deadline: string; // YYYY-MM-DD
  created_at: string;
}

import type { AiDraft } from '../../shared/types';

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  score: number | null; // thang điểm 10
  comment: string;
  status: 'submitted' | 'unsubmitted';
  submitted_at?: string;
  ai_draft?: AiDraft | null;
}
