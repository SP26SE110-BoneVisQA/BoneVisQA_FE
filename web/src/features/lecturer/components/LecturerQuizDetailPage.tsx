'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Save,
  Settings2,
  Users,
  Timer,
  PlusCircle,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/api/errors/app-toast';
import {
  useAssignQuizToClass,
  useDeleteQuizQuestion,
  useLecturerPortalClasses,
  useLecturerQuizDetail,
  useLecturerQuizQuestions,
  useUpdateLecturerQuiz,
} from '@/features/lecturer/queries/use-lecturer-quizzes';
import { queryKeys } from '@/lib/query-keys';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import QuestionEditorDialog from '@/components/lecturer/quizzes/QuestionEditorDialog';
import QuestionImportDialog from '@/components/lecturer/quizzes/QuestionImportDialog';
import type { ParsedQuestion } from '@/components/lecturer/quizzes/QuestionImportDialog';
import QuestionCard from '@/components/lecturer/quizzes/QuestionCard';
import { addQuizQuestion } from '@/lib/api/lecturer-quiz';
import { getClassStats } from '@/lib/api/lecturer';
import type { QuizDto, QuizQuestionDto, ClassItem, ClassStats } from '@/lib/api/types';

const QUESTIONS_PER_PAGE = 3;
const TOPIC_ROTATION = ['Trauma', 'Imaging', 'Joints'] as const;
const POINTS_ROTATION = [10, 15, 5] as const;

const CLASSIFICATION_OPTIONS = [
  'Resident Year 1',
  'Resident Year 2',
  'Advanced Diagnostics',
  'Continuing Med Ed',
] as const;

