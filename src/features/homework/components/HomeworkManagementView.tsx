import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  ChevronRight, 
  X,
  Sparkles,
  Loader2,
  Paperclip
} from 'lucide-react';
import { Student, ClassItem, AiDraft } from '../../../shared/types';
import { Assignment, Submission } from '../types';
import { todayLocal, addDaysLocal } from '../../../shared/utils/date';
import { useConfirm } from '../../../shared/components/ui';
import { aiService } from '../../../services/aiService';
import { SubmissionAttachmentsModal } from './SubmissionAttachmentsModal';

interface HomeworkManagementViewProps {
  assignments: Assignment[];
  submissions: Submission[];
  students: Student[];
  classes: ClassItem[];
  initialClassId?: string;
  onCreateAssignment: (asg: Omit<Assignment, 'id' | 'created_at'>) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onUpdateSubmission: (submissionId: string, updates: Partial<Submission>) => void;
  onCreateSubmissionRecord: (assignmentId: string, studentId: string, status: 'submitted' | 'unsubmitted', score: number | null, comment: string) => void;
  onRequestAiDraft: (submissionId: string) => void;
  onDiscardAiDraft: (submissionId: string) => void;
  // Giáo viên duyệt bản nháp: điểm và nhận xét lấy từ ô đang nhập, nếu trống thì dùng bản nháp
  onApproveAiDraft: (submissionId: string, score: number, feedback: string, draft: AiDraft) => void;
}

