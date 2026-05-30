'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { analyticsApi, type StudentDashboardData, type StudentCompetency, type ErrorPattern, type LearningInsight } from '@/lib/api/analytics';
import { quizExtensionsApi, type SpacedRepetitionStats, type ReviewItem } from '@/lib/api/quiz-extensions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Target,
  CheckCircle,
  Clock,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function StudentAnalyticsPage() {
  const [dashboardData, setDashboardData] = useState<StudentDashboardData | null>(null);
  const [srStats, setSrStats] = useState<SpacedRepetitionStats | null>(null);
  const [dueReviews, setDueReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboard, stats, reviews] = await Promise.all([
          analyticsApi.getStudentDashboard().catch(() => null),
          quizExtensionsApi.getSpacedRepetitionStats().catch(() => null),
          quizExtensionsApi.getDueReviews(5).catch(() => []),
        ]);
        
        setDashboardData(dashboard);
        setSrStats(stats);
        setDueReviews(reviews);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Analytics" subtitle="Track your learning progress" />
        <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const getMasteryColor = (level: string) => {
    switch (level) {
      case 'Expert': return 'bg-green-500';
      case 'Proficient': return 'bg-blue-500';
      case 'Intermediate': return 'bg-yellow-500';
      case 'Beginner': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getMasteryBadgeVariant = (level: string) => {
    switch (level) {
      case 'Expert': return 'default' as const;
      case 'Proficient': return 'secondary' as const;
      case 'Intermediate': return 'outline' as const;
      default: return 'destructive' as const;
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Analytics" subtitle="Track your learning progress and insights" />
      
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">
                    {dashboardData?.summary.averageScore.toFixed(1) ?? '0'}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-blue-500/10 p-3">
                  <BookOpen className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quizzes Taken</p>
                  <p className="text-2xl font-bold">
                    {dashboardData?.summary.totalQuizzes ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-red-500/10 p-3">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weak Topics</p>
                  <p className="text-2xl font-bold">
                    {dashboardData?.summary.weakTopicCount ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-purple-500/10 p-3">
                  <Clock className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due for Review</p>
                  <p className="text-2xl font-bold">
                    {srStats?.dueToday ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Competency Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Topic Competency
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.competencies && dashboardData.competencies.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.competencies.map((comp) => (
                    <div key={comp.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{comp.boneSpecialty?.name ?? 'Unknown Topic'}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={getMasteryBadgeVariant(comp.masteryLevel)}>
                            {comp.masteryLevel}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {comp.score.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <Progress 
                          value={comp.score} 
                          className="h-2"
                        />
                        <div 
                          className={`absolute top-0 left-0 h-2 rounded-full ${getMasteryColor(comp.masteryLevel)} opacity-30`}
                          style={{ width: `${comp.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {comp.correctAttempts}/{comp.totalAttempts} correct attempts
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No quiz data yet. Take some quizzes to see your progress!</p>
                  <Button asChild className="mt-4">
                    <Link href="/student/quizzes">Start Practice</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Learning Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.insights && dashboardData.insights.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.insights.slice(0, 5).map((insight) => (
                    <div 
                      key={insight.id} 
                      className={`p-4 rounded-lg border ${
                        !insight.isRead ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-2 ${
                          insight.insightType === 'WeakTopic' ? 'bg-red-100' :
                          insight.insightType === 'ErrorPattern' ? 'bg-orange-100' :
                          'bg-blue-100'
                        }`}>
                          {insight.insightType === 'WeakTopic' ? (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          ) : insight.insightType === 'ErrorPattern' ? (
                            <TrendingUp className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Lightbulb className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{insight.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                          {insight.recommendedAction && (
                            <p className="text-sm text-primary mt-2">
                              Action: {insight.recommendedAction}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Complete more quizzes to receive personalized insights!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Error Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Error Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.errorPatterns && dashboardData.errorPatterns.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.errorPatterns.map((pattern) => (
                    <div key={pattern.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{pattern.errorTopic ?? 'Unknown Topic'}</p>
                        <p className="text-sm text-muted-foreground">
                          Repeated {pattern.errorCount} times
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={async () => {
                          try {
                            await analyticsApi.resolveErrorPattern(pattern.id);
                            setDashboardData(prev => prev ? {
                              ...prev,
                              errorPatterns: prev.errorPatterns.filter(p => p.id !== pattern.id)
                            } : null);
                          } catch (error) {
                            console.error('Error resolving pattern:', error);
                          }
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Resolved
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p>No active error patterns. Great job!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Spaced Repetition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                Spaced Repetition
              </CardTitle>
            </CardHeader>
            <CardContent>
              {srStats && srStats.totalReviews > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-red-50">
                      <p className="text-2xl font-bold text-red-600">{srStats.overdue}</p>
                      <p className="text-xs text-muted-foreground">Overdue</p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-50">
                      <p className="text-2xl font-bold text-yellow-600">{srStats.dueToday}</p>
                      <p className="text-xs text-muted-foreground">Due Today</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50">
                      <p className="text-2xl font-bold text-green-600">{srStats.mastered}</p>
                      <p className="text-xs text-muted-foreground">Mastered</p>
                    </div>
                  </div>

                  {dueReviews.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Due for review:</p>
                      {dueReviews.slice(0, 3).map((review) => (
                        <div key={review.scheduleId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-sm font-medium truncate">{review.caseTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.daysOverdue > 0 ? `${review.daysOverdue} days overdue` : 'Due today'}
                            </p>
                          </div>
                          <Badge variant={review.daysOverdue > 0 ? 'destructive' : 'secondary'}>
                            {review.repetitionCount}x reviewed
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button asChild className="w-full">
                    <Link href="/student/review">
                      Start Review Session
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reviews scheduled. Complete quizzes to start building your review queue!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
