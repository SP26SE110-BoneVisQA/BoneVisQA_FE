'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ExpertQuizList from '@/components/expert/quizzes/ExpertQuizList';
import { fetchExpertQuizzesPaged, fetchExpertQuizLibrary, type ExpertQuizLibraryItem } from '@/lib/api/expert-quizzes';
import { useToast } from '@/components/ui/toast';
import { Library, BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LIBRARY_PAGE_SIZE = 4;

export default function ExpertQuizzesPage() {
  const router = useRouter();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setIsLoading(true);
    try {
      await fetchExpertQuizzesPaged(1, 500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load quizzes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditQuiz = (quiz: { id: string }) => {
    router.push(`/expert/quizzes/create?edit=${quiz.id}`);
  };

  const handleCreateQuiz = () => {
    router.push('/expert/quizzes/create');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        title="Quiz management"
        subtitle="Create questions, assign quizzes to classes, and review scores."
      />
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">

        {/* Tab Navigation */}
        <div className="flex gap-4 border-b border-border">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              !showLibrary
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-card-foreground'
            }`}
            onClick={() => setShowLibrary(false)}
          >
            My Quizzes
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              showLibrary
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-card-foreground'
            }`}
            onClick={() => setShowLibrary(true)}
          >
            Quiz Library
          </button>
        </div>

        {!showLibrary ? (
          <ExpertQuizList
            onEditQuiz={handleEditQuiz}
            onCreateQuiz={handleCreateQuiz}
            onRefresh={loadQuizzes}
          />
        ) : (
          <QuizLibrarySection />
        )}
      </div>
    </div>
  );
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

function QuizLibrarySection() {
  const [libraryQuizzes, setLibraryQuizzes] = useState<ExpertQuizLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageIndex, setPageIndex] = useState(1);

  useEffect(() => {
    loadLibraryQuizzes();
  }, []);

  const loadLibraryQuizzes = async () => {
    setLoading(true);
    try {
      const data = await fetchExpertQuizLibrary(1, 100);
      // Sort by createdAt descending (newest first)
      const sorted = [...data.items].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setLibraryQuizzes(sorted);
    } catch (e) {
      console.error('Failed to load library quizzes:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = libraryQuizzes.filter((quiz) => {
    const term = searchTerm.toLowerCase();
    return (
      quiz.title?.toLowerCase().includes(term) ||
      quiz.topic?.toLowerCase().includes(term) ||
      quiz.difficulty?.toLowerCase().includes(term) ||
      quiz.expertName?.toLowerCase().includes(term)
    );
  });

  const filteredTotal = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / LIBRARY_PAGE_SIZE));

  useEffect(() => {
    setPageIndex(1);
  }, [searchTerm]);

  useEffect(() => {
    setPageIndex((prev) => {
      if (prev > totalPages) return Math.max(1, totalPages);
      return prev;
    });
  }, [totalPages]);

  const pagedItems = useMemo(() => {
    const start = (pageIndex - 1) * LIBRARY_PAGE_SIZE;
    return filtered.slice(start, start + LIBRARY_PAGE_SIZE);
  }, [filtered, pageIndex]);

  return (
    <div className="rounded-3xl border border-border/40 bg-card shadow-sm overflow-x-auto">
      <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 font-['Manrope',sans-serif] text-lg font-bold text-card-foreground">
          <Library className="h-5 w-5 text-primary" />
          Quiz Library
        </h3>
        <span className="text-sm font-medium text-muted-foreground">
          {libraryQuizzes.length} {libraryQuizzes.length === 1 ? 'quiz' : 'quizzes'} available
        </span>
      </div>

      <div className="border-b border-border px-6 py-3">
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, topic, difficulty, or expert..."
            className="h-10 w-full rounded-full border border-border bg-muted pl-4 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Library className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No quizzes found in library.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Quiz Title</th>
                  <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Topic</th>
                  <th className="px-2 py-4 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Difficulty</th>
                  <th className="px-2 py-4 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Questions</th>
                  <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Created By</th>
                  <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedItems.map((quiz) => (
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
                    <span className="text-sm font-bold text-card-foreground">{quiz.difficulty || '—'}</span>
                  </td>
                  <td className="px-2 py-4 text-center">
                    <span className="text-sm font-bold text-card-foreground">{quiz.questionCount}</span>
                  </td>
                  <td className="px-3 py-4">
                    <span className="text-sm text-muted-foreground">{quiz.expertName || 'Unknown'}</span>
                  </td>
                  <td className="px-3 py-4">
                    <span className="text-xs text-muted-foreground">{formatCreatedAt(quiz.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(pageIndex - 1) * LIBRARY_PAGE_SIZE + 1} to {Math.min(pageIndex * LIBRARY_PAGE_SIZE, filteredTotal)} of {filteredTotal} quizzes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                  disabled={pageIndex === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {pageIndex} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
                  disabled={pageIndex === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
