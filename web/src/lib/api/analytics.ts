import { http } from './client';

export interface StudentCompetency {
  id: string;
  studentId: string;
  boneSpecialtyId: string | null;
  pathologyCategoryId: string | null;
  score: number;
  totalAttempts: number;
  correctAttempts: number;
  masteryLevel: string;
  lastAttemptAt: string | null;
  boneSpecialty?: { id: string; name: string };
  pathologyCategory?: { id: string; name: string };
}

export interface ErrorPattern {
  id: string;
  studentId: string;
  questionPattern: string | null;
  errorTopic: string | null;
  errorCount: number;
  topicHint: string | null;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string | null;
}

export interface LearningInsight {
  id: string;
  studentId: string;
  insightType: string;
  title: string;
  description: string | null;
  confidence: number;
  relatedBoneSpecialtyId: string | null;
  relatedPathologyId: string | null;
  recommendedAction: string | null;
  isRead: boolean;
  isActionTaken: boolean;
  createdAt: string | null;
  relatedBoneSpecialty?: { id: string; name: string };
  relatedPathology?: { id: string; name: string };
}

export interface StudentDashboardData {
  competencies: StudentCompetency[];
  errorPatterns: ErrorPattern[];
  insights: LearningInsight[];
  summary: {
    averageScore: number;
    totalQuizzes: number;
    weakTopicCount: number;
    activeErrorPatterns: number;
  };
}

export const analyticsApi = {
  getStudentCompetencies: async (): Promise<StudentCompetency[]> => {
    const { data } = await http.get<StudentCompetency[]>('/api/analytics/student/competencies');
    return data;
  },

  getStudentErrorPatterns: async (): Promise<ErrorPattern[]> => {
    const { data } = await http.get<ErrorPattern[]>('/api/analytics/student/error-patterns');
    return data;
  },

  getStudentInsights: async (): Promise<LearningInsight[]> => {
    const { data } = await http.get<LearningInsight[]>('/api/analytics/student/insights');
    return data;
  },

  getStudentDashboard: async (): Promise<StudentDashboardData> => {
    const { data } = await http.get<StudentDashboardData>('/api/analytics/student/dashboard');
    return data;
  },

  markInsightAsRead: async (insightId: string): Promise<void> => {
    await http.post(`/api/analytics/student/insights/${insightId}/read`);
  },

  markInsightAsActionTaken: async (insightId: string): Promise<void> => {
    await http.post(`/api/analytics/student/insights/${insightId}/action`);
  },

  resolveErrorPattern: async (patternId: string): Promise<void> => {
    await http.post(`/api/analytics/student/error-patterns/${patternId}/resolve`);
  },

  analyzeQuizAttempt: async (attemptId: string): Promise<void> => {
    await http.post(`/api/analytics/quiz-attempt/${attemptId}/analyze`);
  },
};
