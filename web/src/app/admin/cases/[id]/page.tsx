import { AdminCaseDetailPage } from '@/features/admin/components/AdminCaseDetailPage';

export default async function AdminCaseDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminCaseDetailPage caseId={id} />;
}