export const HomeworkManagementView: React.FC<HomeworkManagementViewProps> = ({
  assignments,
  submissions,
  students,
  classes,
  initialClassId,
  onCreateAssignment,
  onDeleteAssignment,
  onUpdateSubmission,
  onCreateSubmissionRecord,
  onRequestAiDraft,
  onDiscardAiDraft,
  onApproveAiDraft,
}) => {
  const confirm = useConfirm();
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || classes[0]?.id || 'all');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string>(assignments[0]?.id || '');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);

  // New Assignment Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newClassId, setNewClassId] = useState(classes[0]?.id || '');
  const [newDeadline, setNewDeadline] = useState(addDaysLocal(7));

  // Quick feedback template phrases
  const quickComments = [
    '大変よくできました！ (Rất xuất sắc!)',
    'Dùng ngữ pháp tốt, cần luyện thêm chữ Hán.',
    'Cần chú ý phân biệt trợ từ に và で.',
    'Chữ viết rất đẹp, thứ tự nét Kanji chuẩn xác.',
    'Cần học thuộc kỹ từ vựng Minna no Nihongo.',
    'Cần chú ý chia thể động từ (thể Te/Ta/Nai).',
  ];

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    return selectedClassId === 'all' || a.class_id === selectedClassId;
  });

  const activeAssignment = assignments.find((a) => a.id === activeAssignmentId) || filteredAssignments[0];
  const activeClass = classes.find((c) => c.id === activeAssignment?.class_id);
  const classStudents = activeAssignment ? students.filter((s) => s.class_id === activeAssignment.class_id) : [];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateAssignment({
      class_id: newClassId,
      title: newTitle.trim(),
      description: newDesc.trim(),
      deadline: newDeadline,
    });
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
  };

  // Toggle submission status
  const handleToggleSubmission = (studentId: string) => {
    if (!activeAssignment) return;
    const existing = submissions.find((s) => s.assignment_id === activeAssignment.id && s.student_id === studentId);
    if (existing) {
      onUpdateSubmission(existing.id, {
        status: existing.status === 'submitted' ? 'unsubmitted' : 'submitted',
        submitted_at: existing.status === 'unsubmitted' ? todayLocal() : undefined,
      });
    } else {
      onCreateSubmissionRecord(activeAssignment.id, studentId, 'submitted', null, '');
    }
  };

  // Update Score
  const handleScoreChange = (studentId: string, scoreVal: string) => {
    if (!activeAssignment) return;
    const numScore = scoreVal === '' ? null : Math.max(0, Math.min(10, Number(scoreVal)));
    const existing = submissions.find((s) => s.assignment_id === activeAssignment.id && s.student_id === studentId);
    if (existing) {
      onUpdateSubmission(existing.id, { score: numScore });
    } else {
      onCreateSubmissionRecord(activeAssignment.id, studentId, 'submitted', numScore, '');
    }
  };

  // AI Feedback Loading State
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  // Đang tạo bản nháp chấm AI cho bài nộp nào
  const [aiDraftLoadingId, setAiDraftLoadingId] = useState<string | null>(null);

  const handleRequestDraft = async (submissionId: string) => {
    setAiDraftLoadingId(submissionId);
    try {
      await onRequestAiDraft(submissionId);
    } finally {
      setAiDraftLoadingId(null);
    }
  };

  // Update Comment
  const handleCommentChange = (studentId: string, commentVal: string) => {
    if (!activeAssignment) return;
    const existing = submissions.find((s) => s.assignment_id === activeAssignment.id && s.student_id === studentId);
    if (existing) {
      onUpdateSubmission(existing.id, { comment: commentVal });
    } else {
      onCreateSubmissionRecord(activeAssignment.id, studentId, 'submitted', null, commentVal);
    }
  };

  // Generate Japanese AI Pedagogical Feedback
  const handleAIGenerateFeedback = async (student: Student, scoreValue: string | number) => {
    if (!activeAssignment) return;
    setAiLoadingId(student.id);
    try {
      // Thang điểm 10 (không dùng 85 như thang 100)
      const parsedScore = scoreValue !== '' ? Number(scoreValue) : 8.5;
      const res = await aiService.generateFeedback({
        assignmentTitle: activeAssignment.title,
        assignmentDescription: activeAssignment.description,
        studentName: student.full_name,
        score: parsedScore,
        level: activeClass?.level || 'N5',
      });

      const fullFeedback = `${res.detailedFeedback} 💡 Gợi ý: ${res.actionableSuggestions[0] || 'Cố gắng phát huy!'}`;
      handleCommentChange(student.id, fullFeedback);
    } catch (err) {
      console.error('Error generating AI feedback:', err);
    } finally {
      setAiLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header & Actions */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Quản lý Bài tập & Chấm điểm
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Giao bài tập Minna no Nihongo, Kanji, theo dõi tiến độ nộp bài và nhận xét học viên.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsAttachmentsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
              Tệp nộp bài
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tạo bài tập mới
            </button>
          </div>
        </div>

        {/* Class Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedClassId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedClassId === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả bài tập
          </button>
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedClassId === cls.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column: Left Assignment List, Right Grading Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Assignment Picker Cards */}
        <div className="lg:col-span-4 space-y-2.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block px-1">
            Danh sách bài tập ({filteredAssignments.length})
          </span>

          {filteredAssignments.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
              Chưa có bài tập nào. Hãy bấm nút "Tạo bài tập mới" để giao bài tập cho lớp.
            </div>
          ) : (
            filteredAssignments.map((asg) => {
              const isSelected = activeAssignment?.id === asg.id;
              const cls = classes.find((c) => c.id === asg.class_id);
              const asgStudents = students.filter((s) => s.class_id === asg.class_id);
              const submittedCount = submissions.filter((s) => s.assignment_id === asg.id && s.status === 'submitted').length;

              return (
                <div
                  key={asg.id}
                  onClick={() => setActiveAssignmentId(asg.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {cls?.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Hạn: {asg.deadline}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{asg.title}</h4>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500">
                      Đã nộp: <strong className="text-blue-700">{submittedCount}/{asgStudents.length}</strong>
                    </span>
                    <span className="text-blue-600 font-semibold flex items-center gap-0.5">
                      Chấm bài <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Active Assignment Roster & Grading Table */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-5 border border-blue-100 shadow-xs space-y-4">
          {activeAssignment ? (
            <>
              {/* Assignment Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-600 text-white">
                      {activeClass?.name} ({activeClass?.level})
                    </span>
                    <span className="text-xs text-rose-600 font-bold">
                      Hạn nộp: {activeAssignment.deadline}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {activeAssignment.title}
                  </h3>
                  {activeAssignment.description && (
                    <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {activeAssignment.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Xóa bài tập "${activeAssignment.title}"?`,
                      message: 'Các bài nộp và điểm của bài tập này cũng sẽ bị xóa. Không thể hoàn tác.',
                      confirmLabel: 'Xóa bài tập',
                      tone: 'danger',
                    });
                    if (ok) onDeleteAssignment(activeAssignment.id);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer self-start"
                  title="Xóa bài tập"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Comment Chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  💡 Nhận xét nhanh mẫu (bấm để copy dán vào ô nhận xét):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickComments.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => navigator.clipboard.writeText(chip)}
                      title="Bấm để sao chép nhận xét"
                      className="px-2 py-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-[10px] font-medium border border-slate-200 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student Grading List */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Danh sách nộp bài ({classStudents.length} học viên)
                </span>

                {classStudents.map((st) => {
                  const sub = submissions.find((s) => s.assignment_id === activeAssignment.id && s.student_id === st.id);
                  const isSubmitted = sub?.status === 'submitted';
                  const currentScore = sub?.score !== null && sub?.score !== undefined ? sub.score : '';
                  const currentComment = sub?.comment || '';

                  return (
                    <div
                      key={st.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSubmitted ? 'bg-white border-blue-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Submission Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSubmission(st.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSubmitted
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {isSubmitted ? 'Đã nộp' : 'Chưa nộp'}
                          </button>

                          <div>
                            <h5 className="text-xs font-bold text-slate-900">{st.full_name}</h5>
                            <p className="text-[10px] text-slate-500">SĐT: {st.phone}</p>
                          </div>
                        </div>

                        {/* Score Input */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-600">Điểm:</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            placeholder="0-10"
                            value={currentScore}
                            onChange={(e) => handleScoreChange(st.id, e.target.value)}
                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs font-black text-center text-blue-700 bg-white"
                          />
                          <span className="text-xs text-slate-400 font-bold">/10</span>
                          {isSubmitted && sub && (
                            <button
                              type="button"
                              disabled={aiDraftLoadingId === sub.id}
                              onClick={() => handleRequestDraft(sub.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="Gemini AI chấm thành bản nháp, giáo viên duyệt trước khi lưu điểm"
                            >
                              {aiDraftLoadingId === sub.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                  <span>AI đang chấm...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 text-indigo-600" />
                                  <span>{sub.ai_draft ? 'Chấm lại bằng AI' : 'Chấm bằng AI'}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Comment Section with AI Assistance */}
                      <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Nhận xét giảng viên:
                          </span>
                          <button
                            type="button"
                            disabled={aiLoadingId === st.id}
                            onClick={() => handleAIGenerateFeedback(st, currentScore)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Tự động tạo nhận xét sư phạm bằng Gemini AI"
                          >
                            {aiLoadingId === st.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                <span>AI đang viết...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                <span>AI Gợi ý nhận xét</span>
                              </>
                            )}
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Nhập nhận xét (VD: Dùng ngữ pháp tốt, cần chú ý phân biệt trợ từ に và で...)"
                          value={currentComment}
                          onChange={(e) => handleCommentChange(st.id, e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                      </div>

                      {/* Bản nháp AI: chỉ thành điểm khi giáo viên bấm duyệt */}
                      {sub?.ai_draft && (
                        <div className="mt-3 p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-indigo-800">
                              Bản nháp AI: {sub.ai_draft.score}/10 • {sub.ai_draft.gradeClassification}
                            </span>
                            <span className="text-[10px] font-semibold text-indigo-600">
                              Chưa tính vào điểm, cần giáo viên duyệt
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 whitespace-pre-line">{sub.ai_draft.detailedFeedback}</p>
                          {sub.ai_draft.suggestions.length > 0 && (
                            <ul className="text-[11px] text-slate-600 list-disc pl-4 space-y-0.5">
                              {sub.ai_draft.suggestions.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          )}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => onDiscardAiDraft(sub.id)}
                              className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                              Bỏ bản nháp
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onApproveAiDraft(
                                  sub.id,
                                  sub.ai_draft!.score,
                                  currentComment.trim() || sub.ai_draft!.detailedFeedback,
                                  sub.ai_draft!
                                )
                              }
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-sm cursor-pointer"
                            >
                              Duyệt & chấm {sub.ai_draft.score}/10
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Vui lòng chọn hoặc tạo bài tập mới.
            </div>
          )}
        </div>

      </div>

      {isAttachmentsOpen && <SubmissionAttachmentsModal onClose={() => setIsAttachmentsOpen(false)} />}

      {/* Create Assignment Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Giao bài tập mới
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lớp giao bài tập</label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.level})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên bài tập *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Bài 12 Minna no Nihongo, Kanji Bài 5..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung yêu cầu</label>
                <textarea
                  rows={3}
                  placeholder="Yêu cầu làm bài tập A, B sách bài tập, viết chữ Hán, dịch câu..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hạn nộp</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Tạo & Giao bài
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
