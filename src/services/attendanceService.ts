import { apiClient } from './apiClient';
import { AttendanceSession, AttendanceRecord } from '../shared/types';

export const attendanceService = {
  async createSession(classId: string): Promise<AttendanceSession> {
    return apiClient.post<AttendanceSession>('/attendance/session', { class_id: classId });
  },

  async checkIn(data: {
    student_id: string;
    session_id?: string;
    qr_payload?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; record: AttendanceRecord; alreadyCheckedIn?: boolean }> {
    return apiClient.post('/attendance/checkin', data);
  },

  async getHistory(filters?: { class_id?: string; student_id?: string }): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (filters?.class_id) params.append('class_id', filters.class_id);
    if (filters?.student_id) params.append('student_id', filters.student_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<AttendanceRecord[]>(`/attendance/history${query}`);
  },

  async saveBatchAttendance(
    classId: string,
    date: string,
    presentStudentIds: string[],
    notesMap?: Record<string, string>
  ): Promise<{ success: boolean; count: number; updated: boolean }> {
    return apiClient.post('/attendance/batch', {
      class_id: classId,
      date,
      presentStudentIds,
      notesMap,
    });
  },
};
