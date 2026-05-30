'use client';

import { Filter } from 'lucide-react';
import type { BoneSpecialtyOption, PathologyCategoryOption } from '@/lib/api/student';

type Props = {
  location: string;
  lesionType: string;
  difficulty: string;
  locations: string[];
  lesionTypes: string[];
  difficulties: string[];
  // Deep classification filters
  boneSpecialtyId: string;
  boneSpecialties: BoneSpecialtyOption[];
  pathologyCategoryId: string;
  pathologyCategories: PathologyCategoryOption[];
  severity: string;
  severities: string[];
  patientAgeGroup: string;
  patientAgeGroups: string[];
  // Change handlers
  onLocationChange: (value: string) => void;
  onLesionTypeChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
  onBoneSpecialtyChange: (value: string) => void;
  onPathologyCategoryChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onPatientAgeGroupChange: (value: string) => void;
};

export function CatalogFilter({
  location,
  lesionType,
  difficulty,
  locations,
  lesionTypes,
  difficulties,
  boneSpecialtyId,
  boneSpecialties,
  pathologyCategoryId,
  pathologyCategories,
  severity,
  severities,
  patientAgeGroup,
  patientAgeGroups,
  onLocationChange,
  onLesionTypeChange,
  onDifficultyChange,
  onBoneSpecialtyChange,
  onPathologyCategoryChange,
  onSeverityChange,
  onPatientAgeGroupChange,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 shrink-0 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Catalog filters
        </h2>
      </div>

      {/* Primary filters - row 1 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-card-foreground">
            Location
          </label>
          <select
            id="location"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All locations</option>
            {locations.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="lesionType" className="block text-sm font-medium text-card-foreground">
            Lesion Type
          </label>
          <select
            id="lesionType"
            value={lesionType}
            onChange={(e) => onLesionTypeChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All lesion types</option>
            {lesionTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-card-foreground">
            Difficulty
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All difficulty levels</option>
            {difficulties.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Deep classification filters - row 2 */}
      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="boneSpecialty" className="block text-sm font-medium text-card-foreground">
            Bone Specialty
          </label>
          <select
            id="boneSpecialty"
            value={boneSpecialtyId}
            onChange={(e) => onBoneSpecialtyChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All specialties</option>
            {boneSpecialties.map((option) => (
              <option key={option.id} value={option.id}>
                {option.level > 0 ? '\u00A0\u00A0'.repeat(option.level) : ''}
                {option.name}
                {option.parentName ? ` (${option.parentName})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pathologyCategory" className="block text-sm font-medium text-card-foreground">
            Pathology Category
          </label>
          <select
            id="pathologyCategory"
            value={pathologyCategoryId}
            onChange={(e) => onPathologyCategoryChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All categories</option>
            {pathologyCategories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.boneSpecialtyName ? ` (${option.boneSpecialtyName})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="severity" className="block text-sm font-medium text-card-foreground">
            Severity
          </label>
          <select
            id="severity"
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All severities</option>
            {severities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="patientAgeGroup" className="block text-sm font-medium text-card-foreground">
            Patient Age Group
          </label>
          <select
            id="patientAgeGroup"
            value={patientAgeGroup}
            onChange={(e) => onPatientAgeGroupChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All age groups</option>
            {patientAgeGroups.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
