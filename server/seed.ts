import { count } from 'drizzle-orm';
import type { AppDb } from './db/client';
import * as s from './db/schema';
import { hashPassword } from './lib/security';

export interface SeedOptions {
  seedPassword: string;
  /** true: nạp dữ liệu demo (chỉ dev). false: chỉ tạo admin và giáo viên */
  demo: boolean;
  teacherName: string;
}

// Chỉ seed khi chưa có người dùng nào. Trả về true nếu đã seed.
export async function seedDatabase(db: AppDb, opts: SeedOptions): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(s.users);
  if (Number(n) > 0) return false;

  const pw = hashPassword(opts.seedPassword);
  const teacherId = 'usr-teacher-1';

  await db.transaction(async (tx) => {
    await tx.insert(s.users).values([
      { id: 'usr-admin-1', email: 'admin@eduscan.edu.vn', passwordHash: pw, fullName: 'Ban Quản Trị EduScan', role: 'admin', phone: '0988.888.999' },
      { id: teacherId, email: 'teacher@eduscan.edu.vn', passwordHash: pw, fullName: opts.teacherName, role: 'teacher', phone: '0912.345.678' },
    ]);
    if (!opts.demo) return;

    await tx.insert(s.users).values([
      { id: 'usr-student-1', email: 'student@qnu.edu.vn', passwordHash: pw, fullName: 'Nguyễn Văn An', role: 'student', studentCode: '225101001', phone: '0905.111.222' },
      { id: 'usr-student-2', email: 'mai.le@qnu.edu.vn', passwordHash: pw, fullName: 'Lê Thị Mai', role: 'student', studentCode: '225101002', phone: '0905.222.333' },
      { id: 'usr-student-3', email: 'dung.tran@qnu.edu.vn', passwordHash: pw, fullName: 'Trần Tiến Dũng', role: 'student', studentCode: '225101003', phone: '0905.333.444' },
    ]);
    await tx.insert(s.classes).values([
      { id: 'cls-n5-01', name: 'N5 Sơ cấp 1 (Minna no Nihongo)', code: 'JPN-N501', teacherId, description: 'Lớp nhập môn tiếng Nhật: Bảng chữ cái Hiragana/Katakana, 25 bài Minna no Nihongo sơ cấp.', schedule: 'Thứ 2 - 4 - 6 (18:00 - 19:30)', level: 'N5', monthlyFee: 800000 },
      { id: 'cls-n4-01', name: 'N4 Trung cấp cấp tốc (JLPT N4)', code: 'JPN-N401', teacherId, description: 'Luyện thi chứng chỉ quốc tế N4, ngữ pháp nâng cao và Kanji 300 chữ.', schedule: 'Thứ 3 - 5 - 7 (19:30 - 21:00)', level: 'N4', monthlyFee: 1000000 },
      { id: 'cls-kaiwa-01', name: 'Luyện Giao tiếp Kaiwa & Phỏng vấn visa', code: 'JPN-KAIWA', teacherId, description: 'Thực hành phản xạ đàm thoại với người bản xứ, kỹ năng phỏng vấn doanh nghiệp Nhật Bản.', schedule: 'Chủ Nhật (08:30 - 11:30)', level: 'N3', monthlyFee: 1200000 },
    ]);
    await tx.insert(s.enrollments).values([
      { id: 'enr-1', studentId: 'usr-student-1', classId: 'cls-n5-01', joinDate: '2026-09-05' },
      { id: 'enr-2', studentId: 'usr-student-2', classId: 'cls-n5-01', joinDate: '2026-09-05' },
      { id: 'enr-3', studentId: 'usr-student-3', classId: 'cls-n5-01', joinDate: '2026-09-05' },
    ]);
    await tx.insert(s.assignments).values([
      { id: 'asg-1', classId: 'cls-n5-01', title: 'Bài tập 1: Chia thể động từ Te (て形) & Trợ từ に/で', description: 'Làm bài tập trang 45 Minna no Nihongo. Đặt 5 câu có sử dụng thể Te để nối hành động liên tiếp.', sampleSolution: '朝起きて、ご飯を食べて、学校へ行きます。', rubric: 'Chia đúng thể Te (4đ), Trợ từ chính xác (3đ), Ngữ nghĩa rõ ràng tự nhiên (3đ)', deadline: new Date('2026-11-05T23:59:59Z'), createdBy: teacherId },
      { id: 'asg-2', classId: 'cls-n5-01', title: 'Bài tập 2: Luyện viết 20 chữ Hán Kanji chủ đề Gia đình & Thời gian', description: 'Viết mỗi chữ Hán 3 dòng, chú ý thứ tự nét (bút thuận), âm On và âm Kun.', sampleSolution: '父 (Chichi / Fu), 母 (Haha / Bo), 時 (Toki / Ji)', rubric: 'Đúng nét bút thuận (5đ), Âm Hán Việt & On/Kun chính xác (5đ)', deadline: new Date('2026-11-10T23:59:59Z'), createdBy: teacherId },
    ]);
    await tx.insert(s.submissions).values([
      { id: 'sub-1', assignmentId: 'asg-1', studentId: 'usr-student-1', content: '1. 朝起きて、顔を洗います。\n2. 図書館へ行って、本を借ります。\n3. レストランで友達に会って、昼ご飯を食べました。', status: 'graded', score: '9.50', feedback: 'Rất xuất sắc! Thể Te chia chuẩn xác, ngữ nghĩa tự nhiên. Tiếp tục phát huy nhé An!', gradedByAi: true, submittedAt: new Date('2026-10-27T10:15:00Z'), gradedAt: new Date('2026-10-27T10:20:00Z') },
      { id: 'sub-2', assignmentId: 'asg-1', studentId: 'usr-student-2', content: 'Em nộp bài tập thể Te: 日曜日京都へ行って、写真をたくさん撮りました。', status: 'submitted', submittedAt: new Date('2026-10-28T02:00:00Z') },
    ]);
    await tx.insert(s.attendanceSessions).values([
      { id: 'ses-1', classId: 'cls-n5-01', qrCode: 'EDUSCAN_SESSION_cls-n5-01_2026-10-26_TOKEN992', sessionCode: 'ES-8921', sessionDate: '2026-10-26', startTime: new Date('2026-10-26T18:00:00Z'), endTime: new Date('2026-10-26T19:30:00Z'), isActive: false },
      { id: 'ses-2', classId: 'cls-n5-01', qrCode: 'EDUSCAN_SESSION_cls-n5-01_2026-10-28_LIVE', sessionCode: 'ES-3472', sessionDate: '2026-10-28', startTime: new Date('2026-10-28T18:00:00Z'), isActive: true },
    ]);
    await tx.insert(s.attendanceRecords).values([
      { id: 'rec-1', sessionId: 'ses-1', studentId: 'usr-student-1', status: 'present', checkInTime: new Date('2026-10-26T18:02:15Z'), notes: 'Quét QR tại lớp' },
      { id: 'rec-2', sessionId: 'ses-1', studentId: 'usr-student-2', status: 'present', checkInTime: new Date('2026-10-26T18:04:30Z'), notes: 'Quét QR tại lớp' },
      { id: 'rec-3', sessionId: 'ses-1', studentId: 'usr-student-3', status: 'absent', checkInTime: new Date('2026-10-26T19:30:00Z'), notes: 'Vắng có phép' },
    ]);
    await tx.insert(s.tuitionRecords).values([
      { id: 'tui-1', studentId: 'usr-student-1', classId: 'cls-n5-01', month: '10/2026', amount: 800000, paidAmount: 800000, dueDate: '2026-10-15', paidDate: '2026-10-08', status: 'paid', notes: 'Chuyển khoản Vietcombank' },
      { id: 'tui-2', studentId: 'usr-student-2', classId: 'cls-n5-01', month: '10/2026', amount: 800000, paidAmount: 0, dueDate: '2026-10-15', status: 'unpaid', notes: 'Hẹn nộp vào buổi học thứ 4' },
      { id: 'tui-3', studentId: 'usr-student-3', classId: 'cls-n5-01', month: '10/2026', amount: 800000, paidAmount: 800000, dueDate: '2026-10-15', paidDate: '2026-10-10', status: 'paid', notes: 'Đóng tiền mặt tại lớp' },
    ]);
    await tx.insert(s.notifications).values([
      { id: 'notif-1', userId: 'usr-student-1', title: 'Đã có điểm Bài tập thể Te', message: 'Thầy Quang đã chấm bài tập của bạn: 9.5/10 (Xuất sắc). Xem chi tiết nhận xét AI!', type: 'grade', isRead: false, createdAt: new Date('2026-10-27T10:25:00Z') },
      { id: 'notif-2', userId: 'usr-student-2', title: 'Nhắc nhở nộp học phí tháng 10/2026', message: 'Học phí tháng 10 của lớp N5 Sơ cấp 1 là 800.000 VNĐ. Em vui lòng hoàn tất nhé!', type: 'tuition', isRead: false, createdAt: new Date('2026-10-25T08:00:00Z') },
    ]);
  });
  return true;
}
