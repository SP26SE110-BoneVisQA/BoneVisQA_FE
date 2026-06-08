import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { BookOpen, CheckCircle2, Clock, Lightbulb, ShieldAlert, TrendingUp } from 'lucide-react';
import { isNextImageRemoteOptimized } from '@/lib/images/remote-image';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { stashSessionPrefillImage } from '@/components/student/VisualQaSessionHistorySidebar';
import {
  medicalCaseDifficultyBadgeClass,
  medicalCaseDifficultyLabel,
  type MedicalCaseDifficultyTier,
} from '@/lib/medical-case-difficulty';

interface CaseCardProps {
  title: string;
  thumbnail?: string;
  boneLocation: string;
  lesionType: string;
  difficulty: MedicalCaseDifficultyTier;
  duration?: string;
  progress?: number;
  status?: string;
  /** BE `reviewState` on history list when `status` alone is ambiguous. */
  reviewState?: string | null;
  /** BE `lastResponderRole` on history list (e.g. assistant, lecturer, expert). */
  lastResponderRole?: string | null;
  askedAt?: string;
  /** SEPS learning fields when returned by history API */
  keyImagingFindings?: string | null;
  reflectiveQuestions?: string | null;
  /** Lecturer rejection explanation when session was rejected (history list). */
  rejectionReason?: string | null;
  /** When set, the whole card links (e.g. catalog case detail). */
  href?: string;
  /** Stash study image for Visual QA restore when thread DTO omits image URL (Wave 1 hydrate). */
  prefillSessionImage?: { sessionId: string; imageUrl?: string | null };
}

function formatLastResponderRole(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const key = t.toLowerCase();
  const labels: Record<string, string> = {
    assistant: 'Assistant',
    ai: 'Assistant',
    student: 'You',
    user: 'You',
    lecturer: 'Lecturer',
    instructor: 'Lecturer',
    expert: 'Expert',
    system: 'System',
  };
  if (labels[key]) return `Last reply: ${labels[key]}`;
  const pretty = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return `Last reply: ${pretty}`;
}

const difficultyConfig: Record<MedicalCaseDifficultyTier, { color: string; label: string }> = {
  easy: {
    color: medicalCaseDifficultyBadgeClass('easy'),
    label: medicalCaseDifficultyLabel('easy'),
  },
  medium: {
    color: medicalCaseDifficultyBadgeClass('medium'),
    label: medicalCaseDifficultyLabel('medium'),
  },
  hard: {
    color: medicalCaseDifficultyBadgeClass('hard'),
    label: medicalCaseDifficultyLabel('hard'),
  },
};

