import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { Type } from '@google/genai';
import { assignments, submissions, users } from '../db/schema';
import { submissionDto } from '../lib/dto';
import { ah, AuthedRequest } from '../lib/http';
import { canManageClass } from '../lib/access';
import type { Deps } from './deps';

// Lỗi AI được trả về rõ ràng (503). Không bao giờ trả điểm hay nhận xét giả thay cho kết quả AI.
function aiUnavailable(res: any, err: unknown) {
  console.error('[ai] Gemini error:', (err as any)?.message || err);
  return res.status(503).json({
    error: 'Không thể dùng AI lúc này. Vui lòng thử lại hoặc thao tác thủ công.',
    aiFallback: false,
  });
}

const GRADING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    gradeClassification: { type: Type.STRING },
    rubricBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING },
          maxScore: { type: Type.NUMBER },
          earnedScore: { type: Type.NUMBER },
          comment: { type: Type.STRING },
        },
        required: ['criterion', 'maxScore', 'earnedScore', 'comment'],
      },
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    detailedFeedback: { type: Type.STRING },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['score', 'gradeClassification', 'rubricBreakdown', 'strengths', 'weaknesses', 'detailedFeedback', 'suggestions'],
};

const GRADING_SYSTEM_PROMPT = `Bạn là chuyên gia giáo dục và giám khảo chấm bài công tâm, tỉ mỉ và ân cần.
Chấm điểm bài nộp dựa trên đề bài, đáp án mẫu và barem điểm trên thang 10.
Chỉ ra điểm mạnh, điểm yếu và lời khuyên sư phạm mang tính động viên giúp học viên cải thiện. Ngôn ngữ: Tiếng Việt chuẩn mực.`;

interface GradingInput {
  assignmentTitle?: string;
  assignmentDescription?: string;
  sampleSolution?: string;
  rubric?: string;
  studentName?: string;
  studentCode?: string;
  submissionContent?: string;
}

// Gọi Gemini chấm bài. Ném lỗi nếu AI không trả về kết quả hợp lệ.
async function gradeWithGemini(ai: NonNullable<Deps['ai']>, model: string, b: GradingInput) {
  const userPrompt = `ĐỀ BÀI: ${b.assignmentTitle}\nYÊU CẦU: ${b.assignmentDescription || 'Chuẩn bài học'}\nBẢN MẪU: ${b.sampleSolution || 'Đáp án chuẩn'}\nBAREM: ${b.rubric || 'Thang điểm 10'}\nHỌC VIÊN: ${b.studentName || 'Học viên'} (MSSV: ${b.studentCode || 'N/A'})\n\nBÀI LÀM:\n${b.submissionContent || '(Xem hình ảnh đính kèm)'}`;
  const response = await ai.models.generateContent({
    model,
    contents: [userPrompt],
    config: { systemInstruction: GRADING_SYSTEM_PROMPT, responseMimeType: 'application/json', responseSchema: GRADING_SCHEMA },
  });
  if (!response.text) throw new Error('empty response');
  return JSON.parse(response.text);
}

export function aiRoutes({ auth, ai, config, db }: Deps) {
  const r = Router();

  r.post(
    '/grade-assignment',
    auth.requireTeacher,
    ah(async (req, res) => {
      if (!ai) return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.', aiFallback: false });
      try {
        return res.json(await gradeWithGemini(ai, config.geminiModel, req.body ?? {}));
      } catch (err) {
        return aiUnavailable(res, err);
      }
    })
  );

  // Tạo bản nháp AI cho một bài nộp. Bản nháp KHÔNG thay đổi điểm: giáo viên xem, sửa, rồi mới chấm.
  r.post(
    '/drafts/:submissionId',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      if (!ai) return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.', aiFallback: false });

      const [row] = await db
        .select({ s: submissions, a: assignments, u: users })
        .from(submissions)
        .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
        .innerJoin(users, eq(users.id, submissions.studentId))
        .where(eq(submissions.id, req.params.submissionId))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Không tìm thấy bài nộp.' });
      if (!(await canManageClass(db, req.user, row.a.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được chấm bài của lớp mình phụ trách.' });
      }

      try {
        const result = await gradeWithGemini(ai, config.geminiModel, {
          assignmentTitle: row.a.title,
          assignmentDescription: row.a.description ?? '',
          sampleSolution: row.a.sampleSolution ?? '',
          rubric: row.a.rubric ?? '',
          studentName: row.u.fullName,
          studentCode: row.u.studentCode ?? '',
          submissionContent: row.s.content ?? '',
        });
        const [updated] = await db
          .update(submissions)
          .set({ aiDraft: result, aiDraftAt: new Date() })
          .where(eq(submissions.id, row.s.id))
          .returning();
        return res.json(submissionDto(updated));
      } catch (err) {
        return aiUnavailable(res, err);
      }
    })
  );

  // Bỏ bản nháp AI, giáo viên không dùng
  r.delete(
    '/drafts/:submissionId',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const [row] = await db
        .select({ s: submissions, a: assignments })
        .from(submissions)
        .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
        .where(eq(submissions.id, req.params.submissionId))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Không tìm thấy bài nộp.' });
      if (!(await canManageClass(db, req.user, row.a.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được chỉnh bài nộp của lớp mình phụ trách.' });
      }
      const [updated] = await db
        .update(submissions)
        .set({ aiDraft: null, aiDraftAt: null })
        .where(eq(submissions.id, row.s.id))
        .returning();
      return res.json(submissionDto(updated));
    })
  );

  r.post(
    '/generate-feedback',
    auth.requireTeacher,
    ah(async (req, res) => {
      const { assignmentTitle, studentName, score } = req.body ?? {};
      if (!ai) return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.', aiFallback: false });
      const prompt = `Viết nhận xét sư phạm ngắn gọn, khích lệ cho học viên ${studentName || 'học viên'} nộp bài tập "${assignmentTitle || 'Bài tập'}", đạt điểm ${score ?? 8.5}/10.`;
      try {
        const response = await ai.models.generateContent({ model: config.geminiModel, contents: prompt });
        if (!response.text) return aiUnavailable(res, new Error('empty response'));
        return res.json({
          detailedFeedback: response.text,
          actionableSuggestions: ['Ôn tập thêm từ vựng và cấu trúc ngữ pháp trọng tâm.'],
        });
      } catch (err) {
        return aiUnavailable(res, err);
      }
    })
  );

  return r;
}
