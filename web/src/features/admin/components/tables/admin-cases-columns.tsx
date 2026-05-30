'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import type { AdminCaseRow } from '@/lib/api/admin-cases';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

function statusClass(statusRaw: string): string {
  const s = statusRaw.trim().toLowerCase();
  if (s === 'approved' || s === 'completed') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (s === 'pending') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (s === 'hidden') return 'border-slate-300 bg-slate-100 text-slate-700';
  if (s === 'rejected' || s === 'failed') return 'border-red-300 bg-red-50 text-red-700';
  return 'border-border bg-muted text-muted-foreground';
}

export function buildAdminCasesColumns(): ColumnDef<AdminCaseRow>[] {
  return [
    {
      id: 'case',
      header: 'Case',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.id}</p>
        </div>
      ),
    },
    { accessorKey: 'boneLocation', header: 'Location' },
    { accessorKey: 'lesionType', header: 'Lesion' },
    { accessorKey: 'difficulty', header: 'Difficulty' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(row.original.status)}`}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-right">Actions</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <Link href={`/admin/cases/${row.original.id}`}>
            <Button type="button" variant="outline" size="sm">
              <Eye className="h-3.5 w-3.5" />
              Open
            </Button>
          </Link>
        </div>
      ),
    },
  ];
}
