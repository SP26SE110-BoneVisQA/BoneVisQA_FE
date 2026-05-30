'use client';

import Link from 'next/link';
import { useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { DashboardOverviewLayout } from '@/components/layouts';
import { useLecturerDashboardQueries } from '@/features/lecturer/hooks/useLecturerDashboardQueries';
import TeachingObjectives from '@/components/lecturer/TeachingObjectives';
import StudentProgress from '@/components/lecturer/StudentProgress';
import { useToast } from '@/components/ui/toast';
import {
  Users,
  GraduationCap,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Eye,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Target,
  FileQuestion,
  ClipboardCheck,
  FolderOpen,
  ClipboardList,
  Bell,
  Settings,
  MessageSquare,
  Image,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function toPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function formatNumber(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return Number(n).toLocaleString();
}

function MiniStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className={cn('rounded-xl p-3', color)}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] opacity-80">{label}</p>
    </div>
  );
}

function CollapsibleCard({
  title,
  icon: Icon,
  badge,
  children,
  className,
}: {
  title: string;
  icon: ElementType;
  badge?: number | string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const badgeCount = typeof badge === 'number' ? badge : Number(badge);
  const showBadge = badge !== undefined && Number.isFinite(badgeCount) && badgeCount > 0;

  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-card', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
          {showBadge ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{badge}</span>
          ) : null}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  color,
}: {
  href: string;
  icon: ElementType;
  label: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/20 hover:shadow-sm"
    >
      <div className={cn('rounded-lg p-2', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-center text-[10px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

function topicBarColor(avgScore: number): string {
  if (avgScore >= 80) return 'bg-success';
  if (avgScore >= 60) return 'bg-warning';
  return 'bg-destructive';
}

export default function LecturerDashboardPage() {
  const toast = useToast();
  const {
    setSelectedClassId,
    effectiveClassId,
    stats,
    classes,
    analytics,
    topActive,
    triage,
    pendingTriageCount,
    isLoading,
    errorMessage,
  } = useLecturerDashboardQueries();

  return (
    <DashboardOverviewLayout
      title="Lecturer Dashboard"
      isLoading={isLoading}
      error={errorMessage}
      maxWidthClass="max-w-7xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <MiniStat value={formatNumber(stats?.totalClasses)} label="Classes" color="bg-primary/10 text-primary" />
          <MiniStat value={formatNumber(stats?.totalStudents)} label="Students" color="bg-accent/10 text-accent" />
          <MiniStat value={formatNumber(stats?.totalQuestions)} label="Questions" color="bg-purple-50 text-purple-600" />
          <MiniStat value={formatNumber(pendingTriageCount)} label="Pending" color="bg-warning/10 text-warning" />
          <MiniStat value={formatNumber(stats?.escalatedItems)} label="Escalated" color="bg-destructive/10 text-destructive" />
          <MiniStat value={toPercent(stats?.averageQuizScore)} label="Avg Score" color="bg-success/10 text-success" />
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          <QuickLink href="/lecturer/classes" icon={Users} label="Classes" color="bg-primary/10 text-primary" />
          <QuickLink href="/lecturer/quizzes" icon={FileQuestion} label="Quizzes" color="bg-accent/10 text-accent" />
          <QuickLink href="/lecturer/qa-triage" icon={ClipboardCheck} label="QA Triage" color="bg-warning/10 text-warning" />
          <QuickLink href="/lecturer/cases" icon={FolderOpen} label="Cases" color="bg-purple-50 text-purple-600" />
          <QuickLink href="/lecturer/assignments" icon={ClipboardList} label="Tasks" color="bg-success/10 text-success" />
          <QuickLink href="/lecturer/analytics" icon={BarChart3} label="Analytics" color="bg-destructive/10 text-destructive" />
          <QuickLink href="/lecturer/announcements" icon={Bell} label="Announce" color="bg-cyan-50 text-cyan-600" />
          <QuickLink href="/lecturer/settings" icon={Settings} label="Settings" color="bg-muted text-muted-foreground" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CollapsibleCard title="Class Performance" icon={BarChart3} badge={classes.length}>
              <div className="mb-3">
                <select
                  value={effectiveClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={classes.length === 0}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                >
                  {classes.length === 0 && <option value="">No classes</option>}
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.className} ({cls.semester})
                    </option>
                  ))}
                </select>
              </div>
              {analytics?.classPerformance?.length ? (
                <div className="space-y-2">
                  {analytics.classPerformance.map((cls) => (
                    <div
                      key={cls.classId}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30"
                    >
                      <div>
                        <p className="text-sm font-medium">{cls.className}</p>
                        <p className="text-[10px] text-muted-foreground">{cls.studentCount} students</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">{cls.totalCasesViewed} cases</span>
                        <span className="text-muted-foreground">{cls.totalQuestions} Q</span>
                        <span
                          className={cn(
                            'font-semibold',
                            cls.completionRate >= 60 ? 'text-success' : 'text-warning',
                          )}
                        >
                          {cls.completionRate}%
                        </span>
                        <span
                          className={cn(
                            'font-bold',
                            (cls.avgQuizScore ?? 0) >= 60 ? 'text-success' : 'text-warning',
                          )}
                        >
                          {toPercent(cls.avgQuizScore)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No class data</p>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="Top Active Students" icon={TrendingUp} badge={topActive.length}>
              {topActive.length > 0 ? (
                <div className="space-y-1">
                  {topActive.map((row, idx) => (
                    <div
                      key={`${row.studentId}-${idx}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/30"
                    >
                      <span className="w-5 text-xs font-medium text-muted-foreground">{idx + 1}</span>
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{row.studentName}</span>
                      <span className="text-xs text-muted-foreground">{row.totalCasesViewed}</span>
                      <span className="text-xs text-muted-foreground">{row.totalQuestionsAsked}</span>
                      {row.averageQuizScore > 0 ? (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            row.averageQuizScore >= 60 ? 'text-success' : 'text-warning',
                          )}
                        >
                          {toPercent(row.averageQuizScore)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No activity yet</p>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="Topic Performance" icon={Target} badge={analytics?.topicScores?.length}>
              {analytics?.topicScores?.length ? (
                <div className="space-y-2">
                  {analytics.topicScores.slice(0, 6).map((topic) => (
                    <div key={topic.topic} className="flex items-center gap-3">
                      <span className="w-24 truncate text-xs">{topic.topic}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', topicBarColor(topic.avgScore))}
                          style={{ '--topic-pct': `${topic.avgScore}%`, width: 'var(--topic-pct)' } as CSSProperties}
                        />
                      </div>
                      <span className="w-10 text-right text-xs">{topic.avgScore}%</span>
                      <span className="w-8 text-[10px] text-muted-foreground">{topic.attempts}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No topic data</p>
              )}
            </CollapsibleCard>

            {effectiveClassId ? (
              <>
                <TeachingObjectives
                  classId={effectiveClassId}
                  onError={(error) => toast.error(error)}
                />
                <StudentProgress
                  classId={effectiveClassId}
                  onError={(error) => toast.error(error)}
                />
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            <CollapsibleCard title="Top Performers" icon={Award} badge={analytics?.topStudents?.length}>
              {analytics?.topStudents?.length ? (
                <div className="space-y-1">
                  {analytics.topStudents.slice(0, 5).map((s, i) => (
                    <div
                      key={s.studentId ?? i}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-success/5"
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                          i === 0
                            ? 'bg-yellow-100 text-yellow-600'
                            : i === 1
                              ? 'bg-slate-100 text-slate-500'
                              : i === 2
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-xs">{s.studentName}</span>
                      <span className="text-xs font-medium text-success">
                        {toPercent(s.averageQuizScore)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">No data</p>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="Need Attention" icon={AlertTriangle} badge={analytics?.bottomStudents?.length}>
              {analytics?.bottomStudents?.length ? (
                <div className="space-y-1">
                  {analytics.bottomStudents.slice(0, 5).map((s, i) => (
                    <div
                      key={s.studentId ?? i}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-warning/5"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/20 text-[10px] font-bold text-warning">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-xs">{s.studentName}</span>
                      <span className="text-xs font-medium text-warning">
                        {toPercent(s.averageQuizScore)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-2 text-center">
                  <CheckCircle className="mx-auto mb-1 h-5 w-5 text-success" />
                  <p className="text-xs text-success">All doing well!</p>
                </div>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="QA Triage" icon={MessageSquare} badge={pendingTriageCount}>
              {triage.length ? (
                <div className="space-y-2">
                  {triage.slice(0, 4).map((q) => (
                    <div
                      key={q.id}
                      className="flex items-start gap-2 rounded-lg bg-muted/30 p-2 hover:bg-muted/50"
                    >
                      <div
                        className={cn(
                          'shrink-0 rounded p-1',
                          q.escalated ? 'bg-warning/10' : 'bg-primary/10',
                        )}
                      >
                        {q.questionSource === 'VisualQA' ? (
                          <Image className="h-3 w-3" />
                        ) : (
                          <MessageSquare className="h-3 w-3" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{q.studentName}</p>
                        <p className="line-clamp-1 text-[10px] text-muted-foreground">{q.questionSnippet}</p>
                      </div>
                      {q.escalated ? (
                        <span className="rounded-full bg-warning/10 px-1 py-0.5 text-[10px] text-warning">
                          Esc
                        </span>
                      ) : null}
                    </div>
                  ))}
                  <Link
                    href="/lecturer/qa-triage"
                    className="flex items-center justify-center gap-1 py-1 text-xs text-primary hover:underline"
                  >
                    View all <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="py-2 text-center">
                  <CheckCircle className="mx-auto mb-1 h-5 w-5 text-success" />
                  <p className="text-xs text-success">All caught up!</p>
                </div>
              )}
            </CollapsibleCard>

            <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-accent/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <GraduationCap className="h-4 w-4 text-primary" /> Summary
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Classes</span>
                  <span className="font-medium">{formatNumber(stats?.totalClasses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Students</span>
                  <span className="font-medium">{formatNumber(stats?.totalStudents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Topics</span>
                  <span className="font-medium">{analytics?.topicScores?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Score</span>
                  <span
                    className={cn(
                      'font-medium',
                      (stats?.averageQuizScore ?? 0) >= 60 ? 'text-success' : 'text-warning',
                    )}
                  >
                    {toPercent(stats?.averageQuizScore)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardOverviewLayout>
  );
}
