import { useCallback, useRef, useState } from 'react';
import { Lesson } from '../../shared/types';
import { lessonService } from '../../services';
import { addDaysLocal } from '../../shared/utils/date';
import type { Loader } from './types';

/**
 * Buổi học đủ rộng cho cả giáo viên và học viên:
 * - 30 ngày tới: "hôm nay học gì" và "buổi sắp tới"
 * - 365 ngày trước: tính tỷ lệ chăm chỉ của học viên trên các buổi đã diễn ra
 * Tổng khoảng 395 ngày, nằm trong giới hạn 400 ngày của API /lessons.
 */
const PAST_DAYS = 365;
const FUTURE_DAYS = 30;

export function useLessonsData() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const requestRef = useRef(0);

  const reset = useCallback(() => {
    requestRef.current++;
    setLessons([]);
  }, []);

  const load = useCallback<Loader>(async () => {
    const request = ++requestRef.current;
    try {
      const data = await lessonService.getLessons(addDaysLocal(-PAST_DAYS), addDaysLocal(FUTURE_DAYS));
      if (request !== requestRef.current) return false;
      setLessons(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { lessons, load, reset };
}
