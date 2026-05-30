import { http } from '@/lib/api/client';

export interface BackupRecord {
  id: string;
  name: string;
  type: string;
  size: string;
  status: string;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  name: string;
  format: string;
  records: number;
  createdAt: string;
}

export interface StorageInfo {
  used: number;
  total: number;
  breakdown: {
    documents: number;
    images: number;
    backups: number;
    other: number;
  };
}

export interface BackupsResponse {
  success: boolean;
  data?: {
    items: BackupRecord[];
    total: number;
    pageIndex: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ExportsResponse {
  success: boolean;
  data?: {
    items: ExportRecord[];
    total: number;
    pageIndex: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface StorageResponse {
  success: boolean;
  data?: StorageInfo;
}

export interface CreateBackupRequest {
  type?: string;
}

export interface ExportDataRequest {
  type: string;
  format: 'csv' | 'json';
}

export const backupApi = {
  getBackups: async (params?: {
    pageIndex?: number;
    pageSize?: number;
  }): Promise<BackupsResponse['data']> => {
    const res = await http.get<BackupsResponse>('/api/admin/backup/backups', { params });
    return res.data.data;
  },

  getExports: async (params?: {
    pageIndex?: number;
    pageSize?: number;
  }): Promise<ExportsResponse['data']> => {
    const res = await http.get<ExportsResponse>('/api/admin/backup/exports', { params });
    return res.data.data;
  },

  getStorage: async (): Promise<StorageInfo | null> => {
    const res = await http.get<StorageResponse>('/api/admin/backup/storage');
    return res.data.data ?? null;
  },

  createBackup: async (request?: CreateBackupRequest): Promise<BackupRecord> => {
    const res = await http.post<{ success: boolean; data: BackupRecord }>('/api/admin/backup/create', request);
    return res.data.data!;
  },

  deleteBackup: async (id: string): Promise<void> => {
    await http.delete(`/api/admin/backup/backups/${id}`);
  },

  exportData: async (request: ExportDataRequest): Promise<ExportRecord> => {
    const res = await http.post<{ success: boolean; data: ExportRecord }>('/api/admin/backup/export', request);
    return res.data.data!;
  },

  downloadExport: async (id: string): Promise<Blob> => {
    const res = await http.get(`/api/admin/backup/download/${id}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
