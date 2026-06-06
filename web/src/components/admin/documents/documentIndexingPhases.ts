import type { NormalizedIndexingStatus } from '@/lib/api/admin-documents';

export type IndexingPhaseKey = 'download' | 'pageIndexing' | 'chunkPersist' | 'enrich';

export type PhaseBarsModel = {
  downloadPct: number;
  pageIndexingPct: number;
  chunkPersistPct: number;
  enrichPct: number;
  failedPhase: IndexingPhaseKey | null;
  activePhase: IndexingPhaseKey | null;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Guess which pipeline bar failed from backend hints. */
export function inferFailedPhase(operation?: string, phaseHint?: string): IndexingPhaseKey {
  const op = (operation ?? '').toLowerCase();
  const ph = (phaseHint ?? '').toLowerCase();
  if (/enrich|embed|metadata and embedding/.test(op) || /enrich|embed/.test(ph)) return 'enrich';
  if (/chunk|persist|saving chunk/.test(op) || /chunk|persist/.test(ph)) return 'chunkPersist';
  if (/indexing pages|pdf|parse|page|pig|ocr/.test(op) || /pars|pdf|page/.test(ph)) return 'pageIndexing';
  if (/download|load|storage|stream/.test(op) || /download|load/.test(ph)) return 'download';
  return 'enrich';
}

function detectActivePhase(operation?: string, progressPercentage = 0): IndexingPhaseKey {
  const op = (operation ?? '').toLowerCase();
  if (/completed\.?$/i.test(op.trim()) || progressPercentage >= 100) return 'enrich';
  if (/enrich|embedding|metadata and embedding/.test(op)) return 'enrich';
  if (/chunk|persist|saving chunk|chunking completed/.test(op)) return 'chunkPersist';
  if (/indexing pages|pdf parsed|page \d|parsing/.test(op)) return 'pageIndexing';
  if (/download|stream to disk|waiting for chunking/.test(op)) return 'download';

  if (progressPercentage >= 95) return 'enrich';
  if (progressPercentage >= 50) return 'chunkPersist';
  if (progressPercentage >= 10) return 'pageIndexing';
  return 'download';
}

/**
 * Map REST + SignalR fields into four stable progress bars aligned with the ingestion pipeline.
 */
export function computePhaseBars(args: {
  normalized: NormalizedIndexingStatus;
  operation?: string;
  phaseHint?: string;
  totalPages?: number;
  totalChunks?: number;
  currentPageIndexing?: number;
  progressPercentage?: number;
}): PhaseBarsModel {
  const {
    normalized,
    operation,
    phaseHint,
    totalPages = 0,
    totalChunks = 0,
    currentPageIndexing = 0,
    progressPercentage = 0,
  } = args;

  const overall = clampPct(progressPercentage);
  const activePhase = detectActivePhase(operation, overall);
  const cur = Math.max(0, Math.floor(currentPageIndexing));

  if (normalized === 'completed') {
    return {
      downloadPct: 100,
      pageIndexingPct: 100,
      chunkPersistPct: 100,
      enrichPct: 100,
      failedPhase: null,
      activePhase: null,
    };
  }

  if (normalized === 'unknown') {
    return {
      downloadPct: 12,
      pageIndexingPct: 0,
      chunkPersistPct: 0,
      enrichPct: 0,
      failedPhase: null,
      activePhase: 'download',
    };
  }

  if (normalized === 'failed') {
    const failedPhase = inferFailedPhase(operation, phaseHint);
    const partial = computePhaseBars({
      normalized: 'processing',
      operation,
      phaseHint,
      totalPages,
      totalChunks,
      currentPageIndexing,
      progressPercentage,
    });
    return { ...partial, failedPhase };
  }

  const pagesReady = totalPages > 0;
  const chunksReady = totalChunks > 0;

  let downloadPct = 0;
  let pageIndexingPct = 0;
  let chunkPersistPct = 0;
  let enrichPct = 0;

  if (activePhase === 'download') {
    downloadPct = overall > 0 ? clampPct((overall / 10) * 100) : normalized === 'pending' ? 28 : 55;
  } else {
    downloadPct = 100;
  }

  if (activePhase === 'pageIndexing') {
    pageIndexingPct =
      pagesReady && totalPages > 0
        ? clampPct((cur / totalPages) * 100)
        : clampPct(((overall - 10) / 40) * 100);
  } else if (activePhase === 'chunkPersist' || activePhase === 'enrich') {
    pageIndexingPct = 100;
  }

  if (activePhase === 'chunkPersist') {
    chunkPersistPct =
      chunksReady && totalChunks > 0
        ? clampPct((cur / totalChunks) * 100)
        : clampPct(((overall - 50) / 45) * 100);
  } else if (activePhase === 'enrich') {
    chunkPersistPct = 100;
  }

  if (activePhase === 'enrich') {
    enrichPct = clampPct(((overall - 95) / 4) * 100) || (overall >= 99 ? 100 : Math.max(8, overall - 90));
  }

  return {
    downloadPct,
    pageIndexingPct,
    chunkPersistPct,
    enrichPct,
    failedPhase: null,
    activePhase,
  };
}
