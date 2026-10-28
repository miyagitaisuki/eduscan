import { apiClient } from './apiClient';
import type { Submission } from '../shared/types';

export interface AIGradeRequest {
  assignmentTitle: string;
  assignmentDescription?: string;
  sampleSolution?: string;
  rubric?: string;
  studentName: string;
  studentCode?: string;
  submissionContent?: string;
  submissionImageBase64?: string;
}

export interface AIGradeResult {
  score: number;
  gradeClassification: string;
  rubricBreakdown: {
    criterion: string;
    maxScore: number;
    earnedScore: number;
    comment: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  detailedFeedback: string;
  suggestions: string[];
}

export const aiService = {
  async gradeAssignment(req: AIGradeRequest): Promise<AIGradeResult> {
    return apiClient.post<AIGradeResult>('/ai/grade-assignment', req);
  },

  // Tạo bản nháp AI cho bài nộp; trả về bài nộp đã có ai_draft. Không thay đổi điểm.
  async createSubmissionDraft(submissionId: string): Promise<Submission> {
    return apiClient.post<Submission>(`/ai/drafts/${submissionId}`, {});
  },

  async discardSubmissionDraft(submissionId: string): Promise<Submission> {
    return apiClient.delete<Submission>(`/ai/drafts/${submissionId}`);
  },

  async generateFeedback(data: {
    assignmentTitle: string;
    assignmentDescription?: string;
    studentName: string;
    score?: number | null;
    level?: string;
  }): Promise<{ detailedFeedback: string; actionableSuggestions: string[] }> {
    return apiClient.post('/ai/generate-feedback', data);
  },
};
