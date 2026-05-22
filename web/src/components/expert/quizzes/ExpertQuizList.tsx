'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { fetchExpertQuizzesPaged, deleteExpertQuiz, type ExpertQuiz } from '@/lib/api/expert-quizzes';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  ClipboardList,
  X,
  Loader2,
  AlertCircle,
  Brain,
} from 'lucide-react';

type QuizStatus = 'Active' | 'Draft' | 'Completed';

const QUIZ_MODE_LABELS: Record<number, string> = {
  1: 'Exam',
  2: 'Practice',
  3: 'Adaptive',
};

const QUIZ_MODE_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  2: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  3: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

interface EnrichedQuiz extends ExpertQuiz {
  status: QuizStatus;
  formattedOpen: string;
  formattedClose: string;
  compactOpen: string;
  compactClose: string;
  formattedCreatedAt: string;
}

const PAGE_SIZE = 5;

function formatQuizInstant(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatQuizCompact(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

function formatCreatedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

function getStatus(openTime: string | null, closeTime: string | null): QuizStatus {
  const now = new Date();
  const open = openTime ? new Date(openTime) : null;
  const close = closeTime ? new Date(closeTime) : null;

  if (close && now > close) return 'Completed';
  if (open && now < open) return 'Draft';
  return 'Active';
}

function buildPageList(totalPages: number, current: number): (number | 'ellipsis')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  for (const p of [...pages]) {
    if (p < 1 || p > totalPages) pages.delete(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

interface ExpertQuizListProps {
  onEditQuiz: (quiz: ExpertQuiz) => void;
  onCreateQuiz: () => void;
  onRefresh?: () => void;
}

export default function ExpertQuizList({ onEditQuiz, onCreateQuiz, onRefresh }: ExpertQuizListProps) {
  const router = useRouter();
  const toast = useToast();
  const [quizzes, setQuizzes] = useState<EnrichedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState<EnrichedQuiz | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExpertQuizzesPaged(1, 100);
      const enriched: EnrichedQuiz[] = data.items.map((q) => ({
        ...q,
        status: getStatus(q.openTime, q.closeTime),
        formattedOpen: formatQuizInstant(q.openTime),
        formattedClose: formatQuizInstant(q.closeTime),
        compactOpen: formatQuizCompact(q.openTime),
        compactClose: formatQuizCompact(q.closeTime),
        formattedCreatedAt: formatCreatedAt(q.createdAt),
      }));
      // Sort by createdAt descending (newest first)
      enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQuizzes(enriched);
      onRefresh?.();
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
      await deleteExpertQuiz(deleteTarget.id);
      toast.success('Quiz deleted successfully.');
      setDeleteTarget(null);
      loadQuizzes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete quiz.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = quizzes.filter((quiz) => {
    const term = searchTerm.toLowerCase();
    return (
      quiz.title?.toLowerCase().includes(term) ||
      quiz.topic?.toLowerCase().includes(term) ||
      quiz.difficulty?.toLowerCase().includes(term)
    );
  });

  const totalPages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const paged = totalPages === 0 ? [] : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageItems = buildPageList(totalPages, currentPage);

  const totalQuizzes = quizzes.length;
  const activeQuizzes = quizzes.filter((q) => q.status === 'Active').length;
  const draftQuizzes = quizzes.filter((q) => q.status === 'Draft').length;

  const listStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const listEnd = filtered.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, filtered.length);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-3xl border border-border/10 bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-96 rounded-3xl border border-border/40 bg-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Total Quizzes</p>
          <p className="mt-1 text-3xl font-black text-card-foreground">{totalQuizzes}</p>
        </div>
        <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
              <CheckCircle className="h-5 w-5 text-secondary" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Active</p>
          <p className="mt-1 text-3xl font-black text-card-foreground">{activeQuizzes}</p>
        </div>
        <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <Edit className="h-5 w-5 text-warning" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Drafts</p>
          <p className="mt-1 text-3xl font-black text-card-foreground">{draftQuizzes}</p>
        </div>
        <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/20">
              <CheckCircle className="h-5 w-5 text-secondary" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">AI Generated</p>
          <p className="mt-1 text-3xl font-black text-card-foreground">
            {quizzes.filter((q) => q.isAiGenerated).length}
          </p>
        </div>
      </div>

      {/* Quiz Table */}
      <div className="rounded-3xl border border-border/40 bg-card shadow-sm overflow-x-auto">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 font-['Manrope',sans-serif] text-lg font-bold text-card-foreground">
            <ClipboardList className="h-5 w-5 text-primary" />
            My Quizzes
          </h3>
          <Button type="button" variant="default" size="sm" onClick={onCreateQuiz}>
            <Plus className="h-4 w-4 mr-2" />
            Create Quiz
          </Button>
        </div>

        <div className="border-b border-border px-6 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search quizzes, topics…"
              className="h-10 w-full rounded-full border border-border bg-muted pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Quiz Title</th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Topic</th>
                <th className="px-2 py-4 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Mode</th>
                <th className="px-2 py-4 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Difficulty</th>
                <th className="px-2 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Time / Pass</th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Opens / Closes</th>
                <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No quizzes found.</p>
                      <Button type="button" variant="outline" size="sm" onClick={onCreateQuiz}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create your first quiz
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((quiz) => (
                  <tr key={quiz.id} className="group hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-sm font-bold leading-snug text-card-foreground">
                            {quiz.title || 'Untitled quiz'}
                          </p>
                          {quiz.isAiGenerated && (
                            <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold uppercase text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                              AI Generated
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-block max-w-full break-words rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {quiz.topic || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${QUIZ_MODE_COLORS[quiz.quizMode ?? 1] || QUIZ_MODE_COLORS[1]}`}>
                        <Brain className="h-3 w-3" />
                        {QUIZ_MODE_LABELS[quiz.quizMode ?? 1] || 'Exam'}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-center">
                      <span className="text-sm font-bold text-card-foreground">{quiz.difficulty || '—'}</span>
                    </td>
                    <td className="px-2 py-4">
                      <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        quiz.status === 'Active'
                          ? 'bg-secondary/15 text-secondary'
                          : quiz.status === 'Completed'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-warning/10 text-warning'
                      }`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          quiz.status === 'Active'
                            ? 'bg-secondary'
                            : quiz.status === 'Completed'
                              ? 'bg-muted-foreground'
                              : 'bg-warning'
                        }`} />
                        {quiz.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="space-y-1 text-[11px] leading-snug">
                        <div className="font-semibold text-card-foreground">{quiz.timeLimit || 0} min</div>
                        <div className="text-muted-foreground">Pass: {quiz.passingScore || 0}%</div>
                      </div>
                    </td>
                    <td className="min-w-0 px-3 py-4">
                      <div className="min-w-0 space-y-1 text-[11px] leading-snug">
                        <div><span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Open</span><span className="block break-words font-semibold text-card-foreground">{quiz.compactOpen}</span></div>
                        <div><span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Close</span><span className="block break-words font-semibold text-card-foreground">{quiz.compactClose}</span></div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Save quiz data to sessionStorage for edit page
                            sessionStorage.setItem('editQuiz', JSON.stringify(quiz));
                            router.push(`/expert/quizzes/create?edit=${quiz.id}`);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          title="Edit Quiz"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(quiz)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Delete Quiz"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            {filtered.length === 0 ? 'No quizzes to show.' : `Showing ${listStart} to ${listEnd} of ${filtered.length} quizzes`}
          </p>
          {totalPages > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/30 bg-white text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageItems.map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors ${
                      item === currentPage
                        ? 'bg-primary text-white'
                        : 'border border-border/30 bg-white hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/30 bg-white text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-card-foreground">Delete Quiz</h3>
                <p className="text-sm text-muted-foreground mt-1">This action cannot be undone</p>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/40 p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground truncate">{deleteTarget.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{deleteTarget.difficulty || '—'}</span>
                    <span>•</span>
                    <span>{deleteTarget.timeLimit || 0} min</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 mb-6">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm leading-relaxed text-muted-foreground">
                <p>Are you sure you want to delete this quiz?</p>
                <p className="mt-2 font-medium text-foreground/90">
                  The quiz and all its questions will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
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
          </div>
        </div>
      )}
    </div>
  );
}
