'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  UploadCloud,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Settings2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Bone,
  Stethoscope,
  ArrowLeft,
  BookOpen,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  createExpertQuiz,
  addQuizQuestionsBatched,
  getQuizQuestions,
  getExpertQuiz,
  updateExpertQuiz,
  type ExpertQuiz,
  type CreateExpertQuizRequest,
  type QuizQuestionDto,
} from '@/lib/api/expert-quizzes';
import { updateExpertQuizQuestion, fetchExpertQuizQuestions, createExpertQuizQuestion, deleteExpertQuizQuestion } from '@/lib/api/expert-quiz-questions';
import type { CreateQuizQuestionRequest } from '@/lib/api/types';
import classificationApi, { type BoneSpecialtyTreeDto, type PathologyCategorySimpleDto } from '@/lib/api/classification';
import { useToast } from '@/components/ui/toast';
import ExpertQuestionCard from '../../../../components/expert/quizzes/ExpertQuestionCard';
import ExpertQuestionEditorDialog from '../../../../components/expert/quizzes/ExpertQuestionEditorDialog';
import QuestionImportDialog from '../../../../components/lecturer/quizzes/QuestionImportDialog';
import type { ParsedQuestion } from '../../../../components/lecturer/quizzes/QuestionImportDialog';

const QUESTIONS_PER_PAGE = 5;

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
  { value: 'Lower Limb', label: 'Lower Limb' },
  { value: 'Upper Limb', label: 'Upper Limb' },
  { value: 'Spine', label: 'Spine' },
  { value: 'Chest', label: 'Chest' },
  { value: 'Abdomen', label: 'Abdomen' },
  { value: 'Head & Neck', label: 'Head & Neck' },
  { value: 'Pelvis', label: 'Pelvis' },
  { value: 'General', label: 'General' },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
] as const;

const QUIZ_MODE_OPTIONS = [
  { value: 1, label: 'Exam', description: 'Timed assessment with grading' },
  { value: 2, label: 'Practice', description: 'Unlimited attempts, hints & explanations' },
  { value: 3, label: 'Adaptive', description: 'AI-powered personalized difficulty' },
] as const;

