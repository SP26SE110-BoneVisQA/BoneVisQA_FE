'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import useSWR from 'swr';
import Header from '@/components/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageLoadingSkeleton, SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import CaseListRow from '@/components/expert/cases/CaseListRow';
import CreateExpertCaseModal from '@/components/expert/cases/CreateExpertCaseModal';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus, Search, Sparkles, Filter, X } from 'lucide-react';
import { EXPERT_DASHBOARD_QUERY_KEY } from '@/lib/api/expert-dashboard';
import { fetchExpertCasesPaged, type ExpertCasePagedResponse } from '@/lib/api/expert-cases';
import { getApiProblemDetails } from '@/lib/api/client';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type StatusTab = 'all' | 'pending' | 'approved' | 'draft';

interface ExpertFilterState {
  location: string;
  lesionType: string;
  difficulty: string;
}

const PAGE_SIZE = 4;
const RECENT_EDITED_CASE_IDS_KEY = 'expert_case_library_recent_ids';
const LOCATION_OPTIONS = ['All', 'Upper Limb', 'Lower Limb', 'Spine', 'Pelvis', 'Shoulder', 'Elbow', 'Wrist', 'Hand', 'Hip', 'Knee', 'Ankle', 'Foot'];
const LESION_TYPE_OPTIONS = ['All', 'Fracture', 'Arthritis', 'Tumor', 'Infection', 'Congenital', 'Trauma', 'Degenerative', 'Other'];
const DIFFICULTY_OPTIONS = ['All', 'Easy', 'Medium', 'Hard'];

