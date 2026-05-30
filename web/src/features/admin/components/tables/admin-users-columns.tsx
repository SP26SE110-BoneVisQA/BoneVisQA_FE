'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { DisplayRole, UiUser, UserRole } from '@/components/admin/UserManagementTable';
import { BookOpen, Calendar, Pencil, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

function roleBadgeClass(role: DisplayRole): string {
  switch (role) {
    case 'Student':
      return 'bg-blue-500/15 text-blue-700 border-blue-500/25';
    case 'Lecturer':
      return 'bg-violet-500/15 text-violet-800 border-violet-500/25';
    case 'Expert':
      return 'bg-fuchsia-500/15 text-fuchsia-800 border-fuchsia-500/25';
    case 'Admin':
      return 'bg-slate-500/15 text-slate-800 border-slate-500/30';
    case 'Pending':
      return 'bg-amber-500/15 text-amber-900 border-amber-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function needsRoleAssignment(role: DisplayRole): boolean {
  return role === 'Unassigned' || role === 'Pending';
}

export function buildAdminUsersColumns(actions: {
  hideRoleButton?: boolean;
  onToggleStatus: (user: UiUser) => void;
  onOpenAssignRole: (user: UiUser, mode: 'assign' | 'change') => void;
  onEdit: (user: UiUser) => void;
  onDelete: (user: UiUser) => void;
}): ColumnDef<UiUser>[] {
  return [
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex min-w-0 gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-xs font-bold text-primary">
              {user.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <span
                className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${roleBadgeClass(user.role)}`}
              >
                {user.role}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'class',
      header: 'Assigned class',
      cell: ({ row }) => {
        const user = row.original;
        if (user.classList?.length) {
          return (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <BookOpen className="h-3 w-3 shrink-0" />
              <span className="truncate">{user.classList[0].className}</span>
            </span>
          );
        }
        return <span className="text-xs italic text-muted-foreground">Unassigned</span>;
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.status === 'Active';
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
              isActive
                ? 'border-success/35 bg-success/10 text-success'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {row.original.status}
          </span>
        );
      },
    },
    {
      id: 'joined',
      header: 'Joined',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {row.original.joinedAt}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const user = row.original;
        const pendingQueue = needsRoleAssignment(user.role);
        const isActive = user.status === 'Active';
        return (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {!actions.hideRoleButton ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => actions.onOpenAssignRole(user, pendingQueue ? 'assign' : 'change')}
              >
                {pendingQueue ? <UserCheck className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {pendingQueue ? 'Assign' : 'Role'}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => actions.onEdit(user)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => actions.onDelete(user)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => actions.onToggleStatus(user)}
              title={isActive ? 'Deactivate user' : 'Activate user'}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        );
      },
    },
  ];
}

export type { UserRole };
