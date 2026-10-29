import { and, eq, gte, inArray, isNotNull, lte, ne } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { attendanceSessions, classes, holidays, lessons } from '../db/schema';
import { newId } from './security';

// Lịch giảng: sinh buổi học từ quy tắc lặp hàng tuần, trừ ngày nghỉ chung.
// Mọi ngày là chuỗi YYYY-MM-DD và giờ là HH:MM thuần (không múi giờ), nên thao tác ngày dùng UTC
// chỉ để cộng trừ lịch, không bao giờ lệch ngày theo giờ máy chủ.

/** Một lịch lặp không kéo dài quá khoảng này (chặn nhập nhầm năm, sinh hàng nghìn buổi) */
export const MAX_LESSON_SPAN_DAYS = 370;

export interface LessonRule {
  /** 0 = Chủ Nhật ... 6 = Thứ Bảy */
  weekdays: number[];
  /** HH:MM */
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
}

export interface HolidayRange {
  name: string;
  startDate: string;
  endDate: string;
}

export const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** HH:MM từ giá trị time của Postgres (HH:MM:SS) hoặc từ request */
export const hhmm = (t: string): string => t.slice(0, 5);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** Chuẩn hóa giờ về HH:MM; undefined nếu không hợp lệ */
export function parseTimeOfDay(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = TIME_RE.exec(v.trim());
  return m ? `${m[1]}:${m[2]}` : undefined;
}

/** Danh sách thứ trong tuần: loại trùng, sắp xếp; undefined nếu rỗng hoặc có giá trị ngoài 0-6 */
export function normalizeWeekdays(v: unknown): number[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const set = new Set<number>();
  for (const x of v) {
    if (!Number.isInteger(x) || x < 0 || x > 6) return undefined;
    set.add(x);
  }
  return [...set].sort((a, b) => a - b);
}

/** Nhãn lịch học dạng chuỗi, giữ tương thích với parseScheduleDays: "Thứ 2 - 4 - 6 & Chủ Nhật (18:00 - 19:30)" */
export function scheduleLabel(weekdays: number[], startTime: string, endTime: string): string {
  const weekdayNumbers = weekdays.filter((d) => d >= 1).map((d) => d + 1);
  const parts: string[] = [];
  if (weekdayNumbers.length) parts.push(`Thứ ${weekdayNumbers.join(' - ')}`);
  if (weekdays.includes(0)) parts.push('Chủ Nhật');
  return `${parts.join(' & ')} (${hhmm(startTime)} - ${hhmm(endTime)})`;
}

/** Hai khoảng giờ HH:MM trong cùng một ngày có chồng nhau không (chạm đầu mút không tính) */
export const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  hhmm(aStart) < hhmm(bEnd) && hhmm(bStart) < hhmm(aEnd);

const holidayOn = (date: string, list: HolidayRange[]) => list.find((h) => h.startDate <= date && date <= h.endDate);

/** Các ngày học theo quy tắc, bỏ ngày nghỉ chung (trả riêng danh sách ngày bị bỏ) */
export function generateLessonDates(rule: LessonRule, holidayList: HolidayRange[]) {
  const dates: string[] = [];
  const skipped: { date: string; name: string }[] = [];
  const days = new Set(rule.weekdays);
  const span = Math.min(daysBetween(rule.startDate, rule.endDate), MAX_LESSON_SPAN_DAYS);
  for (let i = 0; i <= span; i++) {
    const date = addDays(rule.startDate, i);
    if (!days.has(weekdayOf(date))) continue;
    const holiday = holidayOn(date, holidayList);
    if (holiday) skipped.push({ date, name: holiday.name });
    else dates.push(date);
  }
  return { dates, skipped };
}

// ---- Xung đột phòng học / giáo viên ----

export interface LessonConflict {
  date: string;
  class_id: string;
  class_name: string;
  kind: 'teacher' | 'room';
}

interface ConflictSubject {
  id: string;
  teacherId: string;
  room: string | null;
}

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
}

const normRoom = (room: string | null | undefined) => (room ?? '').trim().toLowerCase();

/** Các buổi của lớp khác (chưa hủy) cùng ngày, chồng giờ và trùng giáo viên hoặc phòng với các khung giờ đưa vào */
export async function findLessonConflicts(db: AppDb, cls: ConflictSubject, slots: Slot[]): Promise<LessonConflict[]> {
  if (slots.length === 0) return [];
  const dates = slots.map((s) => s.date).sort();
  const others = await db
    .select({ l: lessons, teacherId: classes.teacherId, room: classes.room, className: classes.name })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .where(
      and(
        ne(lessons.classId, cls.id),
        ne(lessons.status, 'cancelled'),
        gte(lessons.lessonDate, dates[0]),
        lte(lessons.lessonDate, dates[dates.length - 1])
      )
    );
  const room = normRoom(cls.room);
  const found: LessonConflict[] = [];
  for (const slot of slots) {
    for (const o of others) {
      if (o.l.lessonDate !== slot.date) continue;
      if (!timesOverlap(slot.startTime, slot.endTime, o.l.startTime, o.l.endTime)) continue;
      const base = { date: slot.date, class_id: o.l.classId, class_name: o.className };
      if (o.teacherId === cls.teacherId) found.push({ ...base, kind: 'teacher' });
      if (room && normRoom(o.room) === room) found.push({ ...base, kind: 'room' });
    }
  }
  return found;
}

