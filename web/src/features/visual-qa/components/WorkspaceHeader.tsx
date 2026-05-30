'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VisualQaFlow } from '@/features/visual-qa/store/visual-qa-store';

type WorkspaceHeaderProps = {
  title: string;
  flow: VisualQaFlow | null;
  turnLabel?: string | null;
};

export function WorkspaceHeader({ title, flow, turnLabel }: WorkspaceHeaderProps) {
  const flowBadge =
    flow === 'personal' ? (
      <Badge className="bg-amber-500/15 text-amber-900 border-amber-300/60">
        <Upload className="mr-1 h-3 w-3" aria-hidden />
        Personal DICOM
      </Badge>
    ) : flow === 'catalog' ? (
      <Badge className="bg-primary/10 text-primary border-primary/30">
        <BookOpen className="mr-1 h-3 w-3" aria-hidden />
        Case library
      </Badge>
    ) : null;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/student/dashboard"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {flowBadge}
        {turnLabel ? (
          <span className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {turnLabel}
          </span>
        ) : null}
      </div>
    </header>
  );
}
