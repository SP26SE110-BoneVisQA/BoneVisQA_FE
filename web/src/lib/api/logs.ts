import { http } from '@/lib/api/client';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'Info' | 'Warning' | 'Error' | 'Success';
  category: string;
  message: string;
  user?: string;
  ip?: string;
}

export interface LogsResponse {
  success: boolean;
  data?: {
    items: LogEntry[];
    total: number;
    pageIndex: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface LogsStats {
  total: number;
  errors: number;
  warnings: number;
  today: number;
  todayErrors?: number;
  todayWarnings?: number;
}

export interface LogsStatsResponse {
  success: boolean;
  data?: LogsStats;
}

export const logsApi = {
  getLogs: async (params?: {
    search?: string;
    level?: string;
    category?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<LogsResponse['data']> => {
    const res = await http.get<LogsResponse>('/api/admin/logs', { params });
    return res.data.data;
  },

  getStats: async (): Promise<LogsStats> => {
    const res = await http.get<LogsStatsResponse>('/api/admin/logs/stats');
    return res.data.data ?? { total: 0, errors: 0, warnings: 0, today: 0 };
  },

  getLevels: async (): Promise<string[]> => {
    const res = await http.get<{ success: boolean; data: string[] }>('/api/admin/logs/levels');
    return res.data.data ?? [];
  },

  getCategories: async (): Promise<string[]> => {
    const res = await http.get<{ success: boolean; data: string[] }>('/api/admin/logs/categories');
    return res.data.data ?? [];
  },
};
