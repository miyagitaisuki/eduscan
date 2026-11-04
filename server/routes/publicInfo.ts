import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asc, gte, isNotNull, and } from 'drizzle-orm';
import { classes } from '../db/schema';
import { ah, todayStr } from '../lib/http';
import type { Deps } from './deps';

const hhmm = (t: unknown) => (t ? String(t).slice(0, 5) : null);

export function publicInfoRoutes({ db }: Deps) {
  const r = Router();

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  });

  // Công khai, chỉ đọc: lịch khai giảng cho website. Chỉ trả các lớp sắp khai giảng (start_date từ hôm nay trở đi)
  // và chỉ gồm cấp độ, ngày, thứ, giờ. Không có tên lớp, giáo viên, phòng, học phí hay học viên.
  r.get(
    '/classes',
    limiter,
    ah(async (_req, res) => {
      const rows = await db
        .select({
          level: classes.level,
          startDate: classes.startDate,
          weekdays: classes.weekdays,
          startTime: classes.lessonStartTime,
          endTime: classes.lessonEndTime,
        })
        .from(classes)
        .where(and(isNotNull(classes.startDate), gte(classes.startDate, todayStr())))
        .orderBy(asc(classes.startDate), asc(classes.level));

      const upcoming = rows.map((c) => ({
        level: c.level,
        start_date: String(c.startDate),
        weekdays: [...(c.weekdays ?? [])].sort((a, b) => a - b),
        start_time: hhmm(c.startTime),
        end_time: hhmm(c.endTime),
      }));
      const days = [...new Set(upcoming.flatMap((c) => c.weekdays))].sort((a, b) => a - b);

      res.set('Cache-Control', 'public, max-age=300');
      return res.json({ next_start_date: upcoming[0]?.start_date ?? null, weekdays: days, classes: upcoming });
    })
  );

  return r;
}
