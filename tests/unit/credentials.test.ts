import { describe, it, expect } from 'vitest';
import { buildCredentialMessage, roleLabel } from '../../src/shared/utils/credentials';

describe('buildCredentialMessage', () => {
  it('có đủ họ tên, tên đăng nhập, mật khẩu tạm, địa chỉ đăng nhập và lưu ý đổi mật khẩu', () => {
    const text = buildCredentialMessage(
      { role: 'student', name: 'Nguyễn Văn An', email: 'an@eduscan.edu.vn', password: 'Ab3dE5fG' },
      'https://eduscan.example.com'
    );
    expect(text.split('\n')).toEqual([
      'Tài khoản EduScan',
      'Họ tên: Nguyễn Văn An',
      'Tên đăng nhập: an@eduscan.edu.vn',
      'Mật khẩu tạm: Ab3dE5fG',
      'Đăng nhập tại: https://eduscan.example.com',
      'Bạn sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.',
    ]);
  });
  it('nhãn vai trò', () => {
    expect(roleLabel('teacher')).toBe('giáo viên');
    expect(roleLabel('student')).toBe('học viên');
  });
});
