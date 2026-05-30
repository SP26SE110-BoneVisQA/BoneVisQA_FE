'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Loader2,
  Megaphone,
  Search,
  Stethoscope,
  Users,
} from 'lucide-react';
import { ClassDetailCover } from '@/components/student/ClassDetailVisuals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  fetchStudentClassDetail,
  fetchStudentClasses,
  type StudentClassDetail,
  type StudentClassItem,
} from '@/lib/api/student';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { toast } from 'sonner';

type ClassTab = 'overview' | 'roster' | 'cases' | 'quizzes' | 'announcements';

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface StudentClassWorkbenchProps {
  classId: string;
}

function StudentClassWorkbench({ classId }: StudentClassWorkbenchProps) {
  const [detail, setDetail] = useState<StudentClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ClassTab>('overview');
  const [caseSearch, setCaseSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchStudentClassDetail(classId);
      setDetail(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load class details.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const classmates = useMemo(() => detail?.students ?? [], [detail]);
  const lecturerName = detail?.lecturerName?.trim() || 'Instructor';
  const expertName = detail?.expertName?.trim();
  const expertEmail = detail?.expertEmail?.trim();
  const expertAvatarSrc = detail?.expertAvatarUrl
    ? resolveApiAssetUrl(detail.expertAvatarUrl)
    : '';

  const filteredCases = useMemo(() => {
    if (!detail?.assignedCases) return [];
    if (!caseSearch.trim()) return detail.assignedCases;
    const q = caseSearch.toLowerCase();
    return detail.assignedCases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.dueDate && c.dueDate.toLowerCase().includes(q))
    );
  }, [detail?.assignedCases, caseSearch]);

  const tabs: { key: ClassTab; label: string; icon: typeof Users; count: number }[] = [
    { key: 'overview', label: 'Overview', icon: GraduationCap, count: 1 },
    { key: 'roster', label: 'Classmates', icon: Users, count: classmates.length },
    { key: 'cases', label: 'Cases', icon: BookOpen, count: detail?.assignedCases?.length ?? 0 },
    { key: 'quizzes', label: 'Quizzes', icon: ClipboardList, count: detail?.quizzes.length ?? 0 },
    { key: 'announcements', label: 'Announcements', icon: Megaphone, count: detail?.announcements.length ?? 0 },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading class…
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        icon={<GraduationCap className="h-7 w-7" />}
        title="Class not found"
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="overflow-hidden rounded-3xl border border-border shadow-md">
        <div className="relative">
          <ClassDetailCover variant="hero" className="min-h-[180px] sm:min-h-[220px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-6 py-6 sm:px-10 sm:py-8">
            <span className="inline-block rounded-full border border-cyan-200/30 bg-cyan-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-100">
              {detail.semester || 'Class'}
            </span>
            <h1 className="mt-3 font-['Manrope',sans-serif] text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {detail.className}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Instructor: <span className="font-semibold text-white">{lecturerName}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Classmates</p>
              <p className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
                {classmates.length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <BookOpen className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assigned Cases</p>
              <p className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
                {detail.assignedCases?.length ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <ClipboardList className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Quizzes</p>
              <p className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
                {detail.quizzes.length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Megaphone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Announcements</p>
              <p className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
                {detail.announcements.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="rounded-2xl border border-border bg-card p-1.5 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {label} ({count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="p-6">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Instructor & Expert Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-card-foreground">Class Information</h3>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {initials(lecturerName)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lecturer</p>
                    <p className="font-semibold text-card-foreground">{lecturerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
                  {expertAvatarSrc ? (
                    <img
                      src={expertAvatarSrc}
                      alt=""
                      className="h-12 w-12 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expert</p>
                    <p className="font-semibold text-card-foreground">{expertName || 'Not assigned'}</p>
                    {expertEmail && (
                      <p className="text-xs text-muted-foreground">{expertEmail}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-card-foreground">Quick Actions</h3>
                <div className="grid gap-3">
                  <Link
                    href="/student/catalog"
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-muted/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-card-foreground">Browse Case Catalog</p>
                      <p className="text-xs text-muted-foreground">Explore available cases for self-study</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                  <Link
                    href="/student/quizzes"
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-muted/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                      <ClipboardList className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-card-foreground">My Quizzes</p>
                      <p className="text-xs text-muted-foreground">View assigned quizzes and history</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Activity Preview */}
            <div className="mt-8">
              <h3 className="mb-4 text-lg font-bold text-card-foreground">Assigned Cases</h3>
              {detail.assignedCases && detail.assignedCases.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {detail.assignedCases.slice(0, 4).map((c) => {
                    const isOverdue = c.dueDate && new Date(c.dueDate) < new Date();
                    return (
                      <Link
                        key={c.caseId}
                        href={`/student/cases/${c.caseId}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 transition-all hover:border-primary/30 hover:bg-muted/30"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-card-foreground">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.dueDate ? `Due ${formatDate(c.dueDate)}` : 'No due date'}
                            {isOverdue && ' · Overdue'}
                          </p>
                        </div>
                        {c.isMandatory && (
                          <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            Required
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cases assigned yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ROSTER TAB */}
        {tab === 'roster' && (
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-card-foreground">Class Roster</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {classmates.length} student{classmates.length !== 1 ? 's' : ''} enrolled in this class.
                </p>
              </div>
            </div>
            {classmates.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No classmates yet"
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Student
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Student ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {classmates.map((s) => (
                      <tr key={s.studentId} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-bold text-primary">
                              {initials(s.studentName || '?')}
                            </div>
                            <span className="font-medium text-card-foreground">
                              {s.studentName || 'Unknown student'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {s.studentCode?.trim() || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CASES TAB */}
        {tab === 'cases' && (
          <div className="p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-card-foreground">Assigned Cases</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cases assigned to you by your lecturer.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    placeholder="Search cases..."
                    className="rounded-xl pl-9"
                  />
                </div>
                <Link href="/student/catalog">
                  <Button variant="outline" size="sm">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Catalog
                  </Button>
                </Link>
              </div>
            </div>
            {filteredCases.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-6 w-6" />}
                title="No assigned cases"
                action={
                  <Link href="/student/catalog">
                    <Button variant="outline">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Browse Case Catalog
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredCases.map((c) => {
                  const isOverdue = c.dueDate && new Date(c.dueDate) < new Date();
                  return (
                    <div
                      key={c.caseId}
                      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-card-foreground">{c.title}</h4>
                            {c.isMandatory && (
                              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                Required
                              </span>
                            )}
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {c.dueDate && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due: {formatWhen(c.dueDate)}
                              </span>
                            )}
                            {!c.dueDate && (
                              <span>No due date</span>
                            )}
                          </div>
                        </div>
                        <Link href={`/student/cases/${c.caseId}`}>
                          <Button size="sm">
                            Open Case
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* QUIZZES TAB */}
        {tab === 'quizzes' && (
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-card-foreground">Class Quizzes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Practice quizzes assigned to this class.
                </p>
              </div>
            </div>
            {detail.quizzes.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" />}
                title="No quizzes assigned"
              />
            ) : (
              <div className="space-y-3">
                {detail.quizzes.map((q) => {
                  const isOpen = q.openTime && new Date(q.openTime) <= new Date();
                  const isClosed = q.closeTime && new Date(q.closeTime) < new Date();
                  const isActive = isOpen && !isClosed;
                  return (
                    <div
                      key={q.quizId}
                      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-card-foreground">{q.title}</h4>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Open
                              </span>
                            )}
                            {isClosed && !q.isCompleted && (
                              <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                Closed
                              </span>
                            )}
                            {q.isCompleted && (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                Completed
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              {q.totalQuestions} questions
                            </span>
                            {q.timeLimit != null && (
                              <span>{q.timeLimit} min</span>
                            )}
                            {q.passingScore != null && (
                              <span>Pass: {q.passingScore}%</span>
                            )}
                            {q.openTime && (
                              <span>Opens: {formatDate(q.openTime)}</span>
                            )}
                            {q.closeTime && (
                              <span>Closes: {formatDate(q.closeTime)}</span>
                            )}
                          </div>
                          {q.score != null && (
                            <div className="mt-2">
                              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                                q.score >= (q.passingScore ?? 70) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                Score: {Math.round(q.score)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <Link href={`/student/quiz/${q.quizId}`}>
                          <Button
                            size="sm"
                            variant={q.isCompleted ? 'outline' : 'default'}
                          >
                            {q.isCompleted ? 'Review' : 'Start Quiz'}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {tab === 'announcements' && (
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-card-foreground">Announcements</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Updates from your lecturer.
                </p>
              </div>
            </div>
            {detail.announcements.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="h-6 w-6" />}
                title="No announcements"
              />
            ) : (
              <div className="space-y-4">
                {detail.announcements.map((a) => (
                  <div
                    key={a.id}
                    className="overflow-hidden rounded-xl border border-border bg-muted/20 p-5"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatWhen(a.createdAt)}
                    </div>
                    <h4 className="mt-2 font-semibold text-card-foreground">{a.title}</h4>
                    {a.relatedAssignment?.assignmentTitle && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                          <ClipboardList className="h-3.5 w-3.5" />
                          {a.relatedAssignment.assignmentType?.toUpperCase()}
                        </span>
                        <span className="font-medium text-card-foreground">
                          {a.relatedAssignment.assignmentTitle}
                        </span>
                      </div>
                    )}
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {a.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface StudentClassesListProps {
  classes: StudentClassItem[];
  search: string;
  semesterFilter: string;
  onSearchChange: (v: string) => void;
  onSemesterChange: (v: string) => void;
}

function StudentClassesList({
  classes,
  search,
  semesterFilter,
  onSearchChange,
  onSemesterChange,
}: StudentClassesListProps) {
  const semesters = useMemo(
    () => Array.from(new Set(classes.map((c) => c.semester))).sort(),
    [classes],
  );

  const filtered = useMemo(
    () =>
      classes.filter((item) => {
        const matchSearch =
          item.className.toLowerCase().includes(search.toLowerCase()) ||
          (item.lecturerName?.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchSemester = semesterFilter === 'all' || item.semester === semesterFilter;
        return matchSearch && matchSemester;
      }),
    [classes, search, semesterFilter],
  );

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <p className="text-sm text-muted-foreground">Enrolled Classes</p>
          <p className="mt-2 font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
            {classes.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <p className="text-sm text-muted-foreground">Total Cases</p>
          <p className="mt-2 font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
            {classes.reduce((sum, c) => sum + c.totalCases, 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <p className="text-sm text-muted-foreground">Total Quizzes</p>
          <p className="mt-2 font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
            {classes.reduce((sum, c) => sum + c.totalQuizzes, 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search classes..."
                className="rounded-xl pl-9"
              />
            </div>
            <select
              value={semesterFilter}
              onChange={(e) => onSemesterChange(e.target.value)}
              className="h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All semesters</option>
              {semesters.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Class Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-7 w-7 opacity-90" />}
          title="No classes match your filters"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {filtered.map((item) => (
            <Link
              key={item.classId}
              href={`/student/classes/${item.classId}`}
              className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"
            >
              <div className="mb-3 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {item.semester || 'Class'}
              </div>
              <h3 className="font-['Manrope',sans-serif] text-lg font-bold tracking-tight text-card-foreground transition-colors group-hover:text-primary">
                {item.className}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.lecturerName?.trim() || 'Instructor'}
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {item.totalCases} cases
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {item.totalQuizzes} quizzes
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary/90">
                <span>Open class →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export { StudentClassWorkbench, StudentClassesList };
export type { StudentClassWorkbenchProps } from './types';
