import type { UseFormSetValue } from 'react-hook-form';
import {
  mapDicomAnatomyToExpert,
  mapDicomModalityToExpert,
  type VisualQaDicomMetadata,
} from '@/lib/api/visual-qa/dicom-metadata';
import type { ExpertCaseFormValues } from '@/features/expert/schemas/expert-case-form-schema';

/** Auto-fill expert case form fields from ingest metadata (unknown values → Other). */
export function applyDicomMetadataToExpertForm(
  setValue: UseFormSetValue<ExpertCaseFormValues>,
  metadata: VisualQaDicomMetadata,
): void {
  setValue('modality', mapDicomModalityToExpert(metadata.modality ?? null), {
    shouldDirty: true,
  });
  setValue(
    'anatomySite',
    mapDicomAnatomyToExpert(metadata.anatomySite ?? null, metadata.bodyPartExamined ?? null),
    { shouldDirty: true },
  );
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
