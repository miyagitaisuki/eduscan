import { useCallback, useRef, useState } from 'react';
import { Lesson } from '../../shared/types';
import { lessonService } from '../../services';
import { addDaysLocal, todayLocal } from '../../shared/utils/date';
import type { Loader } from './types';

/** Buổi học từ hôm nay đến chừng này ngày tới: đủ cho "hôm nay học gì" và "buổi sắp tới" */
const WINDOW_DAYS = 30;

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
      const data = await lessonService.getLessons(todayLocal(), addDaysLocal(WINDOW_DAYS));
      if (request !== requestRef.current) return false;
      setLessons(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { lessons, load, reset };
}
