'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { PendingVerification } from '@/lib/api/admin-users';
import { Button } from '@/components/ui/button';
import { Check, Loader2, X } from 'lucide-react';

function formatSubmittedAt(value: string | null): string {
  if (!value?.trim()) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildAdminVerificationsColumns(actions: {
  busyUserId: string | null;
  isPending: boolean;
  onApprove: (row: PendingVerification) => void;
  onReject: (row: PendingVerification) => void;
}): ColumnDef<PendingVerification>[] {
  return [
    {
      accessorKey: 'fullName',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.fullName || '—'}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      id: 'medicalSchool',
      header: 'Medical school',
      cell: ({ row }) => row.original.medicalSchool?.trim() || '—',
    },
    {
      id: 'studentId',
      header: 'Student ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.medicalStudentId?.trim() || '—'}</span>
      ),
    },
    {
      id: 'cohort',
      header: 'Cohort',
      cell: ({ row }) => row.original.schoolCohort?.trim() || '—',
    },
    {
      id: 'submitted',
      header: 'Submitted',
      cell: ({ row }) => formatSubmittedAt(row.original.createdAt),
    },
    {
      id: 'actions',
      header: () => <span className="text-right">Actions</span>,
      cell: ({ row }) => {
        const busy = actions.busyUserId === row.original.userId && actions.isPending;
        return (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-emerald-600/40 text-emerald-800"
              disabled={busy}
              onClick={() => actions.onApprove(row.original)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={busy}
              onClick={() => actions.onReject(row.original)}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
          </div>
        );
      },
    },
  ];
}
