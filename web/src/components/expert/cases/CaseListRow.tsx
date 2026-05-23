'use client';

import Link from 'next/link';
import { Edit, Trash2, Eye, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { resolveApiAssetUrl, getApiProblemDetails } from '@/lib/api/client';
import { deleteExpertCase, formatCaseDateForDisplay } from '@/lib/api/expert-cases';
import { useState } from 'react';

const RECENT_EDITED_CASE_IDS_KEY = 'expert_case_library_recent_ids';

interface CaseListRowProps {
  id: string;
  title: string;
  boneLocation: string;
  lesionType: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  addedBy: string;
  addedDate: string;
  thumbnailUrl?: string | null;
}

const statusConfig = {
  draft: { color: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Draft' },
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle, label: 'Pending' },
  approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Rejected' },
};

const difficultyConfig = {
  Easy: 'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Hard: 'bg-red-100 text-red-700',
};

export default function CaseListRow({
  id,
  title,
  boneLocation,
  lesionType,
  difficulty,
  status,
  addedBy,
  addedDate,
  thumbnailUrl,
}: CaseListRowProps) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const thumbSrc = thumbnailUrl?.trim() ? resolveApiAssetUrl(thumbnailUrl.trim()) : null;
  const showImage = thumbSrc && !imgError;
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;
  const dateLabel = formatCaseDateForDisplay(addedDate);

  const handleDelete = async () => {
    if (!id.trim()) return;
    if (!window.confirm('Delete this case? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const { message } = await deleteExpertCase(id);
      toast.success(message?.trim() || 'Case deleted.');
      window.location.reload();
    } catch (e) {
      const { title: errTitle, detail } = getApiProblemDetails(e);
      toast.error(detail ? `${errTitle}: ${detail}` : errTitle);
    } finally {
      setDeleting(false);
    }
  };

  const markCaseAsRecentlyEdited = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(RECENT_EDITED_CASE_IDS_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const unique = [id, ...parsed.filter((x) => x !== id)];
      localStorage.setItem(RECENT_EDITED_CASE_IDS_KEY, JSON.stringify(unique.slice(0, 30)));
    } catch {
      // ignore localStorage parse/write issues
    }
  };

  return (
    <div className="flex items-stretch rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Image Section */}
      <div className="w-48 flex-shrink-0 bg-muted/40">
        {showImage ? (
          <Link href={`/expert/cases/${id}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbSrc}
              alt=""
              className="w-full h-full object-cover cursor-pointer"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </Link>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 flex items-center p-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${difficultyConfig[difficulty]}`}>
              {difficulty}
            </span>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {boneLocation || 'N/A'}
            </span>
            <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {lesionType || 'N/A'}
            </span>
          </div>
          
          <Link href={`/expert/cases/${id}`} className="block">
            <h3 className="text-base font-semibold text-foreground hover:text-primary truncate">{title}</h3>
          </Link>
          
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span>Expert: {addedBy}</span>
            <span>Created: {dateLabel}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          <Link
            href={`/expert/cases/${id}`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Eye className="h-4 w-4" />
            View
          </Link>
          <Link
            href={`/expert/cases/${id}/edit`}
            onClick={markCaseAsRecentlyEdited}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-slate-50"
          >
            <Edit className="h-4 w-4" />
          </Link>
          <Button
            type="button"
            variant="outline"
            className="h-9 min-w-9 px-3 border-destructive/40 p-0 text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
