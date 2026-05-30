'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListPageLayout } from '@/components/layouts';
import { EmptyState } from '@/components/shared/EmptyState';
import { CaseCatalogCard } from '@/components/student/CaseCatalogCard';
import { CatalogFilter } from '@/components/student/CatalogFilter';
import {
  useStudentCatalog,
  useStudentCatalogFilters,
} from '@/features/student/queries/use-student-catalog';
import { getQueryErrorMessage } from '@/lib/query-utils';
import type { StudentCaseCatalogItem } from '@/lib/api/types';
import { BookOpen } from 'lucide-react';

export function CatalogPage() {
  const searchParams = useSearchParams();
  const [location, setLocation] = useState('');
  const [lesionType, setLesionType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const query = searchParams.get('q')?.trim().toLowerCase() ?? '';

  const filtersQuery = useStudentCatalogFilters();
  const catalogQuery = useStudentCatalog({
    location,
    lesionType,
    difficulty,
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
    if (fromApi?.length) return fromApi.map((d) => d.toLowerCase());
    return Array.from(
      new Set(
        items
          .map((item) => item.difficultyTier ?? item.difficulty ?? item.difficultyLabel)
          .filter((v): v is string => Boolean(v && String(v).trim() && String(v) !== '—')),
      ),
    ).sort();
  }, [filtersQuery.data?.difficulties, items]);

  const visibleItems = useMemo(() => {
    if (!query) return items;
    return items.filter((item) => {
      const tagStr = (item.tags ?? []).join(' ');
      const haystack = `${item.title} ${item.location} ${item.lesionType} ${item.categoryDisplay ?? ''} ${item.difficultyLabel} ${tagStr}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [items, query]);

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
          onLocationChange={setLocation}
          onLesionTypeChange={setLesionType}
          onDifficultyChange={setDifficulty}
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
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-card-foreground">{visibleItems.length}</span>{' '}
            public case{visibleItems.length === 1 ? '' : 's'} from the catalog.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <CaseCatalogCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </ListPageLayout>
  );
}
