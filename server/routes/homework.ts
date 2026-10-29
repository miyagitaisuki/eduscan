import { Router } from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { assignments, classes, enrollments, notifications, submissions, users } from '../db/schema';
import { assignmentDto, submissionDto } from '../lib/dto';
import { ah, AuthedRequest, isStudent } from '../lib/http';
import { newId } from '../lib/security';
import { StorageError, uploadHomeworkAttachment } from '../lib/storage';
import { canManageClass, manageableClassIds } from '../lib/access';
import type { Deps } from './deps';
import type { AppDb } from '../db/client';

async function enrolledClassIds(db: AppDb, studentId: string) {
  const rows = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.status, 'active')));
  return rows.map((r) => r.classId);
}

export function homeworkRoutes({ db, auth }: Deps) {
  const r = Router();

  // ---- Bài tập ----
  r.get(
    '/assignments',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const classId = req.query.class_id as string | undefined;
      const conds = [];
      if (classId) conds.push(eq(assignments.classId, classId));
      if (isStudent(req)) {
        const ids = await enrolledClassIds(db, req.user.id);
        if (ids.length === 0) return res.json([]);
        conds.push(inArray(assignments.classId, ids));
      } else {
        const owned = await manageableClassIds(db, req.user);
        if (owned) {
          if (owned.length === 0) return res.json([]);
          conds.push(inArray(assignments.classId, owned));
        }
      }
      const rows = await db
        .select({ a: assignments, className: classes.name })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .where(conds.length ? and(...conds) : undefined);
      const counts = await db
        .select({ assignmentId: submissions.assignmentId, n: sql<number>`count(*)::int` })
        .from(submissions)
        .where(eq(submissions.status, 'submitted'))
        .groupBy(submissions.assignmentId);
      const countMap = new Map(counts.map((c) => [c.assignmentId, c.n]));
      return res.json(
        rows.map((row) =>
          assignmentDto(row.a, { class_name: row.className, submitted_count: countMap.get(row.a.id) ?? 0 })
        )
      );
    })
  );

  r.get(
    '/assignments/:id',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const [row] = await db
        .select({ a: assignments, className: classes.name })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .where(eq(assignments.id, req.params.id))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Không tìm thấy bài tập.' });
      if (isStudent(req)) {
        const ids = await enrolledClassIds(db, req.user.id);
        if (!ids.includes(row.a.classId)) return res.status(403).json({ error: 'Bạn không thuộc lớp của bài tập này.' });
      } else if (!(await canManageClass(db, req.user, row.a.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được xem bài tập của lớp mình phụ trách.' });
      }
      return res.json(assignmentDto(row.a, { class_name: row.className }));
    })
  );

  r.post(
    '/assignments',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      if (!b.class_id || !b.title) return res.status(400).json({ error: 'Thiếu class_id hoặc tiêu đề bài tập' });
      if (!(await canManageClass(db, req.user, b.class_id))) {
        return res.status(403).json({ error: 'Bạn chỉ được giao bài cho lớp mình phụ trách.' });
      }
      const deadline = b.deadline ? new Date(b.deadline) : new Date(Date.now() + 7 * 86400000);
      if (Number.isNaN(deadline.getTime())) return res.status(400).json({ error: 'Hạn nộp không hợp lệ.' });

      const [row] = await db
        .insert(assignments)
        .values({
          id: newId('asg'),
          classId: b.class_id,
          title: String(b.title).trim(),
          description: b.description || '',
          sampleSolution: b.sample_solution || '',
          rubric: b.rubric || 'Thang điểm 10',
          deadline,
          createdBy: req.user.id,
        })
        .returning();

      // Thông báo cho học viên đang học lớp này
      const students = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(and(eq(enrollments.classId, b.class_id), eq(enrollments.status, 'active')));
      if (students.length > 0) {
        await db.insert(notifications).values(
          students.map((s) => ({
            id: newId('notif'),
            userId: s.studentId,
            title: 'Bài tập mới vừa được giao!',
            message: `Giáo viên vừa giao bài tập: "${row.title}". Hạn chót: ${deadline.toISOString().split('T')[0]}.`,
            type: 'assignment',
          }))
        );
      }
      return res.status(201).json(assignmentDto(row));
    })
  );

  r.delete(
    '/assignments/:id',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const [asg] = await db.select().from(assignments).where(eq(assignments.id, req.params.id)).limit(1);
      if (!asg) return res.status(404).json({ error: 'Không tìm thấy bài tập.' });
      if (!(await canManageClass(db, req.user, asg.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được xóa bài tập của lớp mình phụ trách.' });
      }
      // Xóa bài tập kéo theo bài nộp (ON DELETE CASCADE)
      await db.delete(assignments).where(eq(assignments.id, asg.id));
      return res.json({ success: true });
    })
  );

  // ---- Bài nộp ----
  r.get(
    '/submissions/my',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const rows = await db
        .select({ s: submissions, a: assignments })
        .from(submissions)
        .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
        .where(eq(submissions.studentId, req.user.id));
      return res.json(
        rows.map((row) =>
          submissionDto(row.s, { assignment_title: row.a.title, deadline: row.a.deadline.toISOString() })
        )
      );
    })
  );

  r.get(
    '/submissions',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      const conds = [];
      if (req.query.assignment_id) conds.push(eq(submissions.assignmentId, String(req.query.assignment_id)));
      const studentId = isStudent(req) ? req.user.id : (req.query.student_id as string | undefined);
      if (studentId) conds.push(eq(submissions.studentId, studentId));
      if (!isStudent(req)) {
        const owned = await manageableClassIds(db, req.user);
        if (owned) {
          if (owned.length === 0) return res.json([]);
          conds.push(inArray(assignments.classId, owned));
        }
      }

      const rows = await db
        .select({ s: submissions, u: users, a: assignments })
        .from(submissions)
        .innerJoin(users, eq(users.id, submissions.studentId))
        .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
        .where(conds.length ? and(...conds) : undefined);
      return res.json(
        rows.map((row) =>
          submissionDto(row.s, {
            student_name: row.u.fullName,
            student_code: row.u.studentCode ?? '',
            assignment_title: row.a.title,
          })
        )
      );
    })
  );

  // Học viên nộp bài (ghi đè bài cũ của chính mình nếu nộp lại)
  r.post(
    '/submissions',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      if (!isStudent(req)) return res.status(403).json({ error: 'Chỉ học viên mới được nộp bài.' });
      const { assignment_id, content, attachment_url } = req.body ?? {};
      if (!assignment_id) return res.status(400).json({ error: 'Thiếu assignment_id' });

      const [asg] = await db.select().from(assignments).where(eq(assignments.id, assignment_id)).limit(1);
      if (!asg) return res.status(404).json({ error: 'Không tìm thấy bài tập.' });
      const ids = await enrolledClassIds(db, req.user.id);
      if (!ids.includes(asg.classId)) return res.status(403).json({ error: 'Bạn không thuộc lớp của bài tập này.' });

      // Tệp mới (data URL) được đưa lên Storage; chỉ lưu đường dẫn ngắn vào database.
      let attachmentPath = attachment_url || '';
      if (typeof attachmentPath === 'string' && attachmentPath.startsWith('data:')) {
        try {
          attachmentPath = await uploadHomeworkAttachment(attachmentPath, `${asg.id}/${req.user.id}`);
        } catch (err) {
          if (err instanceof StorageError) return res.status(err.status).json({ error: err.message });
          throw err;
        }
      }

      const [row] = await db
        .insert(submissions)
        .values({
          id: newId('sub'),
          assignmentId: asg.id,
          studentId: req.user.id,
          content: content || '',
          attachmentUrl: attachmentPath,
          status: 'submitted',
          submittedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [submissions.assignmentId, submissions.studentId],
          set: {
            content: content || '',
            attachmentUrl: attachmentPath,
            status: 'submitted',
            score: null,
            feedback: '',
            gradedByAi: false,
            gradedAt: null,
            submittedAt: new Date(),
          },
        })
        .returning();
      return res.status(201).json(submissionDto(row));
    })
  );

  // Giáo viên ghi nhận thủ công bài nộp của học viên (có thể chưa nộp bài trên hệ thống)
  r.post(
    '/submissions/manual',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const { assignment_id, student_id, status, score, comment } = req.body ?? {};
      if (!assignment_id || !student_id) return res.status(400).json({ error: 'Thiếu assignment_id hoặc student_id' });
      const [target] = await db.select().from(assignments).where(eq(assignments.id, assignment_id)).limit(1);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy bài tập.' });
      if (!(await canManageClass(db, req.user, target.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được ghi nhận bài nộp của lớp mình phụ trách.' });
      }
      const scoreNum = score === null || score === undefined || score === '' ? null : Number(score);
      if (scoreNum !== null && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10)) {
        return res.status(400).json({ error: 'Điểm phải nằm trong khoảng 0 đến 10.' });
      }
      const st = status === 'submitted' || status === 'graded' ? status : 'unsubmitted';

      const [row] = await db
        .insert(submissions)
        .values({
          id: newId('sub'),
          assignmentId: assignment_id,
          studentId: student_id,
          status: st,
          score: scoreNum === null ? null : String(scoreNum),
          feedback: comment || '',
          submittedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [submissions.assignmentId, submissions.studentId],
          set: { status: st, score: scoreNum === null ? null : String(scoreNum), feedback: comment || '' },
        })
        .returning();
      return res.status(201).json(submissionDto(row));
    })
  );

  // Chấm điểm / cập nhật nhận xét. Chỉ đánh dấu "graded" khi có điểm.
  r.put(
    '/submissions/:id/grade',
    auth.requireTeacher,
    ah(async (req: AuthedRequest, res) => {
      const b = req.body ?? {};
      const [current] = await db.select().from(submissions).where(eq(submissions.id, req.params.id)).limit(1);
      if (!current) return res.status(404).json({ error: 'Không tìm thấy bài nộp' });
      const [owner] = await db.select({ classId: assignments.classId }).from(assignments).where(eq(assignments.id, current.assignmentId)).limit(1);
      if (!owner || !(await canManageClass(db, req.user, owner.classId))) {
        return res.status(403).json({ error: 'Bạn chỉ được chấm bài của lớp mình phụ trách.' });
      }

      const hasScore = b.score !== undefined && b.score !== null && b.score !== '';
      const scoreNum = hasScore ? Number(b.score) : null;
      if (hasScore && (Number.isNaN(scoreNum) || (scoreNum as number) < 0 || (scoreNum as number) > 10)) {
        return res.status(400).json({ error: 'Điểm phải nằm trong khoảng 0 đến 10.' });
      }

      const set: Record<string, unknown> = {
        feedback: b.feedback ?? b.comment ?? current.feedback,
        rubricBreakdown: b.rubric_breakdown ?? current.rubricBreakdown,
        strengths: b.strengths ?? current.strengths,
        weaknesses: b.weaknesses ?? current.weaknesses,
        suggestions: b.suggestions ?? current.suggestions,
      };
      if (hasScore) {
        set.score = String(scoreNum);
        set.status = 'graded';
        set.gradedAt = new Date();
        set.gradedByAi = !!b.graded_by_ai;
        // Đã chấm: bản nháp AI không còn cần thiết
        set.aiDraft = null;
        set.aiDraftAt = null;
      }
      const [row] = await db.update(submissions).set(set).where(eq(submissions.id, current.id)).returning();

      if (hasScore) {
        const [asg] = await db.select({ title: assignments.title }).from(assignments).where(eq(assignments.id, current.assignmentId)).limit(1);
        await db.insert(notifications).values({
          id: newId('notif'),
          userId: current.studentId,
          title: 'Điểm bài tập đã được công bố!',
          message: `Bài tập "${asg?.title || 'Bài tập'}" đã được chấm: ${scoreNum} điểm.`,
          type: 'grade',
        });
      }
      return res.json(submissionDto(row));
    })
  );

  return r;
}
