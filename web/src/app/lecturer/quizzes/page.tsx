'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuizWorkbenchListSkeleton } from '@/components/shared/DashboardSkeletons';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Sparkles,
  ArrowRight,
  List,
  ClipboardList,
  FilePen,
  ClipboardPen,
  TrendingUp,
  Copy,
  Check,
  Trash,
  BookOpen,
  User,
  UserCheck,
  Eye,
  X,
  Loader2,
  AlertCircle,
  Download,
  Target,
  BrainCircuit,
  FileText,
} from 'lucide-react';
import { deleteQuiz, removeQuizFromClass, getUnassignedLecturerQuizzes, getAssignedQuizzes, getLecturerQuizzes } from '@/lib/api/lecturer-quiz';
import { fetchLecturerDashboardStats } from '@/lib/api/lecturer-dashboard';
import type { LecturerDashboardStats } from '@/lib/api/types';
import { getStoredUserId } from '@/lib/getStoredUserId';
import { exportAllQuizResultsExcel } from '@/lib/api/lecturer';
import type { ClassQuizDto, AssignedQuizDto, QuizDto } from '@/lib/api/types';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { fetchLecturerClasses } from '@/lib/api/lecturer-classes';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { quizExtensionsApi } from '@/lib/api/quiz-extensions';

type QuizStatus = 'Active' | 'Draft' | 'Completed';
type TabType = 'my-quizzes' | 'assigned-quizzes';
type QuizModeType = 'all' | '1' | '2' | '3';

interface EnrichedQuiz {
  quizId: string;
  classId: string;
  quizName: string | null;
  className: string | null;
  topic: string | null;
  assignedAt: string | null;
  openTime: string | null;
  closeTime: string | null;
  questionCount?: number | null;
  isFromExpertLibrary: boolean;
  status: QuizStatus;
  topicLabel: string;
  formattedOpen: string;
  formattedClose: string;
  compactOpen: string;
  compactClose: string;
  isExpertQuiz: boolean;
  difficulty?: string | null;
  timeLimit?: number | null;
  passingScore?: number | null;
  creatorName?: string | null;
  creatorType?: string | null;
  quizMode: number;
}

interface EnrichedAssignedQuiz extends AssignedQuizDto {
  status: QuizStatus;
  topicLabel: string;
  formattedOpen: string;
  formattedClose: string;
  compactOpen: string;
  compactClose: string;
  compactAssigned: string;
  creatorName?: string | null;
  creatorType?: string | null;
  quizMode: number;
}

const PAGE_SIZE = 10;

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

