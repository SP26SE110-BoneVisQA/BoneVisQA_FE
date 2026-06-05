'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DetailPageLayout } from '@/components/layouts';
import { ProfileAvatarPicker } from '@/components/profile/profile-avatar-picker';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Building2,
  ChevronDown,
  Edit3,
  GraduationCap,
  Lock,
  Mail,
  MessageSquare,
  RotateCcw,
  Save,
  Shield,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  fetchMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  type UserProfileDto,
} from '@/lib/api/users';
import {
  fetchLecturerDashboardStats,
  type LecturerDashboardStats,
} from '@/lib/api/lecturer-dashboard';
import { emitAuthRefresh } from '@/lib/useAuth';
import { appToast } from '@/lib/api/errors/app-toast';
import { getApiErrorMessage } from '@/lib/api/client';

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'L'
  );
}

function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '—';
  return `${v}${suffix}`;
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
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:shadow-accent/5">
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

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
      <GraduationCap className="h-2.5 w-2.5" />
      {role}
    </span>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
      ))}
    </div>
  );
}

export function LecturerProfilePage() {
  const [clientReady, setClientReady] = useState(false);
  const seededRef = useRef(false);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; avatar?: string; form?: string }>({});

  useEffect(() => {
    setClientReady(true);
  }, []);

  // Profile data
  useEffect(() => {
    if (!clientReady || typeof window === 'undefined') return;
    if (!localStorage.getItem('token')) return;
    setProfileLoading(true);
    fetchMyProfile()
      .then((data) => {
        if (seededRef.current) return;
        seededRef.current = true;
        setProfile(data);
        setFullName(data.fullName?.trim() ?? '');
        setBio(typeof data.bio === 'string' ? data.bio : '');
        setPhone(typeof data.phoneNumber === 'string' ? data.phoneNumber : '');
      })
      .catch((e) => setProfileError(getApiErrorMessage(e) || 'Failed to load profile.'))
      .finally(() => setProfileLoading(false));
  }, [clientReady]);

  // Stats data
  const { data: stats } = useQuery({
    queryKey: ['lecturer-dashboard-stats'],
    queryFn: fetchLecturerDashboardStats,
    enabled: clientReady,
    staleTime: 60_000,
  });

  const initials = getInitials(fullName || profile?.fullName || 'L');
  const avatarSrc = pendingAvatarUrl?.trim() || profile?.avatarUrl?.trim() || '';
  const displayName = fullName.trim() || profile?.email?.trim() || 'Lecturer';

  const handleAvatarChange = async (file: File | null) => {
    setFieldErrors((e) => ({ ...e, avatar: undefined }));
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setFieldErrors({ avatar: `Image must be ${MAX_AVATAR_BYTES / (1024 * 1024)}MB or smaller.` });
      return;
    }
    setUploading(true);
    try {
      const { avatarUrl } = await uploadMyAvatar(file);
      setPendingAvatarUrl(`${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
      appToast.success('Profile photo ready. Click Save changes to apply.');
    } catch (e) {
      setFieldErrors({ avatar: e instanceof Error ? e.message : 'Failed to upload photo.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (!fullName.trim()) { setFieldErrors({ fullName: 'Full name is required.' }); return; }
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        fullName: fullName.trim(),
        bio: bio.trim() || null,
        phoneNumber: phone.trim() || null,
        avatarUrl: pendingAvatarUrl?.trim() || undefined,
      });
      setProfile((prev) => ({ ...(prev ?? {}), ...updated }));
      if (updated.fullName || pendingAvatarUrl) {
        emitAuthRefresh({
          fullName: updated.fullName ?? fullName.trim(),
          ...(updated.avatarUrl ? { avatarUrl: updated.avatarUrl } : {}),
        });
      }
      setPendingAvatarUrl(null);
      setIsEditing(false);
      appToast.success('Profile updated successfully.');
    } catch (err) {
      setFieldErrors({ form: err instanceof Error ? err.message : 'Failed to save. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!profile) return;
    setFullName(profile.fullName?.trim() ?? '');
    setBio(typeof profile.bio === 'string' ? profile.bio : '');
    setPhone(typeof profile.phoneNumber === 'string' ? profile.phoneNumber : '');
    setPendingAvatarUrl(null);
    setFieldErrors({});
    setIsEditing(false);
  };

  return (
    <DetailPageLayout
      title="My profile"
      isLoading={profileLoading}
      error={profileError}
      maxWidthClass="max-w-7xl"
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/8 via-background to-warning/6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-warning/5 blur-3xl" />

          <div className="relative flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:gap-8">
            {/* Avatar */}
            <div className="flex flex-col items-center sm:items-start">
              <ProfileAvatarPicker
                avatarUrl={avatarSrc}
                initials={initials}
                alt={displayName}
                size="lg"
                variant="hero"
                onUrlChange={(url) => setPendingAvatarUrl(url)}
                onError={(msg) => appToast.error(msg)}
              />
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {(profile?.roles ?? ['Lecturer']).map((r) => <RoleBadge key={r} role={r} />)}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{displayName}</h1>
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground/60" />
                Faculty member
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-muted-foreground/60" />
                  {profile?.email ?? '—'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0">
              <Button
                type="button"
                variant={isEditing ? 'primary' : 'outline'}
                onClick={() => setIsEditing((v) => !v)}
                className="gap-2"
              >
                {isEditing ? <><Lock className="h-4 w-4" /> Lock</> : <><Edit3 className="h-4 w-4" /> Edit profile</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {stats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={BookOpen}
              iconBg="bg-accent/10"
              iconColor="text-accent"
              value={fmt(stats.totalClasses)}
              label="Classes"
              sub="assigned courses"
            />
            <StatCard
              icon={Users}
              iconBg="bg-primary/10"
              iconColor="text-primary"
              value={fmt(stats.totalStudents)}
              label="Students"
              sub="enrolled learners"
            />
            <StatCard
              icon={MessageSquare}
              iconBg="bg-warning/10"
              iconColor="text-warning"
              value={fmt(stats.totalQuestions)}
              label="Questions"
              sub="answered this month"
            />
            <StatCard
              icon={TrendingUp}
              iconBg="bg-success/10"
              iconColor="text-success"
              value={fmt(stats.averageQuizScore, '%')}
              label="Avg score"
              sub={`${stats.totalQuizAttempts} quiz attempts`}
            />
          </div>
        ) : (
          <StatsSkeleton />
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Profile Form */}
          <div className="space-y-6 lg:col-span-2">
            <form id="lecturer-profile-form" onSubmit={handleSave} className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Profile information</h2>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Full name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setFieldErrors((x) => ({ ...x, fullName: undefined })); }}
                      readOnly={!isEditing}
                      className={`mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${!isEditing ? 'bg-muted/30' : ''}`}
                    />
                    {fieldErrors.fullName && <p className="mt-1 text-xs text-destructive">{fieldErrors.fullName}</p>}
                  </div>

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      readOnly={!isEditing}
                      rows={3}
                      placeholder="A short introduction for your students and colleagues…"
                      className={`mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none ${!isEditing ? 'bg-muted/30' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="+84…"
                      className={`mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${!isEditing ? 'bg-muted/30' : ''}`}
                    />
                  </div>

                  {fieldErrors.avatar ? (
                    <p className="text-xs text-destructive" role="alert">{fieldErrors.avatar}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">PNG or JPG, max {MAX_AVATAR_BYTES / (1024 * 1024)}MB.</p>
                  )}
                </div>

                {fieldErrors.form && <p className="mt-3 text-sm text-destructive" role="alert">{fieldErrors.form}</p>}
              </div>
            </form>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Account Info */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/4 to-transparent p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Account info</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="max-w-[160px] truncate font-medium text-foreground">{profile?.email ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Roles</span>
                  <span className="font-medium text-foreground">{(profile?.roles ?? []).join(', ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-success">Active</span>
                </div>
                {stats && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pending reviews</span>
                    <span className="font-medium text-foreground">{fmt(stats.pendingReviews)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Settings shortcut */}
            <div className="rounded-2xl border border-dashed border-border p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Full settings</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Manage notifications, class preferences, and more.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => { window.location.href = '/lecturer/settings'; }}
              >
                <Shield className="h-3.5 w-3.5" />
                Open full settings
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleReset} disabled={saving || uploading}>
            <RotateCcw className="h-4 w-4" />
            Reset changes
          </Button>
          <Button type="submit" form="lecturer-profile-form" isLoading={saving} disabled={saving || uploading}>
            {!saving && <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </DetailPageLayout>
  );
}
