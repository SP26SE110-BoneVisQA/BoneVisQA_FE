'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DetailPageLayout } from '@/components/layouts';
import { RoleBadgeList } from '@/components/profile/role-badge-list';
import {
  EMPTY_PERSONAL_INFO,
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
  useLecturerProfile,
  useLecturerDashboardStats,
  useUpdateLecturerProfile,
} from '@/features/lecturer/queries/use-lecturer-profile';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Edit3,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  RotateCcw,
  Save,
  Shield,
  Users,
} from 'lucide-react';

const lecturerSettingsSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  department: z.string().trim(),
  avatarUrl: z.string(),
  notifyNewStudent: z.boolean(),
  notifyQuizComplete: z.boolean(),
  notifyNewQuestion: z.boolean(),
});

type LecturerSettingsFormValues = z.infer<typeof lecturerSettingsSchema>;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-success' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-background shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div className={`absolute -right-2 -top-2 h-20 w-20 rounded-full opacity-10 blur-2xl ${color}`} />
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color} shadow-sm`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function LecturerSettingsPage() {
  const profileQuery = useLecturerProfile();
  const statsQuery = useLecturerDashboardStats();
  const updateMutation = useUpdateLecturerProfile();
  const profile = profileQuery.data;
  const stats = statsQuery.data;

  const form = useForm<LecturerSettingsFormValues>({
    resolver: zodResolver(lecturerSettingsSchema),
    defaultValues: {
      fullName: '',
      department: '',
      avatarUrl: '',
      notifyNewStudent: true,
      notifyQuizComplete: true,
      notifyNewQuestion: false,
    },
  });

  const [personal, setPersonal] = useState<PersonalInfoValues>(EMPTY_PERSONAL_INFO);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'personal'>('profile');

  useEffect(() => {
    if (!profile) return;
    form.reset({
      fullName: profile.fullName,
      department: profile.department ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      notifyNewStudent: profile.notifyNewStudent,
      notifyQuizComplete: profile.notifyQuizComplete,
      notifyNewQuestion: profile.notifyNewQuestion,
    });
    setPersonal(profileToPersonalValues(profile));
  }, [profile, form]);

  const initials = useMemo(() => {
    const name = form.watch('fullName') || profile?.fullName || 'L';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }, [form, profile?.fullName]);

  const fullName = form.watch('fullName');
  const avatarUrl = form.watch('avatarUrl');

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync({
        ...values,
        ...personalValuesToApiPatch(personal),
      });
      appToast.success('Profile updated successfully.');
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  });

  const errorMessage = profileQuery.error
    ? getQueryErrorMessage(profileQuery.error, 'Failed to load profile.')
    : undefined;

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'personal', label: 'Personal Info' },
  ] as const;

  return (
    <DetailPageLayout
      title="Settings"
      isLoading={profileQuery.isPending}
      error={errorMessage}
      maxWidthClass="max-w-6xl"
    >
      {/* Hero Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,94,152,0.08),transparent_50%)]" />
        <div className="relative px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="relative shrink-0">
              <ProfileAvatarPicker
                avatarUrl={avatarUrl}
                initials={initials || 'L'}
                alt={fullName || 'Lecturer'}
                size="xl"
                variant="hero"
                onUrlChange={(url) => form.setValue('avatarUrl', url, { shouldDirty: true })}
                footer={(openPicker) => (
                  <button
                    type="button"
                    onClick={openPicker}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:bg-background hover:shadow-md"
                  >
                    <Edit3 className="h-4 w-4" />
                    Change photo
                  </button>
                )}
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {fullName || 'Lecturer'}
              </h1>
              {profile?.department && (
                <p className="mt-1 text-lg text-muted-foreground">{profile.department}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <RoleBadgeList roles={profile?.roles ?? ['Lecturer']} />
                {profile?.email && (
                  <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {profile.email}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
              <StatCard
                icon={BookOpen}
                label="Classes"
                value={stats?.totalClasses ?? 0}
                color="bg-primary"
              />
              <StatCard
                icon={Users}
                label="Students"
                value={stats?.totalStudents ?? 0}
                color="bg-cyan-accent"
              />
              <StatCard
                icon={GraduationCap}
                label="Avg. Score"
                value={stats?.averageQuizScore != null ? `${stats.averageQuizScore.toFixed(1)}%` : 'N/A'}
                color="bg-amber-500"
              />
              <StatCard
                icon={Clock}
                label="Quiz Attempts"
                value={stats?.totalQuizAttempts ?? 0}
                color="bg-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-foreground">
                  <Edit3 className="h-5 w-5 text-primary" />
                  Basic Information
                </h2>
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Radiology" className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                    <Calendar className="h-5 w-5 text-primary" />
                    Account Timeline
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-background/60 px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Member since
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatDate(profile?.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-background/60 px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Last login
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatDate(profile?.lastLogin)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-background/60 px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCcw className="h-4 w-4" />
                        Profile updated
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatDate(profile?.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-success/20 bg-success/5 p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20">
                      <Shield className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {profile?.isActive ? 'Active Account' : 'Account Status'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profile?.isActive
                          ? 'Your account is active and verified.'
                          : 'Contact your administrator to activate your account.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-foreground">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </h2>
              <div className="space-y-4">
                {(
                  [
                    ['notifyNewStudent', 'New student enrollments', 'Get notified when students enroll in your classes'],
                    ['notifyQuizComplete', 'Quiz completions', 'Receive updates when students complete quizzes'],
                    ['notifyNewQuestion', 'New student questions', 'Be alerted when students ask new questions'],
                  ] as const
                ).map(([key, label, description]) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/50">
                        <div>
                          <FormLabel className="font-semibold">{label}</FormLabel>
                          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                        </div>
                        <FormControl>
                          <Toggle checked={field.value} onChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Personal Info Tab */}
          {activeTab === 'personal' && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-foreground">
                <MapPin className="h-5 w-5 text-primary" />
                Personal Information
              </h2>
              <PersonalInfoFields values={personal} onChange={setPersonal} />
              <div className="mt-4 rounded-lg bg-muted/30 p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>
                    <strong>Email:</strong> {profile?.email || 'N/A'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Button type="submit" disabled={updateMutation.isPending} className="h-11 px-6">
              {!updateMutation.isPending && <Save className="mr-2 h-4 w-4" />}
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (profile) {
                  form.reset({
                    fullName: profile.fullName,
                    department: profile.department ?? '',
                    avatarUrl: profile.avatarUrl ?? '',
                    notifyNewStudent: profile.notifyNewStudent,
                    notifyQuizComplete: profile.notifyQuizComplete,
                    notifyNewQuestion: profile.notifyNewQuestion,
                  });
                  setPersonal(profileToPersonalValues(profile));
                }
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <div className="ml-auto">
              <Link
                href="/lecturer/profile"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View public profile
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
