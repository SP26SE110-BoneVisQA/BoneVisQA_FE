/** Canonical medical case difficulty tiers — aligned with DB values Easy, Medium, Hard. */
export type MedicalCaseDifficultyTier = 'easy' | 'medium' | 'hard';

export const MEDICAL_CASE_DIFFICULTY_TIERS: MedicalCaseDifficultyTier[] = ['easy', 'medium', 'hard'];

export const MEDICAL_CASE_DIFFICULTY_FILTER_OPTIONS = [
  { id: 'all' as const, label: 'All levels' },
  { id: 'easy' as const, label: 'Easy' },
  { id: 'medium' as const, label: 'Medium' },
  { id: 'hard' as const, label: 'Hard' },
];

export const MEDICAL_CASE_DIFFICULTY_API_VALUES = ['Easy', 'Medium', 'Hard'] as const;
export type MedicalCaseDifficultyApiValue = (typeof MEDICAL_CASE_DIFFICULTY_API_VALUES)[number];

export function medicalCaseDifficultyApiValue(tier: MedicalCaseDifficultyTier): MedicalCaseDifficultyApiValue {
  if (tier === 'hard') return 'Hard';
  if (tier === 'medium') return 'Medium';
  return 'Easy';
}

export function medicalCaseDifficultyLabel(tier: MedicalCaseDifficultyTier): string {
  return medicalCaseDifficultyApiValue(tier);
}

/** Map legacy Basic/Intermediate/Advanced and DB Easy/Medium/Hard to canonical tier. */
export function normalizeMedicalCaseDifficultyTier(raw: unknown): MedicalCaseDifficultyTier | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'easy' || value === 'basic' || value === 'beginner' || value === 'intro') return 'easy';
  if (value === 'medium' || value === 'intermediate' || value === 'moderate') return 'medium';
  if (value === 'hard' || value === 'advanced' || value === 'expert') return 'hard';
  return null;
}

export function normalizeMedicalCaseDifficultyDisplay(raw: unknown): {
  tier: MedicalCaseDifficultyTier | null;
  label: string;
} {
  const tier = normalizeMedicalCaseDifficultyTier(raw);
  if (tier) return { tier, label: medicalCaseDifficultyLabel(tier) };
  const rawStr = String(raw ?? '').trim();
  if (!rawStr) return { tier: null, label: '—' };
  return { tier: null, label: rawStr };
}

export function medicalCaseDifficultyBadgeClass(tier: MedicalCaseDifficultyTier): string {
  if (tier === 'hard') return 'text-destructive bg-destructive/10';
  if (tier === 'medium') return 'text-warning bg-warning/10';
  return 'text-success bg-success/10';
}

export function medicalCaseDifficultyBorderClass(tier: MedicalCaseDifficultyTier): string {
  if (tier === 'hard') return 'border-destructive/25 bg-destructive/10 text-destructive';
  if (tier === 'medium') return 'border-warning/25 bg-warning/10 text-warning';
  return 'border-success/25 bg-success/10 text-success';
}

/** Normalize catalog filter / API option strings for display in selects. */
export function formatMedicalCaseDifficultyFilterOption(raw: string): string {
  const { label } = normalizeMedicalCaseDifficultyDisplay(raw);
  return label === '—' ? raw : label;
}
