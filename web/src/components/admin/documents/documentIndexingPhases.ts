import type { DocumentIndexingPhase } from '@/lib/api/types';
import type { NormalizedIndexingStatus } from '@/lib/api/admin-documents';

export type IndexingPhaseKey =
  | 'download'
  | 'extract'
  | 'chunkPersist'
  | 'enrichMetadata'
  | 'generateEmbeddings';

export const INDEXING_PHASE_STEPS: ReadonlyArray<{
  key: IndexingPhaseKey;
  phase: DocumentIndexingPhase;
  label: string;
}> = [
  { key: 'download', phase: 1, label: '1 · Download PDF' },
  { key: 'extract', phase: 2, label: '2 · Extract text' },
  { key: 'chunkPersist', phase: 3, label: '3 · Chunk & persist' },
  { key: 'enrichMetadata', phase: 4, label: '4 · Enrich metadata' },
  { key: 'generateEmbeddings', phase: 5, label: '5 · Generate embeddings' },
] as const;

/** Backend progress ranges per phase (0–100 overall). */
const PHASE_RANGES: ReadonlyArray<{ start: number; end: number }> = [
  { start: 0, end: 8 },
  { start: 8, end: 40 },
  { start: 40, end: 65 },
  { start: 65, end: 80 },
  { start: 80, end: 100 },
];

export type PhaseBarsModel = {
  downloadPct: number;
  extractPct: number;
  chunkPersistPct: number;
  enrichMetadataPct: number;
  generateEmbeddingsPct: number;
  failedPhase: IndexingPhaseKey | null;
  activePhase: IndexingPhaseKey | null;
  activePhaseNumber: DocumentIndexingPhase | 0;
  overallPct: number;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function phaseKeyFromNumber(phase: DocumentIndexingPhase | 0): IndexingPhaseKey | null {
  const match = INDEXING_PHASE_STEPS.find((s) => s.phase === phase);
  return match?.key ?? null;
}

function detectActivePhaseFromHints(
  operation?: string,
  progressPercentage = 0,
): DocumentIndexingPhase {
  const op = (operation ?? '').toLowerCase();
  if (/embed|vector|generat/.test(op)) return 5;
  if (/enrich|metadata/.test(op)) return 4;
  if (/chunk|persist/.test(op)) return 3;
  if (/extract|pars|page|pdfpig|pig/.test(op)) return 2;
  if (/download|storage|stream/.test(op)) return 1;

  if (progressPercentage >= 80) return 5;
  if (progressPercentage >= 65) return 4;
  if (progressPercentage >= 40) return 3;
  if (progressPercentage >= 8) return 2;
  return 1;
}

function barPctForPhase(
  targetPhase: DocumentIndexingPhase,
  activePhase: DocumentIndexingPhase,
  overall: number,
): number {
  if (targetPhase < activePhase) return 100;
  if (targetPhase > activePhase) return 0;
  const { start, end } = PHASE_RANGES[targetPhase - 1];
  const span = end - start;
  if (span <= 0) return overall >= end ? 100 : 0;
  return clampPct(((overall - start) / span) * 100);
}

/** Guess which pipeline bar failed from backend hints. */
export function inferFailedPhase(
  indexingPhase?: DocumentIndexingPhase | 0,
  operation?: string,
  phaseHint?: string,
): IndexingPhaseKey {
  if (indexingPhase != null && indexingPhase >= 1 && indexingPhase <= 5) {
    return phaseKeyFromNumber(indexingPhase) ?? 'generateEmbeddings';
  }
  const op = (operation ?? '').toLowerCase();
  const ph = (phaseHint ?? '').toLowerCase();
  if (/embed|vector|generat/.test(op) || /embed|vector/.test(ph)) return 'generateEmbeddings';
  if (/enrich|metadata/.test(op) || /enrich|metadata/.test(ph)) return 'enrichMetadata';
  if (/chunk|persist/.test(op) || /chunk|persist/.test(ph)) return 'chunkPersist';
  if (/extract|pars|page|pdf|pig/.test(op) || /extract|pars|page/.test(ph)) return 'extract';
  if (/download|load|storage|stream/.test(op) || /download|load/.test(ph)) return 'download';
  return 'generateEmbeddings';
}

/**
 * Map REST + SignalR fields into five stable progress bars aligned with the ingestion pipeline.
 */
export function computePhaseBars(args: {
  normalized: NormalizedIndexingStatus;
  indexingPhase?: DocumentIndexingPhase | 0;
  operation?: string;
  phaseHint?: string;
  progressPercentage?: number;
}): PhaseBarsModel {
  const { normalized, indexingPhase = 0, operation, phaseHint, progressPercentage = 0 } = args;
  const overall = clampPct(progressPercentage);
  const activePhaseNumber: DocumentIndexingPhase =
    indexingPhase != null && indexingPhase >= 1 && indexingPhase <= 5
      ? (indexingPhase as DocumentIndexingPhase)
      : detectActivePhaseFromHints(operation, overall);
  const activePhase = phaseKeyFromNumber(activePhaseNumber);

  if (normalized === 'completed') {
    return {
      downloadPct: 100,
      extractPct: 100,
      chunkPersistPct: 100,
      enrichMetadataPct: 100,
      generateEmbeddingsPct: 100,
      failedPhase: null,
      activePhase: null,
      activePhaseNumber: 0,
      overallPct: 100,
    };
  }

  if (normalized === 'unknown') {
    return {
      downloadPct: 12,
      extractPct: 0,
      chunkPersistPct: 0,
      enrichMetadataPct: 0,
      generateEmbeddingsPct: 0,
      failedPhase: null,
      activePhase: 'download',
      activePhaseNumber: 1,
      overallPct: overall,
    };
  }

  if (normalized === 'failed') {
    const failedPhase = inferFailedPhase(indexingPhase, operation, phaseHint);
    const partial = computePhaseBars({
      normalized: 'processing',
      indexingPhase: activePhaseNumber,
      operation,
      phaseHint,
      progressPercentage,
    });
    return { ...partial, failedPhase };
  }

  return {
    downloadPct: barPctForPhase(1, activePhaseNumber, overall),
    extractPct: barPctForPhase(2, activePhaseNumber, overall),
    chunkPersistPct: barPctForPhase(3, activePhaseNumber, overall),
    enrichMetadataPct: barPctForPhase(4, activePhaseNumber, overall),
    generateEmbeddingsPct: barPctForPhase(5, activePhaseNumber, overall),
    failedPhase: null,
    activePhase,
    activePhaseNumber,
    overallPct: overall,
  };
}

export function phaseBarValue(model: PhaseBarsModel, key: IndexingPhaseKey): number {
  switch (key) {
    case 'download':
      return model.downloadPct;
    case 'extract':
      return model.extractPct;
    case 'chunkPersist':
      return model.chunkPersistPct;
    case 'enrichMetadata':
      return model.enrichMetadataPct;
    case 'generateEmbeddings':
      return model.generateEmbeddingsPct;
    default:
      return 0;
  }
}
