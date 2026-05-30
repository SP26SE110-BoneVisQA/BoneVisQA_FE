'use client';

import { DetailPageLayout } from '@/components/layouts';
import DocumentDetail from '@/components/admin/documents/DocumentDetail';

export function AdminDocumentDetailPage({ documentId }: { documentId: string }) {
  return (
    <DetailPageLayout
      title="Document details"
      maxWidthClass="max-w-7xl"
      showBack
    >
      <DocumentDetail id={documentId} />
    </DetailPageLayout>
  );
}
