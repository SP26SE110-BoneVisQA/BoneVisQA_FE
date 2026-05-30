'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DetailPageLayout } from '@/components/layouts';
import { StudentClassWorkbench } from '@/components/student/StudentClassWorkbench';
import { useStudentClasses } from '@/features/student/queries/use-student-classes';
import { getQueryErrorMessage } from '@/lib/query-utils';

export default function StudentClassDetailPage() {
  const params = useParams();
  const classId = String(params?.id ?? '');
  const classesQuery = useStudentClasses();
  const className =
    classesQuery.data?.find((c) => c.classId === classId)?.className ?? 'Class';

  return (
    <DetailPageLayout
      title={className}
      isLoading={classesQuery.isPending}
      error={
        classesQuery.error
          ? getQueryErrorMessage(classesQuery.error, 'Failed to load class.')
          : null
      }
      maxWidthClass="max-w-[1200px]"
    >
      <StudentClassWorkbench classId={classId} />
    </DetailPageLayout>
  );
}