function formatAssignedCompact(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
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

export default function QuizListPage() {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('my-quizzes');
  const [myQuizzes, setMyQuizzes] = useState<EnrichedQuiz[]>([]);
  const [assignedQuizzes, setAssignedQuizzes] = useState<EnrichedAssignedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedQuizMode, setSelectedQuizMode] = useState<QuizModeType>('all');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedQuiz | EnrichedAssignedQuiz | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(new Set());
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<Set<string> | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [engagementStats, setEngagementStats] = useState<LecturerDashboardStats | null>(null);

  const handleExportAllResults = async () => {
    if (activeTab !== 'assigned-quizzes') {
      toast.error('Export is only available for Assigned Quizzes tab.');
      return;
    }
    if (assignedQuizzes.length === 0) {
      toast.error('No quiz data to export.');
      return;
    }
    setExporting(true);
    try {
      await exportAllQuizResultsExcel();
      toast.success('All quiz results exported successfully!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const toggleSelect = (quizId: string) => {
    setSelectedQuizIds((prev) => {
      const next = new Set(prev);
      if (next.has(quizId)) next.delete(quizId);
      else next.add(quizId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteTarget || bulkDeleteTarget.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = [...bulkDeleteTarget];
      let successCount = 0;
      let failedCount = 0;

      if (activeTab === 'my-quizzes') {
        const results = await Promise.allSettled(ids.map((id) => deleteQuiz(id)));
        successCount = results.filter((r) => r.status === 'fulfilled').length;
        failedCount = results.length - successCount;
        await loadMyQuizzes();
      } else if (activeTab === 'assigned-quizzes') {
        const results = await Promise.allSettled(
          ids.map((id) => {
            const quiz = assignedQuizzes.find((q) => q.quizId === id);
            if (!quiz) return Promise.reject(new Error('Quiz not found'));
            return removeQuizFromClass(quiz.classId, quiz.quizId);
          })
        );
        successCount = results.filter((r) => r.status === 'fulfilled').length;
        failedCount = results.length - successCount;
        // Reload both tabs so unassigned quizzes appear back in "My Quizzes"
        await Promise.all([loadMyQuizzes(), loadAssignedQuizzes()]);
      }

      setBulkDeleteTarget(null);
      setSelectedQuizIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

      if (failedCount > 0) {
        toast.error(`Processed ${successCount}, ${failedCount} failed.`);
      } else {
        toast.success(`Successfully processed ${successCount} quiz(es).`);
      }
    } catch (error) {
      toast.error('Bulk action failed.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (activeTab === 'my-quizzes') {
        await deleteQuiz(deleteTarget.quizId);
        await loadMyQuizzes();
        toast.success('Quiz deleted permanently.');
      } else if (activeTab === 'assigned-quizzes') {
        const target = deleteTarget as EnrichedAssignedQuiz;
        await removeQuizFromClass(target.classId, target.quizId);
        // Reload both tabs so the quiz moves back to "My Quizzes"
        await Promise.all([loadMyQuizzes(), loadAssignedQuizzes()]);
        toast.success('Quiz unassigned from class.');
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (error as Error)?.message
        || 'Action failed.';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const loadMyQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const lecturerId = getStoredUserId();
      if (!lecturerId) {
        setError('Not logged in. Please log in again.');
        return;
      }
      
      // Load both all quizzes and assigned quizzes to filter out assigned ones for "My Quizzes"
      const [allQuizzesData, assignedData] = await Promise.all([
        getLecturerQuizzes(lecturerId),
        getAssignedQuizzes(lecturerId),
      ]);
      
      // Get set of quizIds that are already assigned
      const assignedQuizIds = new Set(assignedData.map((aq) => aq.quizId));
      
      // Filter to only unassigned quizzes for "My Quizzes"
      const unassignedQuizzes = allQuizzesData.filter((q) => !assignedQuizIds.has(q.quizId));
      
      const enriched: EnrichedQuiz[] = unassignedQuizzes.map((q) => {
        const now = new Date();
        const open = q.openTime ? new Date(q.openTime) : null;
        const close = q.closeTime ? new Date(q.closeTime) : null;
        let status: QuizStatus = 'Draft';
        if (close && now > close) status = 'Completed';
        else if (open && now < open) status = 'Draft';
        else if (!open && !close) status = 'Draft';
        else status = 'Active';
        const topicFromQuiz = (q.topic ?? '').trim();
        return {
          quizId: q.quizId,
          classId: q.classId || '',
          quizName: q.quizName || 'Untitled',
          className: q.className || null,
          topic: q.topic || null,
          assignedAt: q.assignedAt,
          openTime: q.openTime || null,
          closeTime: q.closeTime || null,
          questionCount: q.questionCount,
          isFromExpertLibrary: q.isFromExpertLibrary ?? false,
          status,
          topicLabel: topicFromQuiz || '—',
          formattedOpen: formatQuizInstant(q.openTime),
          formattedClose: formatQuizInstant(q.closeTime),
          compactOpen: formatQuizCompact(q.openTime),
          compactClose: formatQuizCompact(q.closeTime),
          compactAssigned: '—',
          isExpertQuiz: q.isFromExpertLibrary ?? false,
          difficulty: null,
          timeLimit: q.timeLimit ?? null,
          passingScore: q.passingScore ?? null,
          creatorName: q.creatorName ?? null,
          creatorType: q.creatorType ?? null,
          quizMode: q.quizMode ?? 1,
        };
      });
      setMyQuizzes(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const lecturerId = getStoredUserId();
      if (!lecturerId) {
        setError('Not logged in. Please log in again.');
        return;
      }
      const data = await getAssignedQuizzes(lecturerId);
      const enriched: EnrichedAssignedQuiz[] = data.map((q) => {
        const now = new Date();
        const open = q.openTime ? new Date(q.openTime) : null;
        const close = q.closeTime ? new Date(q.closeTime) : null;
        let status: QuizStatus = 'Draft';
        if (close && now > close) status = 'Completed';
        else if (open && now < open) status = 'Draft';
        else if (!open && !close) status = 'Draft';
        else status = 'Active';
        const topicFromQuiz = (q.topic ?? '').trim();
        return {
          ...q,
          status,
          topicLabel: topicFromQuiz || '—',
          formattedOpen: formatQuizInstant(q.openTime),
          formattedClose: formatQuizInstant(q.closeTime),
          compactOpen: formatQuizCompact(q.openTime),
          compactClose: formatQuizCompact(q.closeTime),
          compactAssigned: formatAssignedCompact(q.assignedAt ?? null),
          creatorName: q.creatorName ?? null,
          creatorType: q.creatorType ?? null,
          quizMode: q.quizMode ?? 1,
        };
      });
      setAssignedQuizzes(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assigned quizzes');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadMyQuizzes();
    loadEngagementStats();
  }, []);

  const loadEngagementStats = async () => {
    try {
      const stats = await fetchLecturerDashboardStats();
      setEngagementStats(stats);
    } catch (err) {
      console.error('Failed to load engagement stats:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'my-quizzes') {
      loadMyQuizzes();
    } else if (activeTab === 'assigned-quizzes') {
      loadAssignedQuizzes();
    }
  }, [activeTab]);

  const uniqueClasses = Array.from(new Set(assignedQuizzes.map((q) => q.className).filter(Boolean))) as string[];

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    // Clear filters and selections when switching tabs
    setSearchTerm('');
    setSelectedClass('all');
    setSelectedQuizMode('all');
    setSelectedQuizIds(new Set());
    // Load data for the new tab
    if (tab === 'my-quizzes') {
      loadMyQuizzes();
    } else if (tab === 'assigned-quizzes') {
      loadAssignedQuizzes();
    }
    // expert-library loads within its own component
  };

  const currentQuizzes = activeTab === 'my-quizzes' ? myQuizzes : assignedQuizzes;

  const filtered = currentQuizzes.filter((quiz) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (quiz.quizName?.toLowerCase().includes(term) ?? false) ||
      (quiz.className?.toLowerCase().includes(term) ?? false) ||
      (quiz.topic?.toLowerCase().includes(term) ?? false) ||
      (quiz.topicLabel?.toLowerCase().includes(term) ?? false);
    const matchesClass = selectedClass === 'all' || quiz.className === selectedClass;
    const matchesQuizMode = selectedQuizMode === 'all' || String(quiz.quizMode) === selectedQuizMode;
    return matchesSearch && matchesClass && matchesQuizMode;
  });

  const totalPages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const paged = totalPages === 0 ? [] : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageItems = buildPageList(totalPages, currentPage);

  const allPageSelected = paged.length > 0 && paged.every((q) => selectedQuizIds.has(q.quizId));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedQuizIds((prev) => {
        const next = new Set(prev);
        paged.forEach((q) => next.delete(q.quizId));
        return next;
      });
    } else {
      setSelectedQuizIds((prev) => {
        const next = new Set(prev);
        paged.forEach((q) => next.add(q.quizId));
        return next;
      });
    }
  };

  const totalQuizzes = currentQuizzes.length;
  const activeModules = currentQuizzes.filter((q) => q.status === 'Active').length;
  const pendingDrafts = currentQuizzes.filter((q) => q.status === 'Draft').length;

  const listStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const listEnd = filtered.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, filtered.length);

  if (loading) {
    return <QuizWorkbenchListSkeleton />;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-primary">Academic Management</p>
          <h1 className="font-['Manrope',sans-serif] text-[2.75rem] font-extrabold leading-tight tracking-tight text-card-foreground">Quiz Workbench</h1>
          <p className="mt-2 max-w-xl text-lg text-muted-foreground">Manage and assign quizzes from the Expert library to classes.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => handleTabChange('my-quizzes')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'my-quizzes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <ClipboardList className="h-4 w-4" />
          My Quizzes
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('assigned-quizzes')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'assigned-quizzes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <ClipboardPen className="h-4 w-4" />
          Assigned Quizzes
        </button>
      </div>

      <div className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">Total {activeTab === 'my-quizzes' ? 'My Quizzes' : 'Assigned'}</p>
              <p className="mt-1 text-3xl font-black text-card-foreground">{totalQuizzes}</p>
            </div>
            <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                  <CheckCircle className="h-5 w-5 text-secondary" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <p className="mt-1 text-3xl font-black text-card-foreground">{activeModules}</p>
            </div>
            <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                  <FilePen className="h-5 w-5 text-warning" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">Drafts</p>
              <p className="mt-1 text-3xl font-black text-card-foreground">{pendingDrafts}</p>
            </div>
            <div className="rounded-3xl border border-border/10 bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/20">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">Avg. Score</p>
              <p className="mt-1 text-3xl font-black text-card-foreground">—</p>
            </div>
          </div>

          {/* Quiz Table */}
          <div className="rounded-3xl border border-border/40 bg-card shadow-sm overflow-x-auto">
            <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 font-['Manrope',sans-serif] text-lg font-bold text-card-foreground">
                <ClipboardList className="h-5 w-5 text-primary" />
                {activeTab === 'my-quizzes' ? 'My Quizzes' : 'Assigned Quizzes'}
              </h3>
              {activeTab === 'assigned-quizzes' && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportAllResults}
                    disabled={exporting || assignedQuizzes.length === 0}
                    className="flex items-center gap-2 rounded-full border border-success/30 bg-success/5 px-4 py-2 text-xs font-bold text-success transition-colors hover:bg-success/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export All Results
                  </button>
                  <select
                    value={selectedClass}
                    onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}
                    className="appearance-none rounded-full border border-border bg-white px-4 py-2 pr-8 text-xs font-bold text-muted-foreground focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="all">All Classes</option>
                    {uniqueClasses.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
                  </select>
                </div>
              )}
            </div>

            {selectedQuizIds.size > 0 && (
              <div className="flex items-center gap-3 border-b border-border bg-primary/5 px-6 py-3">
                <span className="text-sm font-semibold text-primary">{selectedQuizIds.size} selected</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setBulkDeleteTarget(new Set(selectedQuizIds))}
                    className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <Trash className="h-4 w-4" />
                    {activeTab === 'my-quizzes' ? 'Delete selected' : 'Unassign selected'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuizIds(new Set())}
                    className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}

            <div className="border-b border-border px-6 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-md">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    placeholder="Search quizzes or topics…"
                    className="h-10 w-full rounded-full border border-border bg-muted pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedQuizMode}
                    onChange={(e) => { setSelectedQuizMode(e.target.value as QuizModeType); setPage(1); }}
                    className="appearance-none rounded-full border border-border bg-white px-4 py-2 pr-8 text-xs font-bold text-muted-foreground focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="all">All Modes</option>
                    <option value="1">Exam</option>
                    <option value="2">Practice</option>
                    <option value="3">Adaptive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-3 sm:px-3 sm:py-4">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="h-4 w-4 cursor-pointer accent-primary" />
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-4 sm:py-4 sm:text-xs">Quiz Title</th>
                    {activeTab === 'assigned-quizzes' && <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-4 sm:text-xs">Class</th>}
                    <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-4 sm:text-xs">Topic</th>
                    <th className="px-1 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-2 sm:py-4 sm:text-xs">Q#</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-4 sm:text-xs">Mode</th>
                    <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-4 sm:text-xs">Status</th>
                    <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-4 sm:text-xs">Opens / Closes</th>
                    <th className="px-2 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-4 sm:text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'assigned-quizzes' ? 9 : 8} className="px-4 py-20 text-center sm:px-8">
                        <p className="text-muted-foreground">No quizzes found.</p>
                      </td>
                    </tr>
                  ) : (
                    paged.map((quiz, idx) => {
                      const quizId = quiz.quizId;
                      const isExpert = activeTab === 'my-quizzes' ? (quiz as EnrichedQuiz).isExpertQuiz : (quiz as EnrichedAssignedQuiz).isFromExpertLibrary;
                      return (
                        <tr key={`${quizId}-${idx}`} className="group cursor-pointer hover:bg-muted/40 transition-colors">
                          <td className="px-2 py-4 sm:px-3 sm:py-5">
                            <input type="checkbox" checked={selectedQuizIds.has(quizId)} onChange={() => toggleSelect(quizId)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 cursor-pointer accent-primary" />
                          </td>
                          <td className="px-3 py-4 sm:px-4 sm:py-5">
                            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleCopyId(quizId); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary sm:h-9 sm:w-9" title="Copy Quiz ID">
                                {copiedId === quizId ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                              </button>
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted sm:h-9 sm:w-9">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 break-words text-sm font-bold leading-snug text-card-foreground">{quiz.quizName || 'Untitled quiz'}</p>
                                {(quiz as EnrichedQuiz).creatorName && (
                                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase leading-tight tracking-wide sm:px-2.5 sm:py-1 sm:text-[10px] ${
                                    (quiz as EnrichedQuiz).creatorType === 'Expert' 
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' 
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                  }`}>
                                    {(quiz as EnrichedQuiz).creatorType === 'Expert' ? 'Expert: ' : ''}{(quiz as EnrichedQuiz).creatorName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          {activeTab === 'assigned-quizzes' && (
                            <td className="px-2 py-4 align-top sm:px-3 sm:py-5">
                              <span className="inline-block max-w-full break-words rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase leading-tight tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 sm:px-2.5 sm:py-1 sm:text-[10px]">
                                {(quiz as EnrichedAssignedQuiz).className || '—'}
                              </span>
                            </td>
                          )}
                          <td className="px-2 py-4 align-top sm:px-3 sm:py-5">
                            <span className="inline-block max-w-full break-words rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:px-2.5 sm:py-1 sm:text-[10px]">{quiz.topicLabel}</span>
                          </td>
                          <td className="px-1 py-4 text-center align-top sm:py-5">
                            <span className="text-sm font-bold text-card-foreground">{quiz.questionCount || '—'}</span>
                          </td>
                          <td className="px-2 py-4 text-center align-top sm:px-3 sm:py-5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold sm:px-2.5 sm:py-1 sm:text-[10px] ${
                              quiz.quizMode === 1 
                                ? 'bg-primary/15 text-primary' 
                                : quiz.quizMode === 2 
                                ? 'bg-success/15 text-success' 
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            }`}>
                              {quiz.quizMode === 1 ? (
                                <>
                                  <FileText className="h-3 w-3" />
                                  Exam
                                </>
                              ) : quiz.quizMode === 2 ? (
                                <>
                                  <Target className="h-3 w-3" />
                                  Practice
                                </>
                              ) : (
                                <>
                                  <BrainCircuit className="h-3 w-3" />
                                  Adaptive
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-2 py-4 align-top sm:px-3 sm:py-5">
                            <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs ${quiz.status === 'Active' ? 'bg-secondary/15 text-secondary' : quiz.status === 'Completed' ? 'bg-muted text-muted-foreground' : 'bg-warning/10 text-warning'}`}>
                              <span className={`h-1 w-1 shrink-0 rounded-full sm:h-1.5 sm:w-1.5 ${quiz.status === 'Active' ? 'bg-secondary' : quiz.status === 'Completed' ? 'bg-muted-foreground' : 'bg-warning'}`} />
                              {quiz.status}
                            </span>
                          </td>
                          <td className="min-w-0 px-2 py-4 align-top sm:px-3 sm:py-5">
                            <div className="min-w-0 space-y-2 text-[11px] leading-snug">
                              <div><span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Open</span><span className="block break-words font-semibold text-card-foreground">{quiz.compactOpen}</span></div>
                              <div><span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Close</span><span className="block break-words font-semibold text-card-foreground">{quiz.compactClose}</span></div>
                            </div>
                          </td>
                          <td className="px-2 py-4 align-top sm:px-3 sm:py-5">
                            <div className="flex justify-end gap-1.5 sm:gap-2">
                              {activeTab === 'assigned-quizzes' && (
                                <>
                                  <button type="button" onClick={() => router.push(`/lecturer/quizzes/${quizId}/results`)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-success/10 hover:text-success" title="View Results">
                                    <BarChart3 className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => router.push(`/lecturer/quizzes/${quizId}`)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" title="Edit Quiz">
                                    <Edit className="h-4 w-4" />

                                  </button>
                                  <button type="button" onClick={() => setDeleteTarget(quiz)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Unassign Quiz">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {activeTab === 'my-quizzes' && (
                                <>
                                  <button type="button" onClick={() => router.push(`/lecturer/quizzes/${quizId}`)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" title="Edit">
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => setDeleteTarget(quiz)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Delete">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/30 bg-white text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {pageItems.map((item, idx) =>
                    item === 'ellipsis' ? <span key={`e-${idx}`} className="px-1 text-muted-foreground">…</span> :
                    <button key={item} type="button" onClick={() => setPage(item)} className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors ${item === currentPage ? 'bg-primary text-white' : 'border border-border/30 bg-white hover:bg-muted text-muted-foreground'}`}>{item}</button>
                  )}
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/30 bg-white text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Contextual Insight Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative col-span-2 flex flex-col justify-between overflow-hidden rounded-[2rem] bg-[#1a2332] p-10">
              <div className="relative z-10">
                <h4 className="font-['Manrope',sans-serif] text-2xl font-bold text-white">Quiz Engagement Insights</h4>
                <p className="mt-4 max-w-md text-sm text-slate-400">
                  {engagementStats?.participationTrendPercent != null && engagementStats.participationTrendPercent > 0
                    ? `Student participation is up ${engagementStats.participationTrendPercent}% this semester.`
                    : engagementStats?.participationTrendPercent != null && engagementStats.participationTrendPercent < 0
                    ? `Student participation is down ${Math.abs(engagementStats.participationTrendPercent)}% this semester.`
                    : 'Student participation trend over the past semester.'}
                </p>
                <div className="mt-8 flex items-center gap-8">
                  <div><p className="font-black text-3xl text-primary-fixed-dim">{engagementStats?.totalQuizAttempts?.toLocaleString() ?? '—'}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">Total Attempts</p></div>
                  <div className="h-10 w-px bg-white/10" />
                  <div><p className="font-black text-3xl text-secondary-fixed">{engagementStats?.averageTimeMinutes != null ? `${engagementStats.averageTimeMinutes}m` : '—'}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">Avg. Time</p></div>
                </div>
              </div>
              <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20"><div className="h-full w-full bg-gradient-to-l from-primary/30 to-transparent" /></div>
            </div>
            <div className="flex flex-col justify-center rounded-[2rem] border border-primary/10 bg-primary/5 p-8">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20"><Sparkles className="h-6 w-6 text-white" /></div>
              <h5 className="font-['Manrope',sans-serif] text-xl font-bold text-card-foreground">Generate with AI</h5>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Instantly create a new quiz by uploading a medical case study or diagnostic images.</p>
              <button type="button" onClick={() => router.push('/lecturer/quizzes/create')} className="mt-6 flex items-center gap-2 text-sm font-bold text-primary transition-all hover:gap-3">
                Launch AI Assistant <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-['Manrope',sans-serif] text-lg font-bold text-card-foreground">Knowledge Integrity Guarantee</h4>
          <p className="mt-1 text-sm text-muted-foreground">All quizzes are validated against the current Board of Radiology standards (v2.0-2024).</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Students Evaluated</p><p className="text-2xl font-black text-primary">—</p></div>
          <div className="h-10 w-px bg-border" />
          <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Avg. Accuracy Rate</p><p className="text-2xl font-black text-secondary">—</p></div>
        </div>
      </div>

      {/* FAB */}
      <button type="button" onClick={() => router.push('/lecturer/quizzes/create')} className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-2xl transition-all hover:scale-110 active:scale-95 z-50" aria-label="Create new quiz">
        <Plus className="h-6 w-6" />
      </button>

      {/* Delete confirmation dialog */}
      <Modal
        open={deleteTarget !== null}
        title={activeTab === 'my-quizzes' ? 'Delete Quiz' : 'Unassign Quiz'}
        onClose={() => !deleting && setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">Cancel</button>
            <button type="button" disabled={deleting} onClick={handleDelete} className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50">
              {deleting ? 'Processing…' : activeTab === 'my-quizzes' ? 'Delete' : 'Unassign'}
            </button>
          </div>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-muted-foreground">
            {activeTab === 'my-quizzes'
              ? <>Are you sure you want to delete <strong className="text-foreground">{deleteTarget.quizName ?? 'this quiz'}</strong>? This will permanently delete all questions and attempts. This action cannot be undone.</>
              : <>Are you sure you want to unassign <strong className="text-foreground">{deleteTarget.quizName ?? 'this quiz'}</strong> from the class? The quiz will remain in your library.</>
            }
          </p>
        )}
      </Modal>

      {/* Bulk delete confirmation dialog */}
      <Modal
        open={bulkDeleteTarget !== null}
        title={activeTab === 'my-quizzes' ? 'Delete Multiple Quizzes' : 'Unassign Multiple Quizzes'}
        onClose={() => !bulkDeleting && setBulkDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" disabled={bulkDeleting} onClick={() => setBulkDeleteTarget(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">Cancel</button>
            <button type="button" disabled={bulkDeleting} onClick={handleBulkDelete} className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50">
              {bulkDeleting ? 'Processing…' : activeTab === 'my-quizzes' ? `Delete ${bulkDeleteTarget?.size ?? 0} Quizzes` : `Unassign ${bulkDeleteTarget?.size ?? 0} Quizzes`}
            </button>
          </div>
        }
      >
        {bulkDeleteTarget && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are about to {activeTab === 'my-quizzes' ? 'delete' : 'unassign'} <strong className="text-foreground">{bulkDeleteTarget.size} quiz</strong>(s).
            </p>
            {activeTab === 'my-quizzes' && (
              <p className="text-xs text-destructive font-medium">This action will permanently delete all questions and attempt history. Cannot be undone.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
