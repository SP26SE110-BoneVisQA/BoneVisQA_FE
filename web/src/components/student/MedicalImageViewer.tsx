'use client';

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Eraser, Hand, RefreshCcw, ScanSearch, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { RectangleAnnotationOverlay } from '@/components/shared/RectangleAnnotationOverlay';
import { Button } from '@/components/ui/button';
import type { NormalizedImageBoundingBox } from '@/lib/api/types';
import {
  cornersNormalizedToBox,
  cornersNormalizedToDraftBox,
  isValidNormalizedBoundingBox,
  normalizeClientPointFromRect,
} from '@/lib/utils/annotations';

const MIN = 0.5;
const MAX = 4;

function MedicalImageViewerInner({
  src,
  alt,
  initialAnnotation,
  expertAnnotation,
  onAnnotationComplete,
  readOnly = false,
  compact = false,
  extraOverlay,
}: {
  src: string | null;
  alt: string;
  initialAnnotation?: NormalizedImageBoundingBox | null;
  expertAnnotation?: NormalizedImageBoundingBox | null;
  onAnnotationComplete?: (box: NormalizedImageBoundingBox | null) => void;
  readOnly?: boolean;
  compact?: boolean;
  extraOverlay?: ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [closedBox, setClosedBox] = useState<NormalizedImageBoundingBox | null>(() =>
    initialAnnotation && isValidNormalizedBoundingBox(initialAnnotation) ? initialAnnotation : null,
  );
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const drag = useRef(false);
  const start = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const windowDrawListenersRef = useRef<{
    move: (ev: PointerEvent) => void;
    up: (ev: PointerEvent) => void;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const panPointerId = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageStageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialAnnotation === undefined) return;
    if (initialAnnotation === null) {
      setClosedBox(null);
      return;
    }
    if (isValidNormalizedBoundingBox(initialAnnotation)) {
      setClosedBox(initialAnnotation);
    }
  }, [initialAnnotation]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((current) => {
        const next = current + (e.deltaY > 0 ? -0.12 : 0.12);
        return Math.min(MAX, Math.max(MIN, next));
      });
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    return () => {
      const h = windowDrawListenersRef.current;
      if (h) {
        window.removeEventListener('pointermove', h.move);
        window.removeEventListener('pointerup', h.up);
        window.removeEventListener('pointercancel', h.up);
        windowDrawListenersRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { distance: getTouchDistance(e.touches), scale };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches);
        if (!dist || !pinchRef.current.distance) return;
        const ratio = dist / pinchRef.current.distance;
        const next = Math.min(MAX, Math.max(MIN, pinchRef.current.scale * ratio));
        setScale(next);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    node.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scale]);

  useEffect(() => {
    if (readOnly) setIsDrawMode(false);
  }, [readOnly]);

  const getNormalizedPoint = useCallback((clientX: number, clientY: number) => {
    const rect =
      imageStageRef.current?.getBoundingClientRect() ?? drawLayerRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;
    return normalizeClientPointFromRect(clientX, clientY, rect);
  }, []);

  const draftBox =
    drawStart && drawCurrent ? cornersNormalizedToDraftBox(drawStart, drawCurrent) : null;

  const clearAnnotation = useCallback(() => {
    setClosedBox(null);
    setDrawStart(null);
    setDrawCurrent(null);
    onAnnotationComplete?.(null);
  }, [onAnnotationComplete]);

  const resetView = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
    if (!readOnly) clearAnnotation();
  }, [clearAnnotation, readOnly]);

  const handleDrawPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly || !isDrawMode) return;
      e.preventDefault();
      e.stopPropagation();
      const startPt = getNormalizedPoint(e.clientX, e.clientY);
      if (!startPt) return;
      if (closedBox) {
        clearAnnotation();
      }
      setDrawStart(startPt);
      setDrawCurrent(startPt);
      drawLayerRef.current?.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const q = getNormalizedPoint(ev.clientX, ev.clientY);
        if (q) setDrawCurrent(q);
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        windowDrawListenersRef.current = null;
        const end = getNormalizedPoint(ev.clientX, ev.clientY) ?? startPt;
        setDrawStart(null);
        setDrawCurrent(null);
        const box = cornersNormalizedToBox(startPt, end);
        if (box) {
          setClosedBox(box);
          onAnnotationComplete?.(box);
        }
      };

      windowDrawListenersRef.current = { move: onMove, up: onUp };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [clearAnnotation, closedBox, getNormalizedPoint, isDrawMode, onAnnotationComplete, readOnly],
  );

  const handlePanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isDrawMode || readOnly) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      panPointerId.current = e.pointerId;
      drag.current = true;
      setIsDragging(true);
      start.current = { x: e.clientX, y: e.clientY, tx, ty };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isDrawMode, readOnly, tx, ty],
  );

  const handlePanPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current || panPointerId.current !== e.pointerId || isDrawMode) return;
    setTx(start.current.tx + (e.clientX - start.current.x));
    setTy(start.current.ty + (e.clientY - start.current.y));
  }, [isDrawMode]);

  const handlePanPointerUp = useCallback((e: React.PointerEvent) => {
    if (panPointerId.current !== e.pointerId) return;
    drag.current = false;
    panPointerId.current = null;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const shellMin = compact
    ? 'min-h-[180px] max-lg:min-h-[min(32vh,260px)] lg:min-h-[340px]'
    : 'min-h-[220px] max-lg:min-h-[min(42vh,360px)] lg:min-h-[520px]';

  if (!src) {
    return (
      <div
        className={`relative flex h-full ${shellMin} flex-col items-center justify-center overflow-hidden rounded-none border-b border-slate-200 bg-slate-50 p-6 text-center lg:p-8`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12),transparent_55%)]" />
        <ScanSearch className="relative mb-3 h-12 w-12 text-primary/80" />
        <p className="relative text-sm font-medium text-slate-900">Radiograph viewer idle</p>
        <p className="relative mt-1 max-w-xs text-xs text-slate-600">
          Upload a DICOM, X-ray, CT, or MRI to inspect the study in the diagnostic viewport.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full ${shellMin} flex-col overflow-hidden rounded-none border-b border-slate-200 bg-slate-50 shadow-sm`}
    >
      <div
        ref={containerRef}
        className="relative flex-1 touch-none overflow-hidden bg-slate-50"
        style={{ touchAction: 'none' }}
      >
        <div
          className={`relative flex h-full w-full items-center justify-center p-2 sm:p-4 ${
            !isDrawMode ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 80ms ease-out',
          }}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={handlePanPointerUp}
          onPointerCancel={handlePanPointerUp}
        >
          <div
            ref={imageStageRef}
            className="relative inline-block max-h-full max-w-full"
            style={{
              width: imageSize.width ? `${imageSize.width}px` : undefined,
              height: imageSize.height ? `${imageSize.height}px` : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
              onLoad={() => {
                if (!imgRef.current) return;
                setImageSize({
                  width: imgRef.current.clientWidth,
                  height: imgRef.current.clientHeight,
                });
              }}
            />
            <RectangleAnnotationOverlay
              closed={closedBox}
              draft={draftBox}
              label="LESION ROI"
              className="z-[10]"
            />
            {expertAnnotation && isValidNormalizedBoundingBox(expertAnnotation) ? (
              <RectangleAnnotationOverlay
                tone="expert"
                closed={expertAnnotation}
                draft={null}
                label="EXPERT ROI"
                className="z-[12]"
              />
            ) : null}
            {extraOverlay ? <div className="pointer-events-none absolute inset-0 z-[15]">{extraOverlay}</div> : null}
            {isDrawMode && !readOnly ? (
              <div
                ref={drawLayerRef}
                role="presentation"
                className="absolute inset-0 z-20 cursor-crosshair bg-transparent"
                aria-hidden
                onPointerDown={handleDrawPointerDown}
              />
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute left-5 top-5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-600 shadow-sm backdrop-blur">
          Radiograph viewer
        </div>

        <div className="absolute bottom-5 left-1/2 flex max-w-[min(100vw-2rem,42rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-2 py-2 shadow-md backdrop-blur sm:gap-2 sm:px-3">
          <Button
            type="button"
            variant="ghost"
            className="!rounded-full !px-2.5 !py-2 text-slate-800"
            onClick={() => setScale((s) => Math.min(MAX, s + 0.15))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!rounded-full !px-2.5 !py-2 text-slate-800"
            onClick={() => setScale((s) => Math.max(MIN, s - 0.15))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`!rounded-full !px-2.5 !py-2 ${!isDrawMode ? 'bg-primary/10 text-primary' : 'text-slate-800'}`}
            aria-label="Pan"
            onClick={() => setIsDrawMode(false)}
          >
            <Hand className="h-4 w-4" />
          </Button>
          {!readOnly ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className={`!rounded-full !px-2.5 !py-2 ${isDrawMode ? 'bg-primary/10 text-primary' : 'text-slate-800'}`}
                aria-label="Draw rectangle ROI"
                onClick={() => setIsDrawMode(true)}
              >
                <Square className="h-4 w-4" />
              </Button>
              {isDrawMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="!rounded-full !px-2.5 !py-2 text-amber-700"
                  aria-label="Clear annotation"
                  onClick={clearAnnotation}
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="!rounded-full !px-2.5 !py-2 text-slate-800"
            onClick={resetView}
            aria-label="Reset viewer"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export const MedicalImageViewer = memo(MedicalImageViewerInner);

const ALLOWED_MEDICAL_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

export function isMedicalImageUploadAllowed(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = file.name.trim().toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot) : '';
  return ALLOWED_MEDICAL_IMAGE_EXTENSIONS.has(ext);
}
