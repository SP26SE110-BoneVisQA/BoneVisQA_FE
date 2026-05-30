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
import { useExpertCaseLibrary } from '@/features/expert/queries/use-expert-cases';
import { queryKeys } from '@/lib/query-keys';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { FolderOpen, Plus, Search, Sparkles } from 'lucide-react';

type StatusTab = 'all' | 'pending' | 'approved' | 'draft';

export function ExpertCasesPage() {
  const queryClient = useQueryClient();
  const casesQuery = useExpertCaseLibrary();
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [assetsCaseId, setAssetsCaseId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const cases = casesQuery.data ?? [];
  const counts = useMemo(
    () => ({
      all: cases.length,
      pending: cases.filter((c) => c.status === 'pending').length,
      approved: cases.filter((c) => c.status === 'approved').length,
      draft: cases.filter((c) => c.status === 'draft').length,
    }),
    [cases],
  );

  const filtered = useMemo(() => {
    const byTab = activeTab === 'all' ? cases : cases.filter((c) => c.status === activeTab);
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((c) => c.title.toLowerCase().includes(q));
  }, [activeTab, cases, query]);

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
              Escalated student reviews are handled in{' '}
              <Link href="/expert/reviews" className="font-medium text-primary hover:underline">
                Expert review
              </Link>
              .
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'All', counts.all],
                  ['pending', 'Pending', counts.pending],
                  ['approved', 'Approved', counts.approved],
                  ['draft', 'Draft', counts.draft],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
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
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        }
      >
        {filtered.length === 0 && !casesQuery.isPending ? (
          <EmptyState
            icon={<FolderOpen className="h-6 w-6 text-primary" />}
            title="No cases in this tab"
            action={
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New case
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <CaseManagementCard
                key={item.id}
                id={item.id}
                title={item.title}
                boneLocation={item.boneLocation}
                lesionType={item.lesionType}
                difficulty={item.difficulty}
                status={item.status}
                addedBy={item.addedBy}
                addedDate={item.addedDate}
                viewCount={item.viewCount}
                usageCount={item.usageCount}
                thumbnailUrl={item.thumbnailUrl}
              />
            ))}
          </div>
        )}
      </ListPageLayout>

      <CreateExpertCaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(caseId) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
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
