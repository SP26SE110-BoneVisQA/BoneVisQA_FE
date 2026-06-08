'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListPageLayout } from '@/components/layouts';
import { EmptyState } from '@/components/shared/EmptyState';
import { CaseCatalogCard } from '@/components/student/CaseCatalogCard';
import { CatalogFilter } from '@/components/student/CatalogFilter';
import { Button } from '@/components/ui/button';
import {
  useBoneSpecialtyOptions,
  usePathologyCategoryOptions,
  useStudentCatalog,
  useStudentCatalogFilters,
} from '@/features/student/queries/use-student-catalog';
import { getQueryErrorMessage } from '@/lib/query-utils';
import type { StudentCaseCatalogItem } from '@/lib/api/types';
import {
  formatMedicalCaseDifficultyFilterOption,
  medicalCaseDifficultyApiValue,
  normalizeMedicalCaseDifficultyTier,
} from '@/lib/medical-case-difficulty';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 6;

export function CatalogPage() {
  const searchParams = useSearchParams();
  const [location, setLocation] = useState('');
  const [lesionType, setLesionType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [boneSpecialtyId, setBoneSpecialtyId] = useState('');
  const [pathologyCategoryId, setPathologyCategoryId] = useState('');
  const [severity, setSeverity] = useState('');
  const [patientAgeGroup, setPatientAgeGroup] = useState('');
  const [pageIndex, setPageIndex] = useState(1);
  const query = searchParams.get('q')?.trim().toLowerCase() ?? '';

  useEffect(() => {
    setPageIndex(1);
  }, [location, lesionType, difficulty, boneSpecialtyId, pathologyCategoryId, severity, patientAgeGroup, query]);

  const filtersQuery = useStudentCatalogFilters();
  const boneSpecialtiesQuery = useBoneSpecialtyOptions();
  const pathologyCategoriesQuery = usePathologyCategoryOptions();
  const catalogQuery = useStudentCatalog({
    location,
    lesionType,
    difficulty,
    boneSpecialtyId,
    pathologyCategoryId,
    severity,
    patientAgeGroup,
    q: query || undefined,
  });

  const items = useMemo<StudentCaseCatalogItem[]>(
    () => catalogQuery.data ?? [],
    [catalogQuery.data],
  );

  const locationOptions = useMemo(() => {
    const fromApi = filtersQuery.data?.locations;
    if (fromApi?.length) return fromApi;
    return Array.from(new Set(items.map((item) => item.location).filter(Boolean))).sort();
  }, [filtersQuery.data?.locations, items]);

  const lesionOptions = useMemo(() => {
    const fromApi = filtersQuery.data?.lesionTypes;
    if (fromApi?.length) return fromApi;
    return Array.from(new Set(items.map((item) => item.lesionType).filter(Boolean))).sort();
  }, [filtersQuery.data?.lesionTypes, items]);

  const difficultyOptions = useMemo(() => {
    const fromApi = filtersQuery.data?.difficulties;
    const rawValues = fromApi?.length
      ? fromApi
      : Array.from(
          new Set(
            items
              .map((item) => item.difficultyTier ?? item.difficulty ?? item.difficultyLabel)
              .filter((v): v is string => Boolean(v && String(v).trim() && String(v) !== '—')),
          ),
        );
    return rawValues
      .map((value) => {
        const tier = normalizeMedicalCaseDifficultyTier(value);
        return tier ? medicalCaseDifficultyApiValue(tier) : formatMedicalCaseDifficultyFilterOption(value);
      })
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .sort();
  }, [filtersQuery.data?.difficulties, items]);

  const severityOptions = useMemo(() => {
    const fromApi = filtersQuery.data?.severities;
    if (fromApi?.length) return fromApi;
    return ['Mild', 'Moderate', 'Severe'];
  }, [filtersQuery.data?.severities]);

  const patientAgeGroupOptions = useMemo(() => {
    const fromApi = filtersQuery.data?.patientAgeGroups;
    if (fromApi?.length) return fromApi;
    return ['Pediatric', 'Adult', 'Geriatric'];
  }, [filtersQuery.data?.patientAgeGroups]);

  const visibleItems = useMemo(() => {
    if (!query) return items;
    return items.filter((item) => {
      const tagStr = (item.tags ?? []).join(' ');
      const haystack = `${item.title} ${item.location} ${item.lesionType} ${item.categoryDisplay ?? ''} ${item.difficultyLabel} ${tagStr}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [items, query]);

  const totalItems = visibleItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const validPage = Math.min(pageIndex, totalPages);
  const startIndex = (validPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const pagedItems = visibleItems.slice(startIndex, endIndex);

  const errorMessage = catalogQuery.error
    ? getQueryErrorMessage(catalogQuery.error, 'Failed to load case catalog.')
    : null;

  const isLoading = catalogQuery.isPending && !catalogQuery.data;

  return (
    <ListPageLayout
      title="Case catalog"
      isLoading={isLoading}
      error={errorMessage}
      skeletonVariant="card-grid"
      toolbar={
        <CatalogFilter
          location={location}
          lesionType={lesionType}
          difficulty={difficulty}
          locations={locationOptions}
          lesionTypes={lesionOptions}
          difficulties={difficultyOptions}
          boneSpecialtyId={boneSpecialtyId}
          boneSpecialties={boneSpecialtiesQuery.data ?? []}
          pathologyCategoryId={pathologyCategoryId}
          pathologyCategories={pathologyCategoriesQuery.data ?? []}
          severity={severity}
          severities={severityOptions}
          patientAgeGroup={patientAgeGroup}
          patientAgeGroups={patientAgeGroupOptions}
          onLocationChange={setLocation}
          onLesionTypeChange={setLesionType}
          onDifficultyChange={setDifficulty}
          onBoneSpecialtyChange={setBoneSpecialtyId}
          onPathologyCategoryChange={setPathologyCategoryId}
          onSeverityChange={setSeverity}
          onPatientAgeGroupChange={setPatientAgeGroup}
        />
      }
    >
      {visibleItems.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6 text-primary" />}
          title="No cases match your filters"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing{' '}
              <span className="font-medium text-card-foreground">
                {startIndex + 1}-{endIndex}
              </span>{' '}
              of <span className="font-medium text-card-foreground">{totalItems}</span> public case
              {totalItems === 1 ? '' : 's'} from the catalog.
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={validPage <= 1}
                  onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {validPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={validPage >= totalPages}
                  onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedItems.map((item) => (
              <CaseCatalogCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </ListPageLayout>
  );
}
