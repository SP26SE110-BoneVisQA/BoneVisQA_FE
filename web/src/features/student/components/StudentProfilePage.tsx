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
  Award,
  Bell,
  BookOpen,
  Camera,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  History,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Save,
  Shield,
  Star,
  Stethoscope,
  TrendingUp,
  User,
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
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getActivityIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('quiz')) return { bg: 'bg-cyan-500/10', color: 'text-cyan-600', Icon: FileText };
  if (t.includes('ai') || t.includes('question')) return { bg: 'bg-purple-500/10', color: 'text-purple-600', Icon: MessageSquare };
  if (t.includes('case') || t.includes('view')) return { bg: 'bg-blue-500/10', color: 'text-blue-600', Icon: Eye };
  return { bg: 'bg-primary/10', color: 'text-primary', Icon: BookOpen };
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  sub,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:shadow-primary/5">
      <div className={`absolute -right-2 -top-2 h-20 w-20 rounded-full opacity-5 blur-2xl ${iconBg}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">{label}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg} ${iconColor}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function PillToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'right-1' : 'left-1'}`}
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
  const [activeTab, setActiveTab] = useState<'activity' | 'notifications'>('activity');

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
    const role = profile?.roles && profile.roles.length > 0 ? profile.roles.join(' · ') : 'Student';
    const cohort = schoolCohort?.trim();
    return cohort ? `${role} · ${cohort}` : role;
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
    if (!confirm('Clear preferences and cached data on this device?')) return;
    try {
      sessionStorage.clear();
      localStorage.removeItem(NOTIF_PREFS_KEY);
    } catch { /* ignore */ }
    setNotif(DEFAULT_NOTIF);
    appToast.success('Local session data cleared.');
  };

  const errorMessage = error ? getQueryErrorMessage(error, 'Failed to load profile.') : null;
  const totalQuizzes = progress?.completedQuizzes ?? progress?.totalQuizAttempts ?? 0;
  const completionRate = progress?.avgQuizScore != null ? Math.round(progress.avgQuizScore) : 0;

  return (
    <DetailPageLayout
      title="My profile"
      isLoading={isPending}
      error={errorMessage}
      maxWidthClass="max-w-7xl"
    >
      {!profile && !isPending && !error ? (
        <EmptyState title="No profile data" />
      ) : profile ? (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">

            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/8 via-background to-accent/8 shadow-sm">
              <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
              <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-accent/5 blur-3xl" />

              <div className="relative flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex flex-col items-center sm:items-start">
                  <ProfileAvatarPicker
                    avatarUrl={avatarUrl ?? ''}
                    initials={initials || 'BV'}
                    alt={fullName || 'Student avatar'}
                    size="xl"
                    variant="hero"
                    onUrlChange={(url) => form.setValue('avatarUrl', url, { shouldDirty: true })}
                    onError={(msg) => appToast.error(msg)}
                  />
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    {(profile.roles ?? ['Student']).map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                      >
                        <GraduationCap className="h-2.5 w-2.5" />
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {fullName || 'Student'}
                  </h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">{roleSubtitle}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground sm:justify-start">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-muted-foreground/60" />
                      {profile.email}
                    </span>
                    {profile.classCode && (
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="h-3 w-3 text-muted-foreground/60" />
                        {profile.classCode}
                      </span>
                    )}
                    <span className={`flex items-center gap-1.5 font-medium ${profile.isActive ? 'text-success' : 'text-warning'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${profile.isActive ? 'bg-success' : 'bg-warning'}`} />
                      {profile.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    type="button"
                    variant={credentialsReadOnly ? 'outline' : 'primary'}
                    onClick={() => setCredentialsReadOnly((r) => !r)}
                    className="gap-2"
                  >
                    {credentialsReadOnly ? (
                      <><Edit3 className="h-4 w-4" /> Edit profile</>
                    ) : (
                      <><Lock className="h-4 w-4" /> Lock</>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={MessageSquare} iconBg="bg-blue-500/10" iconColor="text-blue-600" value={(progress?.totalQuestionsAsked ?? 0).toLocaleString()} label="Questions asked" sub="total in your career" />
              <StatCard icon={FileText} iconBg="bg-cyan-500/10" iconColor="text-cyan-600" value={totalQuizzes.toLocaleString()} label="Quizzes taken" sub="completed assessments" />
              <StatCard icon={Eye} iconBg="bg-purple-500/10" iconColor="text-purple-600" value={(progress?.totalCasesViewed ?? 0).toLocaleString()} label="Cases viewed" sub="bone cases explored" />
              <StatCard icon={TrendingUp} iconBg="bg-success/10" iconColor="text-success" value={`${completionRate}%`} label="Completion rate" sub="assigned content" />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left: Credentials + Personal */}
              <div className="space-y-6 lg:col-span-2">
                {/* Institutional Credentials */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground">Institutional credentials</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Full legal name</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly={credentialsReadOnly} className="mt-1.5 bg-muted/30" />
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
                          <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Medical school / affiliation</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly={credentialsReadOnly} placeholder="e.g. Johns Hopkins University" className="mt-1.5 bg-muted/30" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current cohort</label>
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
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {cohortPresets.map((c) => <option key={c} value={c}>{c}</option>)}
                        <option value="__other__">Other…</option>
                      </select>
                      {!cohortIsPreset ? (
                        <FormField
                          control={form.control}
                          name="schoolCohort"
                          render={({ field }) => (
                            <FormItem className="mt-2">
                              <FormControl>
                                <Input {...field} readOnly={credentialsReadOnly} placeholder="Describe your cohort" className="bg-muted/30" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <FormField control={form.control} name="schoolCohort" render={() => <FormMessage />} />
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name="studentSchoolId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Student ID</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly={credentialsReadOnly} placeholder="Enter your student ID" className="mt-1.5 bg-muted/30" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Account status banner */}
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
                    <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {profile.isActive ? 'Verified institutional account' : 'Account status'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {profile.isActive
                          ? 'Access to assigned classes and case content is active for your role.'
                          : 'Your account is inactive. Contact your lecturer or administrator.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Button type="submit" isLoading={updateMutation.isPending} disabled={updateMutation.isPending}>
                      {!updateMutation.isPending && <Save className="mr-2 h-4 w-4" />}
                      Save changes
                    </Button>
                  </div>
                </div>

                {/* Contact & Demographics */}
                <details className="group rounded-2xl border border-border bg-card shadow-sm">
                  <summary className="flex cursor-pointer items-center gap-3 px-6 py-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-base font-semibold text-foreground">Contact &amp; demographics</span>
                      <p className="text-xs text-muted-foreground">
                        {personalValues.phoneNumber || personalValues.address ? 'Additional info provided' : 'Optional details'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="border-t border-border px-6 pb-6 pt-4">
                    <PersonalInfoFields
                      idPrefix="stu-pi"
                      values={personalValues}
                      onChange={(next) => {
                        (Object.keys(next) as (keyof PersonalInfoValues)[]).forEach((key) => {
                          form.setValue(key, next[key], { shouldDirty: true });
                        });
                      }}
                    />
                    <p className="mt-4 text-xs text-muted-foreground">Email is tied to login and cannot be changed here.</p>
                  </div>
                </details>
              </div>

              {/* Right: Activity / Notifications */}
              <div className="space-y-6">
                {/* Tabs */}
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex border-b border-border">
                    <button type="button" onClick={() => setActiveTab('activity')} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${activeTab === 'activity' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      <History className="h-4 w-4" />
                      Activity
                    </button>
                    <button type="button" onClick={() => setActiveTab('notifications')} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Bell className="h-4 w-4" />
                      Notifications
                    </button>
                  </div>

                  <div className="p-5">
                    {activeTab === 'activity' ? (
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
                          <Link href="/student/history" className="text-xs font-medium text-primary hover:underline">View all</Link>
                        </div>
                        {activity.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">No recent activity yet.</p>
                        ) : (
                          <div className="space-y-4">
                            {activity.slice(0, 6).map((item) => {
                              const { bg, color, Icon } = getActivityIcon(item.type);
                              return (
                                <div key={item.id} className="flex items-start gap-4 rounded-xl p-3 transition-colors hover:bg-muted/30">
                                  <div className={`rounded-xl p-2 ${bg}`}>
                                    <Icon className={`h-4 w-4 ${color}`} aria-hidden />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground leading-tight">{item.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {formatRelativeTime(item.occurredAt)}
                                      {item.description ? ` · ${item.description}` : ''}
                                    </p>
                                  </div>
                                  {item.status && <span className="shrink-0 text-xs font-semibold text-cyan-600 mt-0.5">{item.status}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Clinical digest</p>
                            <p className="text-xs text-muted-foreground">Weekly summaries (stored locally)</p>
                          </div>
                          <PillToggle checked={notif.clinicalDigest} onChange={(v) => patchNotif({ clinicalDigest: v })} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Quiz reminders</p>
                            <p className="text-xs text-muted-foreground">In-app reminders for reviews</p>
                          </div>
                          <PillToggle checked={notif.quizReminders} onChange={(v) => patchNotif({ quizReminders: v })} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">AI insight alerts</p>
                            <p className="text-xs text-muted-foreground">When new relevant cases appear</p>
                          </div>
                          <PillToggle checked={notif.aiInsightAlerts} onChange={(v) => patchNotif({ aiInsightAlerts: v })} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Info */}
                <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/4 to-transparent p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Account info</h3>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="max-w-[160px] truncate font-medium text-foreground">{profile.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Roles</span>
                      <span className="font-medium text-foreground">{(profile.roles ?? []).join(', ')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </form>
        </Form>
      ) : null}
    </DetailPageLayout>
  );
}
