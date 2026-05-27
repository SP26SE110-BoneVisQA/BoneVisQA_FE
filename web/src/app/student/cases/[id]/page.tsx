'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { StudentCaseDetailSkeleton } from '@/components/shared/DashboardSkeletons';
import { RectangleAnnotationOverlay } from '@/components/shared/RectangleAnnotationOverlay';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { fetchCaseCatalogDetail } from '@/lib/api/student';
import type { StudentCaseCatalogDetail, StudentCatalogCaseImage } from '@/lib/api/types';
import { AlertCircle, BookOpen, ChevronRight } from 'lucide-react';
import { isNextImageRemoteOptimized } from '@/lib/images/remote-image';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { isValidNormalizedBoundingBox } from '@/lib/utils/annotations';

function catalogImagesForDisplay(item: StudentCaseCatalogDetail): StudentCatalogCaseImage[] {
  if (item.images && item.images.length > 0) return item.images;
  if (item.imageUrl?.trim()) {
    return [{ imageUrl: item.imageUrl.trim(), roiBoundingBox: null }];
  }
  return [];
}

export default function StudentCaseDetailPage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const rawParam = params?.id;
  const caseId = Array.isArray(rawParam) ? String(rawParam[0] ?? '') : String(rawParam ?? '');
  const [item, setItem] = useState<StudentCaseCatalogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundCase, setNotFoundCase] = useState(false);

  useEffect(() => {
    if (!caseId) {
      setNotFoundCase(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setNotFoundCase(false);
      try {
        const detail = await fetchCaseCatalogDetail(caseId);
        if (!cancelled) setItem(detail);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to load case detail.';
          const is404 = /404|not found/i.test(message);
          if (is404) {
            setNotFoundCase(true);
            setItem(null);
          } else {
            toast.error(message);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, toast]);

  const displayImages = useMemo(() => (item ? catalogImagesForDisplay(item) : []), [item]);

  const qaHref = useMemo(() => {
    if (!item) return `/student/qa/image?caseId=${encodeURIComponent(caseId)}`;
    const primary = displayImages[0]?.imageUrl ?? item.imageUrl;
    if (!primary) return `/student/qa/image?caseId=${encodeURIComponent(caseId)}`;
    const context = `${item.title} | ${item.location} | ${item.lesionType} | ${item.difficultyLabel}`;
    return `/student/qa/image?catalogImageUrl=${encodeURIComponent(primary)}&catalogTitle=${encodeURIComponent(
      item.title,
    )}&catalogContext=${encodeURIComponent(context)}&caseId=${encodeURIComponent(caseId)}`;
  }, [caseId, item, displayImages]);

  const lockAskAi = Boolean(item?.communityReferenceOnly);
  const originLabel =
    item?.caseOrigin === 'communityPromoted' ? 'From Community Request' : 'Created by Expert';

  return (
    <div className="min-h-screen">
      <Header
        title="Case Library Detail"
        subtitle={
          lockAskAi
            ? 'Reference case from the library — read-only; interactive Visual QA is disabled for this origin.'
            : 'Review expert-approved context first, then open this case in Visual QA for your own diagnostic request.'
        }
      />
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        {loading ? (
          <StudentCaseDetailSkeleton />
        ) : notFoundCase ? (
          <EmptyState
            icon={<AlertCircle className="h-6 w-6 text-amber-600" />}
            title="Case not found"
            description="This case may have been removed or is no longer available. Please return to the catalog and choose another case."
          />
        ) : !item ? (
          <EmptyState
            icon={<AlertCircle className="h-6 w-6 text-slate-500" />}
            title="Case detail unavailable"
            description="We could not load this case right now. Please try again in a moment."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Medical images</span>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold normal-case text-foreground">
                  {originLabel}
                </span>
              </div>
              {displayImages.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">
                  No case images available.
                </div>
              ) : (
                <div className="space-y-4">
                  {displayImages.map((img, idx) => {
                    const src = resolveApiAssetUrl(img.imageUrl);
                    const roi =
                      img.roiBoundingBox && isValidNormalizedBoundingBox(img.roiBoundingBox)
                        ? img.roiBoundingBox
                        : null;
                    return (
                      <div
                        key={`${img.imageUrl}-${idx}`}
                        className="flex w-full justify-center overflow-hidden rounded-lg border border-border bg-muted p-2"
                      >
                        <div className="relative inline-block max-w-full">
                          <Image
                            src={src}
                            alt={`${item.title} — image ${idx + 1}`}
                            width={1600}
                            height={1200}
                            sizes="(max-width: 1024px) 100vw, 55vw"
                            className="h-auto max-h-[520px] w-full max-w-full object-contain"
                            priority={idx === 0}
                            unoptimized={!isNextImageRemoteOptimized(src)}
                          />
                          <RectangleAnnotationOverlay
                            closed={roi}
                            draft={null}
                            label="ROI"
                            className="drop-shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="space-y-4">
              <article className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-xl font-semibold text-card-foreground">{item.title}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {item.location}
                  </span>
                  <span className="rounded-full bg-cyan-accent/10 px-2.5 py-1 text-xs font-medium text-cyan-accent">
                    {item.lesionType}
                  </span>
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                    {item.difficultyLabel}
                  </span>
                </div>
                {item.description ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                ) : null}
                {item.diagnosis?.trim() ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Diagnosis</h3>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-card-foreground">{item.diagnosis.trim()}</p>
                  </div>
                ) : null}
              </article>

              <article className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Expert-approved metadata
                </h3>
                <p className="mt-2 text-sm text-card-foreground">
                  {item.expertSummary || 'No expert summary provided.'}
                </p>
                {item.keyFindings && item.keyFindings.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {item.keyFindings.map((finding, index) => (
                      <li key={`${finding}-${index}`}>{finding}</li>
                    ))}
                  </ul>
                ) : null}
                {item.keyLearningPoints && item.keyLearningPoints.length > 0 ? (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Key learning points
                    </h4>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-card-foreground">
                      {item.keyLearningPoints.map((pt, index) => (
                        <li key={`${pt}-${index}`}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {item.approvedAt ? (
                  <p className="mt-3 text-xs text-muted-foreground">Approved at: {item.approvedAt}</p>
                ) : null}
              </article>

              <div className="rounded-xl border border-border bg-card p-5">
                {lockAskAi ? (
                  <>
                    <p className="text-sm font-medium text-card-foreground">Reference-only case</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      This case was added from an approved student request. It is provided for study reference only —
                      interactive Visual QA is not available.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Open this case in Visual QA to draw ROI annotations and ask custom AI diagnostic questions.
                    </p>
                    <div className="mt-4">
                      <Link href={qaHref}>
                        <Button>
                          Ask AI about this case
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
