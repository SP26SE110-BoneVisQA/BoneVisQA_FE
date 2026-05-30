import {
  EXPERT_ANATOMY_SITES,
  EXPERT_IMAGE_MODALITIES,
  type DbImageModality,
  type ExpertAnatomySite,
} from '@/features/expert/lib/expert-ontology';

/** Normalized DICOM clinical metadata from ingest (Python → C# → FE). */
export type VisualQaDicomMetadata = {
  modality?: string | null;
  bodyPartExamined?: string | null;
  patientAge?: string | null;
  patientSex?: string | null;
  sliceThickness?: number | null;
  anatomySite?: string | null;
  laterality?: string | null;
  viewPosition?: string | null;
  previewUrl?: string | null;
};

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Parses camelCase or snake_case ingest metadata objects. */
export function normalizeDicomMetadata(raw: unknown): VisualQaDicomMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const modality = pickString(o, ['modality', 'Modality']);
  const bodyPartExamined = pickString(o, [
    'bodyPartExamined',
    'body_part_examined',
    'bodyPart',
    'BodyPartExamined',
  ]);
  const patientAge = pickString(o, ['patientAge', 'patient_age', 'PatientAge']);
  const patientSex = pickString(o, ['patientSex', 'patient_sex', 'PatientSex']);
  const sliceThickness = pickNumber(o, ['sliceThickness', 'slice_thickness', 'SliceThickness']);
  const anatomySite = pickString(o, ['anatomySite', 'anatomy_site', 'AnatomySite']);
  const laterality = pickString(o, ['laterality', 'Laterality']);
  const viewPosition = pickString(o, ['viewPosition', 'view_position', 'ViewPosition']);
  const previewUrl = pickString(o, ['previewUrl', 'preview_url', 'PreviewUrl']);

  const hasAny =
    modality ||
    bodyPartExamined ||
    patientAge ||
    patientSex ||
    sliceThickness != null ||
    anatomySite ||
    laterality ||
    viewPosition ||
    previewUrl;

  if (!hasAny) return null;

  return {
    modality,
    bodyPartExamined,
    patientAge,
    patientSex,
    sliceThickness,
    anatomySite,
    laterality,
    viewPosition,
    previewUrl,
  };
}

const MODALITY_ALIASES: Record<string, DbImageModality> = {
  cr: 'X-Ray',
  dx: 'X-Ray',
  xr: 'X-Ray',
  xray: 'X-Ray',
  'x-ray': 'X-Ray',
  x_ray: 'X-Ray',
  ct: 'CT',
  mr: 'MRI',
  mri: 'MRI',
  us: 'Ultrasound',
  ultrasound: 'Ultrasound',
};

const MODALITY_BY_TOKEN = new Map<string, DbImageModality>(
  EXPERT_IMAGE_MODALITIES.map((modality) => [modality.toLowerCase().replace(/\s+/g, ''), modality]),
);

export function mapDicomModalityToExpert(modality?: string | null): DbImageModality {
  const raw = modality?.trim() ?? '';
  if (!raw) return 'Other';
  const key = raw.toLowerCase().replace(/\s+/g, '');
  if (MODALITY_ALIASES[key]) return MODALITY_ALIASES[key];
  return MODALITY_BY_TOKEN.get(key) ?? 'Other';
}

function normalizeAnatomyToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function anatomyTokens(value: string): string[] {
  return normalizeAnatomyToken(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

const ANATOMY_SITE_BY_EXACT_TOKEN = new Map<string, ExpertAnatomySite>(
  EXPERT_ANATOMY_SITES.map((site) => [normalizeAnatomyToken(site), site]),
);

const ANATOMY_TOKEN_TO_SITE = new Map<string, ExpertAnatomySite>([
  ['skull', 'Skull & Face'],
  ['face', 'Skull & Face'],
  ['spine', 'Spine'],
  ['vertebra', 'Spine'],
  ['vertebral', 'Spine'],
  ['shoulder', 'Shoulder'],
  ['humerus', 'Humerus'],
  ['elbow', 'Elbow'],
  ['forearm', 'Forearm'],
  ['radius', 'Forearm'],
  ['ulna', 'Forearm'],
  ['wrist', 'Wrist & Hand'],
  ['hand', 'Wrist & Hand'],
  ['pelvis', 'Pelvis'],
  ['hip', 'Hip'],
  ['femur', 'Femur'],
  ['knee', 'Knee'],
  ['tibia', 'Tibia & Fibula'],
  ['fibula', 'Tibia & Fibula'],
  ['ankle', 'Ankle & Foot'],
  ['foot', 'Ankle & Foot'],
  ['chest', 'Chest'],
  ['thorax', 'Chest'],
]);

export function mapDicomAnatomyToExpert(
  anatomySite?: string | null,
  bodyPartExamined?: string | null,
): ExpertAnatomySite {
  const candidates = [anatomySite, bodyPartExamined].filter(Boolean) as string[];
  for (const raw of candidates) {
    const token = normalizeAnatomyToken(raw);
    const exact = ANATOMY_SITE_BY_EXACT_TOKEN.get(token);
    if (exact) return exact;

    const parts = anatomyTokens(raw);
    for (const part of parts) {
      const mapped = ANATOMY_TOKEN_TO_SITE.get(part);
      if (mapped) return mapped;
    }
  }
  return 'Other';
}

export type DicomMetadataDisplayRow = { label: string; value: string };

export function dicomMetadataToDisplayRows(
  metadata: VisualQaDicomMetadata | null | undefined,
): DicomMetadataDisplayRow[] {
  if (!metadata) return [];
  const rows: DicomMetadataDisplayRow[] = [];
  const push = (label: string, value?: string | null) => {
    const v = value?.trim();
    if (v) rows.push({ label, value: v });
  };
  push('Modality', metadata.modality ?? undefined);
  push('Body part', metadata.bodyPartExamined ?? undefined);
  push('Anatomy site', metadata.anatomySite ?? undefined);
  push('Laterality', metadata.laterality ?? undefined);
  push('View', metadata.viewPosition ?? undefined);
  push('Patient age', metadata.patientAge ?? undefined);
  push('Patient sex', metadata.patientSex ?? undefined);
  if (metadata.sliceThickness != null) {
    push('Slice thickness', `${metadata.sliceThickness} mm`);
  }
  return rows;
}
