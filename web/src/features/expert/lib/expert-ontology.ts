import type { ExpertCategory } from '@/lib/api/expert-cases';
import { isValidGuid, sanitizeNullableGuid } from '@/lib/api/sanitize-guids';

/** Values stored in DB (`medical_images.modality` CHECK); shared by API layer and forms. */
export const DB_IMAGE_MODALITIES = ['X-Ray', 'CT', 'MRI', 'Ultrasound', 'Other'] as const;
export type DbImageModality = (typeof DB_IMAGE_MODALITIES)[number];

/** Pathology groups for expert cases (dropdown + ontology). */
export const EXPERT_PATHOLOGY_GROUPS = [
  'Fracture',
  'Tumor',
  'Infection',
  'Degenerative',
  'Congenital',
  'Normal',
  'Other',
] as const;

export type ExpertPathologyGroup = (typeof EXPERT_PATHOLOGY_GROUPS)[number];

/** Stable id when API categories are missing or incomplete (slug matches group name). */
export function pathologyGroupToCategoryId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** API categories first; ensure standard pathology groups always appear in the dropdown. */
export function resolveExpertCategories(apiCategories: ExpertCategory[]): ExpertCategory[] {
  const byName = new Map<string, ExpertCategory>();
  for (const c of apiCategories) {
    const name = c.name?.trim();
    if (!name) continue;
    byName.set(name.toLowerCase(), { id: c.id?.trim() || pathologyGroupToCategoryId(name), name });
  }
  for (const name of EXPERT_PATHOLOGY_GROUPS) {
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { id: pathologyGroupToCategoryId(name), name });
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Maps form `categoryId` to a BE-accepted GUID.
 * Slug fallbacks (e.g. `fracture`) are resolved via API category name when possible.
 */
export function resolveExpertCategoryIdForSubmit(
  rawCategoryId: string | null | undefined,
  categories: ExpertCategory[],
): string | null {
  const trimmed = rawCategoryId?.trim() ?? '';
  if (!trimmed) return null;
  if (isValidGuid(trimmed)) return trimmed;

  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const category of categories) {
    const name = category.name?.trim();
    const id = category.id?.trim();
    if (!name || !id || !isValidGuid(id)) continue;
    bySlug.set(pathologyGroupToCategoryId(name), id);
    byName.set(name.toLowerCase(), id);
  }

  const slugMatch = bySlug.get(trimmed);
  if (slugMatch) return slugMatch;

  const nameMatch = byName.get(trimmed.toLowerCase());
  if (nameMatch) return nameMatch;

  return sanitizeNullableGuid(trimmed);
}

/** Resolves pathology group label for BE `pathologyGroup` field from form `categoryId`. */
export function resolveExpertPathologyGroupForSubmit(
  rawCategoryId: string | null | undefined,
  categories: ExpertCategory[],
): string | null {
  const trimmed = rawCategoryId?.trim() ?? '';
  if (!trimmed) return null;

  for (const category of categories) {
    const id = category.id?.trim();
    const name = category.name?.trim();
    if (!name) continue;
    if (id && id === trimmed) return name;
    if (pathologyGroupToCategoryId(name) === trimmed.toLowerCase()) return name;
  }

  if (!isValidGuid(trimmed)) {
    const ontologyMatch = EXPERT_PATHOLOGY_GROUPS.find(
      (group) => pathologyGroupToCategoryId(group) === trimmed.toLowerCase(),
    );
    if (ontologyMatch) return ontologyMatch;
    return trimmed;
  }

  return null;
}

/** Standardized anatomy sites for expert case ontology (English system UI). */
export const EXPERT_ANATOMY_SITES = [
  'Skull & Face',
  'Spine',
  'Shoulder',
  'Humerus',
  'Elbow',
  'Forearm',
  'Wrist & Hand',
  'Pelvis',
  'Hip',
  'Femur',
  'Knee',
  'Tibia & Fibula',
  'Ankle & Foot',
  'Chest',
  'Other',
] as const;

export type ExpertAnatomySite = (typeof EXPERT_ANATOMY_SITES)[number];

const EXPERT_ANATOMY_SITE_SET = new Set<string>(EXPERT_ANATOMY_SITES);

export const EXPERT_DIFFICULTY_OPTIONS = [
  { value: 'Easy', label: 'Basic' },
  { value: 'Medium', label: 'Intermediate' },
  { value: 'Hard', label: 'Advanced' },
] as const;

export const EXPERT_IMAGE_MODALITIES = DB_IMAGE_MODALITIES;

export const EXPERT_DICOM_ACCEPT = {
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/vnd.rar': ['.rar'],
} as const;

/** Parse anatomy site stored in case description during create flow. */
export function parseAnatomySiteFromDescription(description: string): ExpertAnatomySite {
  const match = description.match(/Anatomy site:\s*(.+?)(?:\n|$)/i);
  if (match) {
    const candidate = match[1].trim();
    if (EXPERT_ANATOMY_SITE_SET.has(candidate)) {
      return candidate as ExpertAnatomySite;
    }
  }
  for (const site of EXPERT_ANATOMY_SITES) {
    if (description.includes(site)) return site;
  }
  return 'Other';
}

export function stripAnatomySiteNote(description: string): string {
  return description.replace(/\n?\n?Anatomy site:\s*.+?(?:\n|$)/gi, '').trim();
}
