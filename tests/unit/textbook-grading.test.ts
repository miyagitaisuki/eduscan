import { describe, it, expect } from 'vitest';
import { gradableExercises, gradeTextbook, isCorrect, publicPayload, validateLessonFile } from '../../server/lib/textbook';
import { LESSON_FILE } from '../fixtures/textbookLesson';

describe('chấm bài giáo trình', () => {
  it('bỏ qua khoảng trắng, dấu câu, chữ toàn/nửa độ rộng', () => {
    expect(isCorrect('明日は雨が降るそうです', '明日は　雨が　{降|ふ}るそうです。')).toBe(true);
    expect(isCorrect('３，０００円です。', '3,000円です')).toBe(true);
  });

  it('chữ có furigana trong đáp án viết bằng kana cũng đúng', () => {
    expect(isCorrect('明日は雨がふるそうです。', '明日は　雨が　{降|ふ}るそうです。')).toBe(true);
    expect(isCorrect('明日は雨が降りそうです。', '明日は　雨が　{降|ふ}るそうです。')).toBe(false);
  });

  it('phần giải thích trong ngoặc （…） của đáp án là tùy chọn', () => {
    expect(isCorrect('雨です。', '雨です（{一日中|いちにちじゅう}）。')).toBe(true);
    expect(isCorrect('雨です（いちにちじゅう）', '雨です（{一日中|いちにちじゅう}）。')).toBe(true);
  });

  it('sách chỉ ghi phần biến đổi: câu đầy đủ chép đúng phần đầu đề bài cũng đúng', () => {
    const prompt = 'デパートで　{物産展|ぶっさんてん}が　あります';
    const answer = '{物産展|ぶっさんてん}が　あるそうです。';
    expect(isCorrect('物産展があるそうです', answer, prompt)).toBe(true);
    expect(isCorrect('デパートで物産展があるそうです。', answer, prompt)).toBe(true);
    expect(isCorrect('デパートでぶっさんてんがあるそうです', answer, prompt)).toBe(true);
    // phần đầu không lấy từ đề bài thì không tự chấm đúng
    expect(isCorrect('学校で物産展があるそうです', answer, prompt)).toBe(false);
    expect(isCorrect('デパートで物産展があります', answer, prompt)).toBe(false);
    expect(isCorrect('デパートで物産展がありますあるそうです', 'あるそうです', prompt)).toBe(false);
    expect(isCorrect('北海道の海産物はしんせんだそうです', '{新鮮|しんせん}だそうです。', '北海道の　{海産物|かいさんぶつ}は　{新鮮|しんせん}です')).toBe(true);
  });

  it('câu bỏ trống là sai', () => {
    expect(isCorrect('', '雨です')).toBe(false);
  });

  it('chỉ lấy bài tập có đủ đáp án, thêm phần đọc hiểu', () => {
    const ex = gradableExercises(LESSON_FILE.lessons[0]);
    expect(ex.map((e) => e.id)).toEqual(['renshuu.1.A', 'yomikaki.reading']);
    expect(ex[0].title).toBe('Ⅰ-A　〜そうです');
    expect(ex[0].items[1].key).toBe('renshuu.1.A#2');
    expect(ex[1].passage).toBe('今日は　雨です。');
  });

  it('tính điểm thang 10 và đánh dấu câu cần xem lại', () => {
    const payload = { source: {} as any, exercises: gradableExercises(LESSON_FILE.lessons[0]) };
    const g = gradeTextbook(payload, { 'renshuu.1.A#1': '明日は雨がふるそうです', 'yomikaki.reading#1': '晴れです' });
    expect(g).toMatchObject({ correct: 1, total: 3, score: 3.33 });
    expect(g.results['renshuu.1.A#2']).toBe('review');
  });

  it('bản gửi học viên không có đáp án trước hạn', () => {
    const payload = { source: {} as any, exercises: gradableExercises(LESSON_FILE.lessons[0]) };
    const hidden = publicPayload(payload, false)!;
    expect(hidden.exercises[0].items[0]).not.toHaveProperty('answer');
    expect(publicPayload(payload, true)!.exercises[0].items[0].answer).toContain('そうです');
  });

  it('từ chối file không đúng định dạng', () => {
    expect(validateLessonFile({ schema: 'x', lessons: [] })).toHaveProperty('error');
    expect(validateLessonFile({ ...LESSON_FILE, lessons: [{ no: 1 }, { no: 1 }] })).toHaveProperty('error');
    expect(validateLessonFile(LESSON_FILE)).toHaveProperty('lessons');
  });
});
