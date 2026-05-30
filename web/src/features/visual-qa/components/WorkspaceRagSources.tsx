'use client';

import { useMemo, useState } from 'react';
import { BookOpen, FileText, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

function sourceLabel(citation: VisualQaCitation, index: number): string {
  return (
    citation.displayLabel?.trim() ||
    citation.title?.trim() ||
    citation.pageLabel?.trim() ||
    citation.label?.trim() ||
    `Source ${index + 1}`
  );
}

function isCitationVisible(citation: VisualQaCitation): boolean {
  return Boolean(
    citation.snippet?.trim() ||
      citation.href?.trim() ||
      citation.documentUrl?.trim() ||
      citation.caseId?.trim() ||
      citation.displayLabel?.trim() ||
      citation.title?.trim() ||
      citation.pageLabel?.trim() ||
      citation.label?.trim(),
  );
}

type WorkspaceRagSourcesProps = {
  citations: VisualQaCitation[];
  className?: string;
  /** When true, source list is visible without expanding the accordion. */
  defaultExpanded?: boolean;
};

/**
 * RAG evidence for AI answers — numbered badges + accordion with chunk previews.
 */
export function WorkspaceRagSources({ citations, className, defaultExpanded = false }: WorkspaceRagSourcesProps) {
  const visible = useMemo(
    () => citations.filter(isCitationVisible),
    [citations],
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (visible.length === 0) return null;

  if (defaultExpanded) {
    return (
      <div className={cn('mt-3 border-t border-slate-200/80 pt-3', className)}>
        <ul className="space-y-2">
          {visible.map((citation, index) => {
            const label = sourceLabel(citation, index);
            const href = resolveCitationHref(citation);
            const snippet = citation.snippet?.trim();
            const isCase = citation.kind === 'case' || Boolean(citation.caseId?.trim());
            const Icon = isCase ? Stethoscope : FileText;

            return (
              <li
                key={`${label}-expanded-${index}`}
                className="rounded-[1rem] border border-slate-200/90 bg-white px-3 py-2 text-xs"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                    [{index + 1}]
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-medium text-slate-800">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      {href?.startsWith('/') ? (
                        <Link href={href} className="truncate hover:underline">
                          {label}
                        </Link>
                      ) : href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:underline"
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="truncate">{label}</span>
                      )}
                    </p>
                    {snippet ? (
                      <p className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">
                        {snippet}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className={cn('mt-3 border-t border-slate-200/80 pt-3', className)}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="sources" className="border-0">
          <AccordionTrigger className="py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:no-underline">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              View sources ({visible.length})
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-1 pt-2">
            <div className="flex flex-wrap gap-1.5">
              {visible.map((citation, index) => {
                const label = sourceLabel(citation, index);
                const href = resolveCitationHref(citation);
                const isCase = citation.kind === 'case' || Boolean(citation.caseId?.trim());
                const active = openIndex === index;

                const badge = (
                  <Badge
                    variant="outline"
                    className={cn(
                      'cursor-pointer rounded-full border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-primary/40 hover:bg-primary/5',
                      active && 'border-primary/50 bg-primary/10 text-primary',
                    )}
                  >
                    [{index + 1}]
                  </Badge>
                );

                if (href && isCase && href.startsWith('/')) {
                  return (
                    <Link key={`${label}-${index}`} href={href} title={label}>
                      {badge}
                    </Link>
                  );
                }

                return (
                  <button
                    key={`${label}-${index}`}
                    type="button"
                    className="inline-flex"
                    title={label}
                    onClick={() => setOpenIndex((prev) => (prev === index ? null : index))}
                  >
                    {badge}
                  </button>
                );
              })}
            </div>

            <ul className="space-y-2">
              {visible.map((citation, index) => {
                const label = sourceLabel(citation, index);
                const href = resolveCitationHref(citation);
                const snippet = citation.snippet?.trim();
                const isCase = citation.kind === 'case' || Boolean(citation.caseId?.trim());
                const Icon = isCase ? Stethoscope : FileText;
                const expanded = openIndex === index;

                return (
                  <li
                    key={`${label}-detail-${index}`}
                    className={cn(
                      'rounded-[1rem] border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-xs',
                      expanded && 'border-primary/30 bg-primary/5',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                        [{index + 1}]
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                          <span className="truncate">{label}</span>
                        </p>
                        {snippet ? (
                          <p className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">
                            {snippet}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] italic text-muted-foreground">
                            No excerpt available for this source.
                          </p>
                        )}
                        {href ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="mt-2 text-[11px] font-medium text-primary hover:underline"
                              >
                                Open source
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="max-w-sm text-xs">
                              <p className="font-medium text-foreground">{label}</p>
                              {snippet ? (
                                <p className="mt-2 max-h-40 overflow-y-auto text-muted-foreground">{snippet}</p>
                              ) : null}
                              {href.startsWith('/') ? (
                                <Link href={href} className="mt-2 inline-block text-primary hover:underline">
                                  View in app →
                                </Link>
                              ) : (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-block text-primary hover:underline"
                                >
                                  Open document →
                                </a>
                              )}
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
