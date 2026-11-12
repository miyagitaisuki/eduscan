// lesson.json tổng hợp (không phải nội dung giáo trình thật), đúng định dạng demix/giaotrinh.
export const LESSON_FILE = {
  schema: 'imeji-lesson/1',
  characters: [],
  audio_scripts: [],
  lessons: [
    {
      no: 1,
      title_ja: '{雨|あめ}が　{降|ふ}るそうです',
      title_vi: 'Truyền đạt tin tức',
      exercises: [
        {
          id: 'renshuu.1.A',
          section: 'renshuu',
          part: 'Ⅰ',
          part_title: '〜そうです',
          label: 'A',
          audio: '1-04',
          instruction: 'Chuyển sang 〜そうです.',
          example: ['{例|れい}）雨です → 雨だそうです。'],
          passage: null,
          kind: 'short_answer',
          items: [
            { n: 1, prompt: '明日は　雨が　{降|ふ}ります', answer: '明日は　雨が　{降|ふ}るそうです。' },
            { n: 2, prompt: 'ジョンくんは　{忙|いそが}しいです', answer: 'ジョンくんは　{忙|いそが}しいそうです。' },
          ],
        },
        { id: 'matome.B', section: 'matome', label: 'B', kind: 'survey', items: [] },
      ],
      reading: {
        title: '読みもの　Bài đọc',
        audio: '1-05',
        text: '今日は　雨です。',
        questions: [{ n: 1, prompt: '今日は　どんな　天気ですか。', answer: '雨です（{一日中|いちにちじゅう}）。' }],
      },
      dialogues: [
        {
          part: 'Ⅰ',
          audio: '1-01',
          situation: '{雨|あめ}の　{話|はなし}',
          lines: [
            { n: 1, speaker: 'ミン', text: '明日は{雨|あめ}ですか。' },
            { n: 2, speaker: 'ゆい', text: 'はい、雨だそうです。' },
          ],
        },
      ],
    },
    { no: 2, title_ja: '第二課', title_vi: 'Bài 2', exercises: [] },
  ],
};
