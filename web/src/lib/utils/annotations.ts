import type {
  NormalizedImageBoundingBox,
  NormalizedPolygonPoint,
  PercentageBoundingBox,
  VisualQaTurn,
} from '@/lib/api/types';

type PixelPoint = {
  x: number;
  y: number;
};

type PixelBounds = PixelPoint & {
  width: number;
  height: number;
};

/** Pixel rect of visible image content inside an object-contain `<img>` layout box. */
export function computeObjectContainContentRect(
  layoutWidth: number,
  layoutHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): { left: number; top: number; width: number; height: number } {
  if (!layoutWidth || !layoutHeight || !naturalWidth || !naturalHeight) {
    return { left: 0, top: 0, width: layoutWidth, height: layoutHeight };
  }
  const scale = Math.min(layoutWidth / naturalWidth, layoutHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    left: (layoutWidth - width) / 2,
    top: (layoutHeight - height) / 2,
    width,
    height,
  };
}

export function normalizeClientPointFromRect(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): { x: number; y: number } | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const localX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const localY = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  return {
    x: localX / rect.width,
    y: localY / rect.height,
  };
}

export function clampAnnotationPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export function isValidPercentageBoundingBox(
  box: PercentageBoundingBox | null | undefined,
): box is PercentageBoundingBox {
  return Boolean(
    box &&
      box.widthPct > 0 &&
      box.heightPct > 0 &&
      box.xPct >= 0 &&
      box.yPct >= 0 &&
      box.xPct + box.widthPct <= 100 &&
      box.yPct + box.heightPct <= 100,
  );
}

/** Convert stored % ROI (0–100) to normalized 0–1 box for overlays / expert UI. */
export function percentageBoundingBoxToNormalized(
  box: PercentageBoundingBox,
): NormalizedImageBoundingBox {
  return {
    x: box.xPct / 100,
    y: box.yPct / 100,
    width: box.widthPct / 100,
    height: box.heightPct / 100,
  };
}

export function clampPercentageBoundingBox(
  box: PercentageBoundingBox,
): PercentageBoundingBox | null {
  const xPct = clampAnnotationPercent(box.xPct);
  const yPct = clampAnnotationPercent(box.yPct);
  const widthPct = clampAnnotationPercent(Math.min(box.widthPct, 100 - xPct));
  const heightPct = clampAnnotationPercent(Math.min(box.heightPct, 100 - yPct));

  if (widthPct <= 0 || heightPct <= 0) {
    return null;
  }

  return { xPct, yPct, widthPct, heightPct };
}

export function parsePercentageBoundingBox(raw: unknown): PercentageBoundingBox | null {
  try {
    if (!raw) return null;

    let source: unknown = raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try {
        source = JSON.parse(trimmed);
      } catch {
        return null;
      }
    }

    if (!source || typeof source !== 'object') return null;
    const candidate = source as Record<string, unknown>;
    const parsed = {
      xPct: Number(
        candidate.xPct ??
          candidate.XPct ??
          candidate.left ??
          candidate.Left ??
          candidate.x ??
          candidate.X,
      ),
      yPct: Number(
        candidate.yPct ??
          candidate.YPct ??
          candidate.top ??
          candidate.Top ??
          candidate.y ??
          candidate.Y,
      ),
      widthPct: Number(
        candidate.widthPct ??
          candidate.WidthPct ??
          candidate.width ??
          candidate.Width ??
          candidate.w ??
          candidate.W,
      ),
      heightPct: Number(
        candidate.heightPct ??
          candidate.HeightPct ??
          candidate.height ??
          candidate.Height ??
          candidate.h ??
          candidate.H,
      ),
    };

    if (Object.values(parsed).some((value) => Number.isNaN(value))) {
      return null;
    }

    return clampPercentageBoundingBox(parsed);
  } catch {
    return null;
  }
}

export function serializePercentageBoundingBox(
  box: PercentageBoundingBox | null | undefined,
): string | null {
  if (!box) return null;
  const normalized = clampPercentageBoundingBox(box);
  if (!normalized) return null;
  return JSON.stringify(normalized);
}

export function buildPercentageBoundingBox(
  startPoint: PixelPoint,
  endPoint: PixelBounds,
): PercentageBoundingBox {
  const left = Math.min(startPoint.x, endPoint.x);
  const top = Math.min(startPoint.y, endPoint.y);
  const width = Math.abs(endPoint.x - startPoint.x);
  const height = Math.abs(endPoint.y - startPoint.y);

  const xPct = endPoint.width <= 0 ? 0 : clampAnnotationPercent((left / endPoint.width) * 100);
  const yPct = endPoint.height <= 0 ? 0 : clampAnnotationPercent((top / endPoint.height) * 100);
  const widthPct =
    endPoint.width <= 0
      ? 0
      : clampAnnotationPercent(Math.min((width / endPoint.width) * 100, 100 - xPct));
  const heightPct =
    endPoint.height <= 0
      ? 0
      : clampAnnotationPercent(Math.min((height / endPoint.height) * 100, 100 - yPct));

  return {
    xPct,
    yPct,
    widthPct,
    heightPct,
  };
}

const EPS = 1e-6;
/** Minimum normalized side length for a committed rectangle ROI. */
const MIN_NORM_RECT_SIDE = 0.008;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function roundNorm(n: number): number {
  return Math.round(clamp01(n) * 1e6) / 1e6;
}

/** Normalized drag preview (no minimum size). */
export function cornersNormalizedToDraftBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
): NormalizedImageBoundingBox {
  const x = clamp01(Math.min(a.x, b.x));
  const y = clamp01(Math.min(a.y, b.y));
  const width = clamp01(Math.abs(b.x - a.x));
  const height = clamp01(Math.abs(b.y - a.y));
  return { x, y, width, height };
}

