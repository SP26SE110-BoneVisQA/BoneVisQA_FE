'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  fetchExpertQuizzesForLecturer,
  fetchExpertQuizQuestions,
  assignExpertQuizToClass,
  copyExpertQuiz,
  updateQuizQuestion,
  deleteQuiz,
  type ExpertQuizForLecturer,
  type ExpertQuizQuestion,
  type UpdateQuestionRequest,
} from '@/lib/api/lecturer-expert-quiz';
import { fetchLecturerClasses } from '@/lib/api/lecturer-classes';
import { resolveApiAssetUrl } from '@/lib/api/client';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Clock,
  Target,
  CheckCircle,
  Loader2,
  X,
  Image as ImageIcon,
  BookOpen,
  UserCheck,
  AlertCircle,
  Check,
  Pencil,
  Copy,
  Trash2,
} from 'lucide-react';

interface EnrichedQuiz extends ExpertQuizForLecturer {
  status: 'Active' | 'Draft' | 'Completed';
  formattedCreatedAt: string;
}

function utcToLocalDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDatetimeLocalToIso(local: string): string {
  const t = local.trim();
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function getStatus(openTime: string | null, closeTime: string | null): 'Active' | 'Draft' | 'Completed' {
  const now = new Date();
  const open = openTime ? new Date(openTime) : null;
  const close = closeTime ? new Date(closeTime) : null;

  if (close && now > close) return 'Completed';
  if (open && now < open) return 'Draft';
  return 'Active';
}

interface QuestionEditModalProps {
  question: ExpertQuizQuestion;
  onClose: () => void;
  onSave: (updated: ExpertQuizQuestion) => void;
}

function QuestionEditModal({ question, onClose, onSave }: QuestionEditModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    questionText: question.questionText,
    optionA: question.optionA ?? '',
    optionB: question.optionB ?? '',
    optionC: question.optionC ?? '',
    optionD: question.optionD ?? '',
    correctAnswer: question.correctAnswer ?? 'A',
  });

  const handleSave = async () => {
    if (!form.questionText.trim()) {
      toast.error('Please enter the question content.');
      return;
    }
    if (!form.optionA.trim() || !form.optionB.trim()) {
      toast.error('Please enter at least 2 answer options.');
      return;
    }

    setSaving(true);
    try {
      const request: UpdateQuestionRequest = {
        questionText: form.questionText,
        type: 'MultipleChoice',
        correctAnswer: form.correctAnswer,
        optionA: form.optionA,
        optionB: form.optionB,
        optionC: form.optionC || null,
        optionD: form.optionD || null,
      };

      await updateQuizQuestion(question.questionId, request);

      const updated: ExpertQuizQuestion = {
        ...question,
        questionText: form.questionText,
        optionA: form.optionA,
        optionB: form.optionB,
        optionC: form.optionC || null,
        optionD: form.optionD || null,
        correctAnswer: form.correctAnswer,
      };

      toast.success('Question updated successfully!');
      onSave(updated);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error updating question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border-border/60 bg-card/85 shadow-xl backdrop-blur-xl">
        <CardHeader className="flex shrink-0 flex-row items-start justify-between space-y-0 border-b border-border/60 pb-4">
          <div>
            <CardTitle className="text-lg">Edit Question</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Update question information</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-10 w-10 shrink-0 rounded-full p-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-6">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Question Content <span className="text-destructive">*</span>
            </label>
            <textarea
              value={form.questionText}
              onChange={(e) => setForm({ ...form, questionText: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="Enter question content..."
            />
          </div>

          {question.imageUrl && (
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">Image</label>
              <img
                src={resolveApiAssetUrl(question.imageUrl)}
                alt="Question image"
                className="max-h-40 rounded-lg object-contain border border-border"
              />
            </div>
          )}

          <div className="space-y-3">
              <label className="block text-sm font-medium text-card-foreground">Answer Options</label>
            {(['A', 'B', 'C', 'D'] as const).map((key) => (
              <div key={key} className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={form.correctAnswer === key ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 w-8 shrink-0 rounded-full px-0 font-bold text-sm"
                  onClick={() => setForm({ ...form, correctAnswer: key })}
                >
                  {key}
                </Button>
                <input
                  type="text"
                  value={key === 'A' ? form.optionA : key === 'B' ? form.optionB : key === 'C' ? form.optionC : form.optionD}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (key === 'A') setForm({ ...form, optionA: value });
                    else if (key === 'B') setForm({ ...form, optionB: value });
                    else if (key === 'C') setForm({ ...form, optionC: value });
                    else setForm({ ...form, optionD: value });
                  }}
                  placeholder={`Option ${key}`}
                  className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Click the letter (A, B, C, D) to select the correct answer</p>
          </div>
        </CardContent>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 p-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PreviewModal({
  quiz,
  onClose,
  onAssign,
  onCopied,
}: {
  quiz: EnrichedQuiz;
  onClose: () => void;
  onAssign: () => void;
  onCopied?: (newQuizId: string, newQuizTitle: string) => void;
}) {
  const toast = useToast();
  const [questions, setQuestions] = useState<ExpertQuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExpertQuizQuestion | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [quiz.id]);

  const loadQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExpertQuizQuestions(quiz.id);
      setQuestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuiz = async () => {
    const newTitle = window.prompt(
      'Enter a title for the copy of this quiz:',
      `Copy of ${quiz.title}`
    );
    if (newTitle === null) return;

    setCopying(true);
    try {
      const result = await copyExpertQuiz(quiz.id, { title: newTitle || undefined });
      toast.success(`Created copy: "${result.newQuizTitle}" with ${result.questionCount} questions.`);
      onCopied?.(result.newQuizId, result.newQuizTitle);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error copying quiz.');
    } finally {
      setCopying(false);
    }
  };

  const handleQuestionSaved = (updated: ExpertQuizQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.questionId === updated.questionId ? updated : q))
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <Card className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border-border/60 bg-card/85 shadow-xl backdrop-blur-xl">
          <CardHeader className="shrink-0 flex-row items-start justify-between space-y-0 border-b border-border/60 pb-4">
            <div className="min-w-0 pr-2">
              <CardTitle className="text-xl">{quiz.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {quiz.questionCount} questions • Difficulty: {quiz.difficulty ?? '—'}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-10 w-10 shrink-0 rounded-full p-0" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-destructive py-8">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            ) : questions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">This quiz has no questions yet.</p>
            ) : (
              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <Card
                    key={q.questionId}
                    className="overflow-hidden border-border/50 bg-muted/10 shadow-sm backdrop-blur-sm"
                  >
                    {q.imageUrl && (
                      <div className="bg-muted/50 p-4 border-b border-border">
                        <img
                          src={resolveApiAssetUrl(q.imageUrl)}
                          alt={`Question ${idx + 1}`}
                          className="max-h-64 mx-auto rounded-lg object-contain"
                        />
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary font-bold text-sm shrink-0">
                          {idx + 1}
                        </span>
                        <p className="text-base font-medium text-card-foreground leading-relaxed flex-1">
                          {q.questionText}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5 text-xs"
                          onClick={() => setEditingQuestion(q)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-11">
                        {[
                          { key: 'A', value: q.optionA },
                          { key: 'B', value: q.optionB },
                          { key: 'C', value: q.optionC },
                          { key: 'D', value: q.optionD },
                        ].map(
                          (opt) =>
                            opt.value && (
                              <div
                                key={opt.key}
                                className={`flex items-center gap-2 p-3 rounded-lg border ${
                                  q.correctAnswer?.toUpperCase() === opt.key
                                    ? 'border-secondary bg-secondary/10'
                                    : 'border-border bg-card'
                                }`}
                              >
                                <span
                                  className={`font-bold text-sm w-6 h-6 flex items-center justify-center rounded ${
                                    q.correctAnswer?.toUpperCase() === opt.key
                                      ? 'bg-secondary text-white'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {opt.key}
                                </span>
                                <span className="text-sm text-card-foreground">{opt.value}</span>
                                {q.correctAnswer?.toUpperCase() === opt.key && (
                                  <CheckCircle className="h-4 w-4 text-secondary ml-auto" />
                                )}
                              </div>
                            )
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 p-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="button" variant="outline" onClick={handleCopyQuiz} disabled={copying}>
              {copying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Quiz
                </>
              )}
            </Button>
            <Button type="button" onClick={onAssign}>
              Assign to Class
            </Button>
          </div>
        </Card>
      </div>

      {editingQuestion && (
        <QuestionEditModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={handleQuestionSaved}
        />
      )}
    </>
  );
}

interface AssignModalProps {
  quiz: EnrichedQuiz;
  onClose: () => void;
  onAssigned: () => void;
}

function AssignModal({ quiz, onClose, onAssigned }: AssignModalProps) {
  const toast = useToast();
  const [classes, setClasses] = useState<{ id: string; className: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [openTime, setOpenTime] = useState<string | ''>(
    utcToLocalDatetimeLocal(quiz.openTime)
  );
  const [closeTime, setCloseTime] = useState<string | ''>(
    utcToLocalDatetimeLocal(quiz.closeTime)
  );
  const [timeLimit, setTimeLimit] = useState<number | ''>(quiz.timeLimit ?? '');
  const [passingScore, setPassingScore] = useState<number | ''>(quiz.passingScore ?? '');

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const removeClass = (classId: string) => {
    setSelectedClassIds((prev) => prev.filter((id) => id !== classId));
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await fetchLecturerClasses();
      setClasses(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load classes.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (selectedClassIds.length === 0) {
      toast.error('Please select at least one class.');
      return;
    }

    const warnings: string[] = [];
    if (openTime && closeTime && new Date(openTime) >= new Date(closeTime)) {
      warnings.push('Open time must be before close time.');
    }

    if (warnings.length > 0) {
      const confirmed = window.confirm(
        'There are some warnings:\n\n' + warnings.join('\n') + '\n\nDo you want to continue?'
      );
      if (!confirmed) return;
    }

    setAssigning(true);
    try {
      const isoOpen = openTime ? localDatetimeLocalToIso(openTime) : null;
      const isoClose = closeTime ? localDatetimeLocalToIso(closeTime) : null;

      const results = await Promise.all(
        selectedClassIds.map(async (classId) => {
          try {
            const result = await assignExpertQuizToClass(classId, quiz.id, {
              openTime: isoOpen,
              closeTime: isoClose,
              timeLimitMinutes: timeLimit === '' ? null : (typeof timeLimit === 'number' ? timeLimit : null),
              passingScore: passingScore === '' ? null : (typeof passingScore === 'number' ? passingScore : null),
            });
            return { classId, success: true, alreadyAssigned: result.result.isAlreadyAssigned };
          } catch (e) {
            return { classId, success: false, error: e instanceof Error ? e.message : 'Unknown error' };
          }
        })
      );

      const successResults = results.filter(r => r.success);
      const alreadyAssignedCount = successResults.filter(r => r.alreadyAssigned).length;
      const newlyAssignedCount = successResults.filter(r => !r.alreadyAssigned).length;
      const failedResults = results.filter(r => !r.success);

      if (alreadyAssignedCount > 0 && newlyAssignedCount > 0) {
        toast.success(`Quiz assigned successfully to ${newlyAssignedCount} class(es). ${alreadyAssignedCount} class(es) already have this quiz.`);
      } else if (alreadyAssignedCount > 0 && newlyAssignedCount === 0 && failedResults.length === 0) {
        toast.info(`This quiz has already been assigned to all ${alreadyAssignedCount} selected classes.`);
      } else if (newlyAssignedCount > 0 && alreadyAssignedCount === 0 && failedResults.length === 0) {
        toast.success(`Quiz assigned to ${newlyAssignedCount} class(es) successfully!`);
      } else if (newlyAssignedCount === 0 && alreadyAssignedCount === 0 && failedResults.length > 0) {
        toast.error(`Failed to assign quiz: ${failedResults[0].error}`);
      } else {
        toast.success(`Assign quiz: ${newlyAssignedCount} success, ${alreadyAssignedCount} already have, ${failedResults.length} failed.`);
      }

      onAssigned();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to assign quiz.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-lg overflow-hidden border-border/60 bg-card/85 shadow-xl backdrop-blur-xl">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border/60 pb-4">
          <div className="min-w-0 pr-2">
            <CardTitle className="text-lg">Assign Quiz to Class</CardTitle>
            <p className="text-sm text-muted-foreground mt-1 truncate">{quiz.title}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-10 w-10 shrink-0 rounded-full p-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1.5">
              Select Class <span className="text-destructive">*</span>
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                {selectedClassIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
                    {selectedClassIds.map((classId) => {
                      const cls = classes.find((c) => c.id === classId);
                      if (!cls) return null;
                      return (
                        <span
                          key={classId}
                          className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                        >
                          <span className="max-w-[12rem] truncate">{cls.className}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 shrink-0 p-0 text-primary-foreground hover:bg-primary-foreground/15"
                            onClick={() => removeClass(classId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {classes.map((cls) => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    return (
                      <Button
                        key={cls.id}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className="gap-1.5 rounded-lg font-medium"
                        onClick={() => toggleClass(cls.id)}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        {cls.className}
                      </Button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-card-foreground">Quiz Info</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Questions:</span> {quiz.questionCount}
              </div>
              <div>
                <span className="font-medium">Difficulty:</span> {quiz.difficulty ?? '—'}
              </div>
              <div>
                <span className="font-medium">Expert:</span> {quiz.expertName ?? '—'}
              </div>
              <div>
                <span className="font-medium">Topic:</span> {quiz.topic ?? '—'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Open Time (optional)
            </label>
            <input
              type="datetime-local"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Close Time (optional)
            </label>
            <input
              type="datetime-local"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Time Limit (minutes, optional)
            </label>
            <input
              type="number"
              min="5"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={quiz.timeLimit?.toString() || ''}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {quiz.timeLimit != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Original setting: {quiz.timeLimit} minutes
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Passing Score (optional)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={quiz.passingScore?.toString() || ''}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {quiz.passingScore != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Original setting: {quiz.passingScore} points
              </p>
            )}
          </div>
        </CardContent>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 p-6">
          <Button type="button" variant="outline" disabled={assigning} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={assigning || selectedClassIds.length === 0}
            onClick={handleAssign}
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign to Class'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface ExpertQuizLibraryProps {
  onAssignSuccess?: () => void;
}

export default function ExpertQuizLibrary({ onAssignSuccess }: ExpertQuizLibraryProps) {
  const toast = useToast();
  const [quizzes, setQuizzes] = useState<EnrichedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [page, setPage] = useState(1);

  const [previewQuiz, setPreviewQuiz] = useState<EnrichedQuiz | null>(null);
  const [assignQuiz, setAssignQuiz] = useState<EnrichedQuiz | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedQuiz | null>(null);
  const [deleting, setDeleting] = useState(false);

  const PAGE_SIZE = 8;

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExpertQuizzesForLecturer(1, 100);
      const enriched: EnrichedQuiz[] = data.items.map((q) => ({
        ...q,
        status: getStatus(q.openTime, q.closeTime),
        formattedCreatedAt: formatDate(q.createdAt),
      }));
      setQuizzes(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quizzes.');
      toast.error(e instanceof Error ? e.message : 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuiz(deleteTarget.id);
      toast.success('Quiz deleted successfully.');
      setDeleteTarget(null);
      loadQuizzes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete quiz.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = quizzes.filter((q) => {
    if (!q.expertName) return false;

    const matchesSearch =
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (q.expertName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesDifficulty = selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const difficultyOptions = ['all', 'Easy', 'Medium', 'Hard'];

  return (
    <>
      <Card className="space-y-6 border-border/40 bg-card/45 p-5 shadow-sm backdrop-blur-xl md:p-6 dark:bg-card/25">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-card-foreground">
              <BookOpen className="h-5 w-5 text-primary" aria-hidden />
              Quiz Library
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select quizzes from the library to assign to your classes.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={loadQuizzes} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search quizzes, topics, Expert..."
              className="h-10 w-full rounded-full border border-border/60 bg-background/50 pl-10 pr-4 text-sm shadow-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={selectedDifficulty}
            onChange={(e) => {
              setSelectedDifficulty(e.target.value);
              setPage(1);
            }}
            className="h-10 cursor-pointer appearance-none rounded-full border border-border/60 bg-background/50 px-4 text-sm shadow-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {difficultyOptions.map((d) => (
              <option key={d} value={d}>
                {d === 'all' ? 'All difficulties' : d}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="min-h-[7.25rem] border-border/40 bg-card/55 p-4 shadow-sm backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-5 w-[min(100%,20rem)]" />
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-4 w-16 rounded-md" />
                      <Skeleton className="h-4 w-14 rounded-md" />
                      <Skeleton className="h-4 w-28 rounded-md" />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Skeleton className="h-9 w-[5.75rem] rounded-md" />
                    <Skeleton className="h-9 w-14 rounded-md" />
                    <Skeleton className="h-9 w-9 rounded-md" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive py-8">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No quizzes found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paged.map((quiz) => (
              <Card
                key={quiz.id}
                className="border-border/50 bg-card/65 p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-card-foreground">{quiz.title}</h4>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          quiz.status === 'Active'
                            ? 'bg-secondary/15 text-secondary'
                            : quiz.status === 'Completed'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-warning/10 text-warning'
                        }`}
                      >
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {quiz.status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {quiz.questionCount} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" />
                        {quiz.difficulty ?? '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" />
                        {quiz.expertName ?? '—'}
                      </span>
                      {quiz.topic && <span className="text-muted-foreground/70">• {quiz.topic}</span>}
                    </div>

                    {(quiz.openTime || quiz.closeTime) && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        {quiz.openTime && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Open: {formatDateShort(quiz.openTime)}
                          </span>
                        )}
                        {quiz.closeTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Close: {formatDateShort(quiz.closeTime)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPreviewQuiz(quiz)}>
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button type="button" variant="default" size="sm" onClick={() => setAssignQuiz(quiz)}>
                      <CheckCircle className="h-3.5 w-3.5" />
                      Assign
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {previewQuiz && (
        <PreviewModal
          quiz={previewQuiz}
          onClose={() => setPreviewQuiz(null)}
          onAssign={() => {
            setAssignQuiz(previewQuiz);
            setPreviewQuiz(null);
          }}
          onCopied={(newQuizId, newQuizTitle) => {
            toast.success(`Created copy: "${newQuizTitle}". Please edit questions in your quiz.`);
          }}
        />
      )}

      {assignQuiz && (
        <AssignModal
          quiz={assignQuiz}
          onClose={() => setAssignQuiz(null)}
          onAssigned={() => {
            onAssignSuccess?.();
            loadQuizzes();
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <Card className="relative w-full max-w-md overflow-hidden border-border/60 bg-card/90 shadow-2xl backdrop-blur-xl">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2 pt-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 ring-2 ring-destructive/15">
                <Trash2 className="h-7 w-7 text-destructive" />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <CardTitle className="text-xl">Delete Quiz</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 rounded-full p-0"
                disabled={deleting}
                onClick={() => !deleting && setDeleteTarget(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-4 px-6 pb-5">
              <div className="rounded-xl border border-border/50 bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-card-foreground truncate">{deleteTarget.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {deleteTarget.questionCount} questions
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {deleteTarget.difficulty ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="text-sm leading-relaxed text-muted-foreground">
                  <p>Are you sure you want to delete this quiz?</p>
                  <p className="mt-2 font-medium text-foreground/90">
                    The quiz and all its questions will be permanently deleted.
                  </p>
                </div>
              </div>
            </CardContent>

            <div className="flex gap-3 px-6 pb-6">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1 rounded-xl"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="flex-1 rounded-xl"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Quiz
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
