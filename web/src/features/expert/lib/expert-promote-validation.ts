import type { ExpertCategory } from '@/lib/api/expert-cases';
import type { PromoteExpertReviewPayload } from '@/lib/api/expert-reviews';
import { isValidGuid } from '@/lib/api/sanitize-guids';
import {
  pathologyGroupToCategoryId,
  resolveExpertCategoryIdForSubmit,
  resolveExpertPathologyGroupForSubmit,
} from '@/features/expert/lib/expert-ontology';

/** BE promote validator (`PathologyGroup` enum on `POST .../promote`). */
export const EXPERT_PROMOTE_PATHOLOGY_GROUPS = [
  'Congenital',
  'Degenerative',
  'Infection',
  'Trauma',
  'Tumor',
] as const;

export type ExpertPromotePathologyGroup = (typeof EXPERT_PROMOTE_PATHOLOGY_GROUPS)[number];

const PROMOTE_GROUP_SET = new Set<string>(
  EXPERT_PROMOTE_PATHOLOGY_GROUPS.map((group) => group.toLowerCase()),
);

const PROMOTE_GROUP_ALIASES: Record<string, ExpertPromotePathologyGroup | null> = {
  fracture: 'Trauma',
  fractures: 'Trauma',
  traumatology: 'Trauma',
  trauma: 'Trauma',
  tumor: 'Tumor',
  tumours: 'Tumor',
  tumour: 'Tumor',
  infection: 'Infection',
  infectious: 'Infection',
  osteomyelitis: 'Infection',
  degenerative: 'Degenerative',
  congenital: 'Congenital',
  normal: null,
  other: null,
};

export type ExpertPromoteFieldKey =
  | 'title'
  | 'categoryId'
  | 'difficulty'
  | 'tagIds'
  | 'clinicalDescription'
  | 'suggestedDiagnosis'
  | 'keyFindings'
  | 'reflectiveQuestions';

export type ExpertPromoteFieldErrors = Partial<Record<ExpertPromoteFieldKey, string>>;

export type ExpertPromoteValidationResult =
  | { ok: true; categoryId: string; pathologyGroup: ExpertPromotePathologyGroup }
  | { ok: false; errors: ExpertPromoteFieldErrors; message: string };

/** Categories shown in review → promote dropdown (BE pathology groups only). */
export function resolvePromoteCategories(apiCategories: ExpertCategory[]): ExpertCategory[] {
  const byName = new Map<string, ExpertCategory>();

  for (const category of apiCategories) {
    const normalized = normalizeToPromotePathologyGroup(category.name ?? '');
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    const id = category.id?.trim();
    byName.set(key, {
      id: id && isValidGuid(id) ? id : pathologyGroupToCategoryId(normalized),
      name: normalized,
    });
  }

  for (const name of EXPERT_PROMOTE_PATHOLOGY_GROUPS) {
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { id: pathologyGroupToCategoryId(name), name });
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeToPromotePathologyGroup(raw: string): ExpertPromotePathologyGroup | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(PROMOTE_GROUP_ALIASES, lower)) {
    return PROMOTE_GROUP_ALIASES[lower] ?? null;
  }
  if (PROMOTE_GROUP_SET.has(lower)) {
    return EXPERT_PROMOTE_PATHOLOGY_GROUPS.find((group) => group.toLowerCase() === lower) ?? null;
  }
  return null;
}

export function resolvePromotePathologyGroupForSubmit(
  rawCategoryId: string | null | undefined,
  categories: ExpertCategory[],
): ExpertPromotePathologyGroup | null {
  const resolved = resolveExpertPathologyGroupForSubmit(rawCategoryId, categories);
  if (!resolved) return null;
  return normalizeToPromotePathologyGroup(resolved);
}

/** Resolve a stored category id/slug to a dropdown value that maps to a BE pathology group. */
export function resolvePromoteCategoryIdForDropdown(
  rawCategoryId: string | null | undefined,
  promoteCategories: ExpertCategory[],
): string {
  const trimmed = rawCategoryId?.trim() ?? '';
  if (!trimmed) return '';

  const pathologyGroup = resolvePromotePathologyGroupForSubmit(trimmed, promoteCategories);
  if (!pathologyGroup) return '';

  const match = promoteCategories.find((category) => category.name === pathologyGroup);
  if (match?.id) return match.id;

  const guid = resolveExpertCategoryIdForSubmit(trimmed, promoteCategories);
  return guid && resolvePromotePathologyGroupForSubmit(guid, promoteCategories) ? guid : '';
}

