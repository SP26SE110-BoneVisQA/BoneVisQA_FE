'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DetailPageLayout } from '@/components/layouts';
import { SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { fetchExpertCase, formatCaseDateForDisplay, type CaseStatus } from '@/lib/api/expert-cases';
import { getApiProblemDetails, resolveApiAssetUrl } from '@/lib/api/client';
import {
  Pencil,
  CheckCircle,
  Clock,
  AlertCircle,
  Target,
  FileText,
  ImageIcon,
  Stethoscope,
  Lightbulb,
  Brain,
  Info,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const statusBadge: Record<
  CaseStatus,
  { label: string; className: string; Icon: typeof CheckCircle }
> = {
  draft: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    Icon: Clock,
  },
  pending: {
    label: 'Pending Review',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: AlertCircle,
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-50 text-red-700 border-red-200',
    Icon: AlertCircle,
  },
};

// Accordion Section Component
function AccordionSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true
}: {
  title: string;
  icon: typeof Info;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border hover:bg-muted/40 transition-colors"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </h2>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="p-5">{children}</div>}
    </div>
  );
}

export default function ExpertCaseDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const toast = useToast();
  const toastedErrorRef = useRef<string | null>(null);

  const { data: caseRow, isPending, isError, error } = useQuery({
    queryKey: ['expert', 'case', id],
    queryFn: () => fetchExpertCase(id),
    enabled: Boolean(id),
  });

  const errorMsg = isError
    ? error instanceof Error
      ? error.message
      : 'Could not load this case.'
    : null;

  useEffect(() => {
    if (!errorMsg) {
      toastedErrorRef.current = null;
      return;
    }
    const { title: errTitle, detail } = getApiProblemDetails(error);
    const combined = detail ? `${errTitle}: ${detail}` : errTitle;
    if (toastedErrorRef.current === combined) return;
    toastedErrorRef.current = combined;
    toast.error(combined);
  }, [error, errorMsg, toast]);

  const st = caseRow ? statusBadge[caseRow.status] : null;
  const StatusIcon = st?.Icon ?? Clock;

  if (isPending) {
    return (
      <DetailPageLayout title="Case detail" showBack maxWidthClass="max-w-7xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left: Image area */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 p-8 animate-pulse">
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-16 w-16 bg-slate-200 rounded-lg animate-pulse" />
                    <div className="h-4 w-32 mx-auto bg-slate-200 rounded" />
                  </div>
                </div>
              </div>
            </div>
            {/* Right: Details */}
            <div className="space-y-4">
              <SkeletonBlock className="h-40 w-full rounded-xl" />
              <SkeletonBlock className="h-48 w-full rounded-xl" />
              <SkeletonBlock className="h-32 w-full rounded-xl" />
            </div>
        </div>
      </DetailPageLayout>
    );
  }

  if (isError || !caseRow) {
    return (
      <DetailPageLayout title="Case detail" error={errorMsg} showBack maxWidthClass="max-w-4xl">
        <div />
      </DetailPageLayout>
    );
  }

  return (
    <DetailPageLayout title={caseRow.title} showBack maxWidthClass="max-w-7xl">
      <div>
        {/* Top action bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {st && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${st.className}`}
              >
                <StatusIcon className="h-3.5 w-3.5" aria-hidden />
                {st.label}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold">
              <Target className="h-3.5 w-3.5" />
              {caseRow.difficulty}
            </span>
          </div>
          <Link href={`/expert/cases/${caseRow.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4" />
              Edit Case
            </Button>
          </Link>
        </div>

        {/* Tags */}
        {caseRow.tags && caseRow.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {caseRow.tags.map((t) => (
              <span
                key={t.id}
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Main layout: Left Image - Right Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Medical Images (2/3 width) */}
          <div className="lg:col-span-2">
            {caseRow.medicalImages && caseRow.medicalImages.length > 0 ? (
              <div className="sticky top-6 space-y-4">
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                      <ImageIcon className="h-4 w-4" />
                      Medical Images
                    </h2>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 gap-4">
                      {caseRow.medicalImages.map((img, idx) => {
                        const src = resolveApiAssetUrl(img.imageUrl);
                        return (
                          <div key={`${img.imageUrl}-${idx}`} className="rounded-lg border border-border bg-muted/5 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <ImageIcon className="h-3 w-3" />
                                {img.modality?.trim() || 'Medical Imaging'}
                              </p>
                              <span className="text-xs text-muted-foreground">Image {idx + 1}</span>
                            </div>
                            {src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={src}
                                alt=""
                                className="max-h-[min(550px,65vh)] w-full rounded-lg border border-border bg-background object-contain mx-auto"
                              />
                            ) : (
                              <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground">
                                Image not available
                              </div>
                            )}
                            {img.annotations && img.annotations.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {img.annotations.map((a, aIdx) =>
                                  a.label ? (
                                    <span
                                      key={aIdx}
                                      className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                                    >
                                      {a.label}
                                    </span>
                                  ) : null
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/20 p-12 text-center">
                <ImageIcon className="mx-auto mb-3 h-16 w-16 text-muted-foreground/50" />
                <p className="text-muted-foreground">No medical images uploaded</p>
              </div>
            )}
          </div>

          {/* RIGHT: Details (1/3 width) */}
          <div className="space-y-4">
            {/* Basic Info - always open */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                  <Info className="h-4 w-4" />
                  Basic Information
                </h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-start border-b border-border/50 pb-3 last:border-0">
                  <span className="text-xs font-medium text-muted-foreground">Bone / Region</span>
                  <span className="text-sm text-right max-w-[60%] text-card-foreground">
                    {caseRow.boneLocation === '—' ? 'Not specified' : caseRow.boneLocation}
                  </span>
                </div>
                <div className="flex justify-between items-start border-b border-border/50 pb-3">
                  <span className="text-xs font-medium text-muted-foreground">Category</span>
                  <span className="text-sm text-right max-w-[60%] text-card-foreground">{caseRow.categoryName}</span>
                </div>
                <div className="flex justify-between items-start border-b border-border/50 pb-3">
                  <span className="text-xs font-medium text-muted-foreground">Expert</span>
                  <span className="text-sm text-right max-w-[60%] text-card-foreground">
                    {caseRow.expertName === '—' ? 'Not assigned' : caseRow.expertName}
                  </span>
                </div>
                <div className="flex justify-between items-start border-b border-border/50 pb-3">
                  <span className="text-xs font-medium text-muted-foreground">Created</span>
                  <span className="text-sm text-right max-w-[60%] text-card-foreground">{formatCaseDateForDisplay(caseRow.addedDate)}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            {caseRow.description && (
              <AccordionSection title="Description" icon={FileText} defaultOpen={false}>
                <p className="text-sm whitespace-pre-wrap text-card-foreground leading-relaxed">
                  {caseRow.description}
                </p>
              </AccordionSection>
            )}

            {/* Suggested Diagnosis */}
            {caseRow.suggestedDiagnosis && (
              <AccordionSection title="Suggested Diagnosis" icon={Stethoscope} defaultOpen={true}>
                <p className="text-sm whitespace-pre-wrap text-card-foreground leading-relaxed">
                  {caseRow.suggestedDiagnosis}
                </p>
              </AccordionSection>
            )}

            {/* Key Findings */}
            {caseRow.keyFindings && (
              <AccordionSection title="Key Findings" icon={Lightbulb} defaultOpen={false}>
                <p className="text-sm whitespace-pre-wrap text-card-foreground leading-relaxed">
                  {caseRow.keyFindings}
                </p>
              </AccordionSection>
            )}

            {/* Reflective Questions */}
            {caseRow.reflectiveQuestions && (
              <AccordionSection title="Reflective Questions" icon={Brain} defaultOpen={false}>
                <p className="text-sm whitespace-pre-wrap text-card-foreground leading-relaxed">
                  {caseRow.reflectiveQuestions}
                </p>
              </AccordionSection>
            )}
          </div>
        </div>
      </div>
    </DetailPageLayout>
  );
}
