'use client';

import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StudentCaseCatalogDetail } from '@/lib/api/types';
import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';
import { dicomMetadataToDisplayRows } from '@/lib/api/visual-qa/dicom-metadata';
import type { VisualQaFlow } from '@/features/visual-qa/store/visual-qa-store';
import { Archive, BookOpen, RotateCcw, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';

type PersonalMeta = {
  fileName?: string;
  uploadedAt?: string;
  sessionId?: string;
  dicomMetadata?: VisualQaDicomMetadata | null;
};

type WorkspaceContextPanelProps = {
  flow: VisualQaFlow;
  caseDetail: StudentCaseCatalogDetail | null;
  personalMeta?: PersonalMeta | null;
  onResetPersonal?: () => void;
  layout?: 'overlay' | 'docked';
  className?: string;
};

function formatUploadedAt(iso?: string): string {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Just now';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WorkspaceContextPanel({
  flow,
  caseDetail,
  personalMeta,
  onResetPersonal,
  layout = 'overlay',
  className,
}: WorkspaceContextPanelProps) {
  if (flow !== 'catalog' && flow !== 'personal') return null;

  const isDocked = layout === 'docked';

  return (
    <div
      className={cn(
        isDocked
          ? 'shrink-0 border-t border-slate-200/80 bg-white'
          : 'pointer-events-auto absolute bottom-4 left-4 right-4 z-20 max-h-[min(42vh,360px)] overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/78 shadow-[0_24px_64px_rgba(2,6,23,0.34)] backdrop-blur-xl lg:max-w-md',
        className,
      )}
    >
      <Accordion
        type="single"
        collapsible
        defaultValue={isDocked ? '' : ''}
        className={cn('border-0 bg-transparent shadow-none', isDocked ? 'rounded-none' : undefined)}
      >
        <AccordionItem value="context" className="border-0 bg-transparent shadow-none">
          <AccordionTrigger
            className={cn(
              'px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] hover:no-underline',
              isDocked
                ? 'text-slate-700 hover:bg-slate-50'
                : 'text-slate-100 hover:bg-white/5',
            )}
          >
            <span className="flex items-center gap-2">
              {flow === 'catalog' ? (
                <BookOpen className={cn('h-4 w-4', isDocked ? 'text-sky-600' : 'text-sky-300')} />
              ) : (
                <Archive className={cn('h-4 w-4', isDocked ? 'text-slate-600' : 'text-slate-300')} />
              )}
              {flow === 'catalog' ? 'Case context' : 'Study details'}
            </span>
          </AccordionTrigger>
          <AccordionContent
            className={cn(
              'max-h-[240px] overflow-y-auto px-5 pb-4',
              isDocked ? 'text-slate-700' : 'text-slate-200',
            )}
          >
            {flow === 'catalog' && caseDetail ? (
              <CatalogContextBody detail={caseDetail} docked={isDocked} />
            ) : null}
            {flow === 'personal' ? (
              <PersonalContextBody meta={personalMeta} onReset={onResetPersonal} docked={isDocked} />
            ) : null}
            {flow === 'catalog' && !caseDetail ? (
              <p className={cn('text-xs', isDocked ? 'text-slate-500' : 'text-slate-400')}>
                Loading case metadata…
              </p>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function CatalogContextBody({ detail, docked = false }: { detail: StudentCaseCatalogDetail; docked?: boolean }) {
  const annotations =
    detail.images?.flatMap((img, idx) =>
      (img.roiBoundingBox ? [{ idx, roi: img.roiBoundingBox }] : []),
    ) ?? [];

  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className={cn('text-sm font-semibold', docked ? 'text-slate-900' : 'text-slate-100')}>{detail.title}</p>
        {detail.description ? (
          <p className={cn('mt-1 line-clamp-4', docked ? 'text-slate-600' : 'text-slate-400')}>{detail.description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-100">{detail.location}</Badge>
        <Badge className="border-slate-500/40 bg-slate-500/15 text-slate-200">{detail.lesionType}</Badge>
        <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-100">{detail.difficultyLabel}</Badge>
      </div>
      {detail.keyFindings && detail.keyFindings.length > 0 ? (
        <div>
          <p className="mb-1 flex items-center gap-1 font-medium text-slate-300">
            <Stethoscope className="h-3.5 w-3.5" />
            Key findings
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-slate-400">
            {detail.keyFindings.slice(0, 4).map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {annotations.length > 0 ? (
        <p className="text-slate-400">
          {annotations.length} expert annotation region{annotations.length === 1 ? '' : 's'} on imaging.
        </p>
      ) : null}
      <Link
        href={`/student/cases/${encodeURIComponent(detail.id)}`}
        className="inline-block text-xs font-medium text-sky-300 hover:underline"
      >
        Full case record →
      </Link>
    </div>
  );
}

function PersonalContextBody({
  meta,
  onReset,
  docked = false,
}: {
  meta?: PersonalMeta | null;
  onReset?: () => void;
  docked?: boolean;
}) {
  const dicomRows = dicomMetadataToDisplayRows(meta?.dicomMetadata);

  return (
    <div className="space-y-3 text-xs">
      {meta?.fileName ? (
        <p className={cn('truncate text-sm font-medium', docked ? 'text-slate-900' : 'text-slate-100')}>
          {meta.fileName}
        </p>
      ) : null}
      {meta?.uploadedAt ? (
        <p className={docked ? 'text-slate-600' : 'text-slate-400'}>Uploaded {formatUploadedAt(meta.uploadedAt)}</p>
      ) : null}
      {dicomRows.length > 0 ? (
        <div
          className={cn(
            'rounded-2xl border p-3.5',
            docked ? 'border-slate-200 bg-slate-50' : 'border-slate-700/70 bg-slate-900/55',
          )}
        >
          <p
            className={cn(
              'mb-2 text-[10px] font-semibold uppercase tracking-wide',
              docked ? 'text-slate-500' : 'text-slate-400',
            )}
          >
            DICOM metadata
          </p>
          <dl className="space-y-1.5">
            {dicomRows.map((row) => (
              <div key={row.label} className="flex gap-2">
                <dt className={cn('w-24 shrink-0', docked ? 'text-slate-500' : 'text-slate-500')}>
                  {row.label}
                </dt>
                <dd className={cn('min-w-0 font-medium', docked ? 'text-slate-900' : 'text-slate-100')}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {onReset ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'w-full rounded-2xl',
            docked
              ? 'border-slate-300 text-slate-800 hover:bg-slate-100'
              : 'border-slate-600 bg-transparent text-slate-100 hover:bg-white/10',
          )}
          onClick={onReset}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Reset / new upload
        </Button>
      ) : null}
    </div>
  );
}
