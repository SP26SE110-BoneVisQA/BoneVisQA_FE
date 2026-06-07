'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import type { AdminCaseRow } from '@/lib/api/admin-cases';
import { caseOriginLabel } from '@/lib/case-origin';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

function difficultyClass(difficultyRaw: string): string {
  const d = difficultyRaw.trim().toLowerCase();
  if (d === 'advanced' || d === 'hard') return 'text-red-700';
  if (d === 'intermediate' || d === 'medium') return 'text-amber-700';
  if (d === 'basic' || d === 'easy') return 'text-emerald-700';
  return 'text-muted-foreground';
}

function originClass(origin: AdminCaseRow['caseOrigin']): string {
  return origin === 'fromStudentRequest'
    ? 'border-sky-200/80 bg-sky-50 text-sky-800'
    : 'border-violet-200/80 bg-violet-50 text-violet-800';
}

export function buildAdminCasesColumns(): ColumnDef<AdminCaseRow>[] {
  return [
    {
      id: 'case',
      header: 'Case',
      cell: ({ row }) => (
        <div className="min-w-[200px]">
          <p className="font-semibold leading-snug text-foreground">{row.original.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.original.id}</p>
        </div>
      ),
    },
    {
      accessorKey: 'boneLocation',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.boneLocation || '—'}</span>
      ),
    },
    {
      accessorKey: 'lesionType',
      header: 'Lesion',
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.lesionType || '—'}</span>
      ),
    },
    {
      accessorKey: 'difficulty',
      header: 'Difficulty',
      cell: ({ row }) => (
        <span className={`text-sm font-medium capitalize ${difficultyClass(row.original.difficulty)}`}>
          {row.original.difficulty || '—'}
        </span>
      ),
    },
    {
      id: 'origin',
      header: 'Source',
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${originClass(row.original.caseOrigin)}`}
        >
          {caseOriginLabel(row.original.caseOrigin)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 shadow-sm" asChild>
            <Link href={`/admin/cases/${row.original.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              View
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
