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
};

export function WorkspaceImagePanel({
  imageUrl,
  imageAlt,
  loading = false,
  readOnly = false,
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
          Chưa có ảnh hiển thị. Mở ca từ thư viện hoặc tải DICOM cá nhân để bắt đầu.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 backdrop-blur-md">
          DICOM viewer
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-md ${
            hasActiveRoi
              ? 'border-cyan-300/25 bg-cyan-400/15 text-cyan-100'
              : 'border-white/10 bg-slate-900/70 text-slate-300'
          }`}
        >
          {hasActiveRoi ? 'ROI selected' : readOnly ? 'Viewer locked' : 'Draw ROI to focus'}
        </span>
      </div>
      <MedicalImageViewer
        src={imageUrl}
        alt={imageAlt}
        initialAnnotation={initialRoi}
        onAnnotationComplete={handleAnnotationComplete}
        readOnly={readOnly}
      />
      {!readOnly ? (
        <>
          <p className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-center text-[11px] text-slate-200 backdrop-blur-md lg:hidden">
            Chạm tab Hình ảnh · Vẽ ROI · Pinch zoom · Kéo để pan
          </p>
          <p className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 hidden rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-center text-[11px] text-slate-200 backdrop-blur-md lg:block">
            Vẽ ROI · Cuộn/pinch zoom · Pan (công cụ bàn tay)
          </p>
        </>
      ) : null}
    </div>
  );
}
