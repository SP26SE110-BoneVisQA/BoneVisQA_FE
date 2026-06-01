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
  Activity,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  Presentation,
  RefreshCcw,
  RotateCcw,
  Save,
  Shield,
  Star,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';

// ── Schema ─────────────────────────────────────────────────────────────────────

const lecturerProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  department: z.string().trim(),
  avatarUrl: z.string(),
  bio: z.string(),
  phoneNumber: z.string(),
  address: z.string(),
  notifyNewStudent: z.boolean(),
  notifyQuizComplete: z.boolean(),
  notifyNewQuestion: z.boolean(),
});

type LecturerProfileFormValues = z.infer<typeof lecturerProfileSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────────

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

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Unknown';
  try {
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
    return formatDate(iso);
  } catch {
    return iso;
  }
}

function StatPill({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <div className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-background/80 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${color} shadow-sm transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

function MiniStatBar({
  icon: Icon,
  label,
  value,
  color,
  progress,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  progress?: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-sm font-bold text-foreground">{value}</p>
        </div>
        {progress != null && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: 'var(--tw-gradient-from, #0055ff)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${
        checked ? 'bg-gradient-to-r from-primary to-blue-400' : 'bg-muted-foreground/25'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function AchievementBadge({ icon: Icon, label, description, color }: {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-4 transition-all hover:shadow-md">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function TimelineItem({
  icon: Icon,
  color,
  title,
  subtitle,
  time,
}: {
  icon: React.ElementType;
  color: string;
  title: string;
  subtitle?: string;
  time?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {time && <span className="shrink-0 text-xs text-muted-foreground">{time}</span>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function LecturerProfilePage() {
  const profileQuery = useLecturerProfile();
  const statsQuery = useLecturerDashboardStats();
  const updateMutation = useUpdateLecturerProfile();
  const profile = profileQuery.data;
  const stats = statsQuery.data;

  const form = useForm<LecturerProfileFormValues>({
    resolver: zodResolver(lecturerProfileSchema),
    defaultValues: {
      fullName: '',
      department: '',
      avatarUrl: '',
      bio: '',
      phoneNumber: '',
      address: '',
      notifyNewStudent: true,
      notifyQuizComplete: true,
      notifyNewQuestion: false,
    },
  });

  const [personal, setPersonal] = useState<PersonalInfoValues>(EMPTY_PERSONAL_INFO);
  const [activeTab, setActiveTab] = useState<'overview' | 'account' | 'notifications'>('overview');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    form.reset({
      fullName: profile.fullName,
      department: profile.department ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      bio: profile.bio ?? '',
      phoneNumber: profile.phoneNumber ?? '',
      address: profile.address ?? '',
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
      appToast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  });

  const errorMessage = profileQuery.error
    ? getQueryErrorMessage(profileQuery.error, 'Failed to load profile.')
    : undefined;

  const avgScore = stats?.averageQuizScore != null ? `${stats.averageQuizScore.toFixed(1)}%` : 'N/A';
  // Derive quiz completion rate from scored attempts vs total attempts.
  // A "completed" attempt is one with a Score (i.e. was submitted and graded).
  const totalAttempts = stats?.totalQuizAttempts ?? 0;
  const completedAttempts = avgScore !== 'N/A' && totalAttempts > 0
    ? Math.round((totalAttempts * (stats!.averageQuizScore! / 100)))
    : 0;
  const completionRate = totalAttempts > 0
    ? Math.min(100, (completedAttempts / totalAttempts) * 100)
    : 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'account', label: 'Account', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ] as const;

  return (
    <DetailPageLayout
      title="My Profile"
      isLoading={profileQuery.isPending}
      error={errorMessage}
      maxWidthClass="max-w-7xl"
    >
      {profile && (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-8">

            {/* ═══════════════════════════════════════════════════ HERO SECTION */}
            <div className="relative overflow-hidden rounded-3xl">
              {/* Background layers */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0055ff] via-[#0040cc] to-[#002288]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,180,255,0.15),transparent_40%)]" />
              {/* Decorative circles */}
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
              <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

              <div className="relative px-8 py-10 sm:px-10 sm:py-12">
                <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
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
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-lg"
                        >
                          <Edit3 className="h-4 w-4" />
                          Change photo
                        </button>
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                      {profile.isActive ? 'Active Lecturer' : 'Account Pending'}
                    </div>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      {fullName || 'Lecturer'}
                    </h1>
                    {profile.department && (
                      <p className="mt-1 text-lg font-medium text-white/80">{profile.department}</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <RoleBadgeList roles={profile.roles ?? ['Lecturer']} />
                      {profile.email && (
                        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
                          <Mail className="h-3.5 w-3.5" />
                          {profile.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats Pills */}
                  <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
                    <div className="group flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:-translate-y-1">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/90 shadow-sm transition-transform duration-300 group-hover:scale-110">
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{stats?.totalClasses ?? 0}</p>
                        <p className="mt-0.5 text-xs font-medium text-white/70">Classes</p>
                      </div>
                    </div>
                    <div className="group flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:-translate-y-1">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/90 shadow-sm transition-transform duration-300 group-hover:scale-110">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{stats?.totalStudents ?? 0}</p>
                        <p className="mt-0.5 text-xs font-medium text-white/70">Students</p>
                      </div>
                    </div>
                    <div className="group flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:-translate-y-1">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/90 shadow-sm transition-transform duration-300 group-hover:scale-110">
                        <Award className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{avgScore}</p>
                        <p className="mt-0.5 text-xs font-medium text-white/70">Avg. Score</p>
                      </div>
                    </div>
                    <div className="group flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:-translate-y-1">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-400/90 shadow-sm transition-transform duration-300 group-hover:scale-110">
                        <Presentation className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{stats?.totalQuizAttempts ?? 0}</p>
                        <p className="mt-0.5 text-xs font-medium text-white/70">Attempts</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════ TAB NAVIGATION */}
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-muted/40 p-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-background text-foreground shadow-md shadow-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ═══════════════════════════════════════════════════ OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">

                {/* Left: Teaching Summary */}
                <div className="space-y-6 lg:col-span-8">
                  {/* Teaching Performance */}
                  <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-foreground">Teaching Overview</h3>
                          <p className="text-xs text-muted-foreground">Your semester performance summary</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
                        <p className="text-2xl font-bold text-primary">{stats?.totalClasses ?? 0}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">Active Classes</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
                        <p className="text-2xl font-bold text-sky-600">{stats?.totalStudents ?? 0}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">Total Students</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
                        <p className="text-2xl font-bold text-amber-600">{avgScore}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">Avg. Quiz Score</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
                        <p className="text-2xl font-bold text-emerald-600">{completionRate.toFixed(0)}%</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">Quiz Completion</p>
                      </div>
                    </div>
                    {completionRate > 0 && (
                      <div className="border-t border-border/50 px-6 pb-6">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Quiz completion rate</span>
                          <span className="font-semibold text-foreground">{completionRate.toFixed(1)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 transition-all duration-1000"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bio + Department Edit */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                        <Edit3 className="h-4 w-4 text-primary" />
                        Professional Info
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsEditing((v) => !v)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          isEditing
                            ? 'bg-primary text-primary-foreground'
                            : 'text-primary hover:bg-primary/10'
                        }`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {isEditing ? 'Editing…' : 'Edit'}
                      </button>
                    </div>
                    <div className="space-y-5">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Full Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                readOnly={!isEditing}
                                className={`h-12 ${!isEditing ? 'cursor-default bg-muted/30' : ''}`}
                              />
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
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Department
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g. Musculoskeletal Radiology"
                                readOnly={!isEditing}
                                className={`h-12 ${!isEditing ? 'cursor-default bg-muted/30' : ''}`}
                              />
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
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Bio / Professional Summary
                            </FormLabel>
                            <FormControl>
                              <textarea
                                {...field}
                                readOnly={!isEditing}
                                rows={3}
                                placeholder="Write a brief professional summary about your teaching expertise…"
                                className={`w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                                  !isEditing ? 'cursor-default bg-muted/30' : ''
                                }`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {isEditing && (
                      <div className="mt-5 flex justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            if (profile) {
                              form.reset({
                                fullName: profile.fullName,
                                department: profile.department ?? '',
                                avatarUrl: profile.avatarUrl ?? '',
                                bio: profile.bio ?? '',
                                phoneNumber: profile.phoneNumber ?? '',
                                address: profile.address ?? '',
                                notifyNewStudent: profile.notifyNewStudent,
                                notifyQuizComplete: profile.notifyQuizComplete,
                                notifyNewQuestion: profile.notifyNewQuestion,
                              });
                              setPersonal(profileToPersonalValues(profile));
                            }
                          }}
                          className="h-10"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateMutation.isPending}
                          isLoading={updateMutation.isPending}
                          className="h-10 px-6"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { href: '/lecturer/classes', icon: BookOpen, label: 'Manage Classes', color: 'bg-primary/10 text-primary hover:bg-primary/20' },
                      { href: '/lecturer/quizzes', icon: Presentation, label: 'Quiz Library', color: 'bg-sky-500/10 text-sky-600 hover:bg-sky-500/20' },
                      { href: '/lecturer/analytics', icon: TrendingUp, label: 'Analytics', color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' },
                      { href: '/lecturer/settings', icon: Bell, label: 'Settings', color: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' },
                    ].map((action) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                      >
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color}`}>
                          <action.icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{action.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Right: Sidebar Cards */}
                <div className="space-y-6 lg:col-span-4">

                  {/* Account Status Card */}
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm dark:from-emerald-950/20 dark:to-teal-950/20">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
                        <Shield className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Account Status</p>
                        <p className="text-xs text-muted-foreground">Security & verification</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-700">
                          {profile.isActive ? 'Active Account' : 'Account Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">Email verified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">Lecturer role assigned</span>
                      </div>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                      <Star className="h-4 w-4 text-amber-500" />
                      Teaching Milestones
                    </h3>
                    <div className="space-y-3">
                      <AchievementBadge
                        icon={GraduationCap}
                        label="Teaching Since"
                        description={formatDate(profile.createdAt)}
                        color="bg-primary"
                      />
                      <AchievementBadge
                        icon={BookOpen}
                        label="Classes Managed"
                        description={`${stats?.totalClasses ?? 0} active courses`}
                        color="bg-sky-500"
                      />
                      <AchievementBadge
                        icon={Users}
                        label="Students Mentored"
                        description={`${stats?.totalStudents ?? 0} total enrolled`}
                        color="bg-emerald-500"
                      />
                      <AchievementBadge
                        icon={Award}
                        label="Average Score"
                        description={`${avgScore} across all quizzes`}
                        color="bg-amber-500"
                      />
                    </div>
                  </div>

                  {/* Activity Timeline */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                      <Activity className="h-4 w-4 text-primary" />
                      Account Timeline
                    </h3>
                    <div className="space-y-4">
                      <TimelineItem
                        icon={Calendar}
                        color="bg-primary/20 text-primary"
                        title="Member Since"
                        time={formatDate(profile.createdAt)}
                      />
                      <TimelineItem
                        icon={Clock}
                        color="bg-sky-500/20 text-sky-600"
                        title="Last Login"
                        time={formatRelativeTime(profile.lastLogin)}
                      />
                      <TimelineItem
                        icon={RefreshCcw}
                        color="bg-emerald-500/20 text-emerald-600"
                        title="Profile Updated"
                        time={formatRelativeTime(profile.updatedAt)}
                      />
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="space-y-1">
                      {[
                        { href: '/lecturer/classes', icon: BookOpen, label: 'My Classes', desc: 'Manage courses' },
                        { href: '/lecturer/quizzes', icon: Presentation, label: 'Quiz Library', desc: 'View & create quizzes' },
                        { href: '/lecturer/settings', icon: Bell, label: 'Settings', desc: 'Notifications & preferences' },
                      ].map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <link.icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{link.label}</p>
                            <p className="text-xs text-muted-foreground">{link.desc}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
                {/* Left Column */}
                <div className="space-y-6 lg:col-span-7">
                  {/* Basic Info */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                      <User className="h-4 w-4 text-primary" />
                      Basic Information
                    </h3>
                    <div className="space-y-5">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Full Name
                            </FormLabel>
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
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Department / Specialty
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. Musculoskeletal Radiology" className="h-12" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="rounded-xl bg-muted/40 px-4 py-3">
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="font-medium text-foreground">{profile.email}</span>
                          <span className="text-xs">(read-only, tied to login)</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                      <Phone className="h-4 w-4 text-primary" />
                      Contact Information
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                          Phone Number
                        </label>
                        <Input
                          value={personal.phoneNumber}
                          onChange={(e) => setPersonal((p) => ({ ...p, phoneNumber: e.target.value }))}
                          placeholder="+84 90X XXX XXX"
                          className="h-12"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                          Address
                        </label>
                        <Input
                          value={personal.address}
                          onChange={(e) => setPersonal((p) => ({ ...p, address: e.target.value }))}
                          placeholder="University address or office location"
                          className="h-12"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                      <Edit3 className="h-4 w-4 text-primary" />
                      Professional Bio
                    </h3>
                    <textarea
                      {...form.register('bio')}
                      rows={4}
                      placeholder="Write a brief professional summary about your expertise and teaching philosophy…"
                      className="w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6 lg:col-span-5">
                  {/* Account Timeline */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      Account Timeline
                    </h3>
                    <div className="space-y-4">
                      <TimelineItem
                        icon={Calendar}
                        color="bg-primary/20 text-primary"
                        title="Member Since"
                        subtitle="When your account was created"
                        time={formatDate(profile.createdAt)}
                      />
                      <TimelineItem
                        icon={Clock}
                        color="bg-sky-500/20 text-sky-600"
                        title="Last Login"
                        subtitle="Most recent session"
                        time={formatRelativeTime(profile.lastLogin)}
                      />
                      <TimelineItem
                        icon={RefreshCcw}
                        color="bg-emerald-500/20 text-emerald-600"
                        title="Last Updated"
                        subtitle="Profile last modified"
                        time={formatRelativeTime(profile.updatedAt)}
                      />
                    </div>
                  </div>

                  {/* Account Security */}
                  <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm dark:from-emerald-950/20 dark:to-teal-950/20">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
                        <Shield className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Security Status</p>
                        <p className="text-xs text-muted-foreground">Your account protection level</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-white/60 px-4 py-3">
                        <span className="text-sm text-muted-foreground">Account Active</span>
                        <span className={`text-sm font-semibold ${profile.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {profile.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white/60 px-4 py-3">
                        <span className="text-sm text-muted-foreground">Email Verified</span>
                        <span className="text-sm font-semibold text-emerald-600">Verified</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white/60 px-4 py-3">
                        <span className="text-sm text-muted-foreground">Role</span>
                        <span className="text-sm font-semibold text-primary">
                          {profile.roles?.join(', ') || 'Lecturer'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Account Summary */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-4 text-sm font-bold text-foreground">Account Summary</h3>
                    <div className="space-y-3">
                      <MiniStatBar icon={BookOpen} label="Classes" value={stats?.totalClasses ?? 0} color="bg-primary/10 text-primary" />
                      <MiniStatBar icon={Users} label="Students" value={stats?.totalStudents ?? 0} color="bg-sky-500/10 text-sky-600" />
                      <MiniStatBar icon={Presentation} label="Quiz Attempts" value={stats?.totalQuizAttempts ?? 0} color="bg-amber-500/10 text-amber-600" />
                      <MiniStatBar icon={Award} label="Avg. Score" value={avgScore} color="bg-emerald-500/10 text-emerald-600" />
                    </div>
                  </div>
                </div>

                {/* Save Bar */}
                <div className="lg:col-span-12">
                  <div className="flex items-center justify-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (profile) {
                          form.reset({
                            fullName: profile.fullName,
                            department: profile.department ?? '',
                            avatarUrl: profile.avatarUrl ?? '',
                            bio: profile.bio ?? '',
                            phoneNumber: profile.phoneNumber ?? '',
                            address: profile.address ?? '',
                            notifyNewStudent: profile.notifyNewStudent,
                            notifyQuizComplete: profile.notifyQuizComplete,
                            notifyNewQuestion: profile.notifyNewQuestion,
                          });
                          setPersonal(profileToPersonalValues(profile));
                        }
                      }}
                      className="h-10"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                    <Button type="submit" disabled={updateMutation.isPending} isLoading={updateMutation.isPending} className="h-10 px-6">
                      <Save className="mr-2 h-4 w-4" />
                      {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
                {/* Notifications */}
                <div className="lg:col-span-8">
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
                      <Bell className="h-4 w-4 text-primary" />
                      Notification Preferences
                    </h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Control what updates you receive as a lecturer
                    </p>
                    <div className="space-y-3">
                      {(
                        [
                          [
                            'notifyNewStudent',
                            'New Student Enrollments',
                            'Get notified when students enroll in your classes',
                            'bg-emerald-500',
                          ],
                          [
                            'notifyQuizComplete',
                            'Quiz Completions',
                            'Receive updates when students complete quizzes',
                            'bg-sky-500',
                          ],
                          [
                            'notifyNewQuestion',
                            'New Student Questions',
                            'Be alerted when students submit new questions',
                            'bg-amber-500',
                          ],
                        ] as const
                      ).map(([key, label, description, color]) => (
                        <FormField
                          key={key}
                          control={form.control}
                          name={key}
                          render={({ field }) => (
                            <div className="group flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-5 transition-colors hover:bg-muted/40">
                              <div className="flex items-start gap-4">
                                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                                  <Bell className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{label}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                                </div>
                              </div>
                              <Toggle checked={field.value} onChange={field.onChange} />
                            </div>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notification Summary */}
                <div className="space-y-6 lg:col-span-4">
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                      <Bell className="h-4 w-4 text-primary" />
                      Notification Summary
                    </h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Student enrollments', active: form.watch('notifyNewStudent'), color: 'bg-emerald-500' },
                        { label: 'Quiz completions', active: form.watch('notifyQuizComplete'), color: 'bg-sky-500' },
                        { label: 'New questions', active: form.watch('notifyNewQuestion'), color: 'bg-amber-500' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${item.active ? item.color : 'bg-muted-foreground/30'}`} />
                          <span className={`text-sm ${item.active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                            {item.label}
                          </span>
                          <span className="ml-auto text-xs font-semibold text-muted-foreground">
                            {item.active ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-3 text-sm font-bold text-foreground">Quick Actions</h3>
                    <div className="space-y-2">
                      <Link
                        href="/lecturer/settings"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">Account Settings</p>
                          <p className="text-xs text-muted-foreground">Update profile details</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>

                  {/* Save Bar */}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (profile) {
                          form.reset({
                            fullName: profile.fullName,
                            department: profile.department ?? '',
                            avatarUrl: profile.avatarUrl ?? '',
                            bio: profile.bio ?? '',
                            phoneNumber: profile.phoneNumber ?? '',
                            address: profile.address ?? '',
                            notifyNewStudent: profile.notifyNewStudent,
                            notifyQuizComplete: profile.notifyQuizComplete,
                            notifyNewQuestion: profile.notifyNewQuestion,
                          });
                          setPersonal(profileToPersonalValues(profile));
                        }
                      }}
                      className="flex-1"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      isLoading={updateMutation.isPending}
                      className="flex-1"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {updateMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </form>
        </Form>
      )}
    </DetailPageLayout>
  );
}
