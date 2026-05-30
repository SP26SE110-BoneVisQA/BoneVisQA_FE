import { http } from '@/lib/api/client';

export interface SystemConfigItem {
  key: string;
  value: string;
  category: string;
  type: string;
}

export interface SystemConfigResponse {
  success: boolean;
  data?: Record<string, SystemConfigItem[]>;
  message?: string;
}

export interface UpdateConfigRequest {
  key: string;
  value: string;
}

export interface UpdateConfigBatchRequest {
  configs: SystemConfigItem[];
}

export const systemConfigApi = {
  getAll: async (): Promise<Record<string, SystemConfigItem[]>> => {
    const res = await http.get<SystemConfigResponse>('/api/admin/system-config');
    return res.data.data ?? {};
  },

  getByCategory: async (category: string): Promise<SystemConfigItem[]> => {
    const res = await http.get<{ success: boolean; data: SystemConfigItem[] }>(
      `/api/admin/system-config/category/${category}`
    );
    return res.data.data ?? [];
  },

  update: async (key: string, value: string): Promise<void> => {
    await http.put('/api/admin/system-config', { key, value } as UpdateConfigRequest);
  },

  updateBatch: async (configs: SystemConfigItem[]): Promise<void> => {
    await http.put('/api/admin/system-config/batch', { configs } as UpdateConfigBatchRequest);
  },

  resetToDefaults: async (): Promise<void> => {
    await http.post('/api/admin/system-config/reset');
  },
};
