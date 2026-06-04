import { AdminDocumentDetailPage } from '@/features/admin/components/AdminDocumentDetailPage';

export default async function AdminDocumentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminDocumentDetailPage documentId={id} />;
}
