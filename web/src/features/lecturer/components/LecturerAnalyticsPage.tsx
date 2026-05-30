'use client';

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

  const classPerformance = data?.classPerformance ?? [];
  const topicScores = data?.topicScores ?? [];
  const topStudents = data?.topStudents ?? [];
  const bottomStudents = data?.bottomStudents ?? [];

  const totalStudents = classPerformance.reduce((s, c) => s + c.studentCount, 0);
  const scored = classPerformance.filter((c) => c.avgQuizScore != null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, c) => s + (c.avgQuizScore ?? 0), 0) / scored.length)
      : 0;
  const totalCases = classPerformance.reduce((s, c) => s + c.totalCasesViewed, 0);

  return (
    <ListPageLayout
      title="Analytics"
      isLoading={analyticsQuery.isPending}
      error={errorMessage ?? (!data && !analyticsQuery.isPending ? 'No data available.' : null)}
      maxWidthClass="max-w-[1600px]"
    >
      {data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Users} value={totalStudents} label="Total students" />
            <Stat icon={BookOpen} value={totalCases} label="Cases studied" />
            <Stat icon={Trophy} value={`${avgScore}%`} label="Avg quiz score" />
            <Button type="button" className="h-auto w-full justify-center py-4">
              <Download className="mr-2 h-4 w-4" />
              Export report
            </Button>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-primary" />
                Class performance
              </h2>
              <div className="space-y-3">
                {classPerformance.map((c) => (
                  <div key={c.classId} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{c.className}</p>
                      <span className="text-sm text-muted-foreground">{c.studentCount} students</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, c.avgQuizScore ?? 0)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avg score: {c.avgQuizScore ?? '—'}% · Cases viewed: {c.totalCasesViewed}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Target className="h-5 w-5 text-accent" />
                Topic scores
              </h2>
              <ul className="space-y-2">
                {topicScores.map((t) => (
                  <li key={t.topic} className="flex justify-between text-sm">
                    <span>{t.topic}</span>
                    <span className="font-semibold">{t.avgScore}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Leaderboard title="Top performers" icon={TrendingUp} students={topStudents} positive />
            <Leaderboard title="Needs attention" icon={TrendingDown} students={bottomStudents} positive={false} />
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          Analytics data is not available yet.
        </div>
      )}
    </ListPageLayout>
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

function Leaderboard({
  title,
  icon: Icon,
  students,
  positive,
}: {
  title: string;
  icon: typeof TrendingUp;
  students: { studentName: string; score?: number; avgScore?: number; className?: string }[];
  positive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Icon className={`h-5 w-5 ${positive ? 'text-success' : 'text-destructive'}`} />
        {title}
      </h2>
      <ul className="space-y-2">
        {students.map((s, i) => (
          <li key={`${s.studentName}-${i}`} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
            <span>{s.studentName}</span>
            <span className="font-semibold">{s.avgScore ?? s.score ?? 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
