import { apiClient } from './apiClient';
import type { Holiday, HolidayInput, Lesson, LessonPlanInput, LessonSyncResult, LessonUpdateInput } from '../shared/types';

export const lessonService = {
  /** Toàn bộ buổi học của một lớp, theo thứ tự ngày */
  getClassLessons(classId: string): Promise<Lesson[]> {
    return apiClient.get<Lesson[]>(`/classes/${classId}/lessons`);
  },

  /** Buổi học của mọi lớp người dùng được xem, trong khoảng ngày (YYYY-MM-DD) */
  getLessons(from: string, to: string): Promise<Lesson[]> {
    return apiClient.get<Lesson[]>(`/lessons?from=${from}&to=${to}`);
  },

  /** Xem trước (dryRun) hoặc áp lịch lặp cho lớp; chỉ admin */
  planClass(
    classId: string,
    plan: LessonPlanInput,
    opts: { dryRun?: boolean; allowConflicts?: boolean } = {}
  ): Promise<LessonSyncResult> {
    return apiClient.post<LessonSyncResult>(`/classes/${classId}/lesson-plan`, {
      ...plan,
      dry_run: opts.dryRun === true,
      allow_conflicts: opts.allowConflicts === true,
    });
  },

  updateLesson(id: string, data: LessonUpdateInput): Promise<Lesson> {
    return apiClient.request<Lesson>(`/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteLesson(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/lessons/${id}`);
  },

  /** Gán nội dung lần lượt cho các buổi (mỗi phần tử một buổi) */
  assignTitles(classId: string, titles: string[], overwrite: boolean): Promise<{ assigned: number; unassigned: number }> {
    return apiClient.post(`/classes/${classId}/lessons/titles`, { titles, overwrite });
  },

  getHolidays(): Promise<Holiday[]> {
    return apiClient.get<Holiday[]>('/holidays');
  },

  createHoliday(data: HolidayInput): Promise<Holiday & { removed_lessons: number }> {
    return apiClient.post('/holidays', data);
  },

  deleteHoliday(id: string): Promise<{ success: boolean; created_lessons: number }> {
    return apiClient.delete(`/holidays/${id}`);
  },
};