const TOPIC_OPTIONS = [
  { value: 'Long Bone Fractures', label: 'Long Bone Fractures' },
  { value: 'Spine Lesions', label: 'Spine Lesions' },
  { value: 'Joint Diseases', label: 'Joint Diseases' },
  { value: 'Bone Tumors', label: 'Bone Tumors' },
  { value: 'Upper Extremity', label: 'Upper Extremity' },
  { value: 'Lower Extremity', label: 'Lower Extremity' },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
] as const;

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  // Use local time components to display in user's timezone
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function LecturerQuizDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const rawQuizId = params.id;
  const quizId = typeof rawQuizId === 'string' ? rawQuizId : Array.isArray(rawQuizId) ? rawQuizId[0] : '';

  const quizQuery = useLecturerQuizDetail(quizId);
  const questionsQuery = useLecturerQuizQuestions(quizId);
  const classesQuery = useLecturerPortalClasses();
  const updateQuizMutation = useUpdateLecturerQuiz();
  const assignQuizMutation = useAssignQuizToClass();
  const deleteQuestionMutation = useDeleteQuizQuestion();

  const quiz = quizQuery.data ?? null;
  const questions = questionsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const loading = quizQuery.isPending || questionsQuery.isPending;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [originalClassId, setOriginalClassId] = useState('');
  const [openTimeLocal, setOpenTimeLocal] = useState('');
  const [closeTimeLocal, setCloseTimeLocal] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [passingScore, setPassingScore] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [classification, setClassification] = useState<(typeof CLASSIFICATION_OPTIONS)[number]>('Resident Year 1');

  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestionDto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);

  const classStatsQuery = useQuery({
    queryKey: [...queryKeys.lecturer.classDetail(selectedClassId), 'stats'] as const,
    queryFn: () => getClassStats(selectedClassId),
    enabled: Boolean(selectedClassId && selectedClassId !== '00000000-0000-0000-0000-000000000000'),
  });
  const classStats = classStatsQuery.data ?? null;
  const statsLoading = classStatsQuery.isFetching;

  // Delete question dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    questionId: string;
    questionText: string;
  } | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  useEffect(() => {
    if (!quizId) {
      setError('Quiz ID is missing');
      return;
    }
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!guidRegex.test(quizId)) {
      setError(`Invalid quiz ID format: ${quizId}`);
      setTimeout(() => router.push('/lecturer/quizzes'), 3000);
    }
  }, [quizId, router]);

  useEffect(() => {
    if (!quiz) return;
    setTitle(quiz.title);
    setSelectedClassId(quiz.classId);
    setOriginalClassId(quiz.classId);
    setOpenTimeLocal(isoToDatetimeLocal(quiz.openTime));
    setCloseTimeLocal(isoToDatetimeLocal(quiz.closeTime));
    setTimeLimit(quiz.timeLimit?.toString() || '');
    setPassingScore(quiz.passingScore != null ? String(quiz.passingScore) : '');
    setTopic(quiz.topic || '');
    setDifficulty(quiz.difficulty || 'Medium');
    if (quiz.classification && (CLASSIFICATION_OPTIONS as readonly string[]).includes(quiz.classification)) {
      setClassification(quiz.classification as (typeof CLASSIFICATION_OPTIONS)[number]);
    }
  }, [quiz]);

  useEffect(() => {
    if (quizQuery.error) {
      setError(quizQuery.error instanceof Error ? quizQuery.error.message : 'Failed to load quiz');
    }
  }, [quizQuery.error]);

  const refreshQuiz = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizDetail(quizId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizQuestions(quizId) });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [quizId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateQuizMutation.mutateAsync({
        id: quizId,
        body: {
          title,
          openTime: datetimeLocalToIso(openTimeLocal),
          closeTime: datetimeLocalToIso(closeTimeLocal),
          timeLimit: timeLimit ? parseInt(timeLimit, 10) : null,
          passingScore: passingScore ? parseInt(passingScore, 10) : null,
          topic: topic || null,
          difficulty: difficulty || null,
          classification: classification || null,
        },
      });
      if (selectedClassId && selectedClassId !== originalClassId) {
        await assignQuizMutation.mutateAsync({ classId: selectedClassId, quizId });
        refreshQuiz();
        setOriginalClassId(selectedClassId);
        appToast.success('Quiz saved and assigned to class successfully.');
      } else {
        appToast.success('Quiz saved successfully.');
      }
      setSavedDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save quiz');
      appToast.error(err instanceof Error ? err.message : 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  const handleSavedGoBack = () => {
    setSavedDialogOpen(false);
    router.push('/lecturer/quizzes');
  };

  const handleEditQuestion = (question: QuizQuestionDto) => {
    console.log('[page.tsx] handleEditQuestion called with:', question);
    console.log('[page.tsx] question.imageUrl:', question.imageUrl);
    setEditingQuestion(question);
    setEditorOpen(true);
  };

  const handleDeleteQuestion = async () => {
    if (!deleteDialog) return;
    setDeletingQuestion(true);
    try {
      await deleteQuestionMutation.mutateAsync({
        questionId: deleteDialog.questionId,
        quizId,
      });
      setDeleteDialog(null);
      appToast.success('Question deleted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
      appToast.error(err instanceof Error ? err.message : 'Failed to delete question');
    } finally {
      setDeletingQuestion(false);
    }
  };

  const openDeleteQuestionDialog = (questionId: string, questionText: string) => {
    setDeleteDialog({ questionId, questionText });
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setEditorOpen(true);
  };

  const handleQuestionSuccess = () => {
    refreshQuiz();
  };

  const handleImportQuestions = async (parsed: ParsedQuestion[]) => {
    for (const p of parsed) {
      try {
        await addQuizQuestion({
          quizId,
          questionText: p.questionText,
          type: p.type,
          optionA: p.optionA,
          optionB: p.optionB,
          optionC: p.optionC,
          optionD: p.optionD,
          correctAnswer: p.correctAnswer,
        });
      } catch {
        // skip failures silently
      }
    }
    refreshQuiz();
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error || 'Quiz not found'}</p>
        <Button onClick={() => router.push('/lecturer/quizzes')}>
          <ArrowLeft className="h-4 w-4" /> Back to Quizzes
        </Button>
      </div>
    );
  }

  const displayTitle = title || quiz.title;

  const enrolledDisplay =
    !selectedClassId?.trim() || selectedClassId === '00000000-0000-0000-0000-000000000000'
    ? '—'
    : statsLoading
      ? '…'
      : String(classStats?.totalStudents ?? 0);
  const avgScoreDisplay =
    !selectedClassId?.trim() || selectedClassId === '00000000-0000-0000-0000-000000000000'
    ? '—'
    : statsLoading
      ? '…'
      : classStats?.avgQuizScore != null
        ? `${Math.round(classStats.avgQuizScore)}%`
        : '—';

  const filtered = questions.filter(
    (q) =>
      q.questionText?.toLowerCase().includes(searchTerm.toLowerCase()) ??
      false
  );

  const totalPages = Math.ceil(filtered.length / QUESTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
  const displayedQuestions = filtered.slice(startIndex, startIndex + QUESTIONS_PER_PAGE);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-primary">Quiz Editor</p>
          <h1 className="font-['Manrope',sans-serif] text-2xl font-bold leading-tight tracking-tight text-card-foreground">
            {displayTitle}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Edit quiz settings and manage questions.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 mt-1">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition-all hover:bg-muted/60"
          >
            Preview
          </button>
          {quiz && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Students</p>
          <p className="text-xl font-bold text-card-foreground">{enrolledDisplay}</p>
        </div>
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <Timer className="h-4 w-4 text-secondary" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Avg Score</p>
          <p className="text-xl font-bold text-card-foreground">{avgScoreDisplay}</p>
        </div>
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <Settings2 className="h-4 w-4 text-secondary" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Questions</p>
          <p className="text-xl font-bold text-card-foreground">{questions.length}</p>
        </div>
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
              <Timer className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Time Limit</p>
          <p className="text-xl font-bold text-card-foreground">{timeLimit || '—'} min</p>
        </div>
      </div>

      {/* Main Content - Bento Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Quiz Settings (right column) */}
        <div className="order-2 col-span-12 lg:order-2 lg:col-span-4">
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-sm text-card-foreground mb-4">
              <Settings2 className="h-4 w-4 text-primary" />
              Quiz Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Classification</label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value as (typeof CLASSIFICATION_OPTIONS)[number])}
                    className="w-full cursor-pointer rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                  >
                    {CLASSIFICATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full cursor-pointer rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                  >
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Topic</label>
                <input
                  list="topic-options-edit"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Select or type topic..."
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                />
                <datalist id="topic-options-edit">
                  {TOPIC_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Class</label>
                <div className="relative">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-lg border border-border bg-muted/50 px-3 py-2 pr-8 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select class…</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.className}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Opens</label>
                  <input
                    type="datetime-local"
                    value={openTimeLocal}
                    onChange={(e) => setOpenTimeLocal(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/50 px-2 py-2 text-xs outline-none transition-all focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Closes</label>
                  <input
                    type="datetime-local"
                    value={closeTimeLocal}
                    onChange={(e) => setCloseTimeLocal(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/50 px-2 py-2 text-xs outline-none transition-all focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Time (min)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                    placeholder="30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Pass (%)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                    placeholder="80"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Description..."
                  className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                />
              </div>
            </div>
          </div>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex h-32 flex-col justify-between rounded-3xl border border-secondary/20 bg-secondary/10 p-5">
              <Users className="h-6 w-6 text-secondary" />
              <div>
                <p className="font-['Manrope',sans-serif] text-2xl font-extrabold text-card-foreground">
                  {enrolledDisplay}
                </p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Enrolled Students
                </p>
              </div>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-3xl border border-warning/20 bg-warning/10 p-5">
              <Timer className="h-6 w-6 text-warning" />
              <div>
                <p
                  className="font-['Manrope',sans-serif] text-2xl font-extrabold text-card-foreground"
                  title="Average class quiz score (based on system data)"
                >
                  {avgScoreDisplay}
                </p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Avg. quiz score
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Questions List (left column) */}
        <div className="order-1 col-span-12 lg:order-1 lg:col-span-8">
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-sm text-card-foreground">
                <Settings2 className="h-4 w-4 text-primary" />
                Questions <span className="text-muted-foreground">({filtered.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search questions..."
                    className="h-8 w-48 rounded-lg border border-border bg-card pl-8 pr-3 text-xs outline-none transition-all focus:border-primary"
                  />
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                {quiz && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted/80 hover:text-card-foreground border border-border"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      Import
                    </button>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-primary/90"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Add Question
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              {questions.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                    <PlusCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 font-medium text-sm text-card-foreground">No questions yet</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Plus className="h-3 w-3" /> Add Question
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted"
                    >
                      <UploadCloud className="h-3 w-3" /> Import
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedQuestions.map((q) => {
                    const i = questions.findIndex((x) => x.id === q.id);
                    const idx = i >= 0 ? i : 0;
                    return (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        variant="curated"
                        topicCategory={TOPIC_ROTATION[idx % TOPIC_ROTATION.length]}
                        points={POINTS_ROTATION[idx % POINTS_ROTATION.length]}
                        onEdit={handleEditQuestion}
                        onDelete={openDeleteQuestionDialog}
                      />
                    );
                  })}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-card-foreground hover:bg-muted disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3 w-3" />
                        Previous
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-primary text-white'
                                : 'text-muted-foreground hover:bg-muted hover:text-card-foreground'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-card-foreground hover:bg-muted disabled:opacity-40"
                      >
                        Next
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FAB - mobile only */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-lg md:hidden disabled:opacity-50"
        aria-label="Save"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
      </button>

      <QuestionEditorDialog
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingQuestion(null);
        }}
        quizId={quizId}
        question={editingQuestion}
        onSuccess={handleQuestionSuccess}
      />

      <QuestionImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportQuestions}
      />

      {/* Delete question confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialog !== null}
        title="Delete question?"
        itemName={deleteDialog?.questionText || ''}
        itemType="Question"
        onConfirm={handleDeleteQuestion}
        onCancel={() => setDeleteDialog(null)}
        deleting={deletingQuestion}
        confirmText="Delete question"
        cancelText="Cancel"
        dangerLevel="high"
      />

      {/* Save success dialog */}
      {savedDialogOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Dismiss"
            onClick={() => setSavedDialogOpen(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card p-6 text-center shadow-xl">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15">
                <CheckCircle2 className="h-7 w-7 text-secondary" />
              </div>
            </div>
            <h3 className="mb-1 font-semibold text-base text-card-foreground">
              Saved successfully
            </h3>
            <p className="mb-5 text-sm text-muted-foreground">
              Your quiz changes have been saved.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSavedDialogOpen(false)}
                className="w-full rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                Stay on page
              </button>
              <button
                type="button"
                onClick={handleSavedGoBack}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
