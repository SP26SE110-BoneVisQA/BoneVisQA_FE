import type { AdminUser } from '@/lib/api/types';
import type { DisplayRole, UiUser, UserRole } from '@/components/admin/UserManagementTable';

const assignableRoles: UserRole[] = ['Student', 'Lecturer', 'Expert', 'Admin'];

export function normalizeAdminUser(user: AdminUser): UiUser {
  const roles = user.roles.map((r) => r.trim()).filter(Boolean);
  const assigned = roles.find((r) => assignableRoles.includes(r as UserRole)) as UserRole | undefined;
  const hasPending = roles.some((r) => r === 'Pending');

  let displayRole: DisplayRole;
  if (assigned) {
    displayRole = assigned;
  } else if (hasPending) {
    displayRole = 'Pending';
  } else {
    displayRole = 'Unassigned';
  }

  const classListFromApi =
    user.classAssignments?.map((c) => ({
      id: c.classId,
      className: c.className,
      relationType: c.roleInClass,
    })) ?? undefined;

  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: displayRole,
    status: user.isActive ? 'Active' : 'Inactive',
    joinedAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A',
    className: user.schoolCohort,
    ...(classListFromApi?.length ? { classList: classListFromApi } : {}),
  };
}
