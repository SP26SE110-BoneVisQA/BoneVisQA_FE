'use client';

import { useMemo, useState } from 'react';
import { ListPageLayout } from '@/components/layouts';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildAdminCasesColumns } from '@/features/admin/components/tables/admin-cases-columns';
import { useAdminCasesPaged } from '@/features/admin/queries/use-admin-cases';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 20;

export function AdminCasesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(1);

  const casesQuery = useAdminCasesPaged(pageIndex, PAGE_SIZE);
  const totalCount = casesQuery.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayPage = Math.min(pageIndex, totalPages);

  const rows = useMemo(() => casesQuery.data?.items ?? [], [casesQuery.data]);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.boneLocation.toLowerCase().includes(q) ||
        row.lesionType.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const columns = useMemo(() => buildAdminCasesColumns(), []);

  const errorMessage = casesQuery.error
    ? getQueryErrorMessage(casesQuery.error, 'Unable to load medical cases.')
    : null;

  return (
    <ListPageLayout
      title="Medical cases"
      isLoading={casesQuery.isPending && !casesQuery.data}
      error={errorMessage}
      skeletonVariant="list"
      maxWidthClass="max-w-6xl"
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void queryClient.invalidateQueries({
              queryKey: [...queryKeys.admin.all, 'cases'],
            })
          }
        >
          Refresh
        </Button>
      }
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search cases on this page..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {totalCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Page {displayPage} of {totalPages} · {totalCount} case{totalCount === 1 ? '' : 's'} total
            </p>
          ) : null}
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={filteredRows}
        manualPagination
        pageCount={totalPages}
        pageIndex={displayPage - 1}
        onPageChange={(idx) => setPageIndex(idx + 1)}
        isLoading={casesQuery.isFetching}
        emptyTitle="No medical cases found"
        emptyDescription="No cases match the current page or filters."
      />
    </ListPageLayout>
  );
}
