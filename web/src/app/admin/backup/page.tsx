'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Database, FileText, Image, Users, Trash2, RefreshCw, CheckCircle, Clock, AlertCircle, HardDrive, Loader2, Plus } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { backupApi, type BackupRecord, type ExportRecord, type StorageInfo } from '@/lib/api/backup';

export default function AdminBackupPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [backupsData, exportsData, storageData] = await Promise.all([
        backupApi.getBackups(),
        backupApi.getExports(),
        backupApi.getStorage(),
      ]);

      if (backupsData) {
        setBackups(backupsData.items);
      }
      if (exportsData) {
        setExports(exportsData.items);
      }
      if (storageData) {
        setStorage(storageData);
      }
    } catch (error) {
      console.error('Failed to fetch backup data:', error);
      toast.error('Failed to load backup data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setBackupProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      const newBackup = await backupApi.createBackup();
      clearInterval(progressInterval);
      setBackupProgress(100);

      setBackups((prev) => [newBackup, ...prev]);
      toast.success('Backup completed successfully!');

      setTimeout(() => {
        setIsBackingUp(false);
        setBackupProgress(0);
      }, 1000);
    } catch {
      toast.error('Failed to create backup');
      setIsBackingUp(false);
      setBackupProgress(0);
    }
  };

  const handleExport = async (type: string, format: 'csv' | 'json') => {
    try {
      await backupApi.exportData({ type, format });
      toast.success(`Exporting ${type} data as ${format.toUpperCase()}...`);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;

    try {
      await backupApi.deleteBackup(id);
      setBackups((prev) => prev.filter((b) => b.id !== id));
      toast.success('Backup deleted successfully.');
    } catch {
      toast.error('Failed to delete backup');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const storagePercent = storage ? (storage.used / storage.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header
        title={t('backup.title', 'Backup & Export')}
        subtitle={t('backup.subtitle', 'Manage data backups and exports')}
      />

      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Storage Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <HardDrive className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">Storage Usage</h2>
                  <p className="text-sm text-muted-foreground">
                    {storage ? `${formatBytes(storage.used)} of ${formatBytes(storage.total)} used` : 'Loading...'}
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold text-primary">{storagePercent.toFixed(1)}%</p>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${storagePercent}%` }} />
            </div>
            {storage && (
              <div className="mt-4 grid grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <p className="font-semibold text-card-foreground">{formatBytes(storage.breakdown.documents)}</p>
                  <p className="text-muted-foreground">Documents</p>
                </div>
                <div>
                  <p className="font-semibold text-card-foreground">{formatBytes(storage.breakdown.images)}</p>
                  <p className="text-muted-foreground">Images</p>
                </div>
                <div>
                  <p className="font-semibold text-card-foreground">{formatBytes(storage.breakdown.backups)}</p>
                  <p className="text-muted-foreground">Backups</p>
                </div>
                <div>
                  <p className="font-semibold text-card-foreground">{formatBytes(storage.breakdown.other)}</p>
                  <p className="text-muted-foreground">Other</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-card-foreground">Quick Actions</h3>
              <div className="space-y-3">
                <Button className="w-full justify-start" onClick={handleBackup} disabled={isBackingUp}>
                  {isBackingUp ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Backing up... {backupProgress}%
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Create Full Backup
                    </>
                  )}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="mr-2 h-4 w-4" />
                  Restore from Backup
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Backup Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-card-foreground">System Backups</h2>
                <p className="text-sm text-muted-foreground">Automated and manual backups</p>
              </div>
            </div>
            <Button onClick={handleBackup} disabled={isBackingUp}>
              <Plus className="mr-2 h-4 w-4" />
              New Backup
            </Button>
          </div>

          {isBackingUp && (
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-primary">Creating backup...</span>
                <span className="text-sm text-muted-foreground">{backupProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${backupProgress}%` }} />
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Backup Name</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Type</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Size</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Created</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-muted/30">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-card-foreground">{backup.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground capitalize">{backup.type.replace('_', ' ')}</td>
                    <td className="py-3 text-sm text-muted-foreground">{backup.size}</td>
                    <td className="py-3 text-sm text-muted-foreground">{backup.createdAt}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        backup.status === 'completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                        {backup.status === 'completed' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {backup.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteBackup(backup.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <Download className="h-6 w-6 text-accent" />
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">Data Export</h2>
              <p className="text-sm text-muted-foreground">Export data in various formats</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ExportCard icon={Users} title="Users Data" description="Export all user accounts and profiles" onExportCsv={() => handleExport('users', 'csv')} onExportJson={() => handleExport('users', 'json')} />
            <ExportCard icon={FileText} title="Cases Data" description="Export all medical cases and metadata" onExportCsv={() => handleExport('cases', 'csv')} onExportJson={() => handleExport('cases', 'json')} />
            <ExportCard icon={Image} title="Documents" description="Export knowledge base documents" onExportCsv={() => handleExport('documents', 'csv')} onExportJson={() => handleExport('documents', 'json')} />
            <ExportCard icon={FileText} title="Quizzes" description="Export quiz questions and results" onExportCsv={() => handleExport('quizzes', 'csv')} onExportJson={() => handleExport('quizzes', 'json')} />
            <ExportCard icon={Database} title="Q&A Sessions" description="Export AI Q&A conversation history" onExportCsv={() => handleExport('qa_sessions', 'csv')} onExportJson={() => handleExport('qa_sessions', 'json')} />
            <ExportCard icon={Database} title="Full Export" description="Export all platform data" onExportCsv={() => handleExport('all', 'csv')} onExportJson={() => handleExport('all', 'json')} />
          </div>
        </div>

        {/* Recent Exports */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <FileText className="h-6 w-6 text-warning" />
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">Recent Exports</h2>
              <p className="text-sm text-muted-foreground">Your recent data exports</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Export Name</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Format</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Records</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">Created</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exports.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/30">
                    <td className="py-3 text-sm font-medium text-card-foreground">{exp.name}</td>
                    <td className="py-3">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase text-muted-foreground">{exp.format}</span>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">{exp.records.toLocaleString()}</td>
                    <td className="py-3 text-sm text-muted-foreground">{exp.createdAt}</td>
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportCard({ icon: Icon, title, description, onExportCsv, onExportJson }: { icon: React.ElementType; title: string; description: string; onExportCsv: () => void; onExportJson: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-card-foreground">{title}</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onExportCsv}>CSV</Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={onExportJson}>JSON</Button>
      </div>
    </div>
  );
}
