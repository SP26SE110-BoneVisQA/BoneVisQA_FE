'use client';

import React from 'react';
import {
  X,
  Award,
  BookOpen,
  Target,
  Clock,
  Star,
  Calendar,
  BarChart3,
} from 'lucide-react';
import {
  type StudentProgressDetailDto,
} from '@/lib/api/lecturer-dashboard';

interface StudentProgressDetailProps {
  student: StudentProgressDetailDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentProgressDetail({ student, isOpen, onClose }: StudentProgressDetailProps) {
  if (!isOpen || !student) return null;

  const getGradeColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' };
    if (score >= 60) return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' };
    if (score >= 40) return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' };
    return { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' };
  };

  const getCompetencyColor = (level: string) => {
    switch (level) {
      case 'Expert': return 'text-success';
      case 'Proficient': return 'text-primary';
      case 'Intermediate': return 'text-warning';
      case 'Beginner': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  const overallGrade = getGradeColor(student.quizProgress.averageScore);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {(student.studentName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-card-foreground">{student.studentName}</h2>
              <p className="text-sm text-muted-foreground">Student ID: {student.studentId}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 text-xs rounded-full ${overallGrade.bg} ${overallGrade.text}`}>
                  Overall: {student.quizProgress.averageScore.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  Enrolled: {new Date(student.enrolledAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
              <Award className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-card-foreground">{student.quizProgress.averageScore.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Overall Score</p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
              <BookOpen className="w-6 h-6 mx-auto mb-2 text-warning" />
              <p className="text-2xl font-bold text-card-foreground">{student.quizProgress.completedQuizzes}/{student.quizProgress.totalQuizzes}</p>
              <p className="text-xs text-muted-foreground">Quizzes Done</p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-card-foreground">{student.caseProgress.viewedCases}/{student.caseProgress.totalAssignedCases}</p>
              <p className="text-xs text-muted-foreground">Cases Viewed</p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-success" />
              <p className="text-2xl font-bold text-card-foreground">{student.caseProgress.completionRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Progress</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-card-foreground">Overall Progress</span>
              <span className="text-sm font-bold text-card-foreground">{student.caseProgress.completionRate.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  student.caseProgress.completionRate >= 70 ? 'bg-success' :
                  student.caseProgress.completionRate >= 40 ? 'bg-warning' : 'bg-destructive'
                }`}
                style={{ width: `${student.caseProgress.completionRate}%` }}
              />
            </div>
          </div>

          {/* Quiz Scores Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Quiz Performance
            </h3>
            {student.quizProgress.quizScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No quiz attempts yet</p>
            ) : (
              <div className="space-y-3">
                {student.quizProgress.quizScores.map((quiz) => {
                  const gradeConfig = getGradeColor(quiz.percentage);
                  return (
                    <div
                      key={quiz.quizId}
                      className={`p-4 rounded-lg border ${gradeConfig.border} ${gradeConfig.bg}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-card-foreground">{quiz.quizTitle}</h4>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Score: {quiz.score}/{quiz.maxScore}</span>
                            <span>{quiz.completedAt && new Date(quiz.completedAt).toLocaleDateString()}</span>
                            {quiz.isPassed ? (
                              <span className="text-success">Passed</span>
                            ) : (
                              <span className="text-destructive">Not Passed</span>
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
            )}
          </div>

          {/* Cases Viewed Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Cases Viewed
            </h3>
            {student.caseProgress.recentCases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No cases viewed yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {student.caseProgress.recentCases.map((caseItem) => (
                  <div key={caseItem.caseId} className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-card-foreground text-sm">{caseItem.caseTitle}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Viewed: {caseItem.viewCount} time{caseItem.viewCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {caseItem.viewedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(caseItem.viewedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {caseItem.isCompleted && (
                      <span className="inline-block mt-2 text-xs text-success">Completed</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Competency Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Competency Levels
            </h3>
            <div className="space-y-3">
              {student.competencyDetail.competencies.map((comp) => (
                <div key={comp.competencyId} className="p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-card-foreground">{comp.competencyName}</span>
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

          {/* Recent Activity */}
          <div>
            <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Activity
            </h3>
            {student.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {student.recentActivities.map((activity, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === 'quiz' ? 'bg-warning/10 text-warning' :
                      activity.type === 'case' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {activity.type === 'quiz' ? <BookOpen className="w-4 h-4" /> :
                       activity.type === 'case' ? <Target className="w-4 h-4" /> :
                       <BarChart3 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-card-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                    </div>
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
