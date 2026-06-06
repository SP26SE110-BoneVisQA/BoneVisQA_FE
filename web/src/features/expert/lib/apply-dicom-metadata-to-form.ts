import type { UseFormSetValue } from 'react-hook-form';
import {
  mapDicomAnatomyToExpert,
  mapDicomModalityToExpert,
  type VisualQaDicomMetadata,
} from '@/lib/api/visual-qa/dicom-metadata';
import type { ExpertCaseFormValues } from '@/features/expert/schemas/expert-case-form-schema';
import {
  EXPERT_PATHOLOGY_GROUPS,
  pathologyGroupToCategoryId,
} from '@/features/expert/lib/expert-ontology';
import type { ExpertCategory } from '@/lib/api/expert-cases';

/** Auto-fill expert case form fields from ingest metadata (unknown values → Other). */
export function applyDicomMetadataToExpertForm(
  setValue: UseFormSetValue<ExpertCaseFormValues>,
  metadata: VisualQaDicomMetadata,
  categories: ExpertCategory[] = [],
): void {
  setValue('modality', mapDicomModalityToExpert(metadata.modality ?? null), {
    shouldDirty: true,
    shouldValidate: true,
  });
  setValue(
    'anatomySite',
    mapDicomAnatomyToExpert(metadata.anatomySite ?? null, metadata.bodyPartExamined ?? null),
    { shouldDirty: true, shouldValidate: true },
  );

  const categoryId = resolvePathologyCategoryFromMetadata(metadata, categories);
  if (categoryId) {
    setValue('categoryId', categoryId, { shouldDirty: true, shouldValidate: true });
  }
}

function resolvePathologyCategoryFromMetadata(
  metadata: VisualQaDicomMetadata,
  categories: ExpertCategory[],
): string | null {
  const haystack = [metadata.anatomySite, metadata.bodyPartExamined, metadata.modality]
    .map((v) => String(v ?? '').toLowerCase())
    .join(' ');
  if (!haystack.trim()) return null;

  for (const group of EXPERT_PATHOLOGY_GROUPS) {
    if (haystack.includes(group.toLowerCase())) {
      const match = categories.find((c) => c.name.toLowerCase() === group.toLowerCase());
      return match?.id ?? pathologyGroupToCategoryId(group);
    }
  }
  return null;
}

/**
 * Reuses the form helper above to derive the same anatomy/modality mapping
 * for non-form flows such as review → promote.
 */
export function deriveExpertCaseFormPrefillFromDicom(
  metadata: VisualQaDicomMetadata | null | undefined,
): Pick<ExpertCaseFormValues, 'anatomySite' | 'modality'> {
  const derived: Pick<ExpertCaseFormValues, 'anatomySite' | 'modality'> = {
    anatomySite: 'Other',
    modality: 'Other',
  };
  if (!metadata) return derived;

  const setValue = ((name: keyof ExpertCaseFormValues, value: unknown) => {
    if (name === 'anatomySite') {
      derived.anatomySite = value as ExpertCaseFormValues['anatomySite'];
    } else if (name === 'modality') {
      derived.modality = value as ExpertCaseFormValues['modality'];
    }
  }) as UseFormSetValue<ExpertCaseFormValues>;

  applyDicomMetadataToExpertForm(setValue, metadata);
  return derived;
}
