import { Router } from 'express';
import { Type } from '@google/genai';
import { and, asc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { attendanceSessions, classes, enrollments, holidays, lessons } from '../db/schema';
import type { AppDb } from '../db/client';
import { holidayDto, lessonDto } from '../lib/dto';
import { ah, AuthedRequest, todayStr } from '../lib/http';
import { newId } from '../lib/security';
import { audit } from '../lib/audit';
import { canManageClass, isAdmin, manageableClassIds } from '../lib/access';
import { parseDateOnly } from '../lib/validation';
import { toCsv } from '../lib/csv';
import { hhmm, weekdayOf } from '../lib/lessons';
import {
  addDays,
  applyLessonPlan,
  daysBetween,
  describeConflict,
  findLessonConflicts,
  MAX_LESSON_SPAN_DAYS,
  normalizeWeekdays,
  parseTimeOfDay,
  planLessonSync,
  resyncAllClasses,
  saveClassRule,
  type LessonRule,
} from '../lib/lessons';
import type { LessonSyncResult } from '../../src/shared/types';
import type { Deps } from './deps';

const MAX_TITLE_LENGTH = 255;
const MAX_BULK_TITLES = 400;
const MAX_SUGGESTIONS = 60;
const WEEKDAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MAX_RANGE_DAYS = 400;

// Admin xem mọi lớp, giáo viên xem lớp mình phụ trách, học viên xem lớp mình đang học
async function canViewClass(db: AppDb, user: AuthedRequest['user'], classId: string) {
  if (user.role === 'student') {
    const [row] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, user.id), eq(enrollments.classId, classId), eq(enrollments.status, 'active')))
      .limit(1);
    return !!row;
  }
  return canManageClass(db, user, classId);
}

// Các cặp "lớp|ngày" đã có phiên điểm danh (QR hoặc điểm danh nhanh)
async function attendedKeys(db: AppDb, classIds: string[], from: string, to: string) {
  if (classIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ classId: attendanceSessions.classId, d: attendanceSessions.sessionDate })
    .from(attendanceSessions)
    .where(and(inArray(attendanceSessions.classId, classIds), gte(attendanceSessions.sessionDate, from), lte(attendanceSessions.sessionDate, to)));
  return new Set(rows.map((r) => `${r.classId}|${r.d}`));
}

