'use client';

import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';
import { dicomMetadataToDisplayRows } from '@/lib/api/visual-qa/dicom-metadata';
import { cn } from '@/lib/utils';

type DicomMetadataSummaryProps = {
  metadata: VisualQaDicomMetadata | null | undefined;
  title?: string;
  description?: string;
  emptyLabel?: string;
  className?: string;
  compact?: boolean;
};

export function DicomMetadataSummary({
  metadata,
  title = 'DICOM metadata',
  description,
  emptyLabel = 'No DICOM metadata was returned for this study.',
  className,
  compact = false,
}: DicomMetadataSummaryProps) {
  const rows = dicomMetadataToDisplayRows(metadata);

  return (
    <article
      className={cn(
        'rounded-[1.35rem] border border-slate-200/70 bg-white/90 p-4 shadow-[0_8px_30px_rgb(15,23,42,0.04)]',
        compact && 'p-3',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      {rows.length > 0 ? (
        <dl className={cn('mt-3 grid gap-3 sm:grid-cols-2', compact && 'gap-2')}>
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-slate-200/60 bg-slate-50/80 px-3 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {row.label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </article>
  );
}
