'use client';

import { useParams } from 'next/navigation';
import ClassExpertAssignments from '@/components/lecturer/ClassExpertAssignments';

export default function ClassExpertsPage() {
  const params = useParams();
  const classId = params.id as string;

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Class Expert Assignments</h1>
        <p className="text-gray-500 mt-1">
          Manage expert assignments for this class.
        </p>
      </div>

      <ClassExpertAssignments classId={classId} />
    </div>
  );
}
