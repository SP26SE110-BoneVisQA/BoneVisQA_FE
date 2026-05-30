'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Loader2,
  MessageSquare,
  ZoomIn,
  Contrast,
  Pencil,
  Download,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Plus,
  Bell,
  Settings,
  BarChart3,
  Trash2,
  CheckSquare,
  Square,

} from 'lucide-react';
import { escalateToExpert, TRIAGE_ALREADY_ESCALATED } from '@/lib/api/lecturer-triage';
import { useLecturerPortalClasses } from '@/features/lecturer/queries/use-lecturer-quizzes';
import {
  useEscalateStudentQuestion,
  useLecturerStudentQuestions,
} from '@/features/lecturer/queries/use-lecturer-student-questions';
import type { LectStudentQuestionDto } from '@/lib/api/types';
import { appToast } from '@/lib/api/errors/app-toast';

const XRAY_PLACEHOLDER =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCINRzGp6z40Z2fsIZBJEM-zldyzpS3z_ih-Bfgh4mig52ts5MniL-9e43XYgucFN-WgwCWVHHmb6ZmiKWBe1o5U38a_alK5WfGZVT6MDhkHtaegScow4-aHvPzDfZMToJd55FiQox63njJi0VcktL5yJKoYeuQo47pBabw2NzpMgmK7qNcyKcxZbFP9puiQVdiuUDTOokGV-Hy573lajieFijGkk9MGyb0Mcz6zVto6MmqVxXgStDewXjMh4rzuqAcWxG1RyRzYiY';

type QuestionsSourceMode = 'legacy' | 'all' | 'visual-qa' | 'case-qa';

interface StudentQuestion {
  id: string;
  /** Answer row id for POST/PUT escalation when provided by API */
  answerId?: string | null;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  studentCode: string | null;
  /** `null` = personal upload session (no catalog case). */
  caseId: string | null;
  caseTitle: string;
  questionText: string;
  askedAt: string;
  status: 'pending' | 'answered' | 'escalated';
  thumbnailUrl?: string;
  studyImageUrl?: string | null;
  /** Set when API is called with explicit `source` (not legacy). */
  questionSource?: 'CaseQA' | 'VisualQA' | null;
}

