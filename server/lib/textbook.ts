// Bài tập giáo trình riêng: dữ liệu lấy từ lesson.json (demix/giaotrinh, schema "imeji-lesson/1").
// Furigana viết {漢字|かな}. Server tự chấm: so câu trả lời với đáp án mẫu sau khi chuẩn hóa,
// chữ có furigana trong đáp án được chấp nhận viết bằng chữ Hán hoặc bằng kana.

export const LESSON_SCHEMA = 'imeji-lesson/1';
export const READING_ID = 'yomikaki.reading';

export interface TextbookDialogue {
  audio: string | null;
  part: string | null;
  situation: string;
  lines: { n: number | null; speaker: string; text: string }[];
  /** Có khi trả cho học viên và đã có file âm thanh */
  audio_url?: string | null;
}

export interface TextbookItem {
  key: string; // "<mã bài tập>#<số câu>", duy nhất trong một bài giao
  n: number;
  prompt: string;
  answer?: string | null;
}

export interface TextbookExercise {
  id: string;
  title: string;
  instruction: string;
  example: string[];
  passage: string | null;
  /** Mã ♪ của phần nghe / bài đọc (vd "1-04") */
  audio?: string | null;
  audio_url?: string | null;
  items: TextbookItem[];
}

export interface TextbookPayload {
  source: { book: string; lesson_no: number; lesson_id: string; title_ja: string; title_vi: string };
  exercises: TextbookExercise[];
  /** Hội thoại của bài (hiện cho học viên kèm nút nghe và lời thoại làm phụ đề) */
  dialogues?: TextbookDialogue[];
  /** Có trong bản gửi học viên: true khi đáp án mẫu được hiện (đã qua hạn nộp) */
  answers_visible?: boolean;
}

export type ItemResult = 'correct' | 'review';

// ---------------------------------------------------------------- nhập lesson.json