export default function CaseCard({
  title,
  thumbnail,
  boneLocation,
  lesionType,
  difficulty,
  duration = '15 min',
  progress = 0,
  status,
  reviewState,
  lastResponderRole,
  askedAt,
  keyImagingFindings,
  reflectiveQuestions,
  rejectionReason,
  href,
  prefillSessionImage,
}: CaseCardProps) {
  const diffConfig = difficultyConfig[difficulty];
  const showRegionTags = Boolean(boneLocation?.trim() || lesionType?.trim());
  const metaTimeLabel = useMemo(() => {
    const raw = askedAt?.trim();
    if (!raw) return duration ?? '';
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return formatRelativeTime(raw);
    return raw;
  }, [askedAt, duration]);
  const metaTimeTitle = useMemo(() => {
    const raw = askedAt?.trim();
    if (!raw) return undefined;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString();
  }, [askedAt]);
  const normalizedStatusKey = (status ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedReviewStateKey = (reviewState ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  let reviewBadge =
    normalizedStatusKey === 'expertapproved' ||
    normalizedStatusKey === 'approved' ||
    normalizedStatusKey === 'revised'
      ? {
          label: 'Verified',
          className: 'border-success/30 bg-success/10 text-success',
          icon: CheckCircle2,
        }
      : normalizedStatusKey === 'pendingexpertreview' ||
          normalizedStatusKey === 'pendinglecturerreview'
        ? {
            label: 'Pending expert review',
            className:
              'border-slate-400/35 bg-slate-500/10 text-slate-700',
            icon: Clock,
          }
        : normalizedStatusKey === 'escalatedtoexpert'
          ? {
              label: 'Expert Reviewing',
              className: 'border-orange-400/40 bg-orange-500/10 text-orange-700',
              icon: ShieldAlert,
            }
          : normalizedStatusKey === 'active'
            ? {
                label: 'Active session',
                className: 'border-blue-400/40 bg-blue-500/10 text-blue-700',
                icon: Clock,
              }
            : normalizedStatusKey === 'rejected'
              ? {
                  label: 'Rejected',
                  className: 'border-destructive/40 bg-destructive/10 text-destructive',
                  icon: ShieldAlert,
                }
          : normalizedStatusKey === 'pending' || normalizedStatusKey === 'pendingexpert'
            ? {
                label: 'Pending expert review',
                className: 'border-warning/30 bg-warning/10 text-warning',
                icon: Clock,
              }
            : null;
  if (!reviewBadge && normalizedReviewStateKey && normalizedReviewStateKey !== 'none') {
    if (normalizedReviewStateKey === 'pending') {
      reviewBadge = {
        label: 'Review requested',
        className: 'border-violet-400/40 bg-violet-500/10 text-violet-800',
        icon: Clock,
      };
    } else if (normalizedReviewStateKey === 'escalated') {
      reviewBadge = {
        label: 'With expert',
        className: 'border-orange-400/40 bg-orange-500/10 text-orange-700',
        icon: ShieldAlert,
      };
    } else if (normalizedReviewStateKey === 'reviewed' || normalizedReviewStateKey === 'resolved') {
      reviewBadge = {
        label: 'Review updated',
        className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-800',
        icon: CheckCircle2,
      };
    }
  }
  const ReviewIcon = reviewBadge?.icon;
  const lastResponderLine = formatLastResponderRole(lastResponderRole);

  const article = (
    <article className="group block overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-lg">
      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden bg-muted">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
            unoptimized={!isNextImageRemoteOptimized(thumbnail)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <BookOpen className="h-16 w-16 text-muted-foreground opacity-30" />
          </div>
        )}

        {/* Difficulty Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${diffConfig.color}`}>
            {diffConfig.label}
          </span>
        </div>

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {title}
        </h3>

        {lastResponderLine ? (
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{lastResponderLine}</p>
        ) : null}

        {reviewBadge && ReviewIcon ? (
          <div
            className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reviewBadge.className}`}
          >
            <ReviewIcon className="h-3.5 w-3.5" />
            {reviewBadge.label}
          </div>
        ) : null}

        {rejectionReason?.trim() ? (
          <p
            className="mb-3 line-clamp-4 rounded-lg border border-destructive/25 bg-destructive/5 px-2.5 py-2 text-xs leading-relaxed text-destructive"
            title={rejectionReason.trim()}
          >
            <span className="font-semibold text-destructive/90">Lecturer note: </span>
            {rejectionReason.trim()}
          </p>
        ) : null}

        {showRegionTags ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {boneLocation?.trim() ? (
              <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">{boneLocation.trim()}</span>
            ) : null}
            {lesionType?.trim() ? (
              <span className="rounded bg-accent/10 px-2 py-1 text-xs text-accent">{lesionType.trim()}</span>
            ) : null}
          </div>
        ) : null}

        {keyImagingFindings?.trim() ? (
          <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-card-foreground">Imaging: </span>
            {keyImagingFindings.trim()}
          </p>
        ) : null}
        {reflectiveQuestions?.trim() ? (
          <div className="mb-3 flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{reflectiveQuestions.trim()}</p>
          </div>
        ) : null}

        {/* Meta */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1" title={metaTimeTitle}>
            <Clock className="h-4 w-4 shrink-0" />
            <span className="text-xs sm:text-sm">{metaTimeLabel}</span>
          </div>
          {progress > 0 && (
            <div className="flex items-center gap-1 text-accent">
              <TrendingUp className="w-4 h-4" />
              <span>{progress}% complete</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );

  if (href?.trim()) {
    return (
      <Link
        href={href.trim()}
        className="block rounded-xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => {
          const sid = prefillSessionImage?.sessionId?.trim();
          if (sid && prefillSessionImage?.imageUrl?.trim()) {
            stashSessionPrefillImage(sid, prefillSessionImage.imageUrl);
          }
        }}
      >
        {article}
      </Link>
    );
  }

  return article;
}