function parseRule(b: Record<string, any>): { rule: LessonRule } | { error: string } {
  const weekdays = normalizeWeekdays(b.weekdays);
  if (!weekdays) return { error: 'Hãy chọn ít nhất một thứ trong tuần (0 = Chủ Nhật ... 6 = Thứ Bảy).' };
  const startTime = parseTimeOfDay(b.start_time);
  const endTime = parseTimeOfDay(b.end_time);
  if (!startTime || !endTime) return { error: 'Giờ học không hợp lệ (định dạng HH:MM).' };
  if (startTime >= endTime) return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' };
  const startDate = parseDateOnly(b.start_date);
  if (!startDate) return { error: 'Ngày bắt đầu không hợp lệ (định dạng YYYY-MM-DD).' };

  let endDate: string | null | undefined;
  if (b.weeks !== undefined && b.weeks !== null && b.weeks !== '') {
    const weeks = Number(b.weeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks * 7 > MAX_LESSON_SPAN_DAYS) {
      return { error: `Số tuần phải từ 1 đến ${Math.floor(MAX_LESSON_SPAN_DAYS / 7)}.` };
    }
    endDate = addDays(startDate, weeks * 7 - 1);
  } else {
    endDate = parseDateOnly(b.end_date);
    if (!endDate) return { error: 'Cần nhập số tuần hoặc ngày kết thúc (YYYY-MM-DD).' };
  }
  if (endDate < startDate) return { error: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' };
  if (daysBetween(startDate, endDate) > MAX_LESSON_SPAN_DAYS) {
    return { error: `Lịch lặp tối đa ${MAX_LESSON_SPAN_DAYS} ngày.` };
  }
  return { rule: { weekdays, startTime, endTime, startDate, endDate } };
}

export function lessonRoutes({ db, auth, ai, config }: Deps) {
  const r = Router();

  // ---- Lịch của một lớp ----
  r.get(
    '/classes/:id/lessons',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const [cls] = await db.select({ id: classes.id, name: classes.name }).from(classes).where(eq(classes.id, req.params.id)).limit(1);
      if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      if (!(await canViewClass(db, req.user, cls.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được xem lịch của lớp mình phụ trách hoặc đang học.' });
      }
      const rows = await db.select().from(lessons).where(eq(lessons.classId, cls.id)).orderBy(asc(lessons.lessonDate));
      const attended = await attendedKeys(db, [cls.id], '1900-01-01', '9999-12-31');
      const today = todayStr();
      return res.json(rows.map((l) => lessonDto(l, { today, attended })));
    })
  );

  // Buổi học trong một khoảng ngày, mọi lớp mà người dùng được xem (Tổng quan, cổng học viên)
  r.get(
    '/lessons',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const from = parseDateOnly(req.query.from);
      const to = parseDateOnly(req.query.to);
      if (!from || !to) return res.status(400).json({ error: 'Cần from và to dạng YYYY-MM-DD.' });
      if (to < from || daysBetween(from, to) > MAX_RANGE_DAYS) {
        return res.status(400).json({ error: `Khoảng ngày không hợp lệ (tối đa ${MAX_RANGE_DAYS} ngày).` });
      }

      let classIds: string[] | null;
      if (req.user.role === 'student') {
        const mine = await db
          .select({ classId: enrollments.classId })
          .from(enrollments)
          .where(and(eq(enrollments.studentId, req.user.id), eq(enrollments.status, 'active')));
        classIds = mine.map((m) => m.classId);
      } else {
        classIds = await manageableClassIds(db, req.user);
      }
      if (typeof req.query.class_id === 'string' && req.query.class_id) {
        const wanted = req.query.class_id;
        classIds = classIds === null || classIds.includes(wanted) ? [wanted] : [];
      }
      if (classIds !== null && classIds.length === 0) return res.json([]);

      const conds = [gte(lessons.lessonDate, from), lte(lessons.lessonDate, to)];
      if (classIds) conds.push(inArray(lessons.classId, classIds));
      const rows = await db
        .select({ l: lessons, className: classes.name })
        .from(lessons)
        .innerJoin(classes, eq(classes.id, lessons.classId))
        .where(and(...conds))
        .orderBy(asc(lessons.lessonDate), asc(lessons.startTime));
      const attended = await attendedKeys(db, [...new Set(rows.map((x) => x.l.classId))], from, to);
      const today = todayStr();
      return res.json(rows.map((x) => lessonDto(x.l, { today, attended, className: x.className })));
    })
  );

  // ---- Đặt lịch lặp và sinh buổi học (admin) ----
  // dry_run: chỉ tính và trả kế hoạch. Có xung đột phòng/giáo viên thì cần allow_conflicts mới áp.
  r.post(
    '/classes/:id/lesson-plan',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const [cls] = await db.select().from(classes).where(eq(classes.id, req.params.id)).limit(1);
      if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      const parsed = parseRule(b);
      if ('error' in parsed) return res.status(400).json({ error: parsed.error });
      const { rule } = parsed;

      const today = todayStr();
      const dryRun = b.dry_run === true;
      const apply = async (tx: AppDb) => {
        const plan = await planLessonSync(tx, cls, rule, today);
        const blocked = plan.conflicts.length > 0 && b.allow_conflicts !== true;
        const willWrite = !dryRun && !blocked;
        if (willWrite) {
          await saveClassRule(tx, cls.id, rule);
          await applyLessonPlan(tx, cls.id, plan);
        }
        return { plan, blocked, willWrite };
      };
      const { plan, blocked, willWrite } = dryRun
        ? await apply(db)
        : await db.transaction((tx) => apply(tx as unknown as AppDb));

      if (!dryRun && blocked) {
        return res.status(409).json({
          error: `Lịch bị trùng phòng hoặc giáo viên: ${plan.conflicts.slice(0, 3).map(describeConflict).join('; ')}${plan.conflicts.length > 3 ? '…' : ''}`,
          conflicts: plan.conflicts,
        });
      }
      if (willWrite) {
        await audit(db, req.user.id, 'lessons.plan', cls.id, {
          created: plan.create.length,
          removed: plan.remove.length,
          updated: plan.update.length,
        });
      }
      const result: LessonSyncResult = {
        applied: willWrite,
        end_date: rule.endDate,
        total: plan.keep + plan.create.length + plan.update.length,
        create: plan.create.map((c) => c.date),
        update: plan.update.map((u) => u.date),
        remove: plan.remove.map((x) => x.date),
        keep: plan.keep,
        kept_off_schedule: plan.keptOffSchedule,
        skipped_holidays: plan.skippedHolidays,
        conflicts: plan.conflicts,
      };
      return res.json(result);
    })
  );

  // Gán nội dung lần lượt cho các buổi (mỗi dòng một buổi), bỏ qua buổi đã hủy.
  // Mặc định chỉ điền buổi còn trống; overwrite = true thì ghi đè từ buổi đầu tiên.
  r.post(
    '/classes/:id/lessons/titles',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const [cls] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, req.params.id)).limit(1);
      if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      if (!(await canManageClass(db, req.user, cls.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được sửa nội dung buổi học của lớp mình phụ trách.' });
      }
      const raw = req.body?.titles;
      if (!Array.isArray(raw)) return res.status(400).json({ error: 'titles phải là danh sách nội dung.' });
      const titles = raw.map((t) => String(t ?? '').trim()).filter(Boolean);
      if (titles.length === 0) return res.status(400).json({ error: 'Danh sách nội dung đang trống.' });
      if (titles.length > MAX_BULK_TITLES) return res.status(400).json({ error: `Tối đa ${MAX_BULK_TITLES} nội dung mỗi lần.` });
      if (titles.some((t) => t.length > MAX_TITLE_LENGTH)) {
        return res.status(400).json({ error: `Mỗi nội dung tối đa ${MAX_TITLE_LENGTH} ký tự.` });
      }

      const overwrite = req.body?.overwrite === true;
      // Mặc định chỉ gán từ hôm nay: lớp đang học dở dán giáo trình mới không được rơi vào buổi đã qua
      const includePast = req.body?.include_past === true;
      const conds = [eq(lessons.classId, cls.id), ne(lessons.status, 'cancelled')];
      if (!includePast) conds.push(gte(lessons.lessonDate, todayStr()));
      const rows = await db
        .select()
        .from(lessons)
        .where(and(...conds))
        .orderBy(asc(lessons.lessonDate));
      const targets = overwrite ? rows : rows.filter((l) => !l.title);
      const n = Math.min(targets.length, titles.length);
      await db.transaction(async (tx) => {
        for (let i = 0; i < n; i++) {
          await tx.update(lessons).set({ title: titles[i], manuallyEdited: true }).where(eq(lessons.id, targets[i].id));
        }
      });
      return res.json({ assigned: n, unassigned: titles.length - n });
    })
  );

  // Gợi ý nội dung cho các buổi bằng Gemini. Chỉ trả về danh sách để giáo viên xem và sửa,
  // không ghi vào DB. Lỗi AI trả 503 chứ không trả nội dung giả.
  r.post(
    '/classes/:id/lessons/suggest-titles',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      if (!ai) return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' });
      const [cls] = await db.select().from(classes).where(eq(classes.id, req.params.id)).limit(1);
      if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      if (!(await canManageClass(db, req.user, cls.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được soạn nội dung cho lớp mình phụ trách.' });
      }
      const count = Number(req.body?.count);
      if (!Number.isInteger(count) || count < 1 || count > MAX_SUGGESTIONS) {
        return res.status(400).json({ error: `Số buổi cần gợi ý phải từ 1 đến ${MAX_SUGGESTIONS}.` });
      }
      const hint = String(req.body?.hint ?? '').trim().slice(0, 300);
      const prompt = [
        `Lớp tiếng Nhật trình độ JLPT ${cls.level}, tên lớp: "${cls.name}".`,
        cls.description ? `Giáo trình / mục tiêu của lớp: ${cls.description}` : '',
        hint ? `Ghi chú thêm từ giáo viên: ${hint}` : '',
        `Hãy đề xuất đúng ${count} nội dung cho ${count} buổi học liên tiếp, đi từ dễ đến khó, ngắn gọn (dưới 80 ký tự mỗi nội dung), tiếng Việt.`,
      ]
        .filter(Boolean)
        .join('\n');
      try {
        const response = await ai.models.generateContent({
          model: config.geminiModel,
          contents: [prompt],
          config: {
            systemInstruction: 'Bạn là giáo viên tiếng Nhật có kinh nghiệm soạn kế hoạch giảng dạy. Chỉ trả về JSON đúng schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: { titles: { type: Type.ARRAY, items: { type: Type.STRING } } },
              required: ['titles'],
            },
          },
        });
        const parsed = JSON.parse(response.text ?? '');
        const titles = Array.isArray(parsed?.titles)
          ? parsed.titles.map((t: unknown) => String(t ?? '').trim().slice(0, MAX_TITLE_LENGTH)).filter(Boolean).slice(0, count)
          : [];
        if (titles.length === 0) return res.status(502).json({ error: 'AI không trả về nội dung nào. Thử lại hoặc nhập tay.' });
        return res.json({ titles });
      } catch (err) {
        console.error('[lessons] Gemini error:', (err as Error)?.message || err);
        return res.status(503).json({ error: 'Không thể dùng AI lúc này. Vui lòng thử lại hoặc nhập nội dung thủ công.' });
      }
    })
  );

  // Xuất lịch lớp ra CSV: vừa là file mẫu để điền nội dung, vừa là bản sao lưu
  r.get(
    '/classes/:id/lessons/export.csv',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const [cls] = await db.select().from(classes).where(eq(classes.id, req.params.id)).limit(1);
      if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      if (!(await canManageClass(db, req.user, cls.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được xuất lịch của lớp mình phụ trách.' });
      }
      const rows = await db.select().from(lessons).where(eq(lessons.classId, cls.id)).orderBy(asc(lessons.lessonDate));
      const body = rows.map((l) => [
        l.lessonDate,
        WEEKDAY_NAMES[weekdayOf(l.lessonDate)],
        hhmm(l.startTime),
        hhmm(l.endTime),
        l.status === 'cancelled' ? 'Đã hủy' : '',
        l.title,
        l.notes ?? '',
      ]);
      await audit(db, req.user.id, 'lessons.export_csv', cls.id, { count: rows.length });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="lich-hoc-${cls.id}-${todayStr()}.csv"`);
      return res.send(toCsv(['Ngày', 'Thứ', 'Giờ bắt đầu', 'Giờ kết thúc', 'Trạng thái', 'Nội dung', 'Ghi chú'], body));
    })
  );

  // Nhập nội dung từ CSV, khớp theo cột Ngày. Dòng không có nội dung và ghi chú bị bỏ qua (giữ nguyên buổi).
  // dry_run = true chỉ kiểm tra. Ghi thì đánh dấu buổi là đã sửa tay để đồng bộ lịch không ghi đè.
  r.post(
    '/classes/:id/lessons/import-csv',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const [cls] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, req.params.id)).limit(1);
      if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      if (!(await canManageClass(db, req.user, cls.id))) {
        return res.status(403).json({ error: 'Bạn chỉ được nhập nội dung cho lớp mình phụ trách.' });
      }
      const b = req.body ?? {};
      if (!Array.isArray(b.rows) || b.rows.length === 0) return res.status(400).json({ error: 'Không có dòng nào để nhập.' });
      if (b.rows.length > MAX_BULK_TITLES) return res.status(400).json({ error: `Mỗi lần nhập tối đa ${MAX_BULK_TITLES} dòng.` });

      const byDate = new Map(
        (await db.select().from(lessons).where(eq(lessons.classId, cls.id))).map((l) => [l.lessonDate, l])
      );
      const seen = new Set<string>();
      const results: { line: number; status: 'ok' | 'skip' | 'error'; lesson_date: string; title: string; errors: string[] }[] = [];
      const updates: { id: string; title?: string; notes: string }[] = [];

      for (const [i, raw] of (b.rows as unknown[]).entries()) {
        const row = (raw ?? {}) as Record<string, unknown>;
        const line = Number(row.line) || i + 1;
        const date = String(row.lesson_date ?? '').trim();
        const title = String(row.title ?? '').trim();
        const notes = String(row.notes ?? '').trim();
        const errors: string[] = [];
        const lesson = byDate.get(date);
        if (!date || !parseDateOnly(date)) errors.push('Ngày phải dạng YYYY-MM-DD.');
        else if (!lesson) errors.push('Lớp không có buổi học vào ngày này.');
        else if (lesson.status === 'cancelled') errors.push('Buổi này đã hủy.');
        if (date && seen.has(date)) errors.push('Ngày này xuất hiện nhiều lần trong file.');
        if (date) seen.add(date);
        if (title.length > MAX_TITLE_LENGTH) errors.push(`Nội dung tối đa ${MAX_TITLE_LENGTH} ký tự.`);

        if (errors.length > 0) {
          results.push({ line, status: 'error', lesson_date: date, title, errors });
        } else if (!title && !notes) {
          results.push({ line, status: 'skip', lesson_date: date, title, errors: ['Không có nội dung, giữ nguyên buổi.'] });
        } else {
          results.push({ line, status: 'ok', lesson_date: date, title, errors: [] });
          updates.push({ id: lesson!.id, ...(title ? { title } : {}), notes });
        }
      }

      const valid = updates.length;
      const invalid = results.filter((r) => r.status === 'error').length;
      if (b.dry_run === true) {
        return res.json({ dry_run: true, total: results.length, valid, skipped: results.length - valid - invalid, invalid, results });
      }
      await db.transaction(async (tx) => {
        for (const u of updates) {
          await tx
            .update(lessons)
            .set({ ...(u.title !== undefined ? { title: u.title } : {}), notes: u.notes || null, manuallyEdited: true })
            .where(eq(lessons.id, u.id));
        }
      });
      await audit(db, req.user.id, 'lessons.import_csv', cls.id, { updated: valid, invalid });
      return res.json({ dry_run: false, total: results.length, updated: valid, skipped: results.length - valid - invalid, invalid, results });
    })
  );

  // ---- Sửa / xóa một buổi (admin; giáo viên chỉ nội dung) ----
  r.patch(
    '/lessons/:id',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const [lesson] = await db.select().from(lessons).where(eq(lessons.id, req.params.id)).limit(1);
      if (!lesson) return res.status(404).json({ error: 'Không tìm thấy buổi học.' });
      if (!(await canManageClass(db, req.user, lesson.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được sửa buổi học của lớp mình phụ trách.' });
      }
      // Giáo viên chỉ sửa nội dung và ghi chú; lịch, giờ, trạng thái do admin quản lý
      if (!isAdmin(req.user)) {
        const scheduleFields = ['lesson_date', 'start_time', 'end_time', 'status'];
        if (scheduleFields.some((k) => b[k] !== undefined)) {
          return res.status(403).json({ error: 'Chỉ admin mới đổi ngày, giờ hoặc hủy buổi học.' });
        }
      }

      const set: Record<string, unknown> = {};
      if (b.title !== undefined) {
        const title = String(b.title ?? '').trim();
        if (title.length > MAX_TITLE_LENGTH) return res.status(400).json({ error: `Nội dung tối đa ${MAX_TITLE_LENGTH} ký tự.` });
        set.title = title;
      }
      if (b.notes !== undefined) set.notes = String(b.notes ?? '').trim() || null;
      if (b.status !== undefined) {
        if (b.status !== 'planned' && b.status !== 'cancelled') return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
        set.status = b.status;
      }
      if (b.lesson_date !== undefined) {
        const d = parseDateOnly(b.lesson_date);
        if (!d) return res.status(400).json({ error: 'Ngày học không hợp lệ (định dạng YYYY-MM-DD).' });
        set.lessonDate = d;
      }
      for (const [key, col] of [['start_time', 'startTime'], ['end_time', 'endTime']] as const) {
        if (b[key] === undefined) continue;
        const t = parseTimeOfDay(b[key]);
        if (!t) return res.status(400).json({ error: 'Giờ học không hợp lệ (định dạng HH:MM).' });
        set[col] = t;
      }
      if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });

      const next = {
        date: (set.lessonDate as string) ?? lesson.lessonDate,
        startTime: (set.startTime as string) ?? lesson.startTime.slice(0, 5),
        endTime: (set.endTime as string) ?? lesson.endTime.slice(0, 5),
        status: (set.status as string) ?? lesson.status,
      };
      if (next.startTime >= next.endTime) return res.status(400).json({ error: 'Giờ kết thúc phải sau giờ bắt đầu.' });

      if (next.date !== lesson.lessonDate) {
        const [dup] = await db
          .select({ id: lessons.id })
          .from(lessons)
          .where(and(eq(lessons.classId, lesson.classId), eq(lessons.lessonDate, next.date)))
          .limit(1);
        if (dup) return res.status(409).json({ error: 'Lớp đã có buổi học vào ngày này.' });
      }

      const schedulingChanged = set.lessonDate || set.startTime || set.endTime || (set.status === 'planned' && lesson.status === 'cancelled');
      if (schedulingChanged && next.status !== 'cancelled' && b.allow_conflicts !== true) {
        const [cls] = await db.select().from(classes).where(eq(classes.id, lesson.classId)).limit(1);
        const conflicts = await findLessonConflicts(db, cls, [next]);
        if (conflicts.length > 0) {
          return res.status(409).json({
            error: `Buổi học bị trùng: ${conflicts.slice(0, 3).map(describeConflict).join('; ')}`,
            conflicts,
          });
        }
      }

      const [row] = await db
        .update(lessons)
        .set({ ...set, manuallyEdited: true })
        .where(eq(lessons.id, lesson.id))
        .returning();
      const attended = await attendedKeys(db, [row.classId], row.lessonDate, row.lessonDate);
      return res.json(lessonDto(row, { today: todayStr(), attended }));
    })
  );

  r.delete(
    '/lessons/:id',
    auth.requireAdmin,
    ah(async (req, res) => {
      const deleted = await db.delete(lessons).where(eq(lessons.id, req.params.id)).returning({ id: lessons.id });
      if (deleted.length === 0) return res.status(404).json({ error: 'Không tìm thấy buổi học.' });
      return res.json({ success: true });
    })
  );

  // ---- Ngày nghỉ chung (admin quản lý, mọi người đăng nhập đều xem được) ----
  r.get(
    '/holidays',
    auth.requireAuth,
    ah(async (_req, res) => {
      const rows = await db.select().from(holidays).orderBy(asc(holidays.startDate));
      return res.json(rows.map(holidayDto));
    })
  );

  // Thêm/xóa ngày nghỉ áp lại lịch mọi lớp: buổi chưa chốt trong ngày nghỉ bị bỏ, buổi đã chốt được giữ
  r.post(
    '/holidays',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const name = String(b.name ?? '').trim();
      if (!name) return res.status(400).json({ error: 'Tên ngày nghỉ không được để trống.' });
      if (name.length > 150) return res.status(400).json({ error: 'Tên ngày nghỉ tối đa 150 ký tự.' });
      const startDate = parseDateOnly(b.start_date);
      if (!startDate) return res.status(400).json({ error: 'Ngày bắt đầu nghỉ không hợp lệ (định dạng YYYY-MM-DD).' });
      const endDate = b.end_date === undefined || b.end_date === null || b.end_date === '' ? startDate : parseDateOnly(b.end_date);
      if (!endDate) return res.status(400).json({ error: 'Ngày kết thúc nghỉ không hợp lệ (định dạng YYYY-MM-DD).' });
      if (endDate < startDate) return res.status(400).json({ error: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' });
      if (daysBetween(startDate, endDate) > 60) return res.status(400).json({ error: 'Một kỳ nghỉ tối đa 61 ngày.' });

      const today = todayStr();
      const { row, sync } = await db.transaction(async (tx) => {
        const [h] = await tx.insert(holidays).values({ id: newId('hol'), name, startDate, endDate }).returning();
        return { row: h, sync: await resyncAllClasses(tx as unknown as AppDb, today) };
      });
      await audit(db, req.user.id, 'holiday.create', row.id, { name, startDate, endDate, removed: sync.removed });
      return res.status(201).json({ ...holidayDto(row), removed_lessons: sync.removed });
    })
  );

  r.delete(
    '/holidays/:id',
    auth.requireAdmin,
    ah(async (req: AuthedRequest, res) => {
      const today = todayStr();
      const result = await db.transaction(async (tx) => {
        const deleted = await tx.delete(holidays).where(eq(holidays.id, req.params.id)).returning({ id: holidays.id });
        if (deleted.length === 0) return null;
        return resyncAllClasses(tx as unknown as AppDb, today);
      });
      if (!result) return res.status(404).json({ error: 'Không tìm thấy ngày nghỉ.' });
      await audit(db, req.user.id, 'holiday.delete', req.params.id, { created: result.created });
      return res.json({ success: true, created_lessons: result.created });
    })
  );

  return r;
}
