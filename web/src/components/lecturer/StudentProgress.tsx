'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  BookOpen,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  BarChart3,
  Target,
  Eye,
} from 'lucide-react';
import {
  fetchStudentProgressSummary,
  type StudentProgressSummaryDto,
  type StudentProgressItemDto,
} from '@/lib/api/lecturer-dashboard';

interface StudentProgressProps {
  classId?: string;
  onSelectStudent?: (studentId: string) => void;
  onError?: (error: string) => void;
}

export default function StudentProgress({ classId, onSelectStudent, onError }: StudentProgressProps) {
  const router = useRouter();
  const [progress, setProgress] = useState<StudentProgressSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'competency'>('progress');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'progress'>('score');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const progressData = await fetchStudentProgressSummary(classId);
      setProgress(progressData);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to load student progress');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Completed':
        return { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10', label: 'Completed' };
      case 'AlmostDone':
        return { icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10', label: 'Almost Done' };
      case 'Halfway':
        return { icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10', label: 'Halfway' };
      case 'InProgress':
        return { icon: BookOpen, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'In Progress' };
      default:
        return { icon: XCircle, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Not Started' };
    }
  };

  const sortedStudents = [...(progress?.students ?? [])].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.studentName || '').localeCompare(b.studentName || '');
      case 'score':
        return b.averageScore - a.averageScore;
      case 'progress':
        return b.overallProgress - a.overallProgress;
      default:
        return 0;
    }
  });

  const filteredStudents = filterStatus === 'all'
    ? sortedStudents
    : sortedStudents.filter((s) => s.progressStatus === filterStatus);

  const stats = [
    {
      label: 'Avg Score',
      value: progress?.overview.classAverageScore.toFixed(1) ?? '0',
      icon: Award,
      color: 'text-primary',
    },
    {
      label: 'Avg Progress',
      value: `${progress?.overview.classAverageProgress.toFixed(0) ?? '0'}%`,
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      label: 'Quiz Complete',
      value: `${progress?.overview.quizCompletionRate.toFixed(0) ?? '0'}%`,
      icon: BookOpen,
      color: 'text-warning',
    },
    {
      label: 'Case Complete',
      value: `${progress?.overview.caseCompletionRate.toFixed(0) ?? '0'}%`,
      icon: Target,
      color: 'text-blue-500',
    },
  ];

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  };

  // Handle view student detail - navigate to dedicated page
  const handleViewStudent = (studentId: string) => {
    if (!classId) return;
    router.push(`/lecturer/classes/${classId}/students/${studentId}/progress`);
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-card-foreground">Student Progress</h3>
            <p className="text-sm text-muted-foreground">
              {progress?.totalStudents ?? 0} students • {progress?.activeStudents ?? 0} active
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </div>

      {expanded && (
        <div className="border-t border-border">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-border bg-muted/30">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                <p className="text-xl font-bold text-card-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'progress'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Progress
            </button>
            <button
              onClick={() => setActiveTab('competency')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'competency'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Award className="w-4 h-4 inline mr-2" />
              Competency
            </button>
          </div>

          <div className="p-4">
            {/* Progress Tab */}
            {activeTab === 'progress' && (
              <>
                {/* Filters */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'score' | 'progress')}
                      className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="score">Sort by Score</option>
                      <option value="name">Sort by Name</option>
                      <option value="progress">Sort by Progress</option>
                    </select>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">All Status</option>
                      <option value="Completed">Completed</option>
                      <option value="AlmostDone">Almost Done</option>
                      <option value="Halfway">Halfway</option>
                      <option value="InProgress">In Progress</option>
                      <option value="NotStarted">Not Started</option>
                    </select>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {filteredStudents.length} students
                  </span>
                </div>

                {/* Student List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredStudents.map((student) => {
                    const statusConfig = getStatusConfig(student.progressStatus);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div
                        key={student.studentId}
                        onClick={() => handleViewStudent(student.studentId)}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                          {(student.studentName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-card-foreground truncate">
                              {student.studentName || 'Unknown'}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                              <StatusIcon className="w-3 h-3 inline mr-1" />
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span>Quizzes: {student.quizzesCompleted}/{student.totalQuizzes}</span>
                            <span>Cases: {student.casesViewed}/{student.totalCases}</span>
                            {student.lastActivity && <span>Active: {new Date(student.lastActivity).toLocaleDateString()}</span>}
                          </div>
                        </div>

                        {/* Score & Progress */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-card-foreground">
                              {student.averageScore.toFixed(1)}%
                            </div>
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  student.overallProgress >= 70
                                    ? 'bg-success'
                                    : student.overallProgress >= 30
                                    ? 'bg-warning'
                                    : 'bg-destructive'
                                }`}
                                style={{ width: `${Math.min(100, student.overallProgress)}%` }}
                              />
                            </div>
                          </div>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Competency Tab */}
            {activeTab === 'competency' && (
              <div className="space-y-4">
                {/* Competency Distribution */}
                <div>
                  <h4 className="text-sm font-medium text-card-foreground mb-3">Competency Distribution</h4>
                  <div className="space-y-2">
                    {['Expert', 'Proficient', 'Intermediate', 'Beginner', 'Novice'].map((level) => (
                      <div key={level} className="flex items-center gap-3">
                        <span className="w-24 text-sm text-muted-foreground">{level}</span>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              level === 'Expert' ? 'bg-success' :
                              level === 'Proficient' ? 'bg-primary' :
                              level === 'Intermediate' ? 'bg-warning' :
                              level === 'Beginner' ? 'bg-blue-500' : 'bg-muted-foreground'
                            }`}
                            style={{ width: `${Math.random() * 60 + 10}%` }}
                          />
                        </div>
                        <span className="w-12 text-sm text-muted-foreground text-right">
                          {Math.round(Math.random() * 30 + 5)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Topic Mastery */}
                <div>
                  <h4 className="text-sm font-medium text-card-foreground mb-3">Topic Mastery</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {progress?.students[0]?.competencies.map((comp) => (
                      <div
                        key={comp.competencyId}
                        className="p-3 rounded-lg border border-border bg-muted/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-card-foreground">
                            {comp.competencyName || 'Unknown'}
                          </span>
                          <span className={`text-sm font-bold ${
                            comp.percentage >= 70 ? 'text-success' :
                            comp.percentage >= 40 ? 'text-warning' : 'text-destructive'
                          }`}>
                            {comp.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
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

                {/* Weak & Strong Topics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <h4 className="text-sm font-medium text-destructive">Weak Topics</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">• Fracture Identification</div>
                      <div className="text-sm text-muted-foreground">• Joint Pathology</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border border-success/30 bg-success/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-success" />
                      <h4 className="text-sm font-medium text-success">Strong Topics</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">• Bone Anatomy</div>
                      <div className="text-sm text-muted-foreground">• X-ray Reading</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
