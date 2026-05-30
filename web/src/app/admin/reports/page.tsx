'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Users, FileText, BrainCircuit, Download, Calendar, Eye, MessageSquare, Trophy, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { reportsApi, type ReportData, type TopCase, type TopQuiz } from '@/lib/api/reports';

type DateRange = '7d' | '30d' | '90d' | '1y';

export default function AdminReportsPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [topCases, setTopCases] = useState<TopCase[]>([]);
  const [topQuizzes, setTopQuizzes] = useState<TopQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [report, cases, quizzes] = await Promise.all([
        reportsApi.getReport(dateRange),
        reportsApi.getTopCases(dateRange, 10),
        reportsApi.getTopQuizzes(dateRange, 10),
      ]);
      setReportData(report);
      setTopCases(cases);
      setTopQuizzes(quizzes);
    } catch (error) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    try {
      const format = type === 'excel' ? 'csv' : 'csv';
      const data = await reportsApi.exportReport(dateRange, format);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bonevisqa-report-${dateRange}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = reportData ? [
    { title: 'Active Users', value: reportData.activeUsers.toLocaleString(), change: '+12%', changeType: 'positive' as const, icon: Users, iconColor: 'bg-primary/10 text-primary' },
    { title: 'New Registrations', value: reportData.newRegistrations.toLocaleString(), change: '+8%', changeType: 'positive' as const, icon: TrendingUp, iconColor: 'bg-accent/10 text-accent' },
    { title: 'Cases Viewed', value: reportData.casesViewed.toLocaleString(), change: '+15%', changeType: 'positive' as const, icon: Eye, iconColor: 'bg-success/10 text-success' },
    { title: 'AI Questions', value: reportData.aiQuestions.toLocaleString(), change: '+23%', changeType: 'positive' as const, icon: MessageSquare, iconColor: 'bg-warning/10 text-warning' },
  ] : [];

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header
        title={t('reports.title', 'Reports & Analytics')}
        subtitle={t('reports.subtitle', 'Platform usage statistics and insights')}
      />

      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {(['7d', '30d', '90d', '1y'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  dateRange === range ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('excel')}>
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Period Info */}
        {reportData && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Reporting period: <strong className="text-foreground">{reportData.period}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Additional Stats */}
        {reportData && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Trophy className="mx-auto h-6 w-6 text-warning" />
              <p className="mt-2 text-2xl font-bold text-card-foreground">{reportData.quizzesTaken.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Quizzes Taken</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <TrendingUp className="mx-auto h-6 w-6 text-success" />
              <p className="mt-2 text-2xl font-bold text-card-foreground">{reportData.avgQuizScore}%</p>
              <p className="text-sm text-muted-foreground">Avg Quiz Score</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <FileText className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-2 text-2xl font-bold text-card-foreground">{reportData.casesViewed.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Case Views</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <BrainCircuit className="mx-auto h-6 w-6 text-accent" />
              <p className="mt-2 text-2xl font-bold text-card-foreground">{reportData.aiQuestions.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">AI Q&A Sessions</p>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Cases */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-card-foreground">Most Viewed Cases</h3>
            </div>
            <div className="space-y-3">
              {topCases.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">{c.title}</p>
                    <div className="mt-1 h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(c.views / (topCases[0]?.views || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm font-semibold text-card-foreground">{c.views.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{c.completions} completions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Quiz Topics */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              <h3 className="text-lg font-semibold text-card-foreground">Top Quiz Topics</h3>
            </div>
            <div className="space-y-3">
              {topQuizzes.slice(0, 5).map((q, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">{q.topic}</p>
                    <div className="mt-1 h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-warning transition-all" style={{ width: `${(q.attempts / (topQuizzes[0]?.attempts || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm font-semibold text-card-foreground">{q.avgScore}%</p>
                    <p className="text-xs text-muted-foreground">{q.attempts} attempts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Table */}
        {reportData && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-semibold text-card-foreground">Performance Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Metric</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase text-muted-foreground">Value</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase text-muted-foreground">vs Previous Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-3 text-sm text-card-foreground">Active Users</td>
                    <td className="py-3 text-right font-semibold text-card-foreground">{reportData.activeUsers.toLocaleString()}</td>
                    <td className="py-3 text-right text-success">+12%</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-card-foreground">New Registrations</td>
                    <td className="py-3 text-right font-semibold text-card-foreground">{reportData.newRegistrations.toLocaleString()}</td>
                    <td className="py-3 text-right text-success">+8%</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-card-foreground">Cases Viewed</td>
                    <td className="py-3 text-right font-semibold text-card-foreground">{reportData.casesViewed.toLocaleString()}</td>
                    <td className="py-3 text-right text-success">+15%</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-card-foreground">Quizzes Taken</td>
                    <td className="py-3 text-right font-semibold text-card-foreground">{reportData.quizzesTaken.toLocaleString()}</td>
                    <td className="py-3 text-right text-success">+10%</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-card-foreground">AI Q&A Sessions</td>
                    <td className="py-3 text-right font-semibold text-card-foreground">{reportData.aiQuestions.toLocaleString()}</td>
                    <td className="py-3 text-right text-success">+23%</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-card-foreground">Average Quiz Score</td>
                    <td className="py-3 text-right font-semibold text-card-foreground">{reportData.avgQuizScore}%</td>
                    <td className="py-3 text-right text-success">+3%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