export function inferPromoteCategoryIdFromReviewContent(
  textParts: Array<string | null | undefined>,
  promoteCategories: ExpertCategory[],
): string {
  const haystack = textParts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!haystack) return '';

  const rules: Array<{ pattern: RegExp; group: ExpertPromotePathologyGroup }> = [
    { pattern: /gãy xương|gãy cổ|fracture|trauma|chấn thương|broken bone/i, group: 'Trauma' },
    { pattern: /tumor|tumour|u xương|neoplasm|sarcoma/i, group: 'Tumor' },
    { pattern: /infection|nhiễm|viêm|osteomyelitis/i, group: 'Infection' },
    { pattern: /degenerative|thoái hóa|osteoarthritis/i, group: 'Degenerative' },
    { pattern: /congenital|bẩm sinh|dị tật/i, group: 'Congenital' },
  ];

  for (const rule of rules) {
    if (!rule.pattern.test(haystack)) continue;
    const match = promoteCategories.find((category) => category.name === rule.group);
    return match?.id ?? pathologyGroupToCategoryId(rule.group);
  }
  return '';
}

export function validateExpertPromoteForm(
  payload: PromoteExpertReviewPayload,
  ctx: { rawCategoryId: string; promoteCategories: ExpertCategory[] },
): ExpertPromoteValidationResult {
  const errors: ExpertPromoteFieldErrors = {};

  if (!payload.title?.trim()) {
    errors.title = 'Enter a library case title.';
  }

  const normalizedCategoryId =
    resolvePromoteCategoryIdForDropdown(ctx.rawCategoryId, ctx.promoteCategories) ||
    ctx.rawCategoryId.trim();
  const pathologyGroup = resolvePromotePathologyGroupForSubmit(
    normalizedCategoryId,
    ctx.promoteCategories,
  );
  const categoryId = pathologyGroup
    ? ctx.promoteCategories.find((category) => category.name === pathologyGroup)?.id ??
      pathologyGroupToCategoryId(pathologyGroup)
    : null;

  if (!normalizedCategoryId) {
    errors.categoryId =
      'Select a pathology category: Trauma, Tumor, Infection, Degenerative, or Congenital.';
  } else if (!pathologyGroup) {
    errors.categoryId =
      'Selected category is not valid for library publish. Choose Trauma, Tumor, Infection, Degenerative, or Congenital.';
  }

  if (!payload.difficulty?.trim()) {
    errors.difficulty = 'Select a difficulty level.';
  }

  if ((payload.tagIds?.length ?? 0) === 0) {
    errors.tagIds = 'Select at least one tag.';
  }

  if (!payload.description?.trim()) {
    errors.clinicalDescription = 'Enter a clinical description.';
  }
  if (!payload.suggestedDiagnosis?.trim()) {
    errors.suggestedDiagnosis = 'Enter suggested main diagnosis in Expert clinical override.';
  }
  if (!payload.keyFindings?.trim()) {
    errors.keyFindings = 'Enter key imaging findings.';
  }
  if (!payload.reflectiveQuestions?.trim()) {
    errors.reflectiveQuestions = 'Enter reflective questions.';
  }

  if (Object.keys(errors).length > 0) {
    const message =
      errors.categoryId ??
      errors.title ??
      errors.tagIds ??
      errors.clinicalDescription ??
      errors.suggestedDiagnosis ??
      errors.keyFindings ??
      errors.reflectiveQuestions ??
      errors.difficulty ??
      'Complete all required library fields before publishing.';
    return { ok: false, errors, message };
  }

  return {
    ok: true,
    categoryId: categoryId!,
    pathologyGroup: pathologyGroup!,
  };
}

/** User-fixable promote validation errors (not server outages). */
export function isExpertPromoteUserErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  if (/categoryid or categoryname/i.test(message)) return true;
  if (/pathologygroup must be one of/i.test(message)) return true;
  if (/select a pathology category/i.test(message)) return true;
  if (/complete all required library fields/i.test(message)) return true;
  if (/title and difficulty are required/i.test(message)) return true;
  if (/select at least one tag/i.test(message)) return true;
  if (/required to publish/i.test(message)) return true;
  if (/enter a clinical description/i.test(message)) return true;
  if (/enter suggested main diagnosis/i.test(message)) return true;
  if (/complete clinical description/i.test(message)) return true;
  if (/enter key imaging/i.test(message)) return true;
  if (/enter reflective/i.test(message)) return true;
  if (/only self-uploaded images/i.test(message)) return true;
  if (/approve-and-promote fields/i.test(message)) return true;
  return false;
}

export class ExpertPromoteValidationError extends Error {
  readonly isUserError = true;

  constructor(message: string) {
    super(message);
    this.name = 'ExpertPromoteValidationError';
  }
}
