import { Router } from 'express';
import { asc, sql } from 'drizzle-orm';
import { textbookLessons } from '../db/schema';
import { ah, AuthedRequest } from '../lib/http';
import { newId } from '../lib/security';
import { gradableExercises, validateLessonFile } from '../lib/textbook';
import type { Deps } from './deps';

// Thư viện giáo trình riêng: giáo viên nhập lesson.json một lần, sau đó giao bài từ đây.
export function textbookRoutes({ db, auth }: Deps) {
  const r = Router();

  r.get(
    '/lessons',
    auth.requireTeacher,
    ah(async (_req, res) => {
      const rows = await db
        .select()
        .from(textbookLessons)
        .orderBy(asc(textbookLessons.book), asc(textbookLessons.lessonNo));
      return res.json(
        rows.map((l) => ({
          id: l.id,
          book: l.book,
          lesson_no: l.lessonNo,
          title_ja: l.titleJa,
          title_vi: l.titleVi,
          updated_at: l.updatedAt.toISOString(),
          exercises: gradableExercises(l.data).map((ex) => ({ id: ex.id, title: ex.title, count: ex.items.length })),
        }))
      );
    })
  );

  // Nhập (hoặc nhập lại) file lesson.json; bài trùng (book, lesson_no) được ghi đè.
  // Bài đã giao giữ nguyên vì assignments.payload là bản chụp lúc giao.
  r.post(
    '/import',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const book = String(req.body?.book ?? '').trim();
      if (!book || book.length > 100) return res.status(400).json({ error: 'Cần tên giáo trình (tối đa 100 ký tự).' });
      const checked = validateLessonFile(req.body?.data);
      if ('error' in checked) return res.status(400).json({ error: checked.error });

      const now = new Date();
      const rows = checked.lessons.map((l) => ({
        id: newId('tbl'),
        book,
        lessonNo: l.no,
        titleJa: typeof l.title_ja === 'string' ? l.title_ja : '',
        titleVi: typeof l.title_vi === 'string' ? l.title_vi : '',
        data: l,
        updatedBy: req.user.id,
        updatedAt: now,
      }));
      await db
        .insert(textbookLessons)
        .values(rows)
        .onConflictDoUpdate({
          target: [textbookLessons.book, textbookLessons.lessonNo],
          set: {
            titleJa: sql`excluded.title_ja`,
            titleVi: sql`excluded.title_vi`,
            data: sql`excluded.data`,
            updatedBy: sql`excluded.updated_by`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      const exercises = checked.lessons.reduce((n, l) => n + gradableExercises(l).length, 0);
      return res.json({ book, lessons: rows.length, gradable_exercises: exercises });
    })
  );

  return r;
}
