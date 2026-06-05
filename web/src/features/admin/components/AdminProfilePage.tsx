'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DetailPageLayout } from '@/components/layouts';
import { ProfileAvatarPicker } from '@/components/profile/profile-avatar-picker';
import { Button } from '@/components/ui/button';
import {
  Award,
  BookOpen,
  Cpu,
  Database,
  Edit3,
  FileText,
  GraduationCap,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  Save,
  Settings2,
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
  fetchAdminUserStats,
  fetchAdminExpertReviewStats,
  fetchAdminRagStats,
} from '@/lib/api/admin-dashboard';
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
      .join('') || 'A'
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v}`;
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
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:shadow-destructive/5">
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
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
      <Shield className="h-2.5 w-2.5" />
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

export function AdminProfilePage() {
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
  const { data: userStats } = useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: fetchAdminUserStats,
    enabled: clientReady,
    staleTime: 60_000,
  });
  const { data: ragStats } = useQuery({
    queryKey: ['admin-rag-stats'],
    queryFn: fetchAdminRagStats,
    enabled: clientReady,
    staleTime: 60_000,
  });
  const { data: expertStats } = useQuery({
    queryKey: ['admin-expert-stats'],
    queryFn: fetchAdminExpertReviewStats,
    enabled: clientReady,
    staleTime: 60_000,
  });

  const initials = getInitials(fullName || profile?.fullName || 'A');
  const avatarSrc = pendingAvatarUrl?.trim() || profile?.avatarUrl?.trim() || '';
  const displayName = fullName.trim() || profile?.email?.trim() || 'Admin';

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
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-destructive/8 via-background to-primary/8 shadow-sm">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-destructive/5 blur-3xl" />
          <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

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
                {(profile?.roles ?? ['Admin']).map((r) => <RoleBadge key={r} role={r} />)}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{displayName}</h1>
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground/60" />
                System administrator
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
        {userStats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Users}
              iconBg="bg-primary/10"
              iconColor="text-primary"
              value={fmt(userStats.totalUsers)}
              label="Total users"
              sub="registered accounts"
            />
            <StatCard
              icon={GraduationCap}
              iconBg="bg-accent/10"
              iconColor="text-accent"
              value={fmt(userStats.usersByRole?.['Student'])}
              label="Students"
              sub="active learners"
            />
            <StatCard
              icon={FileText}
              iconBg="bg-warning/10"
              iconColor="text-warning"
              value={fmt(ragStats?.totalDocuments)}
              label="Documents"
              sub="in knowledge base"
            />
            <StatCard
              icon={Award}
              iconBg="bg-success/10"
              iconColor="text-success"
              value={fmt(expertStats?.totalReviews)}
              label="Expert reviews"
              sub="content verified"
            />
          </div>
        ) : (
          <StatsSkeleton />
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Profile Form */}
          <div className="space-y-6 lg:col-span-2">
            <form id="admin-profile-form" onSubmit={handleSave} className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <Shield className="h-4 w-4" />
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
                      placeholder="A short introduction for your colleagues…"
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
            {/* System Access */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <Shield className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-foreground">System access</h3>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account type</span>
                  <span className="font-medium text-destructive">Administrator</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Roles assigned</span>
                  <span className="font-medium text-foreground">{(profile?.roles ?? []).join(', ')}</span>
                </div>
                {userStats && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Active users</span>
                      <span className="font-medium text-foreground">{fmt(userStats.activeUsers)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Pending approvals</span>
                      <span className="font-medium text-foreground">{fmt(userStats.pendingUsers)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Platform Overview */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-destructive/4 to-transparent p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground">Platform overview</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total users</span>
                  <span className="font-medium text-foreground">{fmt(userStats?.totalUsers)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Students</span>
                  <span className="font-medium text-foreground">{fmt(userStats?.usersByRole?.['Student'])}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="font-medium text-foreground">{fmt(ragStats?.totalDocuments)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expert reviews</span>
                  <span className="font-medium text-foreground">{fmt(expertStats?.totalReviews)}</span>
                </div>
              </div>
            </div>

            {/* Settings shortcut */}
            <div className="rounded-2xl border border-dashed border-border p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Full settings</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Manage users, system config, and more.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => { window.location.href = '/admin/settings'; }}
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
          <Button type="submit" form="admin-profile-form" isLoading={saving} disabled={saving || uploading}>
            {!saving && <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </DetailPageLayout>
  );
}
