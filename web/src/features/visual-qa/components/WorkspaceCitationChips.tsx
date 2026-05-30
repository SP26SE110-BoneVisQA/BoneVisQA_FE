'use client';

import Link from 'next/link';
import { ExternalLink, FileText, Stethoscope } from 'lucide-react';
import type { VisualQaCitation } from '@/lib/api/types';
import { resolveApiAssetUrl, withVersionedAssetUrl } from '@/lib/api/client';
import { withPageAnchor } from '@/components/student/VisualQaRichAnswer';
import { cn } from '@/lib/utils';

function resolveCitationHref(citation: VisualQaCitation): string | undefined {
  const direct = citation.href?.trim();
  if (direct) return direct;
  const caseId = citation.caseId?.trim();
  if (caseId) return `/student/cases/${caseId}`;
  const raw = citation.documentUrl?.trim();
  if (!raw) return undefined;
  const resolved = resolveApiAssetUrl(raw);
  const versioned = resolved ? withVersionedAssetUrl(resolved, citation.version) : '';
  return withPageAnchor(versioned, citation.startPage ?? citation.pageNumber);
}

function chipLabel(citation: VisualQaCitation, index: number): string {
  const display = citation.displayLabel?.trim();
  if (display) return display;
  const title = citation.title?.trim();
  if (title) return title;
  const page = citation.pageLabel?.trim();
  if (page) return page;
  return `Nguồn ${index + 1}`;
}

type WorkspaceCitationChipsProps = {
  citations: VisualQaCitation[];
  className?: string;
};

/** Citation chips for AI answers — opens source in new tab when href is available. */
export function WorkspaceCitationChips({ citations, className }: WorkspaceCitationChipsProps) {
  const visible = citations.filter(
    (c) =>
      c.href?.trim() ||
      c.documentUrl?.trim() ||
      c.caseId?.trim() ||
      c.displayLabel?.trim() ||
      c.title?.trim(),
  );

  if (visible.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Tài liệu tham khảo</p>
      <div className="flex flex-wrap gap-2">
        {visible.map((citation, index) => {
          const href = resolveCitationHref(citation);
          const label = chipLabel(citation, index);
          const isCase = citation.kind === 'case' || Boolean(citation.caseId?.trim());
          const Icon = isCase ? Stethoscope : FileText;

          const chipClass =
            'inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5';

          if (href && isCase && href.startsWith('/')) {
            return (
              <Link key={`${label}-${index}`} href={href} className={chipClass}>
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            );
          }

          if (href) {
            return (
              <a
                key={`${label}-${index}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={chipClass}
                title={citation.snippet?.trim() || label}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{label}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              </a>
            );
          }

          return (
            <span
              key={`${label}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
              title={citation.snippet?.trim() || label}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
