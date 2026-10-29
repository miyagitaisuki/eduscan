import { describe, it, expect } from 'vitest';
import {
  teacherTabFromPath,
  teacherPath,
  classIdFromSearch,
  studentTabFromPath,
  studentPath,
} from '../../src/app/routes';

describe('teacherTabFromPath', () => {
  it('nhận đúng các tab giáo viên', () => {
    expect(teacherTabFromPath('/dashboard', false)).toBe('dashboard');
    expect(teacherTabFromPath('/homework', false)).toBe('homework');
    expect(teacherTabFromPath('/Classes/', false)).toBe('classes');
  });
  it('tab chỉ dành cho admin trả null với giáo viên thường', () => {
    expect(teacherTabFromPath('/tuition', false)).toBeNull();
    expect(teacherTabFromPath('/teachers', false)).toBeNull();
    expect(teacherTabFromPath('/tuition', true)).toBe('tuition');
    expect(teacherTabFromPath('/teachers', true)).toBe('teachers');
  });
  it('đường dẫn lạ hoặc gốc trả null để chuyển về trang mặc định', () => {
    expect(teacherTabFromPath('/', true)).toBeNull();
    expect(teacherTabFromPath('/khong-co', true)).toBeNull();
    expect(teacherTabFromPath('/home', true)).toBeNull();
  });
});

describe('teacherPath / classIdFromSearch', () => {
  it('tạo và đọc lại tham số lớp', () => {
    expect(teacherPath('students')).toBe('/students');
    const path = teacherPath('attendance', 'cls n5/01');
    expect(path).toBe('/attendance?class=cls%20n5%2F01');
    expect(classIdFromSearch(path.split('?')[1])).toBe('cls n5/01');
  });
  it('không có tham số thì undefined', () => {
    expect(classIdFromSearch('')).toBeUndefined();
    expect(classIdFromSearch('class=')).toBeUndefined();
  });
});

describe('student routes', () => {
  it('nhận các tab học viên', () => {
    expect(studentTabFromPath('/home')).toBe('home');
    expect(studentTabFromPath('/notifications')).toBe('notifications');
    expect(studentTabFromPath('/dashboard')).toBeNull();
    expect(studentTabFromPath('/')).toBeNull();
    expect(studentPath('tuition')).toBe('/tuition');
  });
});
