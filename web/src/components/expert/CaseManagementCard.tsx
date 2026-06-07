'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, Eye, BookOpen, MessageSquareQuote } from 'lucide-react';
import { caseOriginLabel, type CaseLibraryOrigin } from '@/lib/case-origin';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { deleteExpertCase, formatCaseDateForDisplay } from '@/lib/api/expert-cases';
import { queryKeys } from '@/lib/query-keys';
import { getApiProblemDetails } from '@/lib/api/client';
import { useState } from 'react';

const EXPERT_CASE_LIBRARY_SWR_KEY = 'expert-case-library-paged';

interface CaseManagementCardProps {
  id: string;
  title: string;
  boneLocation: string;
  lesionType: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  caseOrigin: CaseLibraryOrigin;
  addedBy: string;
  addedDate: string;
  thumbnailUrl?: string | null;
}

const originConfig: Record<
  CaseLibraryOrigin,
  { color: string; icon: typeof BookOpen; label: string }
> = {
  expertCreated: {
    color: 'border-violet-300/50 bg-violet-50 text-violet-800',
    icon: BookOpen,
    label: caseOriginLabel('expertCreated'),
  },
  fromStudentRequest: {
    color: 'border-sky-300/50 bg-sky-50 text-sky-800',
    icon: MessageSquareQuote,
    label: caseOriginLabel('fromStudentRequest'),
  },
};

const difficultyConfig = {
  basic: 'border-success/25 bg-success/10 text-success',
  intermediate: 'border-warning/25 bg-warning/10 text-warning',
  advanced: 'border-destructive/25 bg-destructive/10 text-destructive',
};

function difficultyLabel(d: CaseManagementCardProps['difficulty']): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function shouldShowExpertAttribution(addedBy: string | null | undefined): boolean {
  const value = (addedBy ?? '').trim();
  if (!value || value === '—') return false;
  return value.toLowerCase() !== 'unknown';
}

export default function CaseManagementCard({
  id,
  title,
  boneLocation,
  lesionType,
  difficulty,
  caseOrigin,
  addedBy,
  addedDate,
  thumbnailUrl,
}: CaseManagementCardProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const originInfo = originConfig[caseOrigin];
  const OriginIcon = originInfo.icon;
  const dateLabel = formatCaseDateForDisplay(addedDate);
  const locLabel = boneLocation === '—' ? 'Not specified' : boneLocation;
  const catLabel = lesionType === '—' ? 'Uncategorized' : lesionType;
  const thumbSrc = thumbnailUrl?.trim() ? resolveApiAssetUrl(thumbnailUrl.trim()) : null;
  const showImage = thumbSrc && !imgError;

  const handleDelete = async () => {
    if (!id.trim()) return;
    if (!window.confirm('Delete this case from your library? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const { message } = await deleteExpertCase(id);
      toast.success(message?.trim() || 'Case deleted.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expert.caseDetail(id) }),
      ]);
    } catch (e) {
      const { title: errTitle, detail } = getApiProblemDetails(e);
      toast.error(detail ? `${errTitle}: ${detail}` : errTitle);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg overflow-hidden">
      {showImage && (
        <div className="relative w-full bg-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbSrc}
            alt=""
            className="w-full h-40 object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      
      <div className="flex flex-col flex-1 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${originInfo.color}`}
          >
            <OriginIcon className="h-3 w-3 shrink-0" aria-hidden />
            {originInfo.label}
          </span>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${difficultyConfig[difficulty]}`}
          >
            {difficultyLabel(difficulty)}
          </span>
          {!thumbSrc && (
            <span className="ml-auto text-xs text-muted-foreground">No image</span>
          )}
        </div>
        
        <h3 className="mb-2 line-clamp-2 font-semibold text-card-foreground">{title}</h3>
        
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {locLabel}
          </span>
          <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {catLabel}
          </span>
        </div>

        <div className="mt-auto rounded-lg border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            {shouldShowExpertAttribution(addedBy) ? (
              <div>
                <p className="text-xs text-muted-foreground">Expert</p>
                <p className="truncate text-sm font-medium text-card-foreground">{addedBy}</p>
              </div>
            ) : null}
            <div className={shouldShowExpertAttribution(addedBy) ? undefined : 'col-span-2'}>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium text-card-foreground">{dateLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/expert/cases/${id}`}
            className="inline-flex h-9 min-w-[5rem] flex-1 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,123,255,0.22)] transition-all hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <Eye className="h-4 w-4 shrink-0" aria-hidden />
            View
          </Link>
          <Link
            href={`/expert/cases/${id}/edit`}
            title="Edit case"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <Edit className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Edit
          </Link>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-9 shrink-0 border-destructive/40 p-0 text-destructive hover:bg-destructive/10"
            disabled={deleting}
            aria-label="Delete case"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