export default function ExpertCasesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const toastedErrorRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [recentEditedCaseIds, setRecentEditedCaseIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ExpertFilterState>({
    location: 'All',
    lesionType: 'All',
    difficulty: 'All',
  });

  const hasActiveFilters =
    filters.location !== 'All' || filters.lesionType !== 'All' || filters.difficulty !== 'All';

  const { data: allCasesData, isLoading, error } = useSWR<ExpertCasePagedResponse>(
    ['expert-case-library-paged'],
    () => fetchExpertCasesPaged(1, 1000),
    { revalidateOnFocus: false, dedupingInterval: 10000 },
  );

  const cases = allCasesData?.items ?? [];

  useEffect(() => {
    if (!error) return;
    const { title, detail } = getApiProblemDetails(error);
    const message = detail ? `${title}: ${detail}` : title;
    if (toastedErrorRef.current === message) return;
    toastedErrorRef.current = message;
    toast.error(message);
  }, [error, toast]);

  useEffect(() => {
    if (allCasesData) toastedErrorRef.current = null;
  }, [allCasesData]);

  const counts = useMemo(() => {
    return {
      all: cases.length,
      pending: cases.filter((c) => c.status === 'pending').length,
      approved: cases.filter((c) => c.status === 'approved').length,
      draft: cases.filter((c) => c.status === 'draft').length,
    };
  }, [cases]);

  useEffect(() => {
    const refreshRecentEditedCases = () => {
      if (typeof window === 'undefined') return;
      try {
        const raw = localStorage.getItem(RECENT_EDITED_CASE_IDS_KEY);
        const parsed = raw ? (JSON.parse(raw) as string[]) : [];
        setRecentEditedCaseIds(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRecentEditedCaseIds([]);
      }
    };
    refreshRecentEditedCases();
    window.addEventListener('focus', refreshRecentEditedCases);
    return () => window.removeEventListener('focus', refreshRecentEditedCases);
  }, []);

  const filtered = useMemo(() => {
    const statusRank: Record<string, number> = {
      approved: 0,
      pending: 1,
      draft: 2,
      rejected: 3,
    };
    const recentIndex = new Map(recentEditedCaseIds.map((id, idx) => [id, idx]));
    const toTimestamp = (value: string | null | undefined) => {
      if (!value) return 0;
      const ts = Date.parse(value);
      return Number.isNaN(ts) ? 0 : ts;
    };

    const byTab = activeTab === 'all' ? cases : cases.filter((c) => c.status === activeTab);
    const q = query.trim().toLowerCase();
    let result = q ? byTab.filter((c) => c.title.toLowerCase().includes(q)) : byTab;

    if (filters.location !== 'All') {
      result = result.filter((c) =>
        (c.boneLocation ?? '').toLowerCase().includes(filters.location.toLowerCase()),
      );
    }
    if (filters.lesionType !== 'All') {
      result = result.filter((c) =>
        (c.categoryName ?? '').toLowerCase().includes(filters.lesionType.toLowerCase()),
      );
    }
    if (filters.difficulty !== 'All') {
      result = result.filter(
        (c) => String(c.difficulty ?? '').toLowerCase() === filters.difficulty.toLowerCase(),
      );
    }
    return [...result].sort((a, b) => {
      const aRecent = recentIndex.get(a.id);
      const bRecent = recentIndex.get(b.id);
      if (aRecent !== undefined || bRecent !== undefined) {
        if (aRecent === undefined) return 1;
        if (bRecent === undefined) return -1;
        if (aRecent !== bRecent) return aRecent - bRecent;
      }

      if (activeTab === 'all') {
        const rankDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
        if (rankDiff !== 0) return rankDiff;
      }

      const timeDiff = toTimestamp(b.addedDate) - toTimestamp(a.addedDate);
      if (timeDiff !== 0) return timeDiff;
      return a.title.localeCompare(b.title);
    });
  }, [activeTab, cases, query, filters, recentEditedCaseIds]);

  const filteredTotal = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPageIndex(1);
  }, [activeTab, query, filters]);

  const pagedItems = useMemo(() => {
    const start = (pageIndex - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageIndex]);

  const updateFilter = (key: keyof ExpertFilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({ location: 'All', lesionType: 'All', difficulty: 'All' });
  };

  const promoteCaseToTop = (caseId?: string) => {
    if (!caseId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(RECENT_EDITED_CASE_IDS_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [caseId, ...parsed.filter((id) => id !== caseId)].slice(0, 30);
      localStorage.setItem(RECENT_EDITED_CASE_IDS_KEY, JSON.stringify(next));
      setRecentEditedCaseIds(next);
    } catch {
      // ignore localStorage errors
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header title="Teaching case library" subtitle="Author, curate, and publish cases for Visual QA and coursework" />

      <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Expert workspace
              </div>
              <h2 className="text-xl font-bold tracking-tight text-card-foreground sm:text-2xl">Cases you own</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Create cases with optional imaging and ROI. Escalated student reviews live under{' '}
                <Link href="/expert/reviews" className="font-medium text-primary underline-offset-4 hover:underline">
                  Expert review
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:flex-col md:items-stretch">
              <Button type="button" className="h-11 gap-2 shadow-md" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New case
              </Button>
              <Link
                href="/expert/reviews"
                className={cn(
                  'inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground',
                  'transition-colors hover:bg-muted/50',
                )}
              >
                Open review queue
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-colors',
                activeTab === id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-card hover:bg-muted/40',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">{count}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title..."
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search cases"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="mr-1 h-4 w-4" />
              Filters
            </Button>
            {hasActiveFilters ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground">
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
                <span className="text-sm text-muted-foreground">
                  {filteredTotal} result{filteredTotal !== 1 ? 's' : ''}
                </span>
              </>
            ) : null}
          </div>

          {showFilters ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-3">
              <select
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <select
                value={filters.lesionType}
                onChange={(e) => updateFilter('lesionType', e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {LESION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <select
                value={filters.difficulty}
                onChange={(e) => updateFilter('difficulty', e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <PageLoadingSkeleton>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <SkeletonBlock className="h-6 w-36 rounded-full" />
                  <SkeletonBlock className="mt-3 h-6 w-4/5" />
                  <SkeletonBlock className="mt-2 h-4 w-2/3" />
                  <SkeletonBlock className="mt-4 h-24 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </PageLoadingSkeleton>
        ) : filteredTotal === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-7 w-7 text-primary" />}
            title={query.trim() ? 'No matches' : `No ${activeTab === 'all' ? '' : `${activeTab} `}cases`}
            description={query.trim() ? 'Try another search or clear the filter.' : 'Create a case or switch tabs to see other statuses.'}
            action={
              <Button type="button" onClick={() => setCreateOpen(true)}>
                Create case
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {pagedItems.map((item) => (
              <CaseListRow
                key={item.id}
                id={item.id}
                title={item.title}
                boneLocation={item.boneLocation ?? 'N/A'}
                lesionType={item.categoryName ?? 'N/A'}
                difficulty={(item.difficulty ?? 'Easy') as 'Easy' | 'Medium' | 'Hard'}
                status={(item.status ?? 'draft') as 'draft' | 'pending' | 'approved' | 'rejected'}
                addedBy={item.addedBy ?? 'Unknown'}
                addedDate={item.addedDate ?? ''}
                thumbnailUrl={item.thumbnailUrl ?? item.medicalImages?.[0]?.imageUrl ?? null}
              />
            ))}

            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(pageIndex - 1) * PAGE_SIZE + 1} to {Math.min(pageIndex * PAGE_SIZE, filteredTotal)} of {filteredTotal} cases
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                    disabled={pageIndex === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-3 text-sm">
                    Page {pageIndex} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
                    disabled={pageIndex === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <CreateExpertCaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(newId) => {
          promoteCaseToTop(newId);
          setActiveTab('all');
          setQuery('');
          setFilters({ location: 'All', lesionType: 'All', difficulty: 'All' });
          setPageIndex(1);
          void queryClient.invalidateQueries({ queryKey: EXPERT_DASHBOARD_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: ['expert-case-library-paged'] });
          toast.success('Case created successfully.');
        }}
      />
    </div>
  );
}
