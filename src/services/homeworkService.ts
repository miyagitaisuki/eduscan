import { apiClient } from './apiClient';
import { Assignment, AssignmentInput, GradeInput, Submission } from '../shared/types';

export const homeworkService = {
  async getAssignments(classId?: string): Promise<Assignment[]> {
    const query = classId ? `?class_id=${classId}` : '';
    return apiClient.get<Assignment[]>(`/assignments${query}`);
  },

  async getAssignment(id: string): Promise<Assignment> {
    return apiClient.get<Assignment>(`/assignments/${id}`);
  },

  // Mọi bài nộp có tệp đính kèm (giáo viên/admin)
  async getAttachmentSubmissions(): Promise<Submission[]> {
    return apiClient.get<Submission[]>('/submissions/attachments');
  },

  // Link tạm để mở tệp đính kèm của một bài nộp
  async getAttachmentUrl(submissionId: string): Promise<{ url: string; expires_in: number }> {
    return apiClient.get<{ url: string; expires_in: number }>(`/submissions/${submissionId}/attachment`);
  },

  async createAssignment(data: AssignmentInput): Promise<Assignment> {
    return apiClient.post<Assignment>('/assignments', data);
  },

  async deleteAssignment(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/assignments/${id}`);
  },

  async getSubmissions(filters?: { assignment_id?: string; student_id?: string }): Promise<Submission[]> {
    const params = new URLSearchParams();
    if (filters?.assignment_id) params.append('assignment_id', filters.assignment_id);
    if (filters?.student_id) params.append('student_id', filters.student_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<Submission[]>(`/submissions${query}`);
  },

  async getMySubmissions(): Promise<Submission[]> {
    return apiClient.get<Submission[]>('/submissions/my');
  },

  async submitHomework(data: {
    assignment_id: string;
    student_id: string;
    content: string;
    attachment_url?: string;
  }): Promise<Submission> {
    return apiClient.post<Submission>('/submissions', data);
  },

  // Giáo viên ghi nhận thủ công bài nộp/điểm của một học viên
  async recordSubmission(data: {
    assignment_id: string;
    student_id: string;
    status: 'submitted' | 'unsubmitted' | 'graded';
    score: number | null;
    feedback: string;
  }): Promise<Submission> {
    return apiClient.post<Submission>('/submissions/manual', data);
  },

  async gradeSubmission(submissionId: string, gradeData: GradeInput): Promise<Submission> {
    return apiClient.put<Submission>(`/submissions/${submissionId}/grade`, gradeData);
  },
};
