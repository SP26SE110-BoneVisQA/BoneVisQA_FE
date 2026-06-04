'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BookOpen, Calendar, Search, ShieldAlert, Users } from 'lucide-react';
import { ListPageLayout } from '@/components/layouts';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { ForbiddenApiError } from '@/lib/api/lecturer-classes';
import { useLecturerClasses } from '@/features/lecturer/queries/use-lecturer-classes';
import { getQueryErrorMessage } from '@/lib/query-utils';

export function LecturerClassesPage() {
  const classesQuery = useLecturerClasses();
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');

  const items = classesQuery.data ?? [];
  const isForbidden = classesQuery.error instanceof ForbiddenApiError;
  const errorMessage = classesQuery.error
    ? getQueryErrorMessage(classesQuery.error, 'Failed to load classes.')
    : null;

  const semesters = useMemo(
    () => Array.from(new Set(items.map((item) => item.semester))).sort(),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchSearch = item.className.toLowerCase().includes(search.toLowerCase());
        const matchSemester = semesterFilter === 'all' || item.semester === semesterFilter;
        return matchSearch && matchSemester;
      }),
    [items, search, semesterFilter],
  );

  return (
    <ListPageLayout
      title="Your classes"
      isLoading={classesQuery.isPending}
      error={isForbidden ? (classesQuery.error as ForbiddenApiError).message : errorMessage}
      maxWidthClass="max-w-[1200px]"
    >
      <div className="space-y-6 pb-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Total classes</p>
            <p className="mt-2 font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
              {items.length}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Semesters</p>
            <p className="mt-2 font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
              {semesters.length}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Visible results</p>
            <p className="mt-2 font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-card-foreground">
              {filtered.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search classes..."
                  className="rounded-xl pl-9"
                />
              </div>
              <select
                value={semesterFilter}
                onChange={(event) => setSemesterFilter(event.target.value)}
                className="h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All semesters</option>
                {semesters.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6 text-muted-foreground" />}
              title="No classes found"
            />
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {filtered.map((item) => (
                <Link
                  key={item.id}
                  href={`/lecturer/classes/${item.id}`}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-card-foreground group-hover:text-primary">
                        {item.className}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {item.semester}
                      </p>
                    </div>
                    {isForbidden ? (
                      <ShieldAlert className="h-5 w-5 text-destructive" />
                    ) : (
                      <Users className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Open workbench for students, cases, quizzes, and announcements.
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </ListPageLayout>
  );
}