interface QuestionCardProps {
  question: StudentQuestion;
  isActive: boolean;
  isSelected: boolean;
  /** When true, show bulk-selection checkbox (multi-delete). */
  selectMode: boolean;
  onSelect: (id: string) => void;
  onClick: () => void;
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function sourceBadgeLabel(source: StudentQuestion['questionSource']): string | null {
  if (source === 'VisualQA') return 'Visual QA';
  if (source === 'CaseQA') return 'Case QA';
  return null;
}

function QuestionCard({
  question,
  isActive,
  isSelected,
  selectMode,
  onSelect,
  onClick,
}: QuestionCardProps) {
  const badgeClass = isActive
    ? 'border-l-4 border-primary bg-surface-container-lowest'
    : 'bg-surface-container-low hover:bg-surface-container transition-all';
  const sourceLabel = sourceBadgeLabel(question.questionSource);
  return (
    <div
      onClick={onClick}
      className={`group rounded-xl p-5 cursor-pointer ${badgeClass}`}
      role="button"
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectMode ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(question.id);
              }}
              className="h-4 w-4 shrink-0 cursor-pointer rounded border-muted-foreground/30 text-primary focus:ring-primary"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
          <span
            className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {question.caseId != null && question.caseId.trim() !== ''
              ? `CASE #${question.caseId.slice(0, 8).toUpperCase().replace(/-/g, '')}`
              : 'PERSONAL UPLOAD'}
          </span>
          {sourceLabel ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                sourceLabel === 'Visual QA'
                  ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                  : 'bg-violet-500/15 text-violet-800 dark:text-violet-200'
              }`}
            >
              {sourceLabel}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(question.askedAt)}</span>
      </div>
      <h4 className="font-bold text-foreground text-sm mb-1 line-clamp-2">{question.questionText}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">{question.caseTitle}</p>
      <div className="mt-4 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-secondary/15 flex items-center justify-center text-[10px] font-bold text-secondary">
          {initials(question.studentName)}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {question.studentName || 'Unknown'} • {question.studentEmail ? question.studentEmail.split('@')[0] : '—'}
        </span>
      </div>
    </div>
  );
}

export function LecturerStudentQuestionsPage() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<StudentQuestion | null>(null);
  /** `legacy` = no `source` query (Case QA only, BE). Other modes send explicit `source`. */
  const [questionsSourceMode, setQuestionsSourceMode] = useState<QuestionsSourceMode>('legacy');
  const [escalateText, setEscalateText] = useState('');
  const [highPriority, setHighPriority] = useState(false);
  const [notifyHead, setNotifyHead] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [expertSubmitting, setExpertSubmitting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((q) => q.id)));
    }
  };

  const deleteSelected = () => {
    setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    if (selectedQuestion && selectedIds.has(selectedQuestion.id)) {
      setSelectedQuestion(null);
    }
  };

  const classesQuery = useLecturerPortalClasses();
  const sourceParam =
    questionsSourceMode === 'legacy'
      ? undefined
      : (questionsSourceMode as 'all' | 'visual-qa' | 'case-qa');
  const questionsQuery = useLecturerStudentQuestions(selectedClass, sourceParam);
  const escalateMutation = useEscalateStudentQuestion();

  useEffect(() => {
    if (classesQuery.data?.length && !selectedClass) {
      setSelectedClass(classesQuery.data[0].id);
    }
  }, [classesQuery.data, selectedClass]);

  useEffect(() => {
    if (!questionsQuery.data) return;
    const mapped: StudentQuestion[] = questionsQuery.data.map((item: LectStudentQuestionDto) => ({
      id: item.id,
      answerId: item.answerId?.trim() || null,
      studentId: item.studentId,
      studentName: item.studentName || 'Unknown',
      studentEmail: item.studentEmail || null,
      studentCode: null,
      caseId: item.caseId,
      caseTitle: item.caseTitle,
      questionText: item.questionText,
      askedAt: item.createdAt || new Date().toISOString(),
      status: item.escalatedById ? 'escalated' : item.answerText ? 'answered' : 'pending',
      thumbnailUrl: undefined,
      studyImageUrl: item.customImageUrl?.trim() || null,
      questionSource: item.questionSource ?? null,
    }));
    setQuestions(mapped);
    setSelectedQuestion((prev) => {
      if (mapped.length === 0) return null;
      if (prev && mapped.some((q) => q.id === prev.id)) return prev;
      return mapped[0];
    });
  }, [questionsQuery.data]);

  useEffect(() => {
    setLoading(classesQuery.isPending || questionsQuery.isFetching);
  }, [classesQuery.isPending, questionsQuery.isFetching]);

  const filtered = questions.filter(
    (q) =>
      q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.studentName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const pendingCount = questions.filter((q) => q.status === 'pending').length;

  const aiPreviewText =
    selectedQuestion?.status === 'answered'
      ? 'An answer has already been submitted for this inquiry.'
      : selectedQuestion
        ? `"Based on the clinical curator engine, the lucency at the distal phalanx suggests a volar-displaced tuft fracture. In lateral views, displacement is assessed relative to the longitudinal axis of the proximal fragment. Crush injuries typically result in comminuted tuft fractures with minimal dorsal displacement, whereas "mallet" mechanisms involve dorsal avulsion at the flexor digitorum profundus insertion. The mechanism of injury is the primary discriminator."`
        : '';

  const handleExpertEscalate = async () => {
    if (!selectedQuestion || !selectedClass) return;
    const routeId = selectedQuestion.answerId?.trim() || selectedQuestion.id;
    setExpertSubmitting(true);
    try {
      await escalateMutation.mutateAsync(routeId);
      appToast.success('Escalated successfully.');
      await questionsQuery.refetch();
    } catch (e) {
      if (e instanceof Error && e.message === TRIAGE_ALREADY_ESCALATED) {
        appToast.info('This case has already been escalated.');
      } else {
        appToast.error(e instanceof Error ? e.message : 'Escalation failed.');
      }
    } finally {
      setExpertSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-background/80 border-b border-border/60 backdrop-blur-md">
        <div className="flex items-center justify-between px-8 h-16 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-8">
            <h2 className="text-xl font-bold tracking-tighter text-primary font-headline">
              Inquiry Dashboard
            </h2>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/lecturer/dashboard" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/lecturer/classes" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Curricula
              </Link>
              <Link href="/lecturer/student-questions" className="text-sm font-semibold text-primary border-b-2 border-primary pb-1">
                Inquiries
              </Link>
              <Link href="/lecturer/settings" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search inquiries…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-64 rounded-full border-0 bg-muted pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
              />
            </div>
            <button className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden border-2 border-white shadow-sm bg-primary/10">
              <span className="text-xs font-bold text-primary">{initials(null)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Left: Question List */}
          <div className="col-span-12 space-y-4 lg:col-span-4">
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold text-foreground">Student Questions</h3>
                  {filtered.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectMode(!selectMode)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        selectMode
                          ? 'bg-primary text-white'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Multi Select
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {selectMode && selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={deleteSelected}
                      className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-4 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete ({selectedIds.size})
                    </button>
                  )}
                  {selectMode && (
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                    >
                      {selectedIds.size === filtered.length ? (
                        <CheckSquare className="h-3.5 w-3.5" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                      Select All
                    </button>
                  )}
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {pendingCount} Pending
                  </span>
                </div>
              </div>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                <span>List source</span>
                <select
                  value={questionsSourceMode}
                  onChange={(e) => setQuestionsSourceMode(e.target.value as QuestionsSourceMode)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="legacy">Case QA only (legacy, no source filter)</option>
                  <option value="all">All — Case QA + Visual QA (shows source badges)</option>
                  <option value="visual-qa">Visual QA only</option>
                  <option value="case-qa">Case QA only (explicit)</option>
                </select>
              </label>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filtered.length > 0 ? (
                filtered.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    isActive={selectedQuestion?.id === q.id}
                    isSelected={selectedIds.has(q.id)}
                    selectMode={selectMode}
                    onSelect={toggleSelect}
                    onClick={() => setSelectedQuestion(q)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? 'No inquiries match your search.' : 'No student questions yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Detail Panel */}
          <div className="col-span-12 space-y-6 lg:col-span-8">
            {selectedQuestion ? (
              <>
                {/* Main Detail Card */}
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Left: text */}
                    <div className="p-8 space-y-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-block rounded bg-secondary/15 px-2 py-1 text-[10px] font-black uppercase tracking-tighter text-secondary">
                            Active Inquiry
                          </span>
                          {sourceBadgeLabel(selectedQuestion.questionSource) ? (
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                selectedQuestion.questionSource === 'VisualQA'
                                  ? 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                                  : 'bg-violet-500/10 text-violet-800 dark:text-violet-200'
                              }`}
                            >
                              {sourceBadgeLabel(selectedQuestion.questionSource)}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground leading-tight">
                          {selectedQuestion.questionText}
                        </h2>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <span aria-hidden>person</span>
                            {selectedQuestion.studentName} (Student ID: {selectedQuestion.studentId.slice(0, 8)})
                          </span>
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <span aria-hidden>calendar_today</span>
                            {new Date(selectedQuestion.askedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Quote */}
                      <div className="rounded-xl border border-border/40 bg-muted/50 p-5">
                        <p className="text-sm leading-relaxed text-foreground italic">
                          &ldquo;{selectedQuestion.questionText}&rdquo;
                        </p>
                      </div>

                      {/* AI Preview */}
                      <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-primary/5 p-6">
                        <div className="absolute right-4 top-4 opacity-10">
                          <Sparkles className="h-10 w-10 text-primary" />
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">
                            AI-generated answer preview
                          </h4>
                        </div>
                        <p className="text-sm italic text-muted-foreground mb-4 leading-relaxed">
                          {aiPreviewText}
                        </p>
                        {selectedQuestion.status !== 'answered' && (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                          >
                            Apply this answer
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: X-ray viewer */}
                    <div className="relative flex min-h-[400px] flex-col items-center justify-center bg-slate-900 p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedQuestion.studyImageUrl?.trim() || XRAY_PLACEHOLDER}
                        alt="Medical X-ray"
                        className="max-h-full max-w-full rounded-lg shadow-2xl opacity-90 object-contain"
                      />
                      <div className="glass-panel absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 rounded-full border border-white/20 px-6 py-2.5 shadow-2xl">
                        <button type="button" className="text-white/70 hover:text-white transition-colors" aria-label="Zoom in">
                          <ZoomIn className="h-5 w-5" />
                        </button>
                        <button type="button" className="text-white/70 hover:text-white transition-colors" aria-label="Contrast">
                          <Contrast className="h-5 w-5" />
                        </button>
                        <button type="button" className="text-white/70 hover:text-white transition-colors" aria-label="Edit">
                          <Pencil className="h-5 w-5" />
                        </button>
                        <div className="h-4 w-px bg-white/20" />
                        <button type="button" className="text-white/70 hover:text-white transition-colors" aria-label="Download">
                          <Download className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Escalation Card */}
                <div className="rounded-2xl border border-border bg-muted/30 p-8 shadow-sm">
                  <div className="mb-6 flex items-start gap-4">
                    <div className="rounded-xl bg-amber-100 p-3">
                      <AlertTriangle className="h-5 w-5 text-amber-900" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Escalate to Clinical Expert</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Requires professional clinical review if the AI preview is insufficient.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Reason for escalation
                      </label>
                      <textarea
                        value={escalateText}
                        onChange={(e) => setEscalateText(e.target.value)}
                        placeholder="e.g., Ambiguous displacement vector, potential false negative in AI interpretation…"
                        rows={3}
                        className="w-full rounded-xl border-0 bg-card text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <label className="flex cursor-pointer items-center gap-2 group">
                          <input
                            type="checkbox"
                            checked={highPriority}
                            onChange={(e) => setHighPriority(e.target.checked)}
                            className="rounded border-muted-foreground/30 text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            Mark as High Priority
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 group">
                          <input
                            type="checkbox"
                            checked={notifyHead}
                            onChange={(e) => setNotifyHead(e.target.checked)}
                            className="rounded border-muted-foreground/30 text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            Notify Head of Radiology
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEscalateText('')}
                          className="rounded-full px-6 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          disabled={expertSubmitting}
                          onClick={() => void handleExpertEscalate()}
                          className="rounded-full bg-gradient-to-br from-primary to-primary/90 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
                        >
                          {expertSubmitting ? 'Submitting…' : 'Submit for Expert Review'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground/50" />
                <p className="text-lg font-semibold text-muted-foreground">Select a question to view details</p>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  Click on a student question in the list to see full inquiry details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        type="button"
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl transition-all hover:scale-110 active:scale-95"
        aria-label="New inquiry"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}