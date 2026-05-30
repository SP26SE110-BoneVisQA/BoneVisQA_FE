'use client';

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  /** Client-side page size; omit to disable built-in pagination. */
  pageSize?: number;
  /** Server-driven pagination (disables client row model paging). */
  manualPagination?: boolean;
  pageCount?: number;
  pageIndex?: number;
  onPageChange?: (pageIndex: number) => void;
  isLoading?: boolean;
  className?: string;
};

export function DataTable<TData>({
  columns,
  data,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or search query.',
  emptyIcon,
  pageSize = 10,
  manualPagination = false,
  pageCount,
  pageIndex: controlledPageIndex,
  onPageChange,
  isLoading = false,
  className,
}: DataTableProps<TData>) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: controlledPageIndex ?? 0,
    pageSize,
  });

  const pageIndex = controlledPageIndex ?? pagination.pageIndex;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(manualPagination
      ? {
          manualPagination: true,
          pageCount: pageCount ?? 1,
          onPaginationChange: (updater) => {
            const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
            onPageChange?.(next.pageIndex);
          },
        }
      : {
          getPaginationRowModel: getPaginationRowModel(),
          onPaginationChange: setPagination,
        }),
    state: {
      pagination: { pageIndex, pageSize },
    },
  });

  const rows = table.getRowModel().rows;
  const showPagination =
    manualPagination ? (pageCount ?? 1) > 1 : data.length > pageSize;

  const paginationLabel = useMemo(() => {
    if (manualPagination && pageCount) {
      return `Page ${pageIndex + 1} of ${pageCount}`;
    }
    const total = table.getPageCount();
    return `Page ${pageIndex + 1} of ${Math.max(1, total)}`;
  }, [manualPagination, pageCount, pageIndex, table]);

  if (!isLoading && data.length === 0) {
    return (
      <div className={cn('rounded-xl border border-border bg-card py-12', className)}>
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-semibold uppercase tracking-wide">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{paginationLabel}</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage() || isLoading}
              onClick={() => {
                if (manualPagination) onPageChange?.(Math.max(0, pageIndex - 1));
                else table.previousPage();
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage() || isLoading}
              onClick={() => {
                if (manualPagination) onPageChange?.(pageIndex + 1);
                else table.nextPage();
              }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
