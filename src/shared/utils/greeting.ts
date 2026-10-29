import { Gender } from '../types';

// Tên gọi trong tiếng Việt là từ cuối của họ tên (VD: "Nguyễn Thanh Quang" -> "Quang")
const givenName = (fullName: string) => fullName.trim().split(/\s+/).pop() ?? fullName;

// Giáo viên: Nam -> Thầy, Nữ -> Cô. Chưa khai giới tính thì dùng họ tên đầy đủ như trước.
export function teacherGreeting(fullName?: string, gender?: Gender | null): string {
  if (!fullName) return 'Xin chào';
  if (gender === 'male') return `Xin chào Thầy ${givenName(fullName)}`;
  if (gender === 'female') return `Xin chào Cô ${givenName(fullName)}`;
  return `Xin chào ${fullName}`;
}

// Học viên: Nam -> anh, Nữ -> chị. Chưa khai giới tính thì gọi là bạn.
export function studentGreeting(fullName: string, gender?: Gender | null): string {
  if (gender === 'male') return `Chào anh ${givenName(fullName)}`;
  if (gender === 'female') return `Chào chị ${givenName(fullName)}`;
  return `Chào bạn ${fullName}`;
}
