import { describe, it, expect } from 'vitest';
import {
  addDays,
  generateLessonDates,
  normalizeWeekdays,
  parseTimeOfDay,
  scheduleLabel,
  timesOverlap,
  weekdayOf,
} from '../../server/lib/lessons';
import { parseScheduleDays } from '../../src/shared/utils/schedule';

describe('sinh ngày học', () => {
  // 2030-01-07 là Thứ Hai
  const rule = { weekdays: [1, 3, 5], startTime: '18:00', endTime: '19:30', startDate: '2030-01-07', endDate: '2030-01-20' };

  it('chỉ lấy đúng các thứ đã chọn trong khoảng ngày', () => {
    expect(weekdayOf('2030-01-07')).toBe(1);
    const { dates } = generateLessonDates(rule, []);
    expect(dates).toEqual(['2030-01-07', '2030-01-09', '2030-01-11', '2030-01-14', '2030-01-16', '2030-01-18']);
  });

  it('bỏ ngày nghỉ chung và báo ngày bị bỏ', () => {
    const { dates, skipped } = generateLessonDates(rule, [{ name: 'Nghỉ lễ', startDate: '2030-01-09', endDate: '2030-01-14' }]);
    expect(dates).toEqual(['2030-01-07', '2030-01-16', '2030-01-18']);
    expect(skipped.map((s) => s.date)).toEqual(['2030-01-09', '2030-01-11', '2030-01-14']);
  });

  it('cộng ngày không lệch qua tháng, năm nhuận', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2029-12-31', 1)).toBe('2030-01-01');
  });

  it('có Chủ Nhật', () => {
    const { dates } = generateLessonDates({ ...rule, weekdays: [0], endDate: '2030-01-14' }, []);
    expect(dates).toEqual(['2030-01-13']);
  });
});

describe('chuẩn hóa dữ liệu lịch', () => {
  it('weekdays: loại trùng, sắp xếp, từ chối giá trị lạ', () => {
    expect(normalizeWeekdays([5, 1, 1, 3])).toEqual([1, 3, 5]);
    expect(normalizeWeekdays([])).toBeUndefined();
    expect(normalizeWeekdays([7])).toBeUndefined();
    expect(normalizeWeekdays(['1'])).toBeUndefined();
  });

  it('giờ: nhận HH:MM và HH:MM:SS, từ chối giờ sai', () => {
    expect(parseTimeOfDay('08:30')).toBe('08:30');
    expect(parseTimeOfDay('18:00:00')).toBe('18:00');
    expect(parseTimeOfDay('24:00')).toBeUndefined();
    expect(parseTimeOfDay('8:30')).toBeUndefined();
  });

  it('khoảng giờ chạm đầu mút không tính là chồng', () => {
    expect(timesOverlap('18:00', '19:30', '19:30', '21:00')).toBe(false);
    expect(timesOverlap('18:00', '19:30', '19:00', '20:00')).toBe(true);
  });

  it('nhãn lịch đọc lại đúng bằng parseScheduleDays', () => {
    for (const days of [[1, 3, 5], [0], [0, 6], [0, 2, 4, 6]]) {
      expect(parseScheduleDays(scheduleLabel(days, '18:00', '19:30'))).toEqual(days);
    }
    expect(scheduleLabel([1, 3, 5], '18:00', '19:30')).toBe('Thứ 2 - 4 - 6 (18:00 - 19:30)');
  });
});
