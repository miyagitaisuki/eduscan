import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { homeworkService } from '../../../services/homeworkService';
import { JaText } from '../../../shared/components/JaText';
import type { TextbookLessonSummary } from '../../../shared/types';

export interface TextbookPick {
  lessonId: string;
  exerciseIds: string[];
  defaultTitle: string;
}

const plain = (s: string) => s.replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1');
const AUDIO_NAME = /^(\d{1,3}-\d{1,2})\.mp3$/i;
const SRT_NAME = /^\d{1,3}-\d{1,2}\.srt$/i;

// Đọc tệp thành base64 (không kèm tiền tố data URL)
function toBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  });
}

// Phần chọn bài giáo trình trong form giao bài: chọn bài, tick bài tập; nhập lesson.json nếu thư viện còn trống.
export const TextbookAssignFields: React.FC<{ onChange: (pick: TextbookPick | null) => void }> = ({ onChange }) => {
  const [lessons, setLessons] = useState<TextbookLessonSummary[] | null>(null);
  const [lessonId, setLessonId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [book, setBook] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [audioCodes, setAudioCodes] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  const load = async (keepId?: string) => {
    try {
      const list = await homeworkService.getTextbookLessons();
      setLessons(list);
      const first = list.find((l) => l.id === keepId) ?? list[0];
      if (first) {
        setLessonId(first.id);
        setSelected(first.exercises.map((e) => e.id));
      }
    } catch (e) {
      setLessons([]);
      setMessage(e instanceof Error ? e.message : 'Không tải được thư viện giáo trình.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const lesson = lessons?.find((l) => l.id === lessonId);

  // Mã ♪ đã có file của giáo trình đang chọn
  useEffect(() => {
    if (!lesson?.book) return;
    homeworkService
      .getTextbookAudio(lesson.book)
      .then((rows) => setAudioCodes(new Set(rows.map((r) => r.code))))
      .catch(() => setAudioCodes(new Set()));
  }, [lesson?.book]);

  // Tải lên các mp3 đã chọn; mỗi file tên "1-01.mp3" đi kèm "1-01.srt" nếu có trong cùng lần chọn
  const uploadAudio = async (files: FileList | null) => {
    if (!lesson || !files || files.length === 0) return;
    const list = Array.from(files);
    const srtByCode = new Map<string, File>();
    for (const f of list) {
      const m = /^(\d{1,3}-\d{1,2})\.srt$/i.exec(f.name);
      if (m) srtByCode.set(m[1], f);
    }
    const mp3s = list.filter((f) => AUDIO_NAME.test(f.name));
    const skipped = list.filter((f) => !AUDIO_NAME.test(f.name) && !SRT_NAME.test(f.name)).length;
    if (mp3s.length === 0) {
      setMessage('Chọn file có tên dạng 1-01.mp3 (kèm 1-01.srt nếu có).');
      return;
    }
    setUploading(true);
    setMessage('');
    let ok = 0;
    const failed: string[] = [];
    for (const f of mp3s) {
      const code = AUDIO_NAME.exec(f.name)![1];
      try {
        const srt = srtByCode.get(code);
        await homeworkService.uploadTextbookAudio(lesson.book, code, await toBase64(f), srt ? await srt.text() : null);
        ok += 1;
        setAudioCodes((cur) => new Set(cur).add(code));
      } catch (e) {
        failed.push(`${code}: ${e instanceof Error ? e.message : 'lỗi'}`);
      }
    }
    setUploading(false);
    if (audioRef.current) audioRef.current.value = '';
    setMessage(
      `Đã tải ${ok}/${mp3s.length} file âm thanh.` +
        (skipped > 0 ? ` Bỏ qua ${skipped} file không đúng tên.` : '') +
        (failed.length ? ` Lỗi: ${failed.join('; ')}` : '')
    );
  };

  useEffect(() => {
    onChange(
      lesson
        ? {
            lessonId: lesson.id,
            exerciseIds: selected,
            defaultTitle: `${lesson.book} – Bài ${lesson.lesson_no}: ${plain(lesson.title_ja)}`,
          }
        : null
    );
  }, [lesson, selected, onChange]);

  const pickLesson = (id: string) => {
    setLessonId(id);
    setSelected(lessons?.find((l) => l.id === id)?.exercises.map((e) => e.id) ?? []);
  };

  const importFile = async (file: File) => {
    if (!book.trim()) {
      setMessage('Nhập tên giáo trình trước (VD: Cuốn 8).');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = JSON.parse(await file.text());
      const r = await homeworkService.importTextbook(book.trim(), data);
      setMessage(`Đã nhập ${r.lessons} bài, ${r.gradable_exercises} bài tập tự chấm được.`);
      await load(lessonId);
    } catch (e) {
      setMessage(e instanceof SyntaxError ? 'File không phải JSON hợp lệ.' : e instanceof Error ? e.message : 'Nhập thất bại.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (lessons === null) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải thư viện giáo trình...
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {lessons.length > 0 && (
        <>
          <select
            aria-label="Bài giáo trình"
            value={lessonId}
            onChange={(e) => pickLesson(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
          >
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.book} – Bài {l.lesson_no}: {plain(l.title_ja)}
              </option>
            ))}
          </select>
          {lesson && lesson.exercises.length === 0 && (
            <p className="text-xs text-warning-700">Bài này chưa có bài tập nào đủ đáp án để tự chấm.</p>
          )}
          {lesson && lesson.exercises.length > 0 && (
            <fieldset className="space-y-1 p-2.5 border border-slate-200 rounded-xl">
              <legend className="px-1 text-xs font-bold text-slate-700">Bài tập giao</legend>
              {lesson.exercises.map((ex) => (
                <label key={ex.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(ex.id)}
                    onChange={(e) =>
                      setSelected((cur) => (e.target.checked ? [...cur, ex.id] : cur.filter((x) => x !== ex.id)))
                    }
                  />
                  <JaText text={ex.title} />
                  <span className="text-slate-500">({ex.count} câu)</span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}

      {lesson && (
        <details className="text-xs">
          <summary className="cursor-pointer font-bold text-primary-700">
            Âm thanh: {audioCodes.size} đoạn đã có file
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-slate-500">
              Tên file theo mã ♪ trong sách: <code>1-01.mp3</code> (hội thoại), <code>1-04.mp3</code> (phần nghe). Có
              <code>1-01.srt</code> cùng lúc thì lưu kèm phụ đề. Tạo file bằng textts (xem demix/giaotrinh).
            </p>
            <input
              ref={audioRef}
              type="file"
              multiple
              accept=".mp3,.srt,audio/mpeg"
              aria-label="Tệp âm thanh và phụ đề"
              disabled={uploading}
              onChange={(e) => uploadAudio(e.target.files)}
              className="block w-full text-xs"
            />
            {uploading && (
              <p className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải lên...
              </p>
            )}
          </div>
        </details>
      )}

      <details className="text-xs" open={lessons.length === 0}>
        <summary className="cursor-pointer font-bold text-primary-700">
          {lessons.length === 0 ? 'Thư viện trống: nhập giáo trình (lesson.json)' : 'Nhập hoặc cập nhật giáo trình (lesson.json)'}
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-slate-500">
            Tạo file bằng <code>python -m gtlesson GIAOTRINH.docx -o out</code> (repo demix/giaotrinh). Nhập lại cùng tên giáo
            trình sẽ cập nhật bài, không đổi các bài đã giao.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Tên giáo trình"
              placeholder="Tên giáo trình, VD: Cuốn 8"
              value={book}
              onChange={(e) => setBook(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Chọn file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label="File lesson.json"
              onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
            />
          </div>
        </div>
      </details>
      {message && <p className="text-xs font-semibold text-slate-700">{message}</p>}
    </div>
  );
};
