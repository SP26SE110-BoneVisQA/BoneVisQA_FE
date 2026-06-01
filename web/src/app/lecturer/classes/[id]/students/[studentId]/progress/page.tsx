'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Target,
  Clock,
  Star,
  Calendar,
  BarChart3,
  Loader2,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import Header from '@/components/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  fetchStudentProgressDetail,
  type StudentProgressDetailDto,
} from '@/lib/api/lecturer-dashboard';

function getGradeColor(score: number) {
  if (score >= 80) return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' };
  if (score >= 60) return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' };
  if (score >= 40) return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' };
  return { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' };
}

function getCompetencyColor(level: string) {
  switch (level) {
    case 'Expert': return 'text-success';
    case 'Proficient': return 'text-primary';
    case 'Intermediate': return 'text-warning';
    case 'Beginner': return 'text-blue-500';
    default: return 'text-muted-foreground';
  }
}

function getProgressColor(progress: number) {
  if (progress >= 70) return 'bg-success';
  if (progress >= 40) return 'bg-warning';
  return 'bg-destructive';
}

export default function StudentProgressDetailPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id: classId, studentId } = use(params);
  const router = useRouter();
  const [student, setStudent] = useState<StudentProgressDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchStudentProgressDetail(classId, studentId);
        if (!ignore) setStudent(data);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load student progress');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [classId, studentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Student Progress" subtitle="Loading..." />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Student Progress" subtitle="Error loading data" />
        <div className="mx-auto max-w-[1200px] px-4 py-6">
          <EmptyState
            title="Unable to load student progress"
            description={error || 'Student data not found'}
            action={
              <Link
                href={`/lecturer/classes/${classId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-all hover:bg-muted/60"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Class
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const overallGrade = getGradeColor(student.quizProgress.averageScore);
  const completionRate = student.caseProgress.completionRate;

  return (
    <div className="min-h-screen bg-background">
      <Header
        title={student.studentName || 'Student Progress'}
        subtitle={`Progress details for ${student.email || 'student'}`}
      />

      <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/lecturer/classes" className="transition-colors hover:text-foreground">
            Classes
          </Link>
          <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
          <Link href={`/lecturer/classes/${classId}`} className="transition-colors hover:text-foreground">
            Class Details
          </Link>
          <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
          <span className="truncate text-foreground">{student.studentName}</span>
        </nav>

        <div className="mb-6">
          <Link
            href={`/lecturer/classes/${classId}`}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back to Class
          </Link>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
          {/* Student Header Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {(student.studentName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{student.studentName}</h1>
                  <p className="text-sm text-muted-foreground">
                    Enrolled: {new Date(student.enrolledAt).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${overallGrade.bg} ${overallGrade.text}`}>
                      <TrendingUp className="h-3 w-3" />
                      Overall: {student.quizProgress.averageScore.toFixed(1)}%
                    </span>
                    {student.lastActivity && (
                      <span className="text-xs text-muted-foreground">
                        Last active: {new Date(student.lastActivity).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
              <Award className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-foreground">{student.quizProgress.averageScore.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Overall Score</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
              <BookOpen className="w-6 h-6 mx-auto mb-2 text-warning" />
              <p className="text-2xl font-bold text-foreground">
                {student.quizProgress.completedQuizzes}/{student.quizProgress.totalQuizzes}
              </p>
              <p className="text-xs text-muted-foreground">Quizzes Done</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
              <Target className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-foreground">
                {student.caseProgress.viewedCases}/{student.caseProgress.totalAssignedCases}
              </p>
              <p className="text-xs text-muted-foreground">Cases Viewed</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
              <Clock className={`w-6 h-6 mx-auto mb-2 ${completionRate >= 70 ? 'text-success' : completionRate >= 40 ? 'text-warning' : 'text-destructive'}`} />
              <p className="text-2xl font-bold text-foreground">{completionRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Progress</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overall Progress
              </span>
              <span className="text-sm font-bold text-card-foreground">{completionRate.toFixed(0)}%</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getProgressColor(completionRate)}`}
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{student.caseProgress.completedCases} cases completed</span>
              <span>{student.caseProgress.totalAssignedCases - student.caseProgress.viewedCases} cases remaining</span>
            </div>
          </div>

          {/* Quiz Performance */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Quiz Performance
            </h2>
            {student.quizProgress.quizScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No quiz attempts yet</p>
            ) : (
              <div className="space-y-4">
                {/* Quiz Stats Summary */}
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Highest</p>
                    <p className="text-lg font-bold text-success">{student.quizProgress.highestScore.toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Average</p>
                    <p className="text-lg font-bold text-primary">{student.quizProgress.averageScore.toFixed(1)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Lowest</p>
                    <p className="text-lg font-bold text-destructive">{student.quizProgress.lowestScore.toFixed(0)}%</p>
                  </div>
                </div>
                {/* Quiz List */}
                <div className="space-y-3">
                  {student.quizProgress.quizScores.map((quiz) => {
                    const gradeConfig = getGradeColor(quiz.percentage);
                    return (
                      <div
                        key={quiz.quizId}
                        className={`p-4 rounded-lg border ${gradeConfig.border} ${gradeConfig.bg}`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-card-foreground">{quiz.quizTitle || 'Unknown Quiz'}</h4>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {quiz.topic && <span>Topic: {quiz.topic}</span>}
                              <span>Score: {quiz.score}/{quiz.maxScore}</span>
                              {quiz.completedAt && (
                                <span>{new Date(quiz.completedAt).toLocaleDateString('en-GB', {
                                  day: '2-digit', month: 'short', year: 'numeric'
                                })}</span>
                              )}
                              {quiz.isPassed ? (
                                <span className="flex items-center gap-1 text-success">
                                  <CheckCircle className="w-3 h-3" /> Passed
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-destructive">
                                  <XCircle className="w-3 h-3" /> Not Passed
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${gradeConfig.text}`}>{quiz.percentage.toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Cases Viewed */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Cases Viewed
            </h2>
            {student.caseProgress.recentCases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No cases viewed yet</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {student.caseProgress.recentCases.map((caseItem) => (
                  <div key={caseItem.caseId} className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-card-foreground">{caseItem.caseTitle || 'Unknown Case'}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Viewed: {caseItem.viewCount} time{caseItem.viewCount !== 1 ? 's' : ''}
                        </p>
                        {caseItem.viewedAt && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(caseItem.viewedAt).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </p>
                        )}
                      </div>
                      {caseItem.isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-success bg-success/10 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Competency Levels */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Competency Levels
            </h2>
            {student.competencyDetail.competencies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No competency data available</p>
            ) : (
              <div className="space-y-4">
                {/* Overall Competency */}
                <div className="p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-card-foreground">Overall Competency</span>
                    <span className={`text-lg font-bold ${
                      student.competencyDetail.overallCompetency >= 70 ? 'text-success' :
                      student.competencyDetail.overallCompetency >= 40 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {student.competencyDetail.overallCompetency.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        student.competencyDetail.overallCompetency >= 70 ? 'bg-success' :
                        student.competencyDetail.overallCompetency >= 40 ? 'bg-warning' : 'bg-destructive'
                      }`}
                      style={{ width: `${student.competencyDetail.overallCompetency}%` }}
                    />
                  </div>
                </div>
                {/* Individual Competencies */}
                <div className="space-y-3">
                  {student.competencyDetail.competencies.map((comp) => (
                    <div key={comp.competencyId} className="p-4 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-card-foreground">{comp.competencyName || 'Unknown'}</span>
                          <span className={`text-sm font-semibold ${getCompetencyColor(comp.level)}`}>
                            {comp.level}
                          </span>
                        </div>
                        <span className={`text-lg font-bold ${
                          comp.percentage >= 70 ? 'text-success' :
                          comp.percentage >= 40 ? 'text-warning' : 'text-destructive'
                        }`}>
                          {comp.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            comp.percentage >= 70 ? 'bg-success' :
                            comp.percentage >= 40 ? 'bg-warning' : 'bg-destructive'
                          }`}
                          style={{ width: `${comp.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Activity
            </h2>
            {student.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {student.recentActivities.map((activity, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.activityType === 'Quiz' ? 'bg-warning/10 text-warning' :
                      activity.activityType === 'CaseView' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {activity.activityType === 'Quiz' ? <BookOpen className="w-5 h-5" /> :
                       activity.activityType === 'CaseView' ? <Target className="w-5 h-5" /> :
                       <BarChart3 className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-card-foreground">{activity.description || activity.activityType}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {activity.score != null && (
                      <div className="text-right">
                        <span className={`text-sm font-bold ${
                          activity.score >= 60 ? 'text-success' : 'text-destructive'
                        }`}>
                          {activity.score.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
