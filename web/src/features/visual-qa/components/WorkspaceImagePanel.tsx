'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import type { NormalizedImageBoundingBox } from '@/lib/api/types';
import {
  parseNormalizedBoundingBox,
  serializeNormalizedBoundingBox,
} from '@/lib/utils/annotations';
import { useVisualQaStore } from '@/features/visual-qa/store/visual-qa-store';

const MedicalImageViewer = dynamic(
  () =>
    import('@/components/student/MedicalImageViewer').then((m) => ({
      default: m.MedicalImageViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 bg-slate-950 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
        <p className="text-xs uppercase tracking-widest text-slate-500">Loading viewer…</p>
      </div>
    ),
  },
);

type WorkspaceImagePanelProps = {
  imageUrl: string | null;
  imageAlt: string;
  loading?: boolean;
  readOnly?: boolean;
  catalogMode?: boolean;
};

export function WorkspaceImagePanel({
  imageUrl,
  imageAlt,
  loading = false,
  readOnly = false,
  catalogMode = false,
}: WorkspaceImagePanelProps) {
  const coordinates = useVisualQaStore((s) => s.coordinates);
  const setCoordinates = useVisualQaStore((s) => s.setCoordinates);
  const hasActiveRoi = Boolean(coordinates?.trim());

  const initialRoi = useMemo(
    () => parseNormalizedBoundingBox(coordinates),
    [coordinates],
  );

  const handleAnnotationComplete = useCallback(
    (box: NormalizedImageBoundingBox | null) => {
      setCoordinates(serializeNormalizedBoundingBox(box));
    },
    [setCoordinates],
  );

  if (loading) {
    return (
      <div className="flex h-full min-h-[280px] flex-col bg-slate-950 p-6">
        <SkeletonBlock className="mx-auto h-full min-h-[240px] w-full max-w-2xl rounded-[1.75rem] opacity-30" />
      </div>
    );
  }

  if (!imageUrl?.trim()) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
        <ImageIcon className="h-10 w-10 text-slate-600" aria-hidden />
        <p className="max-w-sm text-sm text-slate-400">
          {catalogMode
            ? 'Loading teaching case image… If this persists, reopen the case from the library.'
            : 'No image yet. Upload a personal DICOM archive or open a case from the library.'}
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-slate-950/90 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            {catalogMode ? 'Teaching case' : 'DICOM viewer'}
          </span>
          {!catalogMode ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                hasActiveRoi
                  ? 'bg-cyan-400/15 text-cyan-100'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {hasActiveRoi ? 'ROI selected' : readOnly ? 'View only' : 'Draw ROI'}
            </span>
          ) : null}
        </div>
        {!readOnly && !catalogMode ? (
          <span className="hidden text-[10px] text-slate-500 lg:inline">
            Scroll/pinch zoom · Pan with hand tool
          </span>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">
        <MedicalImageViewer
          src={imageUrl}
          alt={imageAlt}
          initialAnnotation={initialRoi}
          onAnnotationComplete={handleAnnotationComplete}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