/** Kiểm tra file lesson.json; trả danh sách bài hợp lệ hoặc thông báo lỗi. */
export function validateLessonFile(data: any): { lessons: any[] } | { error: string } {
  if (!data || typeof data !== 'object' || data.schema !== LESSON_SCHEMA) {
    return { error: `File không đúng định dạng giáo trình (cần "schema": "${LESSON_SCHEMA}").` };
  }
  if (!Array.isArray(data.lessons) || data.lessons.length === 0) return { error: 'File không có bài nào.' };
  if (data.lessons.length > 200) return { error: 'Tối đa 200 bài mỗi lần nhập.' };
  const seen = new Set<number>();
  for (const l of data.lessons) {
    if (!l || typeof l !== 'object' || !Number.isInteger(l.no) || l.no < 1 || l.no > 999) {
      return { error: 'Mỗi bài cần số bài "no" là số nguyên từ 1 đến 999.' };
    }
    if (seen.has(l.no)) return { error: `Bài ${l.no} bị lặp trong file.` };
    seen.add(l.no);
    if (l.exercises !== undefined && !Array.isArray(l.exercises)) return { error: `Bài ${l.no}: "exercises" phải là mảng.` };
  }
  return { lessons: data.lessons };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const codeOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Hội thoại của bài, đúng thứ tự trong sách; không có đáp án nên học viên xem được. */
export function lessonDialogues(lesson: any): TextbookDialogue[] {
  const out: TextbookDialogue[] = [];
  for (const d of Array.isArray(lesson?.dialogues) ? lesson.dialogues : []) {
    if (!d || !Array.isArray(d.lines)) continue;
    out.push({
      audio: codeOrNull(d.audio),
      part: codeOrNull(d.part),
      situation: str(d.situation),
      lines: d.lines
        .filter((l: any) => l && typeof l.text === 'string')
        .map((l: any) => ({ n: Number.isInteger(l.n) ? l.n : null, speaker: str(l.speaker), text: l.text })),
    });
  }
  return out;
}

function exerciseTitle(ex: any): string {
  const label = str(ex.label);
  if (ex.section === 'matome') return `まとめ ${label}`.trim();
  const part = str(ex.part);
  const head = [part, label].filter(Boolean).join('-');
  return [head, str(ex.part_title)].filter(Boolean).join('　');
}

/** Các bài tập chấm tự động được của một bài: có câu hỏi và mọi câu đều có đáp án. */
export function gradableExercises(lesson: any): TextbookExercise[] {
  const out: TextbookExercise[] = [];
  const pack = (id: string, title: string, src: any, items: any[], passage: string | null): void => {
    if (!Array.isArray(items) || items.length === 0) return;
    if (!items.every((i) => i && typeof i.answer === 'string' && i.answer.trim() && typeof i.prompt === 'string')) return;
    out.push({
      id,
      title,
      instruction: str(src?.instruction),
      example: Array.isArray(src?.example) ? src.example.filter((x: unknown) => typeof x === 'string') : [],
      passage,
      audio: codeOrNull(src?.audio),
      items: items.map((i, idx) => ({
        key: `${id}#${Number.isInteger(i.n) ? i.n : idx + 1}`,
        n: Number.isInteger(i.n) ? i.n : idx + 1,
        prompt: i.prompt,
        answer: i.answer,
      })),
    });
  };
  for (const ex of Array.isArray(lesson?.exercises) ? lesson.exercises : []) {
    if (!ex || typeof ex.id !== 'string') continue;
    pack(ex.id, exerciseTitle(ex), ex, ex.items, typeof ex.passage === 'string' ? ex.passage : null);
  }
  const rd = lesson?.reading;
  if (rd && Array.isArray(rd.questions)) {
    pack(READING_ID, `読みもの　${str(rd.title).replace(/^読みもの[　\s]*/, '') || 'Bài đọc'}`,
      { instruction: 'Đọc bài và trả lời câu hỏi.', audio: rd.audio }, rd.questions, str(rd.text) || null);
  }
  return out;
}

/** Bản gửi học viên: bỏ đáp án mẫu trừ khi đã được phép xem. */
export function publicPayload(payload: TextbookPayload | null, revealAnswers: boolean): TextbookPayload | null {
  if (!payload) return null;
  return {
    ...payload,
    answers_visible: revealAnswers,
    exercises: payload.exercises.map((ex) => ({
      ...ex,
      items: ex.items.map(({ answer, ...rest }) => (revealAnswers ? { ...rest, answer } : rest)),
    })),
  };
}

/** Mọi mã ♪ mà bài cần (hội thoại, phần nghe, bài đọc). */
export function audioCodes(payload: TextbookPayload): string[] {
  const codes = [
    ...(payload.dialogues ?? []).map((d) => d.audio),
    ...payload.exercises.map((e) => e.audio),
  ];
  return [...new Set(codes.filter((c): c is string => !!c))];
}

/** Gắn link nghe đã ký vào hội thoại và bài tập có mã ♪ (chỉ những mã đã có file). */
export function attachAudioUrls(payload: TextbookPayload, urls: Map<string, string>): TextbookPayload {
  return {
    ...payload,
    dialogues: (payload.dialogues ?? []).map((d) => ({ ...d, audio_url: d.audio ? urls.get(d.audio) ?? null : null })),
    exercises: payload.exercises.map((e) => ({ ...e, audio_url: e.audio ? urls.get(e.audio) ?? null : null })),
  };
}

// ---------------------------------------------------------------- chấm

const RUBY = /\{([^{}|]+)\|([^{}|]+)\}/g;
// Dấu câu, ngoặc và khoảng trắng không tính khi so (sau NFKC: （）！？ thành ()!?)
const IGNORED = /[\s。、，,．.!?「」『』()［］[\]【】・…〜~：:；;"'“”‘’→]/gu;

export function normalizeAnswer(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(IGNORED, '');
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Biểu thức khớp một đáp án mẫu: mỗi chữ có furigana nhận cả chữ gốc lẫn cách đọc. */
function answerPattern(answer: string): RegExp {
  let src = '';
  let pos = 0;
  for (const m of answer.matchAll(RUBY)) {
    src += esc(normalizeAnswer(answer.slice(pos, m.index)));
    src += `(?:${esc(normalizeAnswer(m[1]))}|${esc(normalizeAnswer(m[2]))})`;
    pos = (m.index ?? 0) + m[0].length;
  }
  src += esc(normalizeAnswer(answer.slice(pos)));
  return new RegExp(`^${src}$`, 'u');
}

/** Đề bài thành dãy đơn vị: mỗi chữ thường là một đơn vị, chữ có furigana nhận chữ gốc hoặc cách đọc. */
function promptUnits(prompt: string): string[][] {
  const units: string[][] = [];
  const pushText = (t: string) => {
    for (const ch of normalizeAnswer(t)) units.push([ch]);
  };
  let pos = 0;
  for (const m of prompt.matchAll(RUBY)) {
    pushText(prompt.slice(pos, m.index));
    units.push([normalizeAnswer(m[1]), normalizeAnswer(m[2])]);
    pos = (m.index ?? 0) + m[0].length;
  }
  pushText(prompt.slice(pos));
  return units;
}

/**
 * prefix có đúng là phần đầu của đề bài, dừng ngay trước chỗ đáp án bắt đầu không.
 * startChars: chữ đầu của đáp án (chữ gốc và cách đọc). Chặn kiểu chép cả đề rồi viết thêm đáp án.
 */
function isPromptPrefix(prefix: string, units: string[][], startChars: Set<string>): boolean {
  const go = (at: number, u: number): boolean => {
    if (at === prefix.length) return u < units.length && units[u].some((alt) => startChars.has(alt[0]));
    if (u >= units.length) return false;
    return units[u].some((alt) => alt && prefix.startsWith(alt, at) && go(at + alt.length, u + 1));
  };
  return go(0, 0);
}

/**
 * Đúng nếu khớp đáp án mẫu, có hoặc không có phần giải thích trong ngoặc （…）.
 * Sách thường chỉ ghi phần biến đổi (物産展が　あるそうです) nên câu đầy đủ cũng đúng
 * khi phần đứng trước đáp án chép đúng phần đầu của đề bài (デパートで…).
 */
export function isCorrect(given: string, answer: string, prompt = ''): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  const variants = [...new Set([answer, answer.replace(/[（(][^（）()]*[)）]/g, '')])].map(answerPattern);
  if (variants.some((re) => re.test(g))) return true;
  if (!prompt) return false;
  const units = promptUnits(prompt);
  const first = promptUnits(answer)[0] ?? [];
  const startChars = new Set(first.map((alt) => alt[0]).filter(Boolean));
  for (let i = 1; i < g.length; i++) {
    const tail = g.slice(i);
    if (variants.some((re) => re.test(tail)) && isPromptPrefix(g.slice(0, i), units, startChars)) return true;
  }
  return false;
}

export function gradeTextbook(payload: TextbookPayload, answers: Record<string, string>) {
  const results: Record<string, ItemResult> = {};
  let correct = 0;
  let total = 0;
  for (const ex of payload.exercises) {
    for (const item of ex.items) {
      total += 1;
      const ok = isCorrect(answers[item.key] ?? '', item.answer ?? '', item.prompt);
      results[item.key] = ok ? 'correct' : 'review';
      if (ok) correct += 1;
    }
  }
  const score = total ? Math.round((correct / total) * 1000) / 100 : 0;
  return { results, correct, total, score };
}
