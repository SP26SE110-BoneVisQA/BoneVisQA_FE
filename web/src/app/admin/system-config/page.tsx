'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, RotateCcw, Server, Database, Mail, Shield, Globe, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { systemConfigApi, type SystemConfigItem } from '@/lib/api/systemConfig';

interface SystemConfig {
  siteName: string;
  supportEmail: string;
  maxUploadSize: number;
  sessionTimeout: number;
  connectionPoolMin: number;
  connectionPoolMax: number;
  queryTimeout: number;
  smtpHost: string;
  smtpPort: string;
  fromEmail: string;
  emailNotifications: boolean;
  passwordMinLength: number;
  sessionDuration: number;
  maxLoginAttempts: number;
  timezone: string;
  dateFormat: string;
  language: string;
}

const DEFAULT_CONFIG: SystemConfig = {
  siteName: 'BoneVisQA',
  supportEmail: 'support@bonevisqa.com',
  maxUploadSize: 20,
  sessionTimeout: 30,
  connectionPoolMin: 0,
  connectionPoolMax: 15,
  queryTimeout: 120,
  smtpHost: 'smtp.gmail.com',
  smtpPort: '587',
  fromEmail: 'bonevisqasp26se110@gmail.com',
  emailNotifications: true,
  passwordMinLength: 6,
  sessionDuration: 60,
  maxLoginAttempts: 5,
  timezone: 'Asia/Ho_Chi_Minh',
  dateFormat: 'DD/MM/YYYY',
  language: 'vi',
};

export default function AdminSystemConfigPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setFetching(true);
    try {
      const data = await systemConfigApi.getAll();
      const newConfig: SystemConfig = { ...DEFAULT_CONFIG };

      Object.values(data).flat().forEach((item: SystemConfigItem) => {
        const key = item.key as keyof SystemConfig;
        if (key in newConfig) {
          if (item.type === 'number') {
            (newConfig as unknown as Record<string, unknown>)[key] = parseInt(item.value) || 0;
          } else if (item.type === 'boolean') {
            (newConfig as unknown as Record<string, unknown>)[key] = item.value === 'true';
          } else {
            (newConfig as unknown as Record<string, unknown>)[key] = item.value;
          }
        }
      });

      setConfig(newConfig);
    } catch {
      toast.error('Failed to load configuration');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const configs: SystemConfigItem[] = [
        { key: 'siteName', value: config.siteName, category: 'General', type: 'string' },
        { key: 'supportEmail', value: config.supportEmail, category: 'General', type: 'string' },
        { key: 'maxUploadSize', value: String(config.maxUploadSize), category: 'General', type: 'number' },
        { key: 'sessionTimeout', value: String(config.sessionTimeout), category: 'General', type: 'number' },
        { key: 'connectionPoolMin', value: String(config.connectionPoolMin), category: 'Database', type: 'number' },
        { key: 'connectionPoolMax', value: String(config.connectionPoolMax), category: 'Database', type: 'number' },
        { key: 'queryTimeout', value: String(config.queryTimeout), category: 'Database', type: 'number' },
        { key: 'smtpHost', value: config.smtpHost, category: 'Email', type: 'string' },
        { key: 'smtpPort', value: config.smtpPort, category: 'Email', type: 'string' },
        { key: 'fromEmail', value: config.fromEmail, category: 'Email', type: 'string' },
        { key: 'emailNotifications', value: String(config.emailNotifications), category: 'Email', type: 'boolean' },
        { key: 'passwordMinLength', value: String(config.passwordMinLength), category: 'Security', type: 'number' },
        { key: 'sessionDuration', value: String(config.sessionDuration), category: 'Security', type: 'number' },
        { key: 'maxLoginAttempts', value: String(config.maxLoginAttempts), category: 'Security', type: 'number' },
        { key: 'timezone', value: config.timezone, category: 'Regional', type: 'string' },
        { key: 'dateFormat', value: config.dateFormat, category: 'Regional', type: 'string' },
        { key: 'language', value: config.language, category: 'Regional', type: 'string' },
      ];

      await systemConfigApi.updateBatch(configs);
      toast.success('System configuration saved successfully.');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error('Failed to save configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await systemConfigApi.resetToDefaults();
      setConfig(DEFAULT_CONFIG);
      toast.info('Configuration reset to defaults.');
    } catch {
      toast.error('Failed to reset configuration.');
    }
  };

  const updateConfig = (key: keyof SystemConfig, value: string | number | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  if (fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header
        title={t('systemConfig.title', 'System Configuration')}
        subtitle={t('systemConfig.subtitle', 'Manage system-wide settings and parameters')}
      />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">General Settings</h2>
              <p className="text-sm text-muted-foreground">Basic system configuration</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Site Name</label>
              <input type="text" value={config.siteName} onChange={(e) => updateConfig('siteName', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Support Email</label>
              <input type="email" value={config.supportEmail} onChange={(e) => updateConfig('supportEmail', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Max Upload Size (MB)</label>
              <input type="number" value={config.maxUploadSize} onChange={(e) => updateConfig('maxUploadSize', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Session Timeout (minutes)</label>
              <input type="number" value={config.sessionTimeout} onChange={(e) => updateConfig('sessionTimeout', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Database className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Database Settings</h2>
              <p className="text-sm text-muted-foreground">Connection pool and query configuration</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Min Pool Size</label>
              <input type="number" value={config.connectionPoolMin} onChange={(e) => updateConfig('connectionPoolMin', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Max Pool Size</label>
              <input type="number" value={config.connectionPoolMax} onChange={(e) => updateConfig('connectionPoolMax', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Query Timeout (sec)</label>
              <input type="number" value={config.queryTimeout} onChange={(e) => updateConfig('queryTimeout', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <Mail className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Email Settings</h2>
              <p className="text-sm text-muted-foreground">SMTP and notification configuration</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">SMTP Host</label>
              <input type="text" value={config.smtpHost} onChange={(e) => updateConfig('smtpHost', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">SMTP Port</label>
              <input type="text" value={config.smtpPort} onChange={(e) => updateConfig('smtpPort', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">From Email</label>
              <input type="email" value={config.fromEmail} onChange={(e) => updateConfig('fromEmail', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <input type="checkbox" checked={config.emailNotifications} onChange={(e) => updateConfig('emailNotifications', e.target.checked)}
                  className="h-5 w-5 rounded border-border text-primary focus:ring-primary" />
                Enable Email Notifications
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Security Settings</h2>
              <p className="text-sm text-muted-foreground">Password and session security</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Min Password Length</label>
              <input type="number" value={config.passwordMinLength} onChange={(e) => updateConfig('passwordMinLength', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Session Duration (min)</label>
              <input type="number" value={config.sessionDuration} onChange={(e) => updateConfig('sessionDuration', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Max Login Attempts</label>
              <input type="number" value={config.maxLoginAttempts} onChange={(e) => updateConfig('maxLoginAttempts', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <Server className="h-5 w-5 text-success" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Regional Settings</h2>
              <p className="text-sm text-muted-foreground">Timezone and date formatting</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Timezone</label>
              <select value={config.timezone} onChange={(e) => updateConfig('timezone', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                <option value="Europe/London">Europe/London (UTC+0)</option>
                <option value="America/New_York">America/New_York (UTC-5)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Date Format</label>
              <select value={config.dateFormat} onChange={(e) => updateConfig('dateFormat', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Language</label>
              <select value={config.language} onChange={(e) => updateConfig('language', e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <button type="button" onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-input">
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </button>
          <Button onClick={handleSave} disabled={loading} isLoading={loading}>
            {!loading && <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
