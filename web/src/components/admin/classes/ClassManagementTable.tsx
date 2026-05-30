'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  MoreVertical,
  Users,
  Search,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdminClassModel } from '@/lib/api/admin-classes';
import { TableEmptyState } from '@/components/shared/TableEmptyState';

export interface ClassManagementTableProps {
  classes: AdminClassModel[];
  onManageEnrollments: (cls: AdminClassModel) => void;
  onEdit?: (cls: AdminClassModel) => void;
  onDelete?: (cls: AdminClassModel) => void;
}

export function ClassManagementTable({
  classes,
  onManageEnrollments,
  onEdit,
  onDelete,
}: ClassManagementTableProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return classes.filter((c) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        c.className.toLowerCase().includes(term) ||
        c.semester.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term)
      );
    });
  }, [classes, search]);

  const colCount = 8;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('classes.searchPlaceholder', 'Search by name, semester, or class ID...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-input pl-12 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-bold">Class</th>
              <th className="px-4 py-3 font-bold">Class ID</th>
              <th className="px-4 py-3 font-bold">Semester</th>
              <th className="px-4 py-3 font-bold text-center">Students</th>
              <th className="min-w-[120px] px-4 py-3 font-bold">Lecturer</th>
              <th className="min-w-[120px] px-4 py-3 font-bold">Expert</th>
              <th className="px-4 py-3 font-bold text-center">Enrollments</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <TableEmptyState
                icon={BookOpen}
                title="No classes found"
                colSpan={colCount}
              />
            ) : (
              filtered.map((cls) => (
                <tr key={cls.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-card-foreground">{cls.className}</div>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[200px] px-4 py-3">
                    <span className="break-all font-mono text-[11px] leading-snug text-muted-foreground">
                      {cls.id}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {cls.semester || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-muted px-2 py-0.5 text-sm font-semibold">
                      {cls.studentCount ?? 0}
                    </span>
                  </td>
                  <td className="max-w-[160px] px-4 py-3 text-xs">
                    <div className="truncate font-medium text-foreground" title={cls.lecturerName ?? ''}>
                      {cls.lecturerName?.trim() || '—'}
                    </div>
                    {cls.lecturerEmail ? (
                      <div className="truncate text-[10px] text-muted-foreground">{cls.lecturerEmail}</div>
                    ) : null}
                  </td>
                  <td className="max-w-[160px] px-4 py-3 text-xs">
                    <div className="truncate font-medium text-foreground" title={cls.expertName ?? ''}>
                      {cls.expertName?.trim() || '—'}
                    </div>
                    {cls.expertEmail ? (
                      <div className="truncate text-[10px] text-muted-foreground">{cls.expertEmail}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => onManageEnrollments(cls)}
                      className="gap-1.5 bg-primary text-primary-foreground shadow-sm"
                    >
                      <Users className="h-4 w-4" />
                      Manage
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 shrink-0 border-border p-0"
                          onClick={() => onEdit(cls)}
                          title="Edit class"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 shrink-0 border-border p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(cls)}
                          title="Delete class"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 shrink-0 border-border p-0"
                          >
                            <span className="sr-only">More</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          <DropdownMenuItem onClick={() => onManageEnrollments(cls)}>
                            Manage enrollments
                          </DropdownMenuItem>
                          {onEdit ? (
                            <DropdownMenuItem onClick={() => onEdit(cls)}>Edit details</DropdownMenuItem>
                          ) : null}
                          {onDelete ? (
                            <DropdownMenuItem
                              onClick={() => onDelete(cls)}
                              className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                            >
                              Delete class
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
