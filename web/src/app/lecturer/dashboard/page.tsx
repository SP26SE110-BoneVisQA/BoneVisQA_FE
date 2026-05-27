'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import { useToast } from '@/components/ui/toast';
import {
  fetchLecturerAnalytics,
  fetchLecturerClassLeaderboard,
  fetchLecturerDashboardStats,
  type LecturerAnalyticsData,
} from '@/lib/api/lecturer-dashboard';
import { fetchLecturerClasses, fetchLecturerTriageList } from '@/lib/api/lecturer-triage';
import type { ClassItem, LecturerDashboardStats, LecturerLeaderboardEntry, LecturerTriageRow } from '@/lib/api/types';
import StudentProgress from '@/components/lecturer/StudentProgress';
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

function toPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function formatNumber(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return Number(n).toLocaleString();
}

// Compact Stat Card
function MiniStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className={`rounded-xl ${color} p-3`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] opacity-80">{label}</p>
    </div>
  );
}

// Collapsible Card
function Card({
  title,
  icon: Icon,
  badge,
  children,
  className = '',
}: {
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const badgeCount = typeof badge === 'number' ? badge : Number(badge);
  const showBadge = badge !== undefined && Number.isFinite(badgeCount) && badgeCount > 0;
  return (
    <div className={`rounded-2xl border bg-card overflow-hidden ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{title}</span>
          {badge !== undefined && Number(badge) > 0 && (
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Quick Link Button
function QuickLink({ href, icon: Icon, label, color }: { href: string; icon: React.ElementType; label: string; color: string }) {
  return (
    <a href={href} className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 hover:shadow-sm hover:border-primary/20 transition-all">
      <div className={`rounded-lg ${color} p-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
    </a>
  );
}

export default function LecturerDashboardPage() {
  const toast = useToast();
  const [selectedClassId, setSelectedClassId] = useState('');
  const lecturerId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR<LecturerDashboardStats>(
    'lecturer-dashboard-statistics',
    fetchLecturerDashboardStats,
    { revalidateOnFocus: false },
  );
  const { data: classesData, error: classesError, isLoading: classesLoading } = useSWR<ClassItem[]>(
    lecturerId ? ['lecturer-classes', lecturerId] : null,
    (_: unknown, id: string) => fetchLecturerClasses(id),
    { revalidateOnFocus: false },
  );
  const { data: analytics, error: analyticsError, isLoading: analyticsLoading } = useSWR<LecturerAnalyticsData>(
    'lecturer-dashboard-analytics',
    fetchLecturerAnalytics,
    { revalidateOnFocus: false },
  );

  const classes = classesData ?? [];
  const selectedClass = selectedClassId || classes[0]?.id || '';

  const { data: leaderboard, error: leaderboardError, isLoading: leaderboardLoading } = useSWR<LecturerLeaderboardEntry[]>(
    selectedClass ? ['lecturer-dashboard-leaderboard', selectedClass] : null,
    (_: unknown, classId: string) => fetchLecturerClassLeaderboard(classId),
    { revalidateOnFocus: false },
  );

  const triageClassId = classes.length > 0 ? (selectedClassId || classes[0]?.id) : '';
  const { data: triageData, error: triageError, isLoading: triageLoading } = useSWR<LecturerTriageRow[]>(
    triageClassId ? ['lecturer-dashboard-triage', triageClassId] : null,
    (_: unknown, classId: string) => fetchLecturerTriageList(classId),
    { revalidateOnFocus: false },
  );

  useEffect(() => { if (statsError) toast.error('Unable to load statistics.'); }, [statsError, toast]);
  useEffect(() => { if (classesError) toast.error('Unable to load classes.'); }, [classesError, toast]);
  useEffect(() => { if (analyticsError) toast.error('Unable to load analytics.'); }, [analyticsError, toast]);
  useEffect(() => { if (leaderboardError) toast.error('Unable to load leaderboard.'); }, [leaderboardError, toast]);
  useEffect(() => { if (triageError) toast.error('Unable to load triage.'); }, [triageError, toast]);

  const topActive = useMemo(() => {
    return [...(leaderboard ?? [])].sort((a, b) => (b.totalQuestionsAsked ?? 0) - (a.totalQuestionsAsked ?? 0)).slice(0, 6);
  }, [leaderboard]);

  const pendingTriageCount = triageData?.filter(q => !q.escalated).length ?? 0;
  const isLoading = statsLoading || classesLoading || analyticsLoading;

  return (
    <div className="min-h-screen">
      <Header title="Lecturer Dashboard" subtitle="Overview of your courses and student performance" />

      <div className="mx-auto max-w-7xl space-y-4 p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <MiniStat value={formatNumber(stats?.totalClasses)} label="Classes" color="bg-primary/10 text-primary" />
          <MiniStat value={formatNumber(stats?.totalStudents)} label="Students" color="bg-accent/10 text-accent" />
          <MiniStat value={formatNumber(stats?.totalQuestions)} label="Questions" color="bg-purple-50 text-purple-600" />
          <MiniStat value={formatNumber(pendingTriageCount)} label="Pending" color="bg-warning/10 text-warning" />
          <MiniStat value={formatNumber(stats?.escalatedItems)} label="Escalated" color="bg-destructive/10 text-destructive" />
          <MiniStat value={toPercent(stats?.averageQuizScore)} label="Avg Score" color="bg-success/10 text-success" />
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          <QuickLink href="/lecturer/classes" icon={Users} label="Classes" color="bg-primary/10 text-primary" />
          <QuickLink href="/lecturer/quizzes" icon={FileQuestion} label="Quizzes" color="bg-accent/10 text-accent" />
          <QuickLink href="/lecturer/qa-triage" icon={ClipboardCheck} label="QA Triage" color="bg-warning/10 text-warning" />
          <QuickLink href="/lecturer/cases" icon={FolderOpen} label="Cases" color="bg-purple-50 text-purple-600" />
          <QuickLink href="/lecturer/assignments" icon={ClipboardList} label="Tasks" color="bg-success/10 text-success" />
          <QuickLink href="/lecturer/analytics" icon={BarChart3} label="Analytics" color="bg-destructive/10 text-destructive" />
          <QuickLink href="/lecturer/announcements" icon={Bell} label="Announce" color="bg-cyan-50 text-cyan-600" />
          <QuickLink href="/lecturer/settings" icon={Settings} label="Settings" color="bg-muted text-muted-foreground" />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - 2 columns wide */}
          <div className="lg:col-span-2 space-y-4">
            {/* Class Performance */}
            <Card title="Class Performance" icon={BarChart3} badge={classes.length}>
              <div className="mb-3">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={classesLoading || classes.length === 0}
                  className="w-full rounded-lg border bg-input px-3 py-2 text-sm"
                >
                  {classes.length === 0 && <option value="">No classes</option>}
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.className} ({cls.semester})</option>
                  ))}
                </select>
              </div>
              {analytics?.classPerformance?.length ? (
                <div className="space-y-2">
                  {analytics.classPerformance.map(cls => (
                    <div key={cls.classId} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">{cls.className}</p>
                        <p className="text-[10px] text-muted-foreground">{cls.studentCount} students</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">{cls.totalCasesViewed} cases</span>
                        <span className="text-muted-foreground">{cls.totalQuestions} Q</span>
                        <span className={`font-semibold ${cls.completionRate >= 60 ? 'text-success' : 'text-warning'}`}>{cls.completionRate}%</span>
                        <span className={`font-bold ${(cls.avgQuizScore ?? 0) >= 60 ? 'text-success' : 'text-warning'}`}>{toPercent(cls.avgQuizScore)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No class data</p>
              )}
            </Card>

            {/* Top Active Students */}
            <Card title="Top Active Students" icon={TrendingUp} badge={topActive.length}>
              {leaderboardLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : topActive.length > 0 ? (
                <div className="space-y-1">
                  {topActive.map((row, idx) => (
                    <div key={`${row.studentId}-${idx}`} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/30">
                      <span className="w-5 text-xs text-muted-foreground font-medium">{idx + 1}</span>
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{row.studentName}</span>
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{row.totalCasesViewed}</span>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{row.totalQuestionsAsked}</span>
                      {row.averageQuizScore > 0 && (
                        <span className={`text-xs font-medium ${row.averageQuizScore >= 60 ? 'text-success' : 'text-warning'}`}>
                          {toPercent(row.averageQuizScore)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              )}
            </Card>

            {/* Topic Performance */}
            <Card title="Topic Performance" icon={Target} badge={analytics?.topicScores?.length}>
              {analyticsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : analytics?.topicScores?.length ? (
                <div className="space-y-2">
                  {analytics.topicScores.slice(0, 6).map(topic => {
                    const color = topic.avgScore >= 80 ? 'bg-success' : topic.avgScore >= 60 ? 'bg-warning' : 'bg-destructive';
                    return (
                      <div key={topic.topic} className="flex items-center gap-3">
                        <span className="text-xs w-24 truncate">{topic.topic}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${topic.avgScore}%` }} />
                        </div>
                        <span className="text-xs w-10 text-right">{topic.avgScore}%</span>
                        <span className="text-[10px] text-muted-foreground w-8">{topic.attempts}x</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No topic data</p>
              )}
            </Card>

            {/* Student Progress */}
            {selectedClass && (
              <StudentProgress
                classId={selectedClass}
                onError={(error) => toast.error(error)}
              />
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Top Performers */}
            <Card title="Top Performers" icon={Award} badge={analytics?.topStudents?.length}>
              {analytics?.topStudents?.length ? (
                <div className="space-y-1">
                  {analytics.topStudents.slice(0, 5).map((s, i) => (
                    <div key={s.studentId ?? i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-success/5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-600' : i === 1 ? 'bg-slate-100 text-slate-500' : i === 2 ? 'bg-amber-100 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                        {i + 1}
                      </span>
                      <span className="text-xs flex-1 truncate">{s.studentName}</span>
                      <span className="text-xs text-success font-medium">{toPercent(s.averageQuizScore)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No data</p>
              )}
            </Card>

            {/* Need Attention */}
            <Card title="Need Attention" icon={AlertTriangle} badge={analytics?.bottomStudents?.length}>
              {analytics?.bottomStudents?.length ? (
                <div className="space-y-1">
                  {analytics.bottomStudents.slice(0, 5).map((s, i) => (
                    <div key={s.studentId ?? i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-warning/5">
                      <span className="w-5 h-5 rounded-full bg-warning/20 text-warning text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-xs flex-1 truncate">{s.studentName}</span>
                      <span className="text-xs text-warning font-medium">{toPercent(s.averageQuizScore)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2">
                  <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
                  <p className="text-xs text-success">All doing well!</p>
                </div>
              )}
            </Card>

            {/* QA Triage Preview */}
            <Card title="QA Triage" icon={MessageSquare} badge={pendingTriageCount}>
              {triageLoading ? (
                <p className="text-sm text-muted-foreground text-center py-2">Loading...</p>
              ) : triageData?.length ? (
                <div className="space-y-2">
                  {triageData.slice(0, 4).map(q => (
                    <div key={q.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50">
                      <div className={`rounded p-1 shrink-0 ${q.escalated ? 'bg-warning/10' : 'bg-primary/10'}`}>
                        {q.questionSource === 'VisualQA' ? <Image className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{q.studentName}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{q.questionSnippet}</p>
                      </div>
                      {q.escalated && <span className="px-1 py-0.5 bg-warning/10 text-warning text-[10px] rounded-full">Esc</span>}
                    </div>
                  ))}
                  <a href="/lecturer/qa-triage" className="flex items-center justify-center gap-1 text-xs text-primary hover:underline py-1">
                    View all <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div className="text-center py-2">
                  <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
                  <p className="text-xs text-success">All caught up!</p>
                </div>
              )}
            </Card>

            {/* Quick Summary */}
            <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-accent/5 p-4">
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Summary
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Classes</span><span className="font-medium">{formatNumber(stats?.totalClasses)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Students</span><span className="font-medium">{formatNumber(stats?.totalStudents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Topics</span><span className="font-medium">{analytics?.topicScores?.length ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Score</span><span className={`font-medium ${(stats?.averageQuizScore ?? 0) >= 60 ? 'text-success' : 'text-warning'}`}>{toPercent(stats?.averageQuizScore)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
