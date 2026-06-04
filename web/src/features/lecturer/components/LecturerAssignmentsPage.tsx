'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ListPageLayout } from '@/components/layouts';
import StatCard from '@/components/StatCard';
import AssignmentCard from '@/components/lecturer/AssignmentCard';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { useLecturerAssignments, useDeleteLecturerAssignment } from '@/features/lecturer/queries/use-lecturer-assignments';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import type { ClassAssignment } from '@/lib/api/types';
import {
  ClipboardList,
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Search,
  Trash2,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const statusFilters = ['all', 'active', 'overdue', 'completed'] as const;
type StatusFilter = (typeof statusFilters)[number];

const PAGE_SIZE = 9;

function computeStatus(
  dueDate: string | null | undefined,
  submitted: number,
  total: number,
): 'active' | 'overdue' | 'completed' {
  if (submitted > 0 && submitted >= total && total > 0) return 'completed';
  if (dueDate && new Date(dueDate) < new Date()) return 'overdue';
  return 'active';
}

function buildPageList(totalPages: number, current: number): (number | 'ellipsis')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  for (const p of [...pages]) {
    if (p < 1 || p > totalPages) pages.delete(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

export function LecturerAssignmentsPage() {
  const assignmentsQuery = useLecturerAssignments();
  const deleteMutation = useDeleteLecturerAssignment();
  const assignments = assignmentsQuery.data ?? [];
  const loading = assignmentsQuery.isPending;
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [newAssignmentIds, setNewAssignmentIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const storedIds = sessionStorage.getItem('newAssignmentIds');
      if (!storedIds) return new Set();
      return new Set(JSON.parse(storedIds) as string[]);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (newAssignmentIds.size === 0) return;
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem('newAssignmentIds');
      sessionStorage.removeItem('newAssignmentType');
      setNewAssignmentIds(new Set());
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [newAssignmentIds.size]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [page, setPage] = useState(1);

  const toggleSelect = (id: string) => {
    setSelectMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedAssignments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedAssignments.map((a) => a.id)));
    }
  };

  const confirmBulkDelete = async () => {
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      appToast.success(`Deleted ${ids.length} assignment(s).`);
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkDeleteOpen(false);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Failed to delete assignments.');
    }
  };

  const errorMessage = assignmentsQuery.error
    ? getQueryErrorMessage(assignmentsQuery.error, 'Failed to load assignments.')
    : null;

  const stats = useMemo(() => {
    const active = assignments.filter(
      (a) => computeStatus(a.dueDate, a.submittedCount, a.totalStudents) === 'active',
    ).length;
    const overdue = assignments.filter(
      (a) => computeStatus(a.dueDate, a.submittedCount, a.totalStudents) === 'overdue',
    ).length;
    const completed = assignments.filter(
      (a) => computeStatus(a.dueDate, a.submittedCount, a.totalStudents) === 'completed',
    ).length;
    return [
      {
        title: 'Total Assignments',
        value: String(assignments.length),
        change: 'This semester',
        changeType: 'neutral' as const,
        icon: ClipboardList,
        iconColor: 'bg-primary/10 text-primary',
      },
      {
        title: 'Active',
        value: String(active),
        change: active > 0 ? 'Require attention' : 'No active assignments',
        changeType: 'neutral' as const,
        icon: Clock,
        iconColor: 'bg-accent/10 text-accent',
      },
      {
        title: 'Overdue',
        value: String(overdue),
        change: overdue > 0 ? 'Needs follow-up' : 'No overdue',
        changeType: overdue > 0 ? ('negative' as const) : ('positive' as const),
        icon: AlertCircle,
        iconColor: 'bg-destructive/10 text-destructive',
      },
      {
        title: 'Completed',
        value: String(completed),
        change: completed > 0 ? 'All graded' : 'No completed yet',
        changeType: 'positive' as const,
        icon: CheckCircle,
        iconColor: 'bg-success/10 text-success',
      },
    ];
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const status = computeStatus(a.dueDate, a.submittedCount, a.totalStudents);
      const matchesFilter = activeFilter === 'all' || status === activeFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q) ||
        (a.type ?? '').toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [assignments, activeFilter, searchQuery]);

  const totalPages = filteredAssignments.length === 0 ? 0 : Math.ceil(filteredAssignments.length / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const pagedAssignments = totalPages === 0 ? [] : filteredAssignments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageItems = buildPageList(totalPages, currentPage);

  const listStart = filteredAssignments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const listEnd = filteredAssignments.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, filteredAssignments.length);

  return (
    <ListPageLayout
      title="Assignments"
      isLoading={loading && assignments.length === 0}
      error={errorMessage}
      maxWidthClass="max-w-[1600px]"
    >
      <div>
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading
            ? stats.map((s) => (
                <div
                  key={s.title}
                  className="bg-card rounded-xl border border-border p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-8 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))
            : stats.map((s) => <StatCard key={s.title} {...s} />)}
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectMode(!selectMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors duration-150 cursor-pointer ${
                selectMode
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Multi Select
            </button>
            {statusFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => { setActiveFilter(filter); setPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors duration-150 cursor-pointer ${
                  activeFilter === filter
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {filter === 'all' ? 'All' : filter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {selectMode && selectedIds.size > 0 && (
              <button
                onClick={() => setBulkDeleteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedIds.size})
              </button>
            )}
            {selectMode && pagedAssignments.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-150 cursor-pointer"
              >
                {selectedIds.size === pagedAssignments.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Select All
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary w-64"
            />
          </div>
          <Link
            href="/lecturer/assignments/create"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium text-sm">New Assignment</span>
          </Link>
        </div>

        {/* Assignments Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-card-foreground mb-1">
              {assignments.length === 0 ? 'No assignments yet' : 'No assignments match your filter'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {assignments.length === 0
                ? 'Create a new assignment from a class detail page.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedAssignments.map((a) => (
              <AssignmentCard
                key={a.id}
                {...a}
                submitted={a.submittedCount}
                graded={a.gradedCount}
                selectable={selectMode}
                selected={selectedIds.has(a.id)}
                onSelect={toggleSelect}
                isNew={newAssignmentIds.has(`${a.classId}_${a.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Showing {listStart} to {listEnd} of {filteredAssignments.length} assignments
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/30 bg-white text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageItems.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="px-1 text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors cursor-pointer ${
                        item === currentPage
                          ? 'bg-primary text-white'
                          : 'border border-border/30 bg-white hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/30 bg-white text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      <DestructiveConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected assignments?"
        confirmLabel="Delete assignments"
        onConfirm={confirmBulkDelete}
        isLoading={deleteMutation.isPending}
      />
    </ListPageLayout>
  );
}
