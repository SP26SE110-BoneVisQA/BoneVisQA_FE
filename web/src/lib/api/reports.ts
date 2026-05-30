import { http } from '@/lib/api/client';

export interface ReportStats {
  totalUsers: number;
  activeCases: number;
  totalQuizzes: number;
  totalQASessions: number;
  avgSessionDuration: number;
  completionRate: number;
}

export interface ReportData {
  period: string;
  activeUsers: number;
  newRegistrations: number;
  casesViewed: number;
  quizzesTaken: number;
  aiQuestions: number;
  avgQuizScore: number;
  stats: ReportStats;
}

export interface TopCase {
  title: string;
  views: number;
  completions: number;
  score?: number;
}

export interface TopQuiz {
  topic: string;
  attempts: number;
  avgScore: number;
  passRate?: number;
}

export interface ReportResponse {
  success: boolean;
  data?: ReportData;
}

export interface TopCasesResponse {
  success: boolean;
  data?: TopCase[];
}

export interface TopQuizzesResponse {
  success: boolean;
  data?: TopQuiz[];
}

export const reportsApi = {
  getReport: async (period: string = '30d'): Promise<ReportData | null> => {
    const res = await http.get<ReportResponse>('/api/admin/reports', { params: { period } });
    return res.data.data ?? null;
  },

  getStats: async (period: string = '30d'): Promise<ReportStats | null> => {
    const res = await http.get<{ success: boolean; data: ReportStats }>('/api/admin/reports/stats', {
      params: { period },
    });
    return res.data.data ?? null;
  },

  getTopCases: async (period: string = '30d', limit: number = 10): Promise<TopCase[]> => {
    const res = await http.get<TopCasesResponse>('/api/admin/reports/top-cases', {
      params: { period, limit },
    });
    return res.data.data ?? [];
  },

  getTopQuizzes: async (period: string = '30d', limit: number = 10): Promise<TopQuiz[]> => {
    const res = await http.get<TopQuizzesResponse>('/api/admin/reports/top-quizzes', {
      params: { period, limit },
    });
    return res.data.data ?? [];
  },

  getUserActivity: async (period: string = '30d') => {
    const res = await http.get<{ success: boolean; data: unknown }>('/api/admin/reports/user-activity', {
      params: { period },
    });
    return res.data.data;
  },

  exportReport: async (period: string = '30d', format: 'csv' | 'json' = 'csv') => {
    const res = await http.get('/api/admin/reports/export', {
      params: { period, format },
      responseType: format === 'json' ? 'json' : 'blob',
    });
    return res.data;
  },
};
