'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Edit,
  ChevronDown,
  BarChart3,
  Timer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import QuestionEditorDialog from '@/components/lecturer/quizzes/QuestionEditorDialog';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import QuestionCard from '@/components/lecturer/quizzes/QuestionCard';
import {
  getQuiz,
  getQuizQuestions,
  deleteQuizQuestion,
} from '@/lib/api/lecturer-quiz';
import type { QuizDto, QuizQuestionDto } from '@/lib/api/types';

const QUESTIONS_PER_PAGE = 3;

export default function QuestionManagerPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestionDto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastEditedQuestionId, setLastEditedQuestionId] = useState<string | null>(null);

  // Delete question dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    questionId: string;
    questionText: string;
  } | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  const loadData = useCallback(async (options?: { preserveQuestionId?: string }) => {
    if (!quizId) {
      setLoading(false);
      setError('Quiz ID is missing');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [quizData, questionsData] = await Promise.all([
        getQuiz(quizId),
        getQuizQuestions(quizId),
      ]);
      setQuiz(quizData);

      // Preserve page position for edited questions
      if (options?.preserveQuestionId) {
        const questionIndex = questionsData.findIndex(q => q.id === options.preserveQuestionId);
        if (questionIndex !== -1) {
          const newPage = Math.max(1, Math.ceil((questionIndex + 1) / QUESTIONS_PER_PAGE));
          setCurrentPage(newPage);
        }
      }

      setQuestions(questionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [quizId, searchTerm]);

  const handleEditQuestion = (question: QuizQuestionDto) => {
    setEditingQuestion(question);
    setLastEditedQuestionId(question.id);
    setEditorOpen(true);
  };

  const openDeleteQuestionDialog = (questionId: string, questionText: string) => {
    setDeleteDialog({ questionId, questionText });
  };

  const handleDeleteQuestionConfirm = async () => {
    if (!deleteDialog) return;
    setDeletingQuestion(true);
    try {
      await deleteQuizQuestion(deleteDialog.questionId);
      setQuestions(questions.filter((q) => q.id !== deleteDialog.questionId));
      setDeleteDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
    } finally {
      setDeletingQuestion(false);
    }
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setLastEditedQuestionId(null);
    setEditorOpen(true);
  };

  const handleQuestionSuccess = () => {
    // Preserve page position for edited questions
    loadData(lastEditedQuestionId ? { preserveQuestionId: lastEditedQuestionId } : undefined);
  };

  const filtered = questions.filter(
    (q) =>
      q.questionText?.toLowerCase().includes(searchTerm.toLowerCase()) ??
      false
  );

  const totalPages = Math.ceil(filtered.length / QUESTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
  const displayedFiltered = filtered.slice(startIndex, startIndex + QUESTIONS_PER_PAGE);

  // Stats
  const totalQuestions = questions.length;
  const avgCompletionTime = totalQuestions > 0 ? '12m 40s' : '—';
  const difficultyIndex = totalQuestions > 0 ? 'Medium' : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error || 'Quiz not found'}</p>
        <Link href="/lecturer/quizzes" className="text-primary underline">
          Back to Quizzes
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Link href="/lecturer/quizzes" className="transition-colors hover:text-primary">
              Quizzes
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-bold text-primary">{quiz.title}</span>
          </nav>
          <h1 className="font-['Manrope',sans-serif] text-[2.75rem] font-extrabold tracking-tight text-card-foreground">
            Question Manager
          </h1>
          <p className="mt-2 max-w-lg text-lg text-muted-foreground">
            Manage diagnostic challenges and clinical validation tests for the advanced musculoskeletal module.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddQuestion}
          className="flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-bold text-white shadow-lg shadow-primary/10 transition-all hover:scale-[0.98] active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Create New Question
        </button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Quiz Health + Radiology Assets */}
        <div className="col-span-12 space-y-6 lg:col-span-4">
          {/* Quiz Health Card */}
          <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-['Manrope',sans-serif] text-lg font-bold text-card-foreground">
                Quiz Health
              </h3>
              <BarChart3 className="h-5 w-5 text-secondary" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-muted p-4">
                <span className="text-sm font-medium text-muted-foreground">Total Questions</span>
                <span className="text-xl font-bold font-['Manrope',sans-serif] text-card-foreground">
                  {totalQuestions}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted p-4">
                <span className="text-sm font-medium text-muted-foreground">Difficulty Index</span>
                <span className="text-xl font-bold font-['Manrope',sans-serif] text-tertiary">
                  {difficultyIndex}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted p-4">
                <span className="text-sm font-medium text-muted-foreground">Avg. Completion Time</span>
                <span className="text-xl font-bold font-['Manrope',sans-serif] text-card-foreground">
                  {avgCompletionTime}
                </span>
              </div>
            </div>
          </div>

          {/* Radiology Assets Card */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-[#2d3133] p-6 text-white">
            <div className="relative z-10">
              <h3 className="font-['Manrope',sans-serif] text-lg font-bold mb-2">
                Radiology Assets
              </h3>
              <p className="text-sm opacity-80 mb-6">
                Reference and attach high-fidelity diagnostic images to your clinical questions.
              </p>
              <button
                type="button"
                className="rounded-full bg-white/10 px-6 py-2 text-sm font-bold backdrop-blur-md transition-colors hover:bg-white/20"
              >
                Browse Library
              </button>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -bottom-10 opacity-20 transition-transform duration-500 group-hover:scale-110"
            >
              <div
                className="h-[160px] w-[160px] animate-pulse rounded-2xl bg-white/10"
                aria-hidden
              />
            </div>
          </div>
        </div>

        {/* Right Column: Questions List */}
        <div className="col-span-12 space-y-6 lg:col-span-8">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions..."
              className="h-10 w-full rounded-full border border-border bg-muted pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Question Cards */}
          {filtered.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/20 p-8">
              <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-['Manrope',sans-serif] text-lg font-semibold text-card-foreground">
                No questions yet
              </h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Start building your quiz by adding questions.
              </p>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-container px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Create First Question
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {displayedFiltered.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  variant="manager"
                  onEdit={handleEditQuestion}
                  onDelete={openDeleteQuestionDialog}
                />
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary-fixed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`h-9 w-9 rounded-full text-sm font-bold transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-white'
                            : 'text-primary hover:bg-primary-fixed'
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
                    className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary-fixed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <QuestionEditorDialog
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingQuestion(null);
          setLastEditedQuestionId(null);
        }}
        quizId={quizId}
        question={editingQuestion}
        onSuccess={handleQuestionSuccess}
        quizMode={quiz?.quizMode}
      />

      {/* Delete question confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialog !== null}
        title="Delete question?"
        description="This question will be permanently deleted from the quiz."
        itemName={deleteDialog?.questionText || ''}
        itemType="Question"
        onConfirm={handleDeleteQuestionConfirm}
        onCancel={() => setDeleteDialog(null)}
        deleting={deletingQuestion}
        confirmText="Delete question"
        cancelText="Cancel"
        dangerLevel="high"
      />
    </div>
  );
}
