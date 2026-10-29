import { apiClient } from './apiClient';
import { AttendanceSession, AttendanceRecord } from '../shared/types';

export const attendanceService = {
  async createSession(classId: string): Promise<AttendanceSession> {
    return apiClient.post<AttendanceSession>('/attendance/session', { class_id: classId });
  },

  // Mã QR hiện hành của phiên (server ký); refresh_in_ms là thời gian còn lại trước khi phải lấy mã mới
  async getSessionQr(sessionId: string): Promise<{ payload: string; refresh_in_ms: number; window_seconds: number }> {
    return apiClient.get(`/attendance/session/${encodeURIComponent(sessionId)}/qr`);
  },

  // Kết thúc phiên QR để mã không còn dùng được
  async closeSession(sessionId: string): Promise<{ success: boolean }> {
    return apiClient.post(`/attendance/session/${encodeURIComponent(sessionId)}/close`);
  },

  // Học viên đã điểm danh trong phiên (cập nhật theo thời gian thực cho màn hình QR Live)
  async getSessionCheckins(sessionId: string): Promise<{ count: number; student_ids: string[]; is_active: boolean }> {
    return apiClient.get(`/attendance/session/${encodeURIComponent(sessionId)}/checkins`);
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
