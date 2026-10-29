import { useCallback, useState } from 'react';
import { Lesson } from '../../shared/types';
import { lessonService } from '../../services';
import { addDaysLocal, todayLocal } from '../../shared/utils/date';
import type { Loader } from './types';

/** Buổi học từ hôm nay đến chừng này ngày tới: đủ cho "hôm nay học gì" và "buổi sắp tới" */
const WINDOW_DAYS = 30;

export function useLessonsData() {
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const load = useCallback<Loader>(async () => {
    try {
      setLessons(await lessonService.getLessons(todayLocal(), addDaysLocal(WINDOW_DAYS)));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { lessons, load };
}
