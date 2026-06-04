'use client';

import { useState } from 'react';
import { ListPageLayout } from '@/components/layouts';
import { StudentClassesList } from '@/components/student/StudentClassWorkbench';
import { useStudentClasses } from '@/features/student/queries/use-student-classes';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { GraduationCap } from 'lucide-react';

export function StudentClassesPage() {
  const classesQuery = useStudentClasses();
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const classes = classesQuery.data ?? [];

  return (
    <ListPageLayout
      title="My classes"
      isLoading={classesQuery.isPending}
      error={
        classesQuery.error
          ? getQueryErrorMessage(classesQuery.error, 'Failed to load your classes.')
          : null
      }
      maxWidthClass="max-w-[1200px]"
    >
      {classes.length === 0 && !classesQuery.isPending ? (
        <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-lg font-bold text-card-foreground">No enrolled classes</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            You are not enrolled in any classes yet. Contact your department administrator or lecturer.
          </p>
        </div>
      ) : (
        <StudentClassesList
          classes={classes}
          search={search}
          semesterFilter={semesterFilter}
          onSearchChange={setSearch}
          onSemesterChange={setSemesterFilter}
        />
      )}
    </ListPageLayout>
  );
}
