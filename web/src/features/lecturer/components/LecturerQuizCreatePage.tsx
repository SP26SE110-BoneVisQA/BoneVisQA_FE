'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useLecturerPortalClasses, useLecturerQuizQuestions } from '@/features/lecturer/queries/use-lecturer-quizzes';
import {
  quizQuestionDraftSchema,
  type QuizQuestionDraftValues,
} from '@/features/lecturer/schemas/quiz-create-schema';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  PlusCircle,
  Timer,
  Percent,
  Save,
  X,
  ListChecks,
  Send,
  Trash2,
  Pencil,
  ArrowLeft,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Settings2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import QuestionEditorDialog from '@/components/lecturer/quizzes/QuestionEditorDialog';
import QuestionImportDialog from '@/components/lecturer/quizzes/QuestionImportDialog';
import {
  createQuiz,
  addQuizQuestionsBatched,
  getQuizQuestions,
  aiAutoGenerateQuiz,
  aiSuggestQuestions,
} from '@/lib/api/lecturer-quiz';
import { getLecturerClasses, getLecturerCases, getClassStats } from '@/lib/api/lecturer';
import { getStoredUserId } from '@/lib/getStoredUserId';
import type {
  CaseDto,
  ClassItem,
  ClassStats,
  CreateQuizQuestionRequest,
  QuizQuestionDto,
  AIQuizQuestion,
} from '@/lib/api/types';
import { useToast } from '@/components/ui/toast';
import type { ParsedQuestion } from '@/components/lecturer/quizzes/QuestionImportDialog';
import QuestionCard from '@/components/lecturer/quizzes/QuestionCard';

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

// NOTE: Adaptive Mode (value: 3) is temporarily disabled for development
const QUIZ_MODE_OPTIONS = [
  { value: 1, label: 'Exam Mode', description: 'Formal assessment with time limit', color: 'bg-red-50 border-red-200 text-red-700' },
  { value: 2, label: 'Practice Mode', description: 'Practice without time pressure', color: 'bg-green-50 border-green-200 text-green-700' },
  // { value: 3, label: 'Adaptive Mode', description: 'AI-powered personalized difficulty', color: 'bg-blue-50 border-blue-200 text-blue-700' },
] as const;

