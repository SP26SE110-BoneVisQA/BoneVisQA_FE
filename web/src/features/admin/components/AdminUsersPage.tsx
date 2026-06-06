'use client';

import { useMemo, useState } from 'react';
import { ListPageLayout } from '@/components/layouts';
import {
  type UiUser,
  type UserRole,
  type UserStatus,
} from '@/components/admin/UserManagementTable';
import {
  CreateUserDialog,
  EditUserDialog,
  ImportUsersDialog,
} from '@/components/admin/users/UserDialogs';
import { UserRoleDialog } from '@/components/admin/UserStatusDialog';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { DataTable } from '@/components/shared/data-table';
import { ToolbarField } from '@/components/shared/ToolbarField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildAdminUsersColumns } from '@/features/admin/components/tables/admin-users-columns';
import { normalizeAdminUser } from '@/features/admin/lib/normalize-admin-user';
import {
  useAdminUsers,
  useAssignAdminUserRole,
  useCreateAdminUser,
  useDeleteAdminUser,
  useToggleAdminUserStatus,
  useUpdateAdminUser,
} from '@/features/admin/queries/use-admin-users';
import { appToast } from '@/lib/api/errors/app-toast';
import type { CreateUserPayload } from '@/lib/api/admin-users';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { ChevronDown, Filter, Plus, Search, Upload, Users } from 'lucide-react';

const directoryRoleTabs = ['Student', 'Lecturer', 'Expert', 'Admin'] as const satisfies readonly UserRole[];
const roleFilterOptions = ['All', 'Pending', 'Unassigned', 'Student', 'Lecturer', 'Expert', 'Admin'] as const;
type RoleTab = UserRole | 'Pending' | 'Unassigned' | 'All';
type RoleFilter = (typeof roleFilterOptions)[number];

