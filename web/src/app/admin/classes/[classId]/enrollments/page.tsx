'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Loader2,
  Trash2,
  ArrowLeft,
  Search,
  PlusCircle,
  GraduationCap,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchClassEnrollments,
  fetchAdminClassById,
  assignClassUser,
  unenrollClassUser,
  removeExpertFromClass,
  removeLecturerFromClass,
  type AdminClassModel,
  type ClassEnrollment,
} from '@/lib/api/admin-classes';
import { fetchAdminUsers } from '@/lib/api/admin-users';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';

function isLecturerSlotRow(e: ClassEnrollment): boolean {
  return Boolean(e.lecturerId?.trim()) && !e.studentId?.trim();
}

function isExpertSlotRow(e: ClassEnrollment): boolean {
  return Boolean(e.expertId?.trim()) && !e.studentId?.trim();
}

function isStudentEnrollmentRow(e: ClassEnrollment): boolean {
  if (e.studentId?.trim()) return true;
  if (/student|learner/i.test(e.role ?? '')) return true;
  if (isLecturerSlotRow(e) || isExpertSlotRow(e)) return false;
  return Boolean(e.studentName?.trim());
}

export default function ClassEnrollmentsPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<'Student' | 'Lecturer' | 'Expert'>('Student');
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const classDetailQuery = useQuery({
    queryKey: ['admin-classes-detail', classId],
    queryFn: () => fetchAdminClassById(classId),
  });

  const enrollmentsQuery = useQuery({
    queryKey: ['admin', 'classes', 'enrollments', classId],
    queryFn: () =>
      fetchClassEnrollments({
        classId: classId,
        pageIndex: 1,
        pageSize: 200,
      }),
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
  });

  const roster = classDetailQuery.data ?? ({} as AdminClassModel);
  const loading = enrollmentsQuery.isPending || usersQuery.isPending || classDetailQuery.isPending;

  const classEnrollments: ClassEnrollment[] = enrollmentsQuery.data ?? [];

  const lecturerEnrollment = useMemo(
    () =>
      classEnrollments.find(
        (e) => Boolean(e.lecturerId?.trim()) && !isStudentEnrollmentRow(e),
      ),
    [classEnrollments],
  );

  const expertEnrollment = useMemo(
    () =>
      classEnrollments.find(
        (e) => Boolean(e.expertId?.trim()) && !isStudentEnrollmentRow(e),
      ),
    [classEnrollments],
  );

  const studentEnrollments = useMemo(
    () => classEnrollments.filter((e) => isStudentEnrollmentRow(e)),
    [classEnrollments],
  );

  const lecturerDisplayName =
    lecturerEnrollment?.lecturerName?.trim() ||
    roster.lecturerName?.trim() ||
    (roster.lecturerEmail ? `${roster.lecturerEmail}` : null);
  const expertDisplayName =
    expertEnrollment?.expertName?.trim() || roster.expertName?.trim() || roster.expertEmail || null;

  const availableUsers = useMemo(() => {
    let users = usersQuery.data ?? [];

    users = users.filter((u) => u.roles.includes(selectedRoleToAssign));

    if (search.trim()) {
      const term = search.toLowerCase();
      users = users.filter((u) => {
        const nameMatch = u.fullName.toLowerCase().includes(term);
        const emailMatch = u.email.toLowerCase().includes(term);
        return nameMatch || emailMatch;
      });
    }

    if (selectedRoleToAssign === 'Lecturer' && lecturerEnrollment?.lecturerId) {
      users = users.filter((u) => u.id !== lecturerEnrollment.lecturerId);
    }
    if (selectedRoleToAssign === 'Expert' && expertEnrollment?.expertId) {
      users = users.filter((u) => u.id !== expertEnrollment.expertId);
    }
    if (selectedRoleToAssign === 'Student') {
      const enrolledStudentIds = new Set(
        studentEnrollments.map((e) => e.studentId).filter(Boolean) as string[],
      );
      const nameHints = studentEnrollments
        .filter((e) => !e.studentId?.trim() && e.studentName?.trim())
        .map((e) => e.studentName!.trim().toLowerCase());
      users = users.filter((u) => {
        if (enrolledStudentIds.has(u.id)) return false;
        const fn = u.fullName.trim().toLowerCase();
        const em = u.email.toLowerCase();
        if (nameHints.some((h) => h === fn || h === em)) return false;
        return true;
      });
    }

    return users.slice(0, 50);
  }, [
    usersQuery.data,
    selectedRoleToAssign,
    search,
    lecturerEnrollment,
    expertEnrollment,
    studentEnrollments,
  ]);

  const assignMutation = useMutation({
    mutationFn: async (userId: string) => {
      return assignClassUser({
        classId: classId,
        studentId: selectedRoleToAssign === 'Student' ? userId : null,
        lecturerId: selectedRoleToAssign === 'Lecturer' ? userId : null,
        expertId: selectedRoleToAssign === 'Expert' ? userId : null,
        removeExpert: false,
      });
    },
    onSuccess: () => {
      toast.success('Assigned successfully.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'classes', 'enrollments', classId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-classes-detail', classId] });
    },
    onError: (e: Error) => {
      toast.error(`Assign failed: ${e.message}`);
    },
    onSettled: () => setAssigningId(null),
  });

  const unenrollMutation = useMutation({
    mutationFn: async ({ enrollmentId, role }: { enrollmentId: string; role: string }) => {
      if (role === 'Expert') {
        return removeExpertFromClass(classId);
      }
      if (role === 'Lecturer') {
        return removeLecturerFromClass(classId);
      }
      return unenrollClassUser(enrollmentId);
    },
    onSuccess: () => {
      toast.success('Removed successfully.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'classes', 'enrollments', classId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-classes-detail', classId] });
    },
    onError: (e: Error) => {
      toast.error(`Remove failed: ${e.message}`);
    },
    onSettled: () => setAssigningId(null),
  });

  const handleAssign = (userId: string) => {
    setAssigningId(userId);
    assignMutation.mutate(userId);
  };

  const handleUnenroll = (enrollmentId: string, role: string) => {
    setAssigningId(enrollmentId);
    unenrollMutation.mutate({ enrollmentId, role });
  };

  const cls = roster as AdminClassModel;

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header
        title={cls.className || 'Class Enrollments'}
        subtitle="Manage lecturers, experts, and students enrolled in this class"
      />

      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/classes')}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Classes
        </Button>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-card-foreground">
                {cls.className || 'Loading...'}
              </h1>
              {cls.semester && (
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
                  {cls.semester}
                </span>
              )}
            </div>
            {classId && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">{classId}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                <UserCheck className="h-5 w-5 text-emerald-500" />
                Current Roster
              </h2>
            </div>

            <div className="flex-1 divide-y divide-border p-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="pb-6">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                      Lecturer (max 1)
                    </div>
                    {lecturerDisplayName ? (
                      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
                        <div className="min-w-0 flex-1 truncate">
                          <div className="text-sm font-medium">{lecturerDisplayName}</div>
                          {roster.lecturerEmail && (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {roster.lecturerEmail}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnenroll(lecturerEnrollment?.id || roster.lecturerId || '', 'Lecturer')}
                          disabled={assigningId === (lecturerEnrollment?.id || roster.lecturerId || '')}
                          className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          title="Remove Lecturer"
                        >
                          {assigningId === (lecturerEnrollment?.id || roster.lecturerId || '') ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                        No lecturer assigned
                      </div>
                    )}
                  </div>

                  <div className="py-6">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      Expert (max 1)
                    </div>
                    {expertDisplayName ? (
                      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
                        <div className="min-w-0 flex-1 truncate">
                          <div className="text-sm font-medium">{expertDisplayName}</div>
                          {roster.expertEmail && (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {roster.expertEmail}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnenroll(expertEnrollment?.id || roster.expertId || '', 'Expert')}
                          disabled={assigningId === (expertEnrollment?.id || roster.expertId || '')}
                          className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          title="Remove Expert"
                        >
                          {assigningId === (expertEnrollment?.id || roster.expertId || '') ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                        No expert assigned
                      </div>
                    )}
                  </div>

                  <div className="pt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <BookOpen className="h-4 w-4 text-blue-500" />
                        Students ({studentEnrollments.length}
                        {typeof roster.studentCount === 'number' &&
                        roster.studentCount !== studentEnrollments.length ? (
                          <span className="ml-1 text-xs font-normal text-amber-600">
                            (catalog {roster.studentCount})
                          </span>
                        ) : null}
                        )
                      </div>
                    </div>
                    {studentEnrollments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                        No students enrolled yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {studentEnrollments.map((stu) => (
                          <div
                            key={stu.id}
                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {stu.studentName || 'Unknown Student'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnenroll(stu.id, 'Student')}
                              disabled={assigningId === stu.id}
                              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                              title="Remove Student"
                            >
                              {assigningId === stu.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-card-foreground">Assign User</h2>
            </div>

            <div className="p-6">
              <div className="mb-4 flex overflow-hidden rounded-xl border border-border bg-muted/30 p-1 shadow-sm">
                {(['Student', 'Lecturer', 'Expert'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRoleToAssign(role)}
                    className={cn(
                      'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
                      selectedRoleToAssign === role
                        ? 'border border-border bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${selectedRoleToAssign}s...`}
                  className="h-11 w-full rounded-xl border border-border bg-input pl-10 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                {usersQuery.isPending ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No available {selectedRoleToAssign}s found.
                  </div>
                ) : (
                  availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/30"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="truncate text-sm font-semibold text-card-foreground">
                          {user.fullName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAssign(user.id)}
                        disabled={assigningId === user.id}
                        className="group h-9 w-9 shrink-0 rounded-lg bg-primary/10 p-0 text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        {assigningId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlusCircle className="h-4 w-4 text-primary transition-colors group-hover:text-primary-foreground" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
