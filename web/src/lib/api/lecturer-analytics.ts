import { http } from './client';

export interface ClassOverview {
  classId: string;
  className: string;
  totalStudents: number;
  activeStudents: number;
  averageScore: number;
  completionRate: number;
  atRiskStudentCount: number;
  totalQuizzes: number;
  topicAverages: Record<string, number>;
}

export interface StudentAnalytics {
  studentId: string;
  studentName: string;
  studentEmail: string;
  averageScore: number;
  totalQuizzesTaken: number;
  masteryLevel: string;
  competencies: CompetencyItem[];
  errorPatterns: ErrorPatternItem[];
  recentQuizzes: RecentQuizResult[];
  isAtRisk: boolean;
}

export interface CompetencyItem {
  boneSpecialtyId: string | null;
  topicName: string;
  score: number;
  masteryLevel: string;
  totalAttempts: number;
}

export interface ErrorPatternItem {
  patternId: string;
  topic: string;
  errorCount: number;
  isResolved: boolean;
}

export interface RecentQuizResult {
  quizId: string;
  quizTitle: string;
  score: number | null;
  completedAt: string | null;
  correctAnswers: number;
  totalQuestions: number;
}

export const lecturerAnalyticsApi = {
  getClassOverview: async (classId: string): Promise<ClassOverview> => {
    const { data } = await http.get<ClassOverview>(`/api/analytics/lecturer/class/${classId}/overview`);
    return data;
  },

  getClassStudents: async (classId: string): Promise<StudentAnalytics[]> => {
    const { data } = await http.get<StudentAnalytics[]>(`/api/analytics/lecturer/class/${classId}/students`);
    return data;
  },

  getStudentAnalytics: async (studentId: string): Promise<StudentAnalytics> => {
    const { data } = await http.get<StudentAnalytics>(`/api/analytics/lecturer/student/${studentId}`);
    return data;
  },

  getAtRiskStudents: async (classId: string): Promise<StudentAnalytics[]> => {
    const { data } = await http.get<StudentAnalytics[]>(`/api/analytics/lecturer/class/${classId}/at-risk`);
    return data;
  },

  getErrorDistribution: async (classId: string): Promise<Record<string, number>> => {
    const { data } = await http.get<Record<string, number>>(`/api/analytics/lecturer/class/${classId}/error-distribution`);
    return data;
  },

  getCompetencyMatrix: async (classId: string): Promise<Record<string, Record<string, number>>> => {
    const { data } = await http.get<Record<string, Record<string, number>>>(`/api/analytics/lecturer/class/${classId}/competency-matrix`);
    return data;
  },

  getMyClasses: async (): Promise<{ id: string; className: string; semester: string | null; studentCount: number }[]> => {
    const { data } = await http.get<{ id: string; className: string; semester: string | null; studentCount: number }[]>('/api/analytics/lecturer/my-classes');
    return data;
  },
};
