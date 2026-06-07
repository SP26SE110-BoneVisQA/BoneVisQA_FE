'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ListPageLayout } from '@/components/layouts';
import { EmptyState } from '@/components/shared/EmptyState';
import CaseManagementCard from '@/components/expert/CaseManagementCard';
import CaseAssetsDialog from '@/components/expert/cases/CaseAssetsDialog';
import CreateExpertCaseModal from '@/components/expert/cases/CreateExpertCaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useExpertCaseLibrary, type ExpertCaseLibraryResponse } from '@/features/expert/queries/use-expert-cases';
import type { ExpertCaseOrigin } from '@/lib/api/expert-cases';
import { queryKeys } from '@/lib/query-keys';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { FolderOpen, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

type OriginTab = 'all' | ExpertCaseOrigin;

const ITEMS_PER_PAGE = 6;
const EXPERT_CASES_PAGE_SIZE = 20;

export function ExpertCasesPage() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const casesQuery = useExpertCaseLibrary({ pageIndex: 1, pageSize: EXPERT_CASES_PAGE_SIZE });
  const [activeTab, setActiveTab] = useState<OriginTab>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [assetsCaseId, setAssetsCaseId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const casesData: ExpertCaseLibraryResponse | undefined = casesQuery.data;
  const allCases = casesData?.items ?? [];

  const filtered = useMemo(() => {
    const byTab =
      activeTab === 'all' ? allCases : allCases.filter((c) => c.caseOrigin === activeTab);
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((c) => c.title.toLowerCase().includes(q));
  }, [activeTab, allCases, query]);

  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCases = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleTabChange = (tab: OriginTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const counts = useMemo(
    () => ({
      all: allCases.length,
      expertCreated: allCases.filter((c) => c.caseOrigin === 'expertCreated').length,
      fromStudentRequest: allCases.filter((c) => c.caseOrigin === 'fromStudentRequest').length,
    }),
    [allCases],
  );

  const errorMessage = casesQuery.error
    ? getQueryErrorMessage(casesQuery.error, 'Failed to load case library.')
    : null;

  return (
    <>
      <ListPageLayout
        title="Teaching case library"
        isLoading={casesQuery.isPending}
        error={errorMessage}
        skeletonVariant="card-grid"
        maxWidthClass="max-w-[1240px]"
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New case
          </Button>
        }
        toolbar={
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Cases you create or publish from student reviews appear here and in your students&apos; class
              library immediately. Escalated reviews are handled in{' '}
              <Link href="/expert/reviews" className="font-medium text-primary hover:underline">
                Expert review
              </Link>
              .
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'All cases', counts.all],
                  ['expertCreated', 'Created by you', counts.expertCreated],
                  ['fromStudentRequest', 'From student requests', counts.fromStudentRequest],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleTabChange(id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    activeTab === id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search cases..."
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        }
      >
        {filtered.length === 0 && !casesQuery.isPending ? (
          <EmptyState
            icon={<FolderOpen className="h-6 w-6 text-primary" />}
            title={activeTab === 'all' ? 'No cases yet' : 'No cases in this tab'}
            description={
              activeTab === 'all'
                ? 'Create a teaching case or publish one from an escalated student review.'
                : 'Switch tabs or create a new case to populate this view.'
            }
            action={
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New case
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedCases.map((item) => (
                <CaseManagementCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  boneLocation={item.boneLocation}
                  lesionType={item.categoryName}
                  difficulty={
                    item.difficulty === 'Hard'
                      ? 'advanced'
                      : item.difficulty === 'Medium'
                        ? 'intermediate'
                        : 'basic'
                  }
                  caseOrigin={item.caseOrigin}
                  addedBy={item.addedBy || item.expertName || ''}
                  addedDate={item.addedDate}
                  thumbnailUrl={item.thumbnailUrl}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || casesQuery.isPending}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || casesQuery.isPending}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </ListPageLayout>

      <CreateExpertCaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (caseId) => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
          await queryClient.refetchQueries({ queryKey: queryKeys.expert.cases() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() });
          if (caseId) setAssetsCaseId(caseId);
        }}
      />

      {assetsCaseId ? (
        <CaseAssetsDialog
          caseId={assetsCaseId}
          mode="annotations"
          allowModeSwitch
          onClose={() => setAssetsCaseId(null)}
        />
      ) : null}
    </>
  );
}
