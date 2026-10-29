import { describe, expect, it } from 'vitest';
import { studentGreeting, teacherGreeting } from '../../src/shared/utils/greeting';

describe('lời chào theo giới tính', () => {
  it('giáo viên nam là Thầy, nữ là Cô, chưa khai thì giữ họ tên', () => {
    expect(teacherGreeting('Nguyễn Thanh Quang', 'male')).toBe('Xin chào Thầy Quang');
    expect(teacherGreeting('Phùng Thị Trang', 'female')).toBe('Xin chào Cô Trang');
    expect(teacherGreeting('Nguyễn Thanh Quang', null)).toBe('Xin chào Nguyễn Thanh Quang');
    expect(teacherGreeting(undefined, 'male')).toBe('Xin chào');
  });

  it('học viên nam là anh, nữ là chị, chưa khai thì gọi bạn', () => {
    expect(studentGreeting('Võ Văn An', 'male')).toBe('Chào anh An');
    expect(studentGreeting('Võ Thuỳ Trang', 'female')).toBe('Chào chị Trang');
    expect(studentGreeting('Võ Văn An', undefined)).toBe('Chào bạn Võ Văn An');
  });
});