export function LecturerQuizCreatePage() {
  const router = useRouter();
  const toast = useToast();
  const classesQuery = useLecturerPortalClasses();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classes = classesQuery.data ?? [];
  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null);
  const publishedQuestionsQuery = useLecturerQuizQuestions(createdQuizId ?? '');
  const questions = publishedQuestionsQuery.data ?? [];

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    classId: '',
    topic: '',
    difficulty: 'Medium',
    openTime: '',
    closeTime: '',
    timeLimit: '30',
    passingScore: '80',
    quizMode: 1,
  });

  const [classification, setClassification] = useState<(typeof CLASSIFICATION_OPTIONS)[number]>(
    'Resident Year 1',
  );

  const [referenceCaseIds, setReferenceCaseIds] = useState<string[]>([]);
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [caseLibrary, setCaseLibrary] = useState<CaseDto[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);

  const draftQuestionsForm = useForm<{ questions: QuizQuestionDraftValues[] }>({
    resolver: zodResolver(z.object({ questions: z.array(quizQuestionDraftSchema) })),
    defaultValues: { questions: [] },
  });
  const questionFields = useFieldArray({
    control: draftQuestionsForm.control,
    name: 'questions',
  });
  const [tempQuestions, setTempQuestions] = useState<CreateQuizQuestionRequest[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<CreateQuizQuestionRequest | null>(null);
  const [editingTempIndex, setEditingTempIndex] = useState<number | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const [questionCount, setQuestionCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<AIQuizQuestion[]>([]);
  const [aiSuggestionMode, setAiSuggestionMode] = useState<'auto' | 'suggest' | null>(null);

  // Bulk selection state
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<{ id: string; text: string } | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Success dialog state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastCreatedQuizId, setLastCreatedQuizId] = useState<string | null>(null);
  const [lastCreatedQuizTitle, setLastCreatedQuizTitle] = useState<string>('');

  const allQuestions = createdQuizId ? questions : tempQuestions;

  // Filter and pagination
  const filteredQuestions = allQuestions.filter(
    (q) =>
      q.questionText?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false
  );

  const totalPages = Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
  const displayedQuestions = filteredQuestions.slice(startIndex, startIndex + QUESTIONS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [allQuestions.length]);

  const classStatsQuery = useQuery({
    queryKey: ['lecturer', 'class-stats', formData.classId] as const,
    queryFn: () => getClassStats(formData.classId.trim()),
    enabled: Boolean(formData.classId?.trim()) && formData.classId !== '00000000-0000-0000-0000-000000000000',
  });
  const createClassStats = classStatsQuery.data ?? null;
  const createStatsLoading = classStatsQuery.isPending;

  const openCasePicker = async () => {
    setCasePickerOpen(true);
    setCasesLoading(true);
    try {
      const data = await getLecturerCases();
      setCaseLibrary(data);
    } catch {
      setCaseLibrary([]);
    } finally {
      setCasesLoading(false);
    }
  };

  const toggleReferenceCase = (id: string) => {
    setReferenceCaseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toUTC = (local: string) => {
    const t = local.trim();
    if (!t) return undefined;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  };

  const buildCreatePayload = () => ({
    title: formData.title,
    topic: formData.topic || undefined,
    difficulty: formData.difficulty || undefined,
    classification: classification,
    isAiGenerated: false,
    classId: formData.classId || '00000000-0000-0000-0000-000000000000',
    openTime: toUTC(formData.openTime),
    closeTime: toUTC(formData.closeTime),
    timeLimit: formData.timeLimit ? parseInt(formData.timeLimit, 10) : undefined,
    passingScore: formData.passingScore ? parseInt(formData.passingScore, 10) : undefined,
    quizMode: formData.quizMode,
  });

  // ========== AI Quiz Handlers ==========

  const handleAIAutoGenerate = async () => {
    if (!formData.title.trim()) {
      setError('Please enter a quiz title first');
      return;
    }
    if (!formData.topic) {
      setError('Please select a topic first');
      return;
    }

    setAiGenerating(true);
    setAiSuggestionMode('auto');
    setError(null);

    try {
      const result = await aiAutoGenerateQuiz({
        title: formData.title,
        topic: formData.topic,
        difficulty: formData.difficulty,
        questionCount: questionCount,
      });

      if (result.success && result.questions.length > 0) {
        setAiQuestions(result.questions);
        setTempQuestions([]);
      } else {
        setError(result.message || 'Cannot create questions from AI');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the quiz');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAISuggestFromCases = async () => {
    if (referenceCaseIds.length === 0) {
      setError('Please select at least 1 case first');
      return;
    }

    setAiSuggesting(true);
    setAiSuggestionMode('suggest');
    setError(null);

    try {
      const selectedCases = caseLibrary.filter((c) => referenceCaseIds.includes(c.id));
      const caseInputs = selectedCases.map((c) => ({
        caseId: c.id,
        caseTitle: c.title,
        caseDescription: c.description,
        difficulty: c.difficulty,
      }));

      const result = await aiSuggestQuestions({
        cases: caseInputs,
        questionsPerCase: Math.ceil(questionCount / referenceCaseIds.length),
        difficulty: formData.difficulty,
      });

      if (result.success && result.questions.length > 0) {
        setAiQuestions(result.questions);
        setTempQuestions([]);
      } else {
        setError(result.message || 'Cannot suggest questions from AI');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while suggesting');
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleAddAIQuestionsToQuiz = () => {
    const newQuestions: CreateQuizQuestionRequest[] = aiQuestions.map((q) => ({
      quizId: createdQuizId || '',
      questionText: q.questionText,
      type: q.type || 'MultipleChoice',
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      caseId: q.caseId,
    }));

    setTempQuestions([...tempQuestions, ...newQuestions]);
    setAiQuestions([]);
    setAiSuggestionMode(null);
  };

  const handleCreateAndAddAIQuestions = async () => {
    if (!formData.title.trim()) {
      setError('Please enter a quiz title.');
      return;
    }
    if (!formData.topic) {
      setError('Please select a topic.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create quiz
      const quiz = await createQuiz({
        title: formData.title,
        topic: formData.topic,
        difficulty: formData.difficulty,
        classification: classification,
        isAiGenerated: true,
        classId: formData.classId || '00000000-0000-0000-0000-000000000000',
        openTime: formData.openTime || undefined,
        closeTime: formData.closeTime || undefined,
        timeLimit: formData.timeLimit ? parseInt(formData.timeLimit, 10) : undefined,
        passingScore: formData.passingScore ? parseInt(formData.passingScore, 10) : undefined,
      });

      const payloads: CreateQuizQuestionRequest[] = aiQuestions.map((q) => ({
        quizId: quiz.id,
        questionText: q.questionText,
        type: q.type || 'MultipleChoice',
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        caseId: q.caseId,
      }));
      await addQuizQuestionsBatched(quiz.id, payloads);

      toast.success('Quiz created and AI questions added.');
      router.push(`/lecturer/quizzes/${quiz.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ========== Quiz Handlers ==========
  const handleSaveDraft = async () => {
    if (!formData.title.trim()) {
      setError('Please enter an assessment title');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const quiz = await createQuiz(buildCreatePayload());
      if (tempQuestions.length > 0) {
        await addQuizQuestionsBatched(quiz.id, tempQuestions);
      }
      toast.success('Draft quiz saved.');
      setLastCreatedQuizId(quiz.id);
      setLastCreatedQuizTitle(quiz.title);
      setSuccessDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!formData.title.trim()) {
      setError('Please enter an assessment title');
      return;
    }
    if (allQuestions.length === 0) {
      setError('Add at least one question before publishing.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const quiz = await createQuiz(buildCreatePayload());
      setCreatedQuizId(quiz.id);
      await addQuizQuestionsBatched(quiz.id, tempQuestions);
      toast.success('Quiz created and published successfully.');
      setLastCreatedQuizId(quiz.id);
      setLastCreatedQuizTitle(quiz.title);
      setSuccessDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quiz');
      toast.error(err instanceof Error ? err.message : 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessGoToEdit = () => {
    setSuccessDialogOpen(false);
    if (lastCreatedQuizId) {
      router.push(`/lecturer/quizzes/${lastCreatedQuizId}`);
    } else {
      router.push('/lecturer/quizzes');
    }
  };

  const handleSuccessGoToList = () => {
    setSuccessDialogOpen(false);
    router.push('/lecturer/quizzes');
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setEditingTempIndex(null);
    setEditorOpen(true);
  };

  const handleEditQuestion = (question: QuizQuestionDto) => {
    if (!createdQuizId) {
      const idx = parseInt(question.id, 10);
      if (!Number.isNaN(idx) && tempQuestions[idx]) {
        setEditingQuestion(tempQuestions[idx]);
        setEditingTempIndex(idx);
        setEditorOpen(true);
      }
      return;
    }
    const q = questions.find((x) => x.id === question.id);
    if (q) {
      setEditingQuestion({
        quizId: q.quizId,
        questionText: q.questionText,
        type: q.type || 'MultipleChoice',
        optionA: q.optionA || '',
        optionB: q.optionB || '',
        optionC: q.optionC || '',
        optionD: q.optionD || '',
        correctAnswer: q.correctAnswer || '',
        caseId: q.caseId || undefined,
      });
      setEditingTempIndex(null);
      setEditorOpen(true);
    }
  };

  const handleDeleteQuestion = (questionId: string, questionText: string) => {
    setQuestionToDelete({ id: questionId, text: questionText });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteQuestion = () => {
    if (!questionToDelete) return;
    setTempQuestions(tempQuestions.filter((_, i) => i.toString() !== questionToDelete.id));
    void publishedQuestionsQuery.refetch();
    setQuestionToDelete(null);
    setDeleteDialogOpen(false);
  };

  // Bulk selection handlers
  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedQuestionIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleSelectQuestion = (questionId: string, selected: boolean) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(questionId);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedQuestionIds.size === filteredQuestions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      const allIds = filteredQuestions.map((q, idx) =>
        !createdQuizId ? String(startIndex + idx) : (q as QuizQuestionDto).id
      );
      setSelectedQuestionIds(new Set(allIds));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedQuestionIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    if (selectedQuestionIds.size === 0) return;

    if (!createdQuizId) {
      const idsToRemove = new Set(selectedQuestionIds);
      setTempQuestions(tempQuestions.filter((_, i) => !idsToRemove.has(String(i))));
    } else {
      const idsToRemove = new Set(selectedQuestionIds);
      setTempQuestions(tempQuestions.filter((q) => !idsToRemove.has((q as { id?: string }).id ?? '')));
      void publishedQuestionsQuery.refetch();
    }

    setSelectedQuestionIds(new Set());
    setIsSelectionMode(false);
    setBulkDeleteDialogOpen(false);
  };

  const toDraftValues = (payload: CreateQuizQuestionRequest): QuizQuestionDraftValues => ({
    questionText: payload.questionText,
    type: payload.type ?? 'MultipleChoice',
    optionA: payload.optionA ?? '',
    optionB: payload.optionB ?? '',
    optionC: payload.optionC ?? '',
    optionD: payload.optionD ?? '',
    correctAnswer: payload.correctAnswer ?? '',
    essayAnswer: payload.essayAnswer ?? '',
    imageUrl: payload.imageUrl ?? '',
  });

  const handleDraftSave = (payload: CreateQuizQuestionRequest) => {
    const row = { ...payload, quizId: 'temp' };
    const draft = toDraftValues(payload);
    if (editingTempIndex !== null) {
      const u = [...tempQuestions];
      u[editingTempIndex] = row;
      setTempQuestions(u);
      questionFields.update(editingTempIndex, draft);
    } else {
      setTempQuestions([...tempQuestions, row]);
      questionFields.append(draft);
    }
    setEditorOpen(false);
    setEditingQuestion(null);
    setEditingTempIndex(null);
  };

  const handleImportQuestions = (parsed: ParsedQuestion[]) => {
    const newQs: CreateQuizQuestionRequest[] = parsed.map((p) => ({
      quizId: 'temp',
      questionText: p.questionText,
      type: p.type,
      optionA: p.optionA,
      optionB: p.optionB,
      optionC: p.optionC,
      optionD: p.optionD,
      correctAnswer: p.correctAnswer,
    }));
    setTempQuestions((prev) => [...prev, ...newQs]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-primary">Create Quiz</p>
          <h1 className="font-['Manrope',sans-serif] text-2xl font-bold leading-tight tracking-tight text-card-foreground">
            {formData.title || 'New Quiz'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Configure quiz settings and add questions.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 mt-1">
          <button
            type="button"
            disabled={loading}
            onClick={handleSaveDraft}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition-all hover:bg-muted/60 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button
            type="button"
            disabled={loading || allQuestions.length === 0}
            onClick={handleCreateQuiz}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publish
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ListChecks className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Questions</p>
          <p className="text-xl font-bold text-card-foreground">{filteredQuestions.length}</p>
        </div>
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <Timer className="h-4 w-4 text-secondary" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Time Limit</p>
          <p className="text-xl font-bold text-card-foreground">{formData.timeLimit || '—'} min</p>
        </div>
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <Settings2 className="h-4 w-4 text-secondary" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Difficulty</p>
          <p className="text-xl font-bold text-card-foreground">{formData.difficulty || '—'}</p>
        </div>
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
              <Percent className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Pass Score</p>
          <p className="text-xl font-bold text-card-foreground">{formData.passingScore || '—'}%</p>
        </div>
      </div>

      {/* Main Content - Bento Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Questions List (left column) */}
        <div className="order-1 col-span-12 lg:order-1 lg:col-span-8">
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-sm text-card-foreground">
                <Settings2 className="h-4 w-4 text-primary" />
                Questions <span className="text-muted-foreground">({filteredQuestions.length})</span>
                {isSelectionMode && filteredQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="ml-2 text-xs font-medium text-primary hover:underline"
                  >
                    {selectedQuestionIds.size === filteredQuestions.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
                {isSelectionMode && selectedQuestionIds.size > 0 && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {selectedQuestionIds.size} selected
                  </span>
                )}
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
                {allQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectionMode}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
                      isSelectionMode
                        ? 'bg-primary text-white border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-card-foreground'
                    }`}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {isSelectionMode ? 'Cancel' : 'Select'}
                  </button>
                )}
                {isSelectionMode && selectedQuestionIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-destructive/90"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete ({selectedQuestionIds.size})
                  </button>
                )}
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
            </div>

            <div className="p-4">
              {/* AI Questions Section */}
              {aiQuestions.length > 0 && (
                <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-bold text-purple-700">
                        AI Generated Questions ({aiQuestions.length})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddAIQuestionsToQuiz}
                        className="h-8 text-xs"
                      >
                        Add to Quiz
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleCreateAndAddAIQuestions}
                        className="h-8 bg-purple-600 text-xs hover:bg-purple-700"
                      >
                        Create Quiz now
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {aiQuestions.map((q, index) => (
                      <div key={index} className="rounded-lg border border-purple-200 bg-white p-3">
                        <div className="mb-2 flex items-start gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                            {index + 1}
                          </span>
                          <p className="text-sm font-medium">{q.questionText}</p>
                        </div>
                        <div className="ml-9 grid grid-cols-2 gap-1 text-xs">
                          <span className={q.correctAnswer === 'A' ? 'text-green-600 font-bold' : ''}>A: {q.optionA}</span>
                          <span className={q.correctAnswer === 'B' ? 'text-green-600 font-bold' : ''}>B: {q.optionB}</span>
                          <span className={q.correctAnswer === 'C' ? 'text-green-600 font-bold' : ''}>C: {q.optionC}</span>
                          <span className={q.correctAnswer === 'D' ? 'text-green-600 font-bold' : ''}>D: {q.optionD}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {allQuestions.length === 0 ? (
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
                  {displayedQuestions.map((question, index) => {
                    const qId = !createdQuizId
                      ? String(startIndex + index)
                      : (question as QuizQuestionDto).id;
                    return (
                      <QuestionCard
                        key={!createdQuizId ? `t-${startIndex + index}` : (question as QuizQuestionDto).id}
                        question={question as QuizQuestionDto}
                        variant="curated"
                        selectable={isSelectionMode}
                        isSelected={selectedQuestionIds.has(qId)}
                        onSelect={handleSelectQuestion}
                        onEdit={() => {
                          if (!createdQuizId) {
                            setEditingQuestion(question as CreateQuizQuestionRequest);
                            setEditingTempIndex(startIndex + index);
                            setEditorOpen(true);
                          } else {
                            handleEditQuestion(question as QuizQuestionDto);
                          }
                        }}
                        onDelete={() =>
                          handleDeleteQuestion(
                            !createdQuizId ? String(startIndex + index) : (question as QuizQuestionDto).id,
                            (question as QuizQuestionDto).questionText
                          )
                        }
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
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Quiz title..."
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
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
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
                  list="topic-options-create"
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="Select or type topic..."
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                />
                <datalist id="topic-options-create">
                  {TOPIC_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Class</label>
                <div className="relative">
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
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
                    value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-2 py-2 text-xs outline-none transition-all focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Closes</label>
                  <input
                    type="datetime-local"
                    value={formData.closeTime}
                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-2 py-2 text-xs outline-none transition-all focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Time (min)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.timeLimit}
                    onChange={(e) => setFormData({ ...formData, timeLimit: e.target.value.replace(/\D/g, '')})}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                    placeholder="30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Pass (%)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.passingScore}
                    onChange={(e) => setFormData({ ...formData, passingScore: e.target.value.replace(/\D/g, '').slice(0, 3)})}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                    placeholder="80"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Description..."
                  className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Quiz Mode</label>
                <div className="grid grid-cols-1 gap-2">
                  {QUIZ_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, quizMode: opt.value })}
                      className={`flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all ${
                        formData.quizMode === opt.value
                          ? `${opt.color} border-2 shadow-sm`
                          : 'border-border bg-muted/30 hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className={`text-xs font-bold ${formData.quizMode === opt.value ? '' : 'text-foreground'}`}>
                        {opt.label}
                      </span>
                      <span className={`text-[10px] ${formData.quizMode === opt.value ? 'opacity-80' : 'text-muted-foreground'}`}>
                        {opt.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="mt-4 rounded-2xl border border-secondary/20 bg-secondary/10 p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={openCasePicker}
                className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                Tag reference cases ({referenceCaseIds.length})
              </button>
              {referenceCaseIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {referenceCaseIds.slice(0, 3).map((id) => {
                    const c = caseLibrary.find((x) => x.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold text-secondary"
                      >
                        {c?.title?.slice(0, 15) || id.slice(0, 8)}
                      </span>
                    );
                  })}
                  {referenceCaseIds.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{referenceCaseIds.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {casePickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => setCasePickerOpen(false)}
          />
          <div className="relative max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold text-card-foreground">Reference cases</h3>
              <button type="button" onClick={() => setCasePickerOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-4">
              {casesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : caseLibrary.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No cases in library.</p>
              ) : (
                <ul className="space-y-2">
                  {caseLibrary.map((c) => {
                    const sel = referenceCaseIds.includes(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggleReferenceCase(c.id)}
                          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                            sel ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <input type="checkbox" readOnly checked={sel} className="mt-1" />
                          <span>
                            <span className="font-medium text-card-foreground">{c.title || 'Untitled'}</span>
                            {c.categoryName ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">{c.categoryName}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-border p-4">
              <Button className="w-full" onClick={() => setCasePickerOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <QuestionEditorDialog
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingQuestion(null);
          setEditingTempIndex(null);
        }}
        quizId={createdQuizId || 'temp'}
        draftMode={!createdQuizId}
        onDraftSave={handleDraftSave}
        question={
          editingQuestion
            ? {
                id: editingTempIndex !== null ? String(editingTempIndex) : '',
                quizId: '',
                quizTitle: null,
                caseId: null,
                caseTitle: null,
                questionText: editingQuestion.questionText,
                type: editingQuestion.type || 'MultipleChoice',
                optionA: editingQuestion.optionA || null,
                optionB: editingQuestion.optionB || null,
                optionC: editingQuestion.optionC || null,
                optionD: editingQuestion.optionD || null,
                correctAnswer: editingQuestion.correctAnswer || null,
              }
            : null
        }
        onSuccess={() => {
          setEditorOpen(false);
          setEditingQuestion(null);
          setEditingTempIndex(null);
        }}
      />

      <QuestionImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportQuestions}
      />

      {/* Success Dialog */}
      {successDialogOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Dismiss"
            onClick={handleSuccessGoToList}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card p-6 text-center shadow-xl">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15">
                <CheckCircle2 className="h-7 w-7 text-secondary" />
              </div>
            </div>
            <h3 className="mb-1 font-semibold text-base text-card-foreground">
              {lastCreatedQuizTitle || 'Quiz'} created successfully!
            </h3>
            <p className="mb-5 text-sm text-muted-foreground">
              What would you like to do next?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSuccessGoToEdit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90"
              >
                <Pencil className="h-4 w-4" />
                Continue editing
              </button>
              <button
                type="button"
                onClick={handleSuccessGoToList}
                className="w-full rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                Back to Quizzes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Remove Question</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Are you sure you want to remove this question? This action cannot be undone.
              {questionToDelete && (
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-left">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {questionToDelete.text}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 sm:flex-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteQuestion}
              className="flex-1 sm:flex-none bg-destructive text-white hover:bg-destructive/90"
            >
              Remove Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Remove {selectedQuestionIds.size} Question{selectedQuestionIds.size > 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Are you sure you want to remove {selectedQuestionIds.size} selected question
              {selectedQuestionIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 sm:flex-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="flex-1 sm:flex-none bg-destructive text-white hover:bg-destructive/90"
            >
              Remove {selectedQuestionIds.size} Question{selectedQuestionIds.size > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
