'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  Users,
  BookOpen,
  Trophy,
  TrendingUp,
  TrendingDown,
  Download,
  Target,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';
import { ListPageLayout } from '@/components/layouts';
import { useLecturerAnalytics } from '@/features/lecturer/queries/use-lecturer-analytics';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { Button } from '@/components/ui/button';

export function LecturerAnalyticsPage() {
  const analyticsQuery = useLecturerAnalytics();
  const data = analyticsQuery.data;
  const errorMessage = analyticsQuery.error
    ? getQueryErrorMessage(analyticsQuery.error, 'Failed to load analytics.')
    : null;

  const classPerformance = useMemo(() => data?.classPerformance ?? [], [data?.classPerformance]);
  const topicScores = useMemo(() => data?.topicScores ?? [], [data?.topicScores]);
  const topStudents = useMemo(() => data?.topStudents ?? [], [data?.topStudents]);
  const bottomStudents = useMemo(() => data?.bottomStudents ?? [], [data?.bottomStudents]);

  const classOptions = useMemo(
    () =>
      classPerformance.map((cls) => ({
        id: cls.classId,
        label: cls.className,
        students: cls.studentCount,
        avgScore: cls.avgQuizScore,
      })),
    [classPerformance],
  );

  const [selectedClassId, setSelectedClassId] = useState(() => classOptions[0]?.id ?? '');
  const activeClass = classPerformance.find((cls) => cls.classId === selectedClassId) ?? classPerformance[0];

  const selectedIndex = classPerformance.findIndex((cls) => cls.classId === selectedClassId);
  const nextClass = classPerformance[(selectedIndex + 1) % classPerformance.length];
  const prevClass = classPerformance[(selectedIndex - 1 + classPerformance.length) % classPerformance.length];

  const totalStudents = classPerformance.reduce((s, c) => s + (c.studentCount ?? 0), 0);
  const totalCases = classPerformance.reduce((s, c) => s + (c.totalCasesViewed ?? 0), 0);

  const scored = classPerformance.filter((c) => typeof c.avgQuizScore === 'number');
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, c) => s + (c.avgQuizScore ?? 0), 0) / scored.length)
      : 0;

  const classAvgScore =
    typeof activeClass?.avgQuizScore === 'number' ? Math.round(activeClass.avgQuizScore) : null;

  const topicDetails = useMemo(() => {
    if (!topicScores.length) return [];
    const maxScore = Math.max(...topicScores.map((t) => t.avgScore ?? 0), 1);
    return topicScores.map((topic) => ({
      ...topic,
      width: Math.round(((topic.avgScore ?? 0) / maxScore) * 100),
      label: topic.topic?.trim() || 'Unnamed topic',
      subLabel: topic.commonErrors?.length
        ? topic.commonErrors.slice(0, 2).join(' · ')
        : `${topic.attempts ?? 0} attempts`,
    }));
  }, [topicScores]);

  const leaderboardRows = useMemo(
    () => (bottomStudents.length > 0 ? bottomStudents.slice(0, 5) : []),
    [bottomStudents],
  );

  const renderLeaderboard = (title: string, Icon: typeof TrendingUp, positive: boolean) => {
    const items = positive ? topStudents.slice(0, 5) : bottomStudents.slice(0, 5);
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Icon className={`h-5 w-5 ${positive ? 'text-success' : 'text-destructive'}`} />
          {title}
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((student, idx) => {
              const displayScore =
                typeof student.avgScore === 'number'
                  ? Math.round(student.avgScore)
                  : typeof student.score === 'number'
                    ? Math.round(student.score)
                    : null;
              return (
                <li
                  key={`${student.studentName}-${idx}`}
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="truncate" title={student.studentName}>
                      {student.studentName || 'Unnamed student'}
                    </span>
                  </div>
                  <span className="font-semibold">{displayScore ?? 0}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <ListPageLayout
      title="Analytics"
      isLoading={analyticsQuery.isPending}
      error={errorMessage ?? (!data && !analyticsQuery.isPending ? 'No data available.' : null)}
      maxWidthClass="max-w-[1600px]"
    >
      {data ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Monitoring {classPerformance.length} class{classPerformance.length === 1 ? '' : 'es'} managed by you.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
              >
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {typeof option.avgScore === 'number' ? ` · ${Math.round(option.avgScore)}%` : ''}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={() => setSelectedClassId(nextClass?.id ?? selectedClassId)} disabled={!nextClass}>
                Previous class
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedClassId(prevClass?.id ?? selectedClassId)} disabled={!prevClass}>
                Next class
              </Button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={GraduationCap} value={totalStudents} label="Total students" />
            <Stat icon={BookOpen} value={totalCases} label="Cases studied" />
            <Stat icon={Trophy} value={`${avgScore}%`} label="Avg quiz score" />
            <Button type="button" className="h-auto w-full justify-center py-4">
              <Download className="mr-2 h-4 w-4" />
              Export report
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Class performance
                  </h2>
                  {activeClass ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{activeClass.className}</span>
                      {' · '}
                      {activeClass.studentCount} students
                      {typeof classAvgScore === 'number' ? ` · ${classAvgScore}% avg score` : ''}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a class to review its performance.</p>
                  )}
                </div>
                <div className="space-y-3">
                  {classPerformance.map((c) => {
                    const isActive = c.classId === selectedClassId;
                    const displayAvg = typeof c.avgQuizScore === 'number' ? Math.round(c.avgQuizScore) : null;
                    return (
                      <div
                        key={c.classId}
                        className={`rounded-xl border p-4 transition-colors ${
                          isActive ? 'border-primary/60 bg-primary/5' : 'border-border bg-card'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedClassId(c.classId)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-3">
                            <UsersIcon />
                            <p className="font-medium">{c.className}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{c.studentCount} students</span>
                            <span className="text-sm font-semibold">{displayAvg ?? '—'}%</span>
                          </div>
                        </button>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(100, displayAvg ?? 0)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Cases viewed: {c.totalCasesViewed ?? 0}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Target className="h-5 w-5 text-accent" />
                  Topic scores
                </h2>
                {topicDetails.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No topic data available yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {topicDetails.map((topic) => (
                      <li key={topic.topic}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{topic.label}</span>
                          <span className="font-semibold">{Math.round(topic.avgScore ?? 0)}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${topic.width}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{topic.subLabel}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {renderLeaderboard('Top performers', TrendingUp, true)}
            {renderLeaderboard('Needs attention', TrendingDown, false)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          Analytics data is not available yet.
        </div>
      )}
    </ListPageLayout>
  );
}

function UsersIcon() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      <Users className="h-4 w-4" />
    </span>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-lg font-bold text-card-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
