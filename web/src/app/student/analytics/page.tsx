'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import { analyticsApi, type StudentDashboardData } from '@/lib/api/analytics';
import { quizExtensionsApi, type SpacedRepetitionStats, type ReviewItem } from '@/lib/api/quiz-extensions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Target,
  CheckCircle,
  Clock,
  BookOpen,
  RefreshCw,
  XCircle,
  Zap,
  Award,
  Brain,
  Calendar,
  Star,
  Trophy,
  Play,
  ArrowRight,
  Activity,
  BarChart,
  PieChart,
  LineChart,
} from 'lucide-react';
import Link from 'next/link';

export default function StudentAnalyticsPage() {
  const [dashboardData, setDashboardData] = useState<StudentDashboardData | null>(null);
  const [srStats, setSrStats] = useState<SpacedRepetitionStats | null>(null);
  const [dueReviews, setDueReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboard, stats, reviews] = await Promise.all([
        analyticsApi.getStudentDashboard(),
        quizExtensionsApi.getSpacedRepetitionStats(),
        quizExtensionsApi.getDueReviews(5),
      ]);
      setDashboardData(dashboard);
      setSrStats(stats);
      setDueReviews(reviews);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const hasData = dashboardData && (
    dashboardData.competencies.length > 0 ||
    dashboardData.summary.totalQuizzes > 0 ||
    (srStats && srStats.totalReviews > 0)
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header title="Analytics" subtitle="Your learning insights and performance" />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={fetchAll} error={error} />
        ) : !hasData ? (
          <WelcomeState />
        ) : (
          <>
            {/* Performance Summary - Horizontal Bar */}
            <div className="mb-6">
              <PerformanceSummaryCard
                averageScore={dashboardData!.summary.averageScore}
                totalQuizzes={dashboardData!.summary.totalQuizzes}
                weakTopics={dashboardData!.summary.weakTopicCount}
                dueToday={srStats?.dueToday ?? 0}
              />
            </div>

            {/* Main Grid - Different from Dashboard */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Topics Analysis */}
              <div className="space-y-6 lg:col-span-2">
                {/* Topic Breakdown with Visual Bars */}
                <TopicBreakdownCard competencies={dashboardData!.competencies} />

                {/* Error Analysis */}
                <ErrorAnalysisCard
                  errorPatterns={dashboardData!.errorPatterns}
                  insights={dashboardData!.insights}
                />
              </div>

              {/* Right Column - Quick Stats & Actions */}
              <div className="space-y-6">
                {/* Spaced Repetition Overview */}
                <SpacedRepetitionOverviewCard
                  srStats={srStats}
                  dueReviews={dueReviews}
                />

                {/* Insights Summary */}
                <InsightsSummaryCard insights={dashboardData!.insights} />

                {/* Quick Actions */}
                <QuickActionsCard dueReviewsCount={dueReviews.length} />
              </div>
            </div>

            {/* Detailed Analytics Section */}
            <div className="mt-6">
              <DetailedAnalyticsCard
                competencies={dashboardData!.competencies}
                summary={dashboardData!.summary}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Performance Summary - Full Width Horizontal Card
function PerformanceSummaryCard({
  averageScore,
  totalQuizzes,
  weakTopics,
  dueToday
}: {
  averageScore: number;
  totalQuizzes: number;
  weakTopics: number;
  dueToday: number;
}) {
  const scoreColor = averageScore >= 80 ? 'text-emerald-600' : averageScore >= 60 ? 'text-blue-600' : averageScore >= 40 ? 'text-amber-600' : 'text-red-600';

  return (
    <Card className="border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          {/* Main Score */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500 mb-1">Average Score</p>
              <p className={`text-5xl font-bold ${scoreColor}`}>{averageScore.toFixed(0)}%</p>
            </div>
            <div className="h-16 w-px bg-slate-200" />
          </div>

          {/* Stats Grid */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 mb-2">
                <Trophy className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalQuizzes}</p>
              <p className="text-xs text-slate-500">Quizzes</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 mb-2">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{weakTopics}</p>
              <p className="text-xs text-slate-500">Weak Areas</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100 mb-2">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{dueToday}</p>
              <p className="text-xs text-slate-500">Due Today</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Topic Breakdown Card with Visual Progress Bars
function TopicBreakdownCard({ competencies }: { competencies: any[] }) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart className="h-5 w-5 text-blue-600" />
          Topic Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {competencies.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No topic data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {competencies.map((comp, idx) => {
              const scoreColor = comp.score >= 80 ? 'bg-emerald-500' : comp.score >= 60 ? 'bg-blue-500' : comp.score >= 40 ? 'bg-amber-500' : 'bg-red-500';
              const masteryLabel = comp.score >= 80 ? 'Expert' : comp.score >= 60 ? 'Good' : comp.score >= 40 ? 'Developing' : 'Needs Work';
              const masteryColor = comp.score >= 80 ? 'bg-emerald-100 text-emerald-700' : comp.score >= 60 ? 'bg-blue-100 text-blue-700' : comp.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

              return (
                <div key={comp.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <span className="font-semibold text-slate-800">{comp.boneSpecialty?.name ?? 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${masteryColor}`}>{masteryLabel}</span>
                      <span className="text-sm font-bold text-slate-700 w-12 text-right">{comp.score.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${scoreColor} rounded-full transition-all duration-500`}
                      style={{ width: `${comp.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{comp.correctAttempts}/{comp.totalAttempts} correct attempts</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Error Analysis Card
function ErrorAnalysisCard({ errorPatterns, insights }: { errorPatterns: any[]; insights: any[] }) {
  const weakInsights = insights.filter((i: any) => i.insightType === 'WeakTopic');
  const errorInsights = insights.filter((i: any) => i.insightType === 'ErrorPattern');

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-amber-600" />
          Learning Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Weak Topics */}
          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Areas to Improve
            </h4>
            {weakInsights.length === 0 ? (
              <div className="text-center py-6 bg-emerald-50 rounded-xl">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm text-emerald-700">No weak topics identified!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {weakInsights.slice(0, 3).map((insight: any) => (
                  <div key={insight.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <p className="font-medium text-sm text-red-800">{insight.title}</p>
                    <p className="text-xs text-red-600 mt-1">{insight.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Patterns */}
          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Common Mistakes
            </h4>
            {errorPatterns.length === 0 ? (
              <div className="text-center py-6 bg-emerald-50 rounded-xl">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm text-emerald-700">No repeated mistakes!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {errorPatterns.slice(0, 3).map((pattern: any) => (
                  <div key={pattern.id} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm text-orange-800">{pattern.errorTopic ?? 'Unknown'}</p>
                      <Badge variant="outline" className="text-xs">{pattern.errorCount}x</Badge>
                    </div>
                    <p className="text-xs text-orange-600 mt-1">Repeated {pattern.errorCount} times</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Spaced Repetition Overview Card
function SpacedRepetitionOverviewCard({ srStats, dueReviews }: { srStats: SpacedRepetitionStats | null; dueReviews: ReviewItem[] }) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-purple-600" />
          Review Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        {srStats && srStats.totalReviews > 0 ? (
          <>
            {/* Mini Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{srStats.overdue}</p>
                <p className="text-xs text-red-600">Overdue</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-xl">
                <p className="text-2xl font-bold text-yellow-600">{srStats.dueToday}</p>
                <p className="text-xs text-yellow-600">Due Today</p>
              </div>
            </div>

            {/* Due Reviews List */}
            {dueReviews.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Items</p>
                {dueReviews.slice(0, 3).map((review) => (
                  <div key={review.scheduleId} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-sm truncate flex-1">{review.caseTitle}</span>
                    <Button size="sm" variant="ghost" asChild className="text-xs">
                      <Link href={`/student/review?id=${review.scheduleId}`}>Review</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button asChild className="w-full mt-4" variant="outline">
              <Link href="/student/review">
                View All Reviews
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        ) : (
          <div className="text-center py-8">
            <Star className="h-12 w-12 mx-auto mb-3 text-purple-300" />
            <p className="text-sm text-slate-600 mb-4">Complete quizzes to build your review schedule</p>
            <Button asChild size="sm">
              <Link href="/student/quizzes">Start Learning</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Insights Summary Card
function InsightsSummaryCard({ insights }: { insights: any[] }) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-6">
            <Award className="h-10 w-10 mx-auto mb-2 text-amber-300" />
            <p className="text-sm text-slate-500">Complete quizzes to receive personalized insights</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.slice(0, 4).map((insight: any) => (
              <div
                key={insight.id}
                className={`p-3 rounded-lg border ${
                  !insight.isRead ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className={`h-4 w-4 mt-0.5 ${
                    insight.insightType === 'WeakTopic' ? 'text-red-500' :
                    insight.insightType === 'ErrorPattern' ? 'text-orange-500' : 'text-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{insight.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Quick Actions Card
function QuickActionsCard({ dueReviewsCount }: { dueReviewsCount: number }) {
  return (
    <Card className="border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 rounded-xl p-2">
            <Zap className="h-5 w-5 text-yellow-300" />
          </div>
          <h3 className="font-bold text-lg">Quick Actions</h3>
        </div>
        <div className="space-y-2">
          <Button asChild className="w-full bg-white text-blue-600 hover:bg-blue-50 justify-start">
            <Link href="/student/quizzes">
              <Play className="h-4 w-4 mr-2" />
              Start New Quiz
            </Link>
          </Button>
          {dueReviewsCount > 0 && (
            <Button asChild variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 justify-start">
              <Link href="/student/review">
                <Clock className="h-4 w-4 mr-2" />
                Review ({dueReviewsCount} due)
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 justify-start">
            <Link href="/student/cases">
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Cases
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Detailed Analytics Card
function DetailedAnalyticsCard({ competencies, summary }: { competencies: any[]; summary: any }) {
  const totalAttempts = competencies.reduce((sum: number, c: any) => sum + c.totalAttempts, 0);
  const totalCorrect = competencies.reduce((sum: number, c: any) => sum + c.correctAttempts, 0);
  const overallAccuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PieChart className="h-5 w-5 text-slate-600" />
          Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-3xl font-bold text-slate-800">{summary.totalQuizzes}</p>
            <p className="text-sm text-slate-500 mt-1">Total Quizzes</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-3xl font-bold text-slate-800">{totalAttempts}</p>
            <p className="text-sm text-slate-500 mt-1">Total Attempts</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-3xl font-bold text-slate-800">{overallAccuracy.toFixed(0)}%</p>
            <p className="text-sm text-slate-500 mt-1">Overall Accuracy</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-3xl font-bold text-slate-800">{competencies.length}</p>
            <p className="text-sm text-slate-500 mt-1">Topics Covered</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Welcome State
function WelcomeState() {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-white">
        <CardContent className="py-12 px-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <BarChart3 className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Analytics Dashboard</h2>
          <p className="text-slate-600 mb-8 max-w-md mx-auto">
            Track your learning progress, identify areas for improvement, and get personalized insights.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link href="/student/quizzes">
                <Play className="h-5 w-5 mr-2" />
                Take Your First Quiz
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/student/cases">
                <BookOpen className="h-5 w-5 mr-2" />
                Browse Cases
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature Preview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <BarChart className="h-8 w-8 text-blue-500 mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">Topic Analysis</h3>
            <p className="text-sm text-slate-500">Track your performance across different bone specialties</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-6">
            <Lightbulb className="h-8 w-8 text-amber-500 mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">AI Insights</h3>
            <p className="text-sm text-slate-500">Get personalized recommendations based on your progress</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <Calendar className="h-8 w-8 text-purple-500 mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">Spaced Repetition</h3>
            <p className="text-sm text-slate-500">Review material at optimal intervals for better retention</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-16 w-32" />
            <div className="flex gap-4">
              <Skeleton className="h-20 w-20" />
              <Skeleton className="h-20 w-20" />
              <Skeleton className="h-20 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-64" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
        </div>
        <div className="space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

// Error State
function ErrorState({ onRetry, error }: { onRetry: () => void; error: string }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="py-12 text-center">
        <XCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
        <h3 className="text-xl font-bold text-red-700 mb-2">Unable to Load Analytics</h3>
        <p className="text-red-600 mb-6">{error}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
