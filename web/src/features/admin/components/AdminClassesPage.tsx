'use client';

import { useState } from 'react';
import { Plus, X, BookOpen, Loader2 } from 'lucide-react';
import { ListPageLayout } from '@/components/layouts';
import { ClassManagementTable } from '@/components/admin/classes/ClassManagementTable';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useAdminClasses,
  useCreateAdminClass,
  useDeleteAdminClass,
  useUpdateAdminClass,
  type AdminClassModel,
} from '@/features/admin/queries/use-admin-classes';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';

export function AdminClassesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSemester, setNewSemester] = useState('');
  const [editTarget, setEditTarget] = useState<AdminClassModel | null>(null);
  const [editName, setEditName] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminClassModel | null>(null);

  const classesQuery = useAdminClasses();
  const createMutation = useCreateAdminClass();
  const updateMutation = useUpdateAdminClass();
  const deleteMutation = useDeleteAdminClass();

  const classes = classesQuery.data ?? [];
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleCreate = async () => {
    if (!newClassName.trim() || !newSemester.trim()) {
      appToast.error('Please enter both class name and semester.');
      return;
    }
    try {
      await createMutation.mutateAsync({
        className: newClassName.trim(),
        semester: newSemester.trim(),
      });
      appToast.success('Class created successfully.');
      setCreateOpen(false);
      setNewClassName('');
      setNewSemester('');
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Failed to create class.');
    }
  };

  const openEdit = (cls: AdminClassModel) => {
    setEditTarget(cls);
    setEditName(cls.className);
    setEditSemester(cls.semester);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim() || !editSemester.trim()) {
      appToast.error('Please enter both class name and semester.');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        className: editName.trim(),
        semester: editSemester.trim(),
      });
      appToast.success('Class updated successfully.');
      setEditTarget(null);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Failed to update class.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      appToast.success('Class deleted successfully.');
      setDeleteTarget(null);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Failed to delete class.');
    }
  };

  return (
    <ListPageLayout
      title="Class management"
      isLoading={classesQuery.isPending}
      error={
        classesQuery.error
          ? getQueryErrorMessage(classesQuery.error, 'Failed to load classes.')
          : null
      }
      maxWidthClass="max-w-[1600px]"
      actions={
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create class
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">{classes.length} classes in the registry.</p>

      <ClassManagementTable
        classes={classes}
        onEdit={openEdit}
        onDelete={(cls) => setDeleteTarget(cls)}
      />

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (!saving) setCreateOpen(false);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                if (!saving) setCreateOpen(false);
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Create class</h3>
                <p className="text-sm text-muted-foreground">Adds a new class to the system registry.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Class name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. radioly"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Semester <span className="text-destructive">*</span>
                </label>
                <Input
                  value={newSemester}
                  onChange={(e) => setNewSemester(e.target.value)}
                  placeholder="e.g. Fall 2026"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={saving}
                onClick={() => {
                  if (!saving) setCreateOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleCreate()}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (!saving) setEditTarget(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                if (!saving) setEditTarget(null);
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Edit class</h3>
                <p className="break-all font-mono text-xs text-muted-foreground">{editTarget.id}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Class name <span className="text-destructive">*</span>
                </label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Semester <span className="text-destructive">*</span>
                </label>
                <Input value={editSemester} onChange={(e) => setEditSemester(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={saving}
                onClick={() => {
                  if (!saving) setEditTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSaveEdit()}>
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DestructiveConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete class"
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </ListPageLayout>
  );
}
