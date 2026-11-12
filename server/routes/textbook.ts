import { Router } from 'express';
import { asc, eq, sql } from 'drizzle-orm';
import { textbookAudio, textbookLessons } from '../db/schema';
import { ah, AuthedRequest } from '../lib/http';
import { newId } from '../lib/security';
import { gradableExercises, validateLessonFile } from '../lib/textbook';
import { AUDIO_CODE, uploadTextbookAudio } from '../lib/textbookAudio';
import { StorageError } from '../lib/storage';
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

  // Danh sách mã ♪ đã có file của một giáo trình (để giáo viên biết còn thiếu gì)
  r.get(
    '/audio',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const book = String(req.query.book ?? '').trim();
      if (!book) return res.status(400).json({ error: 'Cần tên giáo trình.' });
      const rows = await db
        .select({ code: textbookAudio.code, hasSrt: textbookAudio.srtPath, updatedAt: textbookAudio.updatedAt })
        .from(textbookAudio)
        .where(eq(textbookAudio.book, book))
        .orderBy(asc(textbookAudio.code));
      return res.json(rows.map((x) => ({ code: x.code, has_srt: !!x.hasSrt, updated_at: x.updatedAt.toISOString() })));
    })
  );

  // Tải lên một đoạn âm thanh: mp3 (base64) + phụ đề .srt (tùy chọn). Trùng mã thì thay file cũ.
  r.post(
    '/audio',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const book = String(req.body?.book ?? '').trim();
      const code = String(req.body?.code ?? '').trim();
      if (!book || book.length > 100) return res.status(400).json({ error: 'Cần tên giáo trình.' });
      if (!AUDIO_CODE.test(code)) return res.status(400).json({ error: 'Mã âm thanh không hợp lệ (ví dụ 1-01).' });
      const mp3 = req.body?.mp3_base64;
      if (typeof mp3 !== 'string' || !mp3) return res.status(400).json({ error: 'Thiếu tệp mp3.' });
      const srt = typeof req.body?.srt_text === 'string' ? req.body.srt_text : null;
      try {
        const { mp3Path, srtPath } = await uploadTextbookAudio(book, code, mp3, srt);
        const now = new Date();
        await db
          .insert(textbookAudio)
          .values({ id: newId('tba'), book, code, mp3Path, srtPath, updatedBy: req.user.id, updatedAt: now })
          .onConflictDoUpdate({
            target: [textbookAudio.book, textbookAudio.code],
            set: { mp3Path, srtPath, updatedBy: req.user.id, updatedAt: now },
          });
        return res.json({ book, code, has_srt: !!srtPath });
      } catch (err) {
        if (err instanceof StorageError) return res.status(err.status).json({ error: err.message });
        throw err;
      }
    })
  );

  return r;
}