function flattenBoneSpecialties(tree: BoneSpecialtyTreeDto[], level = 0): (BoneSpecialtyTreeDto & { level: number })[] {
  const result: (BoneSpecialtyTreeDto & { level: number })[] = [];
  for (const item of tree) {
    result.push({ ...item, level });
    if (item.children && item.children.length > 0) {
      result.push(...flattenBoneSpecialties(item.children, level + 1));
    }
  }
  return result;
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

function ExpertCreateQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionDto[]>([]);
  const [editQuiz, setEditQuiz] = useState<ExpertQuiz | null>(null);

  // Deep classification state
  const [boneSpecialties, setBoneSpecialties] = useState<BoneSpecialtyTreeDto[]>([]);
  const [flatBoneSpecialties, setFlatBoneSpecialties] = useState<(BoneSpecialtyTreeDto & { level: number })[]>([]);
  const [pathologyCategories, setPathologyCategories] = useState<PathologyCategorySimpleDto[]>([]);
  const [loadingClassifications, setLoadingClassifications] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    difficulty: 'Medium',
    openTime: '',
    closeTime: '',
    timeLimit: '30',
    passingScore: '70',
    quizMode: 1 as number,
  });

  const [classification, setClassification] = useState<string>('');
  const [boneSpecialtyId, setBoneSpecialtyId] = useState<string>('');
  const [pathologyCategoryId, setPathologyCategoryId] = useState<string>('');

  const [tempQuestions, setTempQuestions] = useState<CreateQuizQuestionRequest[]>([]);

  // Load temp questions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('expertDraftQuiz_questions');
    if (saved) {
      try {
        setTempQuestions(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Save temp questions to localStorage on change
  useEffect(() => {
    localStorage.setItem('expertDraftQuiz_questions', JSON.stringify(tempQuestions));
  }, [tempQuestions]);

  // Clear localStorage when quiz is saved successfully
  const clearDraftStorage = () => {
    localStorage.removeItem('expertDraftQuiz_questions');
  };

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<CreateQuizQuestionRequest | null>(null);
  const [editingTempIndex, setEditingTempIndex] = useState<number | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    loadClassifications();
  }, []);

  // Load quiz data when editing
  useEffect(() => {
    if (!editId) return;
    
    const loadQuizData = async () => {
      setLoading(true);
      setIsEditMode(true);
      try {
        // First try to load from sessionStorage (passed from list page)
        const savedQuiz = sessionStorage.getItem('editQuiz');
        if (savedQuiz) {
          const quiz = JSON.parse(savedQuiz);
          sessionStorage.removeItem('editQuiz'); // Clean up
          
          setEditQuiz(quiz);
          setCreatedQuizId(quiz.id);
          
          // Populate form data
          setFormData({
            title: quiz.title || '',
            topic: quiz.topic || '',
            difficulty: quiz.difficulty || 'Medium',
            openTime: utcToLocalDatetimeLocal(quiz.openTime),
            closeTime: utcToLocalDatetimeLocal(quiz.closeTime),
            timeLimit: quiz.timeLimit?.toString() || '30',
            passingScore: quiz.passingScore?.toString() || '70',
            quizMode: quiz.quizMode || 1,
          });
          setClassification(quiz.classification || '');
          setBoneSpecialtyId(quiz.boneSpecialtyId || '');
          setPathologyCategoryId(quiz.pathologyCategoryId || '');
        }
        
        // Always load questions from API
        const quizQuestions = await getQuizQuestions(editId);
        setQuestions(quizQuestions);
      } catch (err) {
        toast.error('Failed to load quiz data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadQuizData();
  }, [editId]);

  const loadClassifications = async () => {
    setLoadingClassifications(true);
    try {
      const [specialtiesTree, pathologyList] = await Promise.all([
        classificationApi.getBoneSpecialtiesTree(),
        classificationApi.getPathologyCategories(),
      ]);
      setBoneSpecialties(specialtiesTree);
      setFlatBoneSpecialties(flattenBoneSpecialties(specialtiesTree));
      setPathologyCategories(pathologyList);
    } catch (err) {
      console.error('Failed to load classifications:', err);
    } finally {
      setLoadingClassifications(false);
    }
  };

  const filteredPathologyCategories = pathologyCategories.filter(
    (p) => !boneSpecialtyId || p.boneSpecialtyId === boneSpecialtyId || !p.boneSpecialtyId
  );

  const toUTC = (local: string) => {
    const t = local.trim();
    if (!t) return undefined;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  };

  const buildCreatePayload = (): CreateExpertQuizRequest => ({
    title: formData.title,
    topic: formData.topic || null,
    difficulty: formData.difficulty || '',
    classification: classification || null,
    isAiGenerated: false,
    openTime: toUTC(formData.openTime) || '',
    closeTime: toUTC(formData.closeTime) || '',
    timeLimit: formData.timeLimit ? parseInt(formData.timeLimit, 10) : undefined,
    passingScore: formData.passingScore ? parseInt(formData.passingScore, 10) : undefined,
    boneSpecialtyId: boneSpecialtyId || null,
    pathologyCategoryId: pathologyCategoryId || null,
    quizMode: formData.quizMode,
  });

  // Build payload for update - only send changed fields
  const buildUpdatePayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      Id: editQuiz?.id,
      id: editQuiz?.id,
      Title: formData.title,
    };
    
    if (formData.topic) payload['Topic'] = formData.topic;
    if (formData.difficulty) payload['Difficulty'] = formData.difficulty;
    if (classification) payload['Classification'] = classification;
    if (formData.openTime) payload['OpenTime'] = toUTC(formData.openTime);
    if (formData.closeTime) payload['CloseTime'] = toUTC(formData.closeTime);
    if (formData.timeLimit) payload['TimeLimit'] = parseInt(formData.timeLimit, 10);
    if (formData.passingScore) payload['PassingScore'] = parseInt(formData.passingScore, 10);
    if (boneSpecialtyId) payload['BoneSpecialtyId'] = boneSpecialtyId;
    if (pathologyCategoryId) payload['PathologyCategoryId'] = pathologyCategoryId;
    payload['QuizMode'] = formData.quizMode;
    
    return payload;
  };

  // ========== Quiz Handlers ==========
  const handleUpdateQuiz = async () => {
    if (!formData.title.trim()) {
      setError('Please enter a quiz title');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (editQuiz) {
        const payload = buildUpdatePayload();
        await updateExpertQuiz(editQuiz.id, payload);
        toast.success('Quiz updated successfully.');
        setSuccessDialogOpen(true);
        setLastCreatedQuizId(editQuiz.id);
        setLastCreatedQuizTitle(editQuiz.title);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quiz');
      toast.error(err instanceof Error ? err.message : 'Failed to update quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (isEditMode) {
      return handleUpdateQuiz();
    }
    if (!formData.title.trim()) {
      setError('Please enter a quiz title');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const quiz = await createExpertQuiz(buildCreatePayload());
      if (tempQuestions.length > 0) {
        await addQuizQuestionsBatched(quiz.id, tempQuestions);
      }
      toast.success('Draft quiz saved.');
      setLastCreatedQuizId(quiz.id);
      setLastCreatedQuizTitle(quiz.title);
      setSuccessDialogOpen(true);
      clearDraftStorage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (isEditMode) {
      return handleUpdateQuiz();
    }
    if (!formData.title.trim()) {
      setError('Please enter a quiz title');
      return;
    }
    if (allQuestions.length === 0) {
      setError('Add at least one question before publishing.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const quiz = await createExpertQuiz(buildCreatePayload());
      setCreatedQuizId(quiz.id);
      if (tempQuestions.length > 0) {
        await addQuizQuestionsBatched(quiz.id, tempQuestions);
      }
      toast.success('Quiz created and published successfully.');
      setLastCreatedQuizId(quiz.id);
      setLastCreatedQuizTitle(quiz.title);
      setSuccessDialogOpen(true);
      clearDraftStorage();
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
      // Navigate to create page with edit param
      router.push(`/expert/quizzes/create?edit=${lastCreatedQuizId}`);
    } else {
      router.push('/expert/quizzes');
    }
  };

  const handleSuccessGoToList = () => {
    setSuccessDialogOpen(false);
    router.push('/expert/quizzes');
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setEditingTempIndex(null);
    setEditingQuestionId(null); // Clear when adding new question
    setEditorOpen(true);
  };

  const handleEditQuestion = (question: QuizQuestionDto) => {
    if (!createdQuizId) {
      const idx = parseInt(question.id, 10);
      if (!Number.isNaN(idx) && tempQuestions[idx]) {
        setEditingQuestion(tempQuestions[idx]);
        setEditingTempIndex(idx);
        setEditingQuestionId(null); // New question in draft mode
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
        imageUrl: q.imageUrl || undefined,
        hint: q.hint || '',
        explanation: q.explanation || '',
      });
      setEditingTempIndex(null);
      setEditingQuestionId(q.id); // Store the question ID for update
      setEditorOpen(true);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Remove this question?')) return;
    
    // If we're in edit mode (quiz already created), delete from server
    if (createdQuizId && questionId && !questionId.startsWith('t-')) {
      setLoading(true);
      try {
        await deleteExpertQuizQuestion(questionId);
        toast.success('Question deleted successfully.');
        // Reload questions from server
        const updatedQuestions = await fetchExpertQuizQuestions(createdQuizId);
        setQuestions(updatedQuestions.map(q => ({
          id: q.questionId,
          quizId: q.quizId || createdQuizId,
          quizTitle: q.quizTitle || null,
          caseId: q.caseId || null,
          caseTitle: q.caseTitle || null,
          questionText: q.questionText,
          type: q.type,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          imageUrl: q.imageUrl || null,
          hint: q.hint || null,
          explanation: q.explanation || null,
        })));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete question.');
      } finally {
        setLoading(false);
      }
    } else {
      // Draft mode - delete locally
      setTempQuestions(tempQuestions.filter((_, i) => i.toString() !== questionId));
      setQuestions(questions.filter((q) => q.id !== questionId));
    }
  };

  const handleDraftSave = async (payload: CreateQuizQuestionRequest, questionId?: string) => {
    // Use editingQuestionId if available, otherwise use questionId from dialog
    const existingQuestionId = editingQuestionId || questionId;
    
    // If we're in edit mode (quiz already created), save to server
    if (createdQuizId) {
      setLoading(true);
      try {
        if (existingQuestionId) {
          // Update existing question via API
          await updateExpertQuizQuestion(existingQuestionId, {
            quizId: createdQuizId,
            questionText: payload.questionText,
            type: payload.type,
            optionA: payload.optionA,
            optionB: payload.optionB,
            optionC: payload.optionC,
            optionD: payload.optionD,
            correctAnswer: payload.correctAnswer ?? '',
            imageUrl: payload.imageUrl,
            hint: payload.hint,
            explanation: payload.explanation,
          });
          toast.success('Question updated successfully.');
        } else {
          // Create new question via API
          await createExpertQuizQuestion(createdQuizId, {
            questionText: payload.questionText,
            type: payload.type,
            optionA: payload.optionA,
            optionB: payload.optionB,
            optionC: payload.optionC,
            optionD: payload.optionD,
            correctAnswer: payload.correctAnswer ?? '',
            imageUrl: payload.imageUrl,
            hint: payload.hint,
            explanation: payload.explanation,
          });
          toast.success('Question added successfully.');
        }
        // Reload questions from server
        const updatedQuestions = await fetchExpertQuizQuestions(createdQuizId);
        setQuestions(updatedQuestions.map(q => ({
          id: q.questionId,
          quizId: q.quizId || createdQuizId,
          quizTitle: q.quizTitle || null,
          caseId: q.caseId || null,
          caseTitle: q.caseTitle || null,
          questionText: q.questionText,
          type: q.type,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          imageUrl: q.imageUrl || null,
          hint: q.hint || null,
          explanation: q.explanation || null,
        })));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save question.');
      } finally {
        setLoading(false);
      }
    } else {
      // Draft mode - save locally
      const row = { ...payload, quizId: 'temp' };
      if (editingTempIndex !== null) {
        const u = [...tempQuestions];
        u[editingTempIndex] = row;
        setTempQuestions(u);
      } else {
        setTempQuestions([...tempQuestions, row]);
      }
    }
    setEditorOpen(false);
    setEditingQuestion(null);
    setEditingTempIndex(null);
    setEditingQuestionId(null); // Clear after save
  };

  const handleImportQuestions = async (parsed: ParsedQuestion[]) => {
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
    
    // If in edit mode, add questions via API
    if (createdQuizId) {
      setLoading(true);
      try {
        for (const q of newQs) {
          await createExpertQuizQuestion(createdQuizId, {
            questionText: q.questionText,
            type: q.type,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer ?? '',
          });
        }
        toast.success(`${newQs.length} questions imported successfully.`);
        // Reload questions from server
        const updatedQuestions = await fetchExpertQuizQuestions(createdQuizId);
        setQuestions(updatedQuestions.map(q => ({
          id: q.questionId,
          quizId: q.quizId || createdQuizId,
          quizTitle: q.quizTitle || null,
          caseId: q.caseId || null,
          caseTitle: q.caseTitle || null,
          questionText: q.questionText,
          type: q.type,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          imageUrl: q.imageUrl || null,
          hint: q.hint || null,
          explanation: q.explanation || null,
        })));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to import questions.');
      } finally {
        setLoading(false);
      }
    } else {
      // Draft mode - save locally
      setTempQuestions((prev) => [...prev, ...newQs]);
    }
  };

  useEffect(() => {
    if (createdQuizId) {
      getQuizQuestions(createdQuizId)
        .then(setQuestions)
        .catch(() => setQuestions([]));
    }
  }, [createdQuizId]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Back Button */}
      <div>
        <button
          type="button"
          onClick={() => router.push('/expert/quizzes')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-card-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quizzes
        </button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-primary">{isEditMode ? 'Edit Quiz' : 'Create Quiz'}</p>
          <h1 className="font-['Manrope',sans-serif] text-2xl font-bold leading-tight tracking-tight text-card-foreground">
            {formData.title || (isEditMode ? 'Edit Quiz' : 'New Quiz')}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {isEditMode 
              ? 'Update quiz settings and manage questions for the expert library.' 
              : 'Configure quiz settings and add questions for the expert library.'}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
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
        <div className="rounded-2xl border border-border/10 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
              <Brain className="h-4 w-4 text-purple-500" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Quiz Mode</p>
          <p className="text-xl font-bold text-card-foreground">
            {QUIZ_MODE_OPTIONS.find(m => m.value === formData.quizMode)?.label || 'Exam'}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Main Content - Bento Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Questions List (left column) */}
        <div className="order-1 col-span-12 lg:order-1 lg:col-span-8">
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-sm text-card-foreground">
                <Settings2 className="h-4 w-4 text-primary" />
                Questions <span className="text-muted-foreground">({filteredQuestions.length})</span>
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
                  {displayedQuestions.map((question, index) => (
                    <ExpertQuestionCard
                      key={!createdQuizId ? `t-${startIndex + index}` : (question as QuizQuestionDto).id}
                      question={question as QuizQuestionDto}
                      variant="curated"
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
                        )
                      }
                    />
                  ))}

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
                  <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Bone className="h-3 w-3" />
                    Bone Specialty
                  </label>
                  <div className="relative">
                    <select
                      value={boneSpecialtyId}
                      onChange={(e) => {
                        setBoneSpecialtyId(e.target.value);
                        setPathologyCategoryId('');
                      }}
                      disabled={loadingClassifications}
                      className="w-full cursor-pointer appearance-none rounded-lg border border-border bg-muted/50 px-3 py-2 pr-8 text-xs outline-none transition-all focus:border-primary"
                    >
                      <option value="">Select specialty…</option>
                      {flatBoneSpecialties.map((s) => (
                        <option key={s.id} value={s.id}>
                          {'\u00A0\u00A0'.repeat(s.level)}{s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Stethoscope className="h-3 w-3" />
                    Pathology Category
                  </label>
                  <div className="relative">
                    <select
                      value={pathologyCategoryId}
                      onChange={(e) => setPathologyCategoryId(e.target.value)}
                      disabled={loadingClassifications}
                      className="w-full cursor-pointer appearance-none rounded-lg border border-border bg-muted/50 px-3 py-2 pr-8 text-xs outline-none transition-all focus:border-primary"
                    >
                      <option value="">Select pathology…</option>
                      {filteredPathologyCategories.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Classification</label>
                <div className="relative">
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-lg border border-border bg-muted/50 px-3 py-2 pr-8 text-xs outline-none transition-all focus:border-primary"
                  >
                    <option value="">None (use deep classification above)</option>
                    {CLASSIFICATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <p className="text-[10px] text-muted-foreground">Optional: academic level or classification</p>
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
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  Quiz Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {QUIZ_MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, quizMode: mode.value })}
                      className={`flex flex-col items-center rounded-lg border-2 p-2.5 transition-all ${
                        formData.quizMode === mode.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-muted/30 hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className={`text-xs font-bold ${
                        formData.quizMode === mode.value ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {mode.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {QUIZ_MODE_OPTIONS.find(m => m.value === formData.quizMode)?.description}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Topic</label>
                <input
                  list="topic-options-create-expert"
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="Select or type topic..."
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs outline-none transition-all focus:border-primary"
                />
                <datalist id="topic-options-create-expert">
                  {TOPIC_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} />
                  ))}
                </datalist>
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
                    placeholder="70"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="mt-4 rounded-2xl border border-secondary/20 bg-secondary/10 p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-2">Quiz Library</h3>
            <p className="text-xs text-muted-foreground">
              Your quiz will be saved to the expert library and can be assigned to classes by lecturers.
              These settings will be used as defaults when lecturers assign this quiz.
            </p>
          </div>
        </div>
      </div>

      <ExpertQuestionEditorDialog
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingQuestion(null);
          setEditingTempIndex(null);
          setEditingQuestionId(null);
        }}
        quizId={createdQuizId || 'temp'}
        draftMode={!createdQuizId}
        onDraftSave={handleDraftSave}
        question={
          editingQuestion
            ? {
                id: editingQuestionId || (editingTempIndex !== null ? String(editingTempIndex) : ''),
                quizId: editingQuestion.quizId || '',
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
                imageUrl: editingQuestion.imageUrl || null,
                hint: editingQuestion.hint || null,
                explanation: editingQuestion.explanation || null,
              }
            : null
        }
        onSuccess={() => {
          setEditorOpen(false);
          setEditingQuestion(null);
          setEditingTempIndex(null);
          setEditingQuestionId(null);
        }}
        quizMode={formData.quizMode}
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
    </div>
  );
}

export default function ExpertCreateQuizPage() {
  return (
    <Suspense fallback={
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-2xl" />
      </div>
    }>
      <ExpertCreateQuizContent />
    </Suspense>
  );
}