export const describeConflict = (c: LessonConflict) =>
  `${c.date}: trùng ${c.kind === 'teacher' ? 'giáo viên' : 'phòng học'} với lớp "${c.class_name}"`;

// ---- Đồng bộ lịch ----

export interface LessonSyncPlan {
  create: Slot[];
  update: (Slot & { id: string })[];
  remove: { id: string; date: string }[];
  /** Buổi giữ nguyên, kể cả buổi được bảo vệ */
  keep: number;
  /** Buổi được bảo vệ nhưng nằm ngoài lịch mới (đã điểm danh, đã sửa tay, đã qua hoặc đã hủy) */
  keptOffSchedule: number;
  skippedHolidays: { date: string; name: string }[];
  conflicts: LessonConflict[];
}

/**
 * Tính những gì cần thêm, sửa, xóa để lịch của lớp khớp quy tắc, mà không ghi gì vào DB.
 * Chỉ buổi "chưa chốt" mới bị đụng tới: còn ở tương lai, chưa điểm danh, chưa bị sửa tay, chưa hủy.
 */
export async function planLessonSync(
  db: AppDb,
  cls: ConflictSubject,
  rule: LessonRule,
  today: string
): Promise<LessonSyncPlan> {
  const holidayRows = await db.select().from(holidays);
  const { dates, skipped } = generateLessonDates(rule, holidayRows);
  const wanted = new Set(dates);

  const existing = await db.select().from(lessons).where(eq(lessons.classId, cls.id));
  const attendedRows = await db
    .select({ d: attendanceSessions.sessionDate })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.classId, cls.id));
  const attended = new Set(attendedRows.map((r) => r.d));

  const plan: LessonSyncPlan = {
    create: [],
    update: [],
    remove: [],
    keep: 0,
    keptOffSchedule: 0,
    skippedHolidays: skipped,
    conflicts: [],
  };
  const taken = new Set<string>();

  for (const l of existing) {
    taken.add(l.lessonDate);
    const locked = l.manuallyEdited || l.status === 'cancelled' || l.lessonDate <= today || attended.has(l.lessonDate);
    const inPlan = wanted.has(l.lessonDate);
    if (locked) {
      plan.keep++;
      if (!inPlan) plan.keptOffSchedule++;
    } else if (!inPlan) {
      plan.remove.push({ id: l.id, date: l.lessonDate });
    } else if (hhmm(l.startTime) !== rule.startTime || hhmm(l.endTime) !== rule.endTime) {
      plan.update.push({ id: l.id, date: l.lessonDate, startTime: rule.startTime, endTime: rule.endTime });
    } else {
      plan.keep++;
    }
  }
  for (const date of dates) {
    if (!taken.has(date)) plan.create.push({ date, startTime: rule.startTime, endTime: rule.endTime });
  }

  plan.conflicts = await findLessonConflicts(db, cls, [...plan.create, ...plan.update]);
  return plan;
}

/** Ghi kế hoạch vào DB; gọi trong transaction cùng với việc lưu quy tắc của lớp */
export async function applyLessonPlan(db: AppDb, classId: string, plan: LessonSyncPlan) {
  const removeIds = plan.remove.map((r) => r.id);
  if (removeIds.length) await db.delete(lessons).where(inArray(lessons.id, removeIds));
  for (const u of plan.update) {
    await db.update(lessons).set({ startTime: u.startTime, endTime: u.endTime }).where(eq(lessons.id, u.id));
  }
  for (let i = 0; i < plan.create.length; i += 200) {
    await db.insert(lessons).values(
      plan.create.slice(i, i + 200).map((c) => ({
        id: newId('les'),
        classId,
        lessonDate: c.date,
        startTime: c.startTime,
        endTime: c.endTime,
      }))
    );
  }
}

export async function saveClassRule(db: AppDb, classId: string, rule: LessonRule) {
  await db
    .update(classes)
    .set({
      weekdays: rule.weekdays,
      lessonStartTime: rule.startTime,
      lessonEndTime: rule.endTime,
      startDate: rule.startDate,
      endDate: rule.endDate,
      // Giữ chuỗi lịch tự do đồng bộ để Tổng quan và các màn hình cũ vẫn đọc được
      schedule: scheduleLabel(rule.weekdays, rule.startTime, rule.endTime),
    })
    .where(eq(classes.id, classId));
}

/**
 * Áp lại quy tắc đã lưu của mọi lớp (sau khi thêm/xóa ngày nghỉ chung). Idempotent: không có gì đổi thì không ghi.
 * Xung đột phòng/giáo viên không chặn ở đây vì admin đã chấp nhận chúng khi áp lịch.
 */
export async function resyncAllClasses(db: AppDb, today: string) {
  const rows = await db
    .select()
    .from(classes)
    .where(and(isNotNull(classes.weekdays), isNotNull(classes.lessonStartTime), isNotNull(classes.lessonEndTime), isNotNull(classes.startDate), isNotNull(classes.endDate)));
  let created = 0;
  let removed = 0;
  for (const c of rows) {
    if (!c.weekdays?.length) continue;
    const plan = await planLessonSync(
      db,
      c,
      {
        weekdays: c.weekdays,
        startTime: hhmm(c.lessonStartTime!),
        endTime: hhmm(c.lessonEndTime!),
        startDate: c.startDate!,
        endDate: c.endDate!,
      },
      today
    );
    await applyLessonPlan(db, c.id, plan);
    created += plan.create.length;
    removed += plan.remove.length;
  }
  return { classes: rows.length, created, removed };
}
