'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DetailPageLayout } from '@/components/layouts';
import { EmptyState } from '@/components/shared/EmptyState';
import { RoleBadgeList } from '@/components/profile/role-badge-list';
import {
  PersonalInfoFields,
  personalValuesToApiPatch,
  profileToPersonalValues,
  type PersonalInfoValues,
} from '@/components/profile/personal-info-fields';
import { ProfileAvatarPicker } from '@/components/profile/profile-avatar-picker';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  useStudentProfileBundle,
  useUpdateStudentProfile,
} from '@/features/student/queries/use-student-profile';
import {
  studentProfileFormSchema,
  type StudentProfileFormValues,
} from '@/features/student/schemas/profile-schema';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import type { StudentProfileUpdatePayload } from '@/lib/api/types';
import {
  Bookmark,
  Bot,
  ChevronRight,
  Pencil,
  Save,
  Scan,
  Shield,
  Trash2,
} from 'lucide-react';

const NOTIF_PREFS_KEY = 'bonevisqa_student_notif_prefs_v1';

type NotifPrefs = {
  clinicalDigest: boolean;
  quizReminders: boolean;
  aiInsightAlerts: boolean;
};

const DEFAULT_NOTIF: NotifPrefs = {
  clinicalDigest: true,
  quizReminders: true,
  aiInsightAlerts: false,
};

function loadNotifPrefs(): NotifPrefs {
  if (typeof window === 'undefined') return DEFAULT_NOTIF;
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIF;
    const p = JSON.parse(raw) as Partial<NotifPrefs>;
    return {
      clinicalDigest: Boolean(p.clinicalDigest ?? DEFAULT_NOTIF.clinicalDigest),
      quizReminders: Boolean(p.quizReminders ?? DEFAULT_NOTIF.quizReminders),
      aiInsightAlerts: Boolean(p.aiInsightAlerts ?? DEFAULT_NOTIF.aiInsightAlerts),
    };
  } catch {
    return DEFAULT_NOTIF;
  }
}

function saveNotifPrefs(p: NotifPrefs) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p));
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return 'Just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function activityIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('quiz') || t.includes('exam')) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-accent/20 text-cyan-accent">
        <Scan className="h-5 w-5" aria-hidden />
      </span>
    );
  }
  if (t.includes('ai') || t.includes('question') || t.includes('qa')) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-900">
        <Bot className="h-5 w-5" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Bookmark className="h-5 w-5" aria-hidden />
    </span>
  );
}

function PillToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-background shadow transition-all ${
          checked ? 'right-1' : 'left-1'
        }`}
      />
    </button>
  );
}

function profileToFormValues(
  profile: NonNullable<ReturnType<typeof useStudentProfileBundle>['data']>['profile'],
): StudentProfileFormValues {
  const personal = profileToPersonalValues(profile);
  return {
    fullName: profile.fullName ?? '',
    schoolCohort: profile.schoolCohort ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    classCode: profile.classCode ?? '',
    ...personal,
  };
}

export function StudentProfilePage() {
  const { data, isPending, error } = useStudentProfileBundle();
  const updateMutation = useUpdateStudentProfile();
  const [credentialsReadOnly, setCredentialsReadOnly] = useState(true);
  const [notif, setNotif] = useState<NotifPrefs>(DEFAULT_NOTIF);

  const cohortPresets = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, i) => `Class of ${y - 4 + i}`);
  }, []);

  const form = useForm<StudentProfileFormValues>({
    resolver: zodResolver(studentProfileFormSchema),
    defaultValues: {
      fullName: '',
      schoolCohort: '',
      avatarUrl: '',
      classCode: '',
      dateOfBirth: '',
      phoneNumber: '',
      gender: '',
      studentSchoolId: '',
      address: '',
      bio: '',
    },
  });

  const profile = data?.profile;
  const progress = data?.progress;
  const activity = data?.activity ?? [];

  useEffect(() => {
    setNotif(loadNotifPrefs());
  }, []);

  useEffect(() => {
    if (profile) {
      form.reset(profileToFormValues(profile));
    }
  }, [profile, form]);

  const schoolCohort = form.watch('schoolCohort');
  const fullName = form.watch('fullName');
  const avatarUrl = form.watch('avatarUrl');
  const cohortIsPreset = cohortPresets.includes(schoolCohort);

  const initials = useMemo(() => {
    const source = fullName || profile?.fullName || 'BV';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [fullName, profile?.fullName]);

  const roleSubtitle = useMemo(() => {
    const role =
      profile?.roles && profile.roles.length > 0 ? profile.roles.join(' · ') : 'Student';
    const cohort = schoolCohort?.trim();
    return cohort ? `${role} • ${cohort}` : role;
  }, [profile?.roles, schoolCohort]);

  const patchNotif = useCallback((patch: Partial<NotifPrefs>) => {
    setNotif((prev) => {
      const next = { ...prev, ...patch };
      saveNotifPrefs(next);
      return next;
    });
  }, []);

  const personalValues: PersonalInfoValues = {
    dateOfBirth: form.watch('dateOfBirth') ?? '',
    phoneNumber: form.watch('phoneNumber') ?? '',
    gender: form.watch('gender') ?? '',
    studentSchoolId: form.watch('studentSchoolId') ?? '',
    address: form.watch('address') ?? '',
    bio: form.watch('bio') ?? '',
  };

  const onSubmit = form.handleSubmit((values) => {
    const payload: StudentProfileUpdatePayload = {
      fullName: values.fullName.trim(),
      schoolCohort: values.schoolCohort.trim(),
      avatarUrl: values.avatarUrl.trim(),
      classCode: values.classCode.trim() || undefined,
      ...personalValuesToApiPatch({
        dateOfBirth: values.dateOfBirth ?? '',
        phoneNumber: values.phoneNumber ?? '',
        gender: values.gender ?? '',
        studentSchoolId: values.studentSchoolId ?? '',
        address: values.address ?? '',
        bio: values.bio ?? '',
      }),
    };
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setCredentialsReadOnly(true);
        appToast.success('Profile updated successfully.');
      },
      onError: (err) => {
        appToast.error(err instanceof Error ? err.message : 'Failed to update profile.');
      },
    });
  });

  const clearLocalSession = () => {
    if (
      !confirm(
        'Clear preferences and cached data on this device? You stay signed in; this only affects this browser.',
      )
    ) {
      return;
    }
    try {
      sessionStorage.clear();
      localStorage.removeItem(NOTIF_PREFS_KEY);
    } catch {
      /* ignore */
    }
    setNotif(DEFAULT_NOTIF);
    appToast.success('Local session data cleared.');
  };

  const errorMessage = error ? getQueryErrorMessage(error, 'Failed to load profile.') : null;

  return (
    <DetailPageLayout
      title="Profile & settings"
      isLoading={isPending}
      error={errorMessage}
      maxWidthClass="max-w-7xl"
    >
      {!profile && !isPending && !error ? (
        <EmptyState
          title="No profile data"
        />
      ) : profile ? (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-8">
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-4">
                <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                  <ProfileAvatarPicker
                    avatarUrl={avatarUrl ?? ''}
                    initials={initials || 'BV'}
                    alt={fullName || 'Student avatar'}
                    size="xl"
                    variant="hero"
                    onUrlChange={(url) => form.setValue('avatarUrl', url, { shouldDirty: true })}
                    onError={(msg) => appToast.error(msg)}
                    footer={(openPicker) => (
                      <button
                        type="button"
                        onClick={openPicker}
                        className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:scale-[0.99] active:scale-[0.98]"
                      >
                        Upload new photo
                      </button>
                    )}
                  />
                  <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
                    {fullName || 'Student'}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{roleSubtitle}</p>
                  <p className="mt-2 max-w-xs text-xs text-muted-foreground">{profile.email}</p>
                  <p className="mt-3 max-w-xs text-[11px] leading-snug text-muted-foreground">
                    Photo uploads apply when you save profile changes below.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border bg-muted/50 p-6">
                    <div className="text-3xl font-bold text-primary">
                      {(progress?.totalQuestionsAsked ?? 0).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Questions asked
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/50 p-6">
                    <div className="text-3xl font-bold text-cyan-accent">
                      {(
                        progress?.completedQuizzes ??
                        progress?.totalQuizAttempts ??
                        0
                      ).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Quizzes taken
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-8 md:p-10 lg:col-span-8">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-foreground">Institutional credentials</h3>
                  <button
                    type="button"
                    onClick={() => setCredentialsReadOnly((r) => !r)}
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    <Pencil className="h-4 w-4" />
                    {credentialsReadOnly ? 'Edit details' : 'Lock fields'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full legal name</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly={credentialsReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical school / affiliation</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly={credentialsReadOnly}
                            placeholder="e.g. Johns Hopkins University"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Current cohort</FormLabel>
                    <select
                      disabled={credentialsReadOnly}
                      value={cohortIsPreset ? schoolCohort : '__other__'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__other__') {
                          if (cohortIsPreset) form.setValue('schoolCohort', '', { shouldDirty: true });
                          return;
                        }
                        form.setValue('schoolCohort', v, { shouldDirty: true });
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {cohortPresets.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__other__">Other…</option>
                    </select>
                    {!cohortIsPreset ? (
                      <FormField
                        control={form.control}
                        name="schoolCohort"
                        render={({ field }) => (
                          <FormItem className="mt-2">
                            <FormControl>
                              <Input
                                {...field}
                                readOnly={credentialsReadOnly}
                                placeholder="Describe your cohort or program"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormField control={form.control} name="schoolCohort" render={() => <FormMessage />} />
                    )}
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="studentSchoolId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly={credentialsReadOnly}
                            placeholder="Enter your student ID"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-6">
                  <Shield className="h-9 w-9 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {profile.isActive ? 'Verified institutional account' : 'Account status'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile.isActive
                        ? 'Access to assigned classes and case content is active for your role.'
                        : 'Your account is inactive. Contact your lecturer or administrator.'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button type="submit" isLoading={updateMutation.isPending} disabled={updateMutation.isPending}>
                    {!updateMutation.isPending && <Save className="mr-2 h-4 w-4" />}
                    Save changes
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold text-foreground">Recent case activity</h3>
                  <Link href="/student/history" className="text-xs font-semibold text-primary hover:underline">
                    View all
                  </Link>
                </div>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {activity.slice(0, 6).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-4"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          {activityIcon(item.type)}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(item.occurredAt)}
                              {item.description ? ` · ${item.description}` : ''}
                            </p>
                          </div>
                        </div>
                        {item.status ? (
                          <span className="shrink-0 text-sm font-semibold text-cyan-accent">{item.status}</span>
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-8">
                <h3 className="mb-6 text-xl font-bold text-foreground">Notification preferences</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Clinical digest</p>
                      <p className="text-xs text-muted-foreground">Weekly summaries (stored on this device)</p>
                    </div>
                    <PillToggle
                      checked={notif.clinicalDigest}
                      onChange={(v) => patchNotif({ clinicalDigest: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Quiz reminders</p>
                      <p className="text-xs text-muted-foreground">In-app reminders for reviews</p>
                    </div>
                    <PillToggle
                      checked={notif.quizReminders}
                      onChange={(v) => patchNotif({ quizReminders: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">AI insight alerts</p>
                      <p className="text-xs text-muted-foreground">When new relevant cases appear</p>
                    </div>
                    <PillToggle
                      checked={notif.aiInsightAlerts}
                      onChange={(v) => patchNotif({ aiInsightAlerts: v })}
                    />
                  </div>
                  <div className="border-t border-border pt-6">
                    <button
                      type="button"
                      onClick={clearLocalSession}
                      className="flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear all session data
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <details className="group rounded-2xl border border-border bg-card p-6 shadow-sm">
              <summary className="cursor-pointer text-lg font-bold text-foreground">
                Contact &amp; demographics
              </summary>
              <div className="mt-6">
                <PersonalInfoFields
                  idPrefix="stu-pi"
                  values={personalValues}
                  onChange={(next) => {
                    (Object.keys(next) as (keyof PersonalInfoValues)[]).forEach((key) => {
                      form.setValue(key, next[key], { shouldDirty: true });
                    });
                  }}
                />
                <p className="mt-4 text-xs text-muted-foreground">
                  Email is tied to login and cannot be changed here.
                </p>
              </div>
            </details>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Roles</p>
              <div className="mt-2">
                <RoleBadgeList roles={profile.roles} emptyLabel="Student" />
              </div>
            </div>
          </form>
        </Form>
      ) : null}
    </DetailPageLayout>
  );
}