/** Two corner points (normalized) → axis-aligned box; returns null if too small. */
export function cornersNormalizedToBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  minSide = MIN_NORM_RECT_SIDE,
): NormalizedImageBoundingBox | null {
  const x0 = clamp01(Math.min(a.x, b.x));
  const y0 = clamp01(Math.min(a.y, b.y));
  let w = clamp01(Math.abs(b.x - a.x));
  let h = clamp01(Math.abs(b.y - a.y));
  if (w < minSide || h < minSide) return null;
  let x = x0;
  let y = y0;
  if (x + w > 1 + EPS) w = clamp01(1 - x);
  if (y + h > 1 + EPS) h = clamp01(1 - y);
  if (w < minSide || h < minSide) return null;
  return {
    x: roundNorm(x),
    y: roundNorm(y),
    width: roundNorm(w),
    height: roundNorm(h),
  };
}

export function isValidNormalizedBoundingBox(
  box: NormalizedImageBoundingBox | null | undefined,
): box is NormalizedImageBoundingBox {
  if (!box || typeof box !== 'object') return false;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.width);
  const h = Number(box.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return false;
  if (w < MIN_NORM_RECT_SIDE || h < MIN_NORM_RECT_SIDE) return false;
  if (x < -EPS || y < -EPS || x + w > 1 + EPS || y + h > 1 + EPS) return false;
  return true;
}

export function parseNormalizedBoundingBox(raw: unknown): NormalizedImageBoundingBox | null {
  try {
    if (raw == null) return null;
    let source: unknown = raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try {
        source = JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    const o = source as Record<string, unknown>;
    let x = Number(o.x ?? o.X);
    let y = Number(o.y ?? o.Y);
    let w = Number(o.width ?? o.w ?? o.Width ?? o.W);
    let h = Number(o.height ?? o.h ?? o.Height ?? o.H);
    if (![x, y, w, h].every((n) => Number.isFinite(n))) {
      return null;
    }
    const scalePct = (n: number) => (n > 1 && n <= 100 ? n / 100 : n);
    x = scalePct(x);
    y = scalePct(y);
    w = scalePct(w);
    h = scalePct(h);
    const candidate: NormalizedImageBoundingBox = {
      x: clamp01(x),
      y: clamp01(y),
      width: clamp01(w),
      height: clamp01(h),
    };
    return isValidNormalizedBoundingBox(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** Serializes `{"x","y","width","height"}` for API `coordinates` / multipart `customPolygon`. */
export function serializeNormalizedBoundingBox(
  box: NormalizedImageBoundingBox | null | undefined,
): string | null {
  if (!box || !isValidNormalizedBoundingBox(box)) return null;
  return JSON.stringify({
    x: roundNorm(box.x),
    y: roundNorm(box.y),
    width: roundNorm(box.width),
    height: roundNorm(box.height),
  });
}

/** Restore persisted ROI as normalized JSON for the viewer store (newest turn wins). */
export function resolveVisualQaStoredCoordinates(params: {
  threadRoiBoundingBox?: NormalizedImageBoundingBox | null;
  turns?: VisualQaTurn[] | null;
  customCoordinates?: PercentageBoundingBox | null;
}): string | null {
  if (params.threadRoiBoundingBox && isValidNormalizedBoundingBox(params.threadRoiBoundingBox)) {
    return serializeNormalizedBoundingBox(params.threadRoiBoundingBox);
  }

  const sorted = [...(params.turns ?? [])].sort((a, b) => b.turnIndex - a.turnIndex);
  for (const turn of sorted) {
    for (const candidate of [turn.roiBoundingBox, turn.questionCoordinates]) {
      if (candidate && isValidNormalizedBoundingBox(candidate)) {
        return serializeNormalizedBoundingBox(candidate);
      }
    }
  }

  const pct = params.customCoordinates;
  if (pct && isValidPercentageBoundingBox(pct)) {
    return serializeNormalizedBoundingBox(percentageBoundingBoxToNormalized(pct));
  }

  return null;
}

export function isValidPolygon(
  points: NormalizedPolygonPoint[] | null | undefined,
): points is NormalizedPolygonPoint[] {
  if (!points || points.length < 3) return false;
  return points.every(
    (p) =>
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x >= -EPS &&
      p.x <= 1 + EPS &&
      p.y >= -EPS &&
      p.y <= 1 + EPS,
  );
}

function normalizeVertex(raw: unknown): NormalizedPolygonPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  let x = Number(o.x ?? o.X);
  let y = Number(o.y ?? o.Y);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  if (x > 1 + EPS || y > 1 + EPS) {
    x /= 100;
    y /= 100;
  }
  return { x: clamp01(x), y: clamp01(y) };
}

export function parseCustomPolygon(raw: unknown): NormalizedPolygonPoint[] | null {
  try {
    if (!raw) return null;
    let source: unknown = raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try {
        source = JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const o = source as Record<string, unknown>;
      if ('width' in o || 'height' in o || 'w' in o || 'h' in o) return null;
    }
    if (!Array.isArray(source)) return null;
    const out: NormalizedPolygonPoint[] = [];
    for (const row of source) {
      const v = normalizeVertex(row);
      if (v) out.push(v);
    }
    return isValidPolygon(out) ? out.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })) : null;
  } catch {
    return null;
  }
}

export function serializeCustomPolygon(
  points: NormalizedPolygonPoint[] | null | undefined,
): string | null {
  if (!points || points.length < 3) return null;
  const normalized = points.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
  if (normalized.length < 3) return null;
  return JSON.stringify(normalized);
}
