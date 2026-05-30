'use client';

import { useMemo, useState } from 'react';
import { ListPageLayout } from '@/components/layouts';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { DataTable } from '@/components/shared/data-table';
import { buildAdminVerificationsColumns } from '@/features/admin/components/tables/admin-verifications-columns';
import {
  useAdminPendingVerifications,
  useVerificationDecision,
} from '@/features/admin/queries/use-admin-verifications';
import { appToast } from '@/lib/api/errors/app-toast';
import type { PendingVerification } from '@/lib/api/admin-users';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { BadgeCheck } from 'lucide-react';

export function AdminVerificationsPage() {
  const listQuery = useAdminPendingVerifications();
  const decisionMutation = useVerificationDecision();

  const [approveTarget, setApproveTarget] = useState<PendingVerification | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingVerification | null>(null);

  const rows = listQuery.data ?? [];
  const busyUserId = decisionMutation.isPending ? decisionMutation.variables?.userId ?? null : null;

  const columns = useMemo(
    () =>
      buildAdminVerificationsColumns({
        busyUserId,
        isPending: decisionMutation.isPending,
        onApprove: setApproveTarget,
        onReject: setRejectTarget,
      }),
    [busyUserId, decisionMutation.isPending],
  );

  const errorMessage = listQuery.error
    ? getQueryErrorMessage(listQuery.error, 'Failed to load verification requests.')
    : null;

  const submitDecision = (vars: { userId: string; isApproved: boolean; notes?: string }) => {
    decisionMutation.mutate(vars, {
      onSuccess: (_, v) => {
        appToast.success(
          v.isApproved ? 'Medical student verification approved.' : 'Verification rejected.',
        );
        setApproveTarget(null);
        setRejectTarget(null);
      },
      onError: (e) => {
        appToast.error(e instanceof Error ? e.message : 'Could not update verification.');
      },
    });
  };

  return (
    <>
      <ListPageLayout
        title="Medical student verification"
        isLoading={listQuery.isPending}
        error={errorMessage}
        skeletonVariant="list"
        maxWidthClass="max-w-6xl"
      >
        <DataTable
          columns={columns}
          data={rows}
          pageSize={10}
          isLoading={listQuery.isPending}
          emptyIcon={<BadgeCheck className="h-6 w-6 text-primary" />}
          emptyTitle="No pending verifications"
          emptyDescription="When students submit medical verification, they will appear here."
        />
      </ListPageLayout>

      <DestructiveConfirmDialog
        open={Boolean(approveTarget)}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve verification?"
        confirmLabel="Approve"
        destructive={false}
        isLoading={decisionMutation.isPending}
        onConfirm={() => {
          if (!approveTarget) return;
          submitDecision({ userId: approveTarget.userId, isApproved: true });
        }}
      />

      <DestructiveConfirmDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && !decisionMutation.isPending && setRejectTarget(null)}
        title="Reject verification?"
        confirmLabel="Confirm reject"
        isLoading={decisionMutation.isPending}
        onConfirm={() => {
          if (!rejectTarget) return;
          submitDecision({ userId: rejectTarget.userId, isApproved: false });
        }}
      />

    </>
  );
}