export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<RoleTab>('All');
  const [filterStatus, setFilterStatus] = useState<UserStatus | 'All'>('All');
  const [filterRole, setFilterRole] = useState<RoleFilter>('All');
  const [pageIndex, setPageIndex] = useState(0);

  const [statusTarget, setStatusTarget] = useState<UiUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UiUser | null>(null);
  const [assignRoleDialog, setAssignRoleDialog] = useState<{
    user: UiUser;
    mode: 'assign' | 'change';
  } | null>(null);
  const [editTarget, setEditTarget] = useState<UiUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const usersQuery = useAdminUsers();
  const toggleMutation = useToggleAdminUserStatus();
  const assignMutation = useAssignAdminUserRole();
  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const deleteMutation = useDeleteAdminUser();

  const users = useMemo(
    () => (usersQuery.data ?? []).map(normalizeAdminUser),
    [usersQuery.data],
  );

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (activeTab === 'Pending' && u.role !== 'Pending') return false;
      if (activeTab === 'Unassigned' && u.role !== 'Unassigned') return false;
      if (
        activeTab !== 'All' &&
        activeTab !== 'Pending' &&
        activeTab !== 'Unassigned' &&
        u.role !== activeTab
      ) {
        return false;
      }
      const needle = search.toLowerCase();
      const matchSearch =
        u.name.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.className?.toLowerCase().includes(needle) ?? false);
      const matchStatus = filterStatus === 'All' || u.status === filterStatus;
      const matchRole = filterRole === 'All' || u.role === filterRole;
      return matchSearch && matchStatus && matchRole;
    });
  }, [users, search, activeTab, filterStatus, filterRole]);

  const paginatedUsers = useMemo(() => {
    const start = pageIndex * 5;
    return filtered.slice(start, start + 5);
  }, [filtered, pageIndex]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));

  const handleTabChange = (tab: RoleTab) => {
    setActiveTab(tab);
    setPageIndex(0);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPageIndex(0);
  };

  const handleStatusChange = (status: UserStatus | 'All') => {
    setFilterStatus(status);
    setPageIndex(0);
  };

  const handleRoleFilterChange = (role: RoleFilter) => {
    setFilterRole(role);
    setPageIndex(0);
  };

  const countsByTab = useMemo(
    () => ({
      Pending: users.filter((u) => u.role === 'Pending').length,
      Unassigned: users.filter((u) => u.role === 'Unassigned').length,
      Student: users.filter((u) => u.role === 'Student').length,
      Lecturer: users.filter((u) => u.role === 'Lecturer').length,
      Expert: users.filter((u) => u.role === 'Expert').length,
      Admin: users.filter((u) => u.role === 'Admin').length,
    }),
    [users],
  );

  const columns = useMemo(
    () =>
      buildAdminUsersColumns({
        hideRoleButton: activeTab === 'Pending',
        onToggleStatus: setStatusTarget,
        onOpenAssignRole: (user, mode) => setAssignRoleDialog({ user, mode }),
        onEdit: setEditTarget,
        onDelete: setDeleteTarget,
      }),
    [activeTab],
  );

  const errorMessage = usersQuery.error
    ? getQueryErrorMessage(usersQuery.error, 'Failed to load users.')
    : null;

  const confirmDeactivate = () => {
    if (!statusTarget) return;
    const nextIsActive = statusTarget.status !== 'Active';
    toggleMutation.mutate(
      { userId: statusTarget.id, isActive: nextIsActive },
      {
        onSuccess: () => {
          appToast.success(`User ${nextIsActive ? 'activated' : 'deactivated'} successfully.`);
          setStatusTarget(null);
        },
        onError: (err) => {
          appToast.error(err instanceof Error ? err.message : 'Failed to update user status.');
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        appToast.success('User deleted successfully.');
        setDeleteTarget(null);
      },
      onError: (err) => {
        appToast.error(err instanceof Error ? err.message : 'Failed to delete user.');
      },
    });
  };

  return (
    <>
      <ListPageLayout
        title="User management"
        isLoading={usersQuery.isPending}
        error={errorMessage}
        skeletonVariant="list"
        maxWidthClass="max-w-[1600px]"
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create user
            </Button>
          </div>
        }
        toolbar={
          <div className="space-y-4">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
              <TabButton label="All" count={users.length} active={activeTab === 'All'} onClick={() => handleTabChange('All')} />
              <TabButton
                label="Pending"
                count={countsByTab.Pending}
                active={activeTab === 'Pending'}
                onClick={() => handleTabChange('Pending')}
                highlight
              />
              <TabButton
                label="Unassigned"
                count={countsByTab.Unassigned}
                active={activeTab === 'Unassigned'}
                onClick={() => handleTabChange('Unassigned')}
              />
              {directoryRoleTabs.map((role) => (
                <TabButton
                  key={role}
                  label={role}
                  count={countsByTab[role]}
                  active={activeTab === role}
                  onClick={() => handleTabChange(role)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row">
              <ToolbarField>
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-12 pl-12"
                    placeholder="Search by name, email, or class..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              </ToolbarField>
              <ToolbarField>
                <div className="relative min-w-[200px]">
                  <Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={filterRole}
                    onChange={(e) => handleRoleFilterChange(e.target.value as RoleFilter)}
                    className="h-12 w-full appearance-none rounded-lg border border-border bg-input pl-12 pr-10 text-sm"
                  >
                    {roleFilterOptions.map((role) => (
                      <option key={role} value={role}>
                        {role === 'All' ? 'All roles' : role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </ToolbarField>
              <ToolbarField>
                <div className="relative min-w-[200px]">
                  <Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={filterStatus}
                    onChange={(e) => handleStatusChange(e.target.value as UserStatus | 'All')}
                    className="h-12 w-full appearance-none rounded-lg border border-border bg-input pl-12 pr-10 text-sm"
                  >
                    <option value="All">All statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </ToolbarField>
            </div>
          </div>
        }
      >
        <DataTable
          columns={columns}
          data={paginatedUsers}
          pageSize={5}
          manualPagination
          pageCount={totalPages}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          isLoading={usersQuery.isPending}
          emptyIcon={<Users className="h-6 w-6 text-primary" />}
          emptyTitle="No users found"
          emptyDescription="Try adjusting the selected role tab or current search filters."
        />
      </ListPageLayout>

      {createOpen ? (
        <CreateUserDialog
          onCancel={() => setCreateOpen(false)}
          onConfirm={async (payload: CreateUserPayload) => {
            await createMutation.mutateAsync(payload);
            appToast.success(`User "${payload.fullName}" created successfully.`);
            setCreateOpen(false);
          }}
        />
      ) : null}

      {importOpen ? (
        <ImportUsersDialog onCancel={() => setImportOpen(false)} onSuccess={() => setImportOpen(false)} />
      ) : null}

      {editTarget ? (
        <EditUserDialog
          userId={editTarget.id}
          initialFullName={editTarget.name}
          initialCohort={editTarget.className}
          onCancel={() => setEditTarget(null)}
          onConfirm={async (userId, fullName, cohort) => {
            await updateMutation.mutateAsync({ userId, fullName, schoolCohort: cohort });
            appToast.success('User details updated successfully.');
            setEditTarget(null);
          }}
        />
      ) : null}

      {assignRoleDialog ? (
        <UserRoleDialog
          user={assignRoleDialog.user}
          mode={assignRoleDialog.mode}
          onCancel={() => setAssignRoleDialog(null)}
          onConfirm={(role) => {
            assignMutation.mutate(
              { userId: assignRoleDialog.user.id, role },
              {
                onSuccess: () => {
                  appToast.success(`Role set to ${role} for ${assignRoleDialog.user.name}.`);
                  setAssignRoleDialog(null);
                },
                onError: (err) => {
                  appToast.error(err instanceof Error ? err.message : 'Failed to assign role.');
                },
              },
            );
          }}
          isLoading={assignMutation.isPending}
        />
      ) : null}

      <DestructiveConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={statusTarget?.status === 'Active' ? 'Deactivate user' : 'Activate user'}
        confirmLabel={statusTarget?.status === 'Active' ? 'Deactivate' : 'Activate'}
        destructive={statusTarget?.status === 'Active'}
        isLoading={toggleMutation.isPending}
        onConfirm={confirmDeactivate}
      />

      <DestructiveConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete user permanently?"
        confirmLabel="Delete user"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
  highlight,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
        active
          ? highlight
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-background text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
      }`}
    >
      <span>{label}</span>
      <span className="min-w-[1.25rem] rounded-md bg-muted/80 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
        {count}
      </span>
    </button>
  );
}
