'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Camera,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { ListPageLayout } from '@/components/layouts';
import { SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, resolveApiAssetUrl } from '@/lib/api/client';
import {
  fetchMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  type UserProfileDto,
} from '@/lib/api/users';
import { emitAuthRefresh } from '@/lib/useAuth';
import { appToast } from '@/lib/api/errors/app-toast';

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'BV'
  );
}

function ProfileHeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-busy="true">
      <SkeletonBlock className="h-40 w-full rounded-none sm:h-48" />
      <div className="relative px-6 pb-6 pt-0">
        <SkeletonBlock className="absolute -top-12 left-6 h-24 w-24 rounded-full border-4 border-card" />
        <div className="ml-0 mt-16 space-y-2 sm:ml-28 sm:mt-4">
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [clientReady, setClientReady] = useState(false);
  const seededFromQueryRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [schoolCohort, setSchoolCohort] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    avatar?: string;
    form?: string;
  }>({});

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!clientReady || typeof window === 'undefined') return;
    if (!localStorage.getItem('token')) {
      router.replace('/auth/sign-in');
    }
  }, [clientReady, router]);

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
    enabled:
      clientReady && typeof window !== 'undefined' && Boolean(localStorage.getItem('token')),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const data = profileQuery.data;
    if (!data || seededFromQueryRef.current) return;
    seededFromQueryRef.current = true;
    setProfile(data);
    setFullName(data.fullName?.trim() ?? '');
    setSchoolCohort(data.schoolCohort?.trim() ?? '');
    setPhoneNumber(typeof data.phoneNumber === 'string' ? data.phoneNumber : '');
    setBio(typeof data.bio === 'string' ? data.bio : '');
  }, [profileQuery.data]);

  const loading = profileQuery.isPending;
  const loadError = profileQuery.isError ? getApiErrorMessage(profileQuery.error) : null;

  const roleLabel = useMemo(() => {
    const role = profile?.activeRole ?? profile?.role ?? profile?.roles?.[0] ?? 'Member';
    return String(role);
  }, [profile]);

  const statusLabel = useMemo(() => {
    return String(profile?.status ?? profile?.userStatus ?? 'Active');
  }, [profile]);

  const displayName = fullName.trim() || profile?.email?.trim() || 'Member';
  const avatarSrc = pendingAvatarUrl?.trim() || profile?.avatarUrl?.trim() || '';
  const avatarDisplaySrc = useMemo(() => {
    if (!avatarSrc) return '';
    return resolveApiAssetUrl(avatarSrc);
  }, [avatarSrc]);

  const handleAvatarChange = async (file: File | null) => {
    setFieldErrors((e) => ({ ...e, avatar: undefined }));
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setFieldErrors((e) => ({
        ...e,
        avatar: `Image must be ${MAX_AVATAR_BYTES / (1024 * 1024)}MB or smaller.`,
      }));
      return;
    }
    setUploading(true);
    try {
      const { avatarUrl } = await uploadMyAvatar(file);
      const bustedUrl = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      // Preview immediately, but defer profile update until Save changes.
      setPendingAvatarUrl(bustedUrl);
      appToast.success('Profile photo ready. Click Save changes to apply.');
    } catch (e) {
      setFieldErrors((err) => ({
        ...err,
        avatar: e instanceof Error ? e.message : 'Failed to upload photo.',
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (!fullName.trim()) {
      setFieldErrors({ fullName: 'Full name is required.' });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        fullName: fullName.trim(),
        schoolCohort: schoolCohort.trim() || null,
        avatarUrl: pendingAvatarUrl?.trim() || undefined,
        phoneNumber: phoneNumber.trim() || null,
        bio: bio.trim() || null,
      });
      const nextFullName = updated.fullName ?? fullName.trim();
      const nextAvatarUrl =
        updated.avatarUrl?.trim() || pendingAvatarUrl?.trim() || profile?.avatarUrl?.trim() || undefined;
      setProfile((prev) => {
        const merged = { ...(prev ?? {}), ...updated };
        const incoming = updated.avatarUrl?.trim();
        if (!incoming) {
          if (pendingAvatarUrl?.trim()) {
            merged.avatarUrl = pendingAvatarUrl;
          } else if (prev?.avatarUrl?.trim()) {
            merged.avatarUrl = prev.avatarUrl;
          }
        }
        return merged;
      });
      emitAuthRefresh({
        fullName: nextFullName,
        ...(nextAvatarUrl ? { avatarUrl: nextAvatarUrl } : {}),
      });
      setPendingAvatarUrl(null);
      appToast.success('Profile saved.');
    } catch (err) {
      setFieldErrors({
        form: err instanceof Error ? err.message : 'Failed to save. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPageLayout
      title="Profile"
      isLoading={loading}
      error={loadError}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {loading ? (
          <ProfileHeroSkeleton />
        ) : loadError ? (
          <div
            className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm text-destructive"
            role="alert"
          >
            {loadError}
          </div>
        ) : (
          <>
            {/* Hero: cover + overlapping avatar */}
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="relative h-36 bg-gradient-to-br from-primary/35 via-primary/15 to-muted sm:h-44">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-accent/20 via-transparent to-transparent opacity-90" />
                <div className="absolute bottom-4 right-6 hidden text-right sm:block">
                  <p className="text-xs font-medium uppercase tracking-widest text-primary-foreground/90 mix-blend-plus-lighter">
                    BoneVisQA
                  </p>
                  <p className="text-[10px] text-primary-foreground/70 mix-blend-plus-lighter">Radiology education</p>
                </div>
              </div>
              <div className="relative px-4 pb-6 pt-0 sm:px-8">
                <div className="absolute -top-14 left-4 flex sm:left-8">
                  <div className="relative">
                    <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-card bg-card shadow-lg ring-2 ring-border sm:h-32 sm:w-32">
                      {avatarDisplaySrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarDisplaySrc} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/15 text-3xl font-bold text-primary">
                          {getInitials(displayName)}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-primary shadow-md transition-colors hover:bg-muted">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading || saving}
                        onChange={(e) => void handleAvatarChange(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
                <div className="ml-0 mt-20 sm:ml-36 sm:mt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-['Manrope',sans-serif] text-2xl font-extrabold tracking-tight text-card-foreground sm:text-3xl">
                      {displayName}
                    </h1>
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {roleLabel}
                    </span>
                    <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {profile?.email ?? '—'}
                  </p>
                  {fieldErrors.avatar ? (
                    <p className="mt-2 text-xs text-destructive" role="alert">
                      {fieldErrors.avatar}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">PNG or JPG, max {MAX_AVATAR_BYTES / (1024 * 1024)}MB.</p>
                  )}
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2 border-b border-border pb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-card-foreground">Personal info</h2>
                        <p className="text-xs text-muted-foreground">How you appear across the platform.</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="profile-fullName" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Full name <span className="text-destructive">*</span>
                        </label>
                        <input
                          id="profile-fullName"
                          type="text"
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (fieldErrors.fullName) setFieldErrors((x) => ({ ...x, fullName: undefined }));
                          }}
                          aria-invalid={Boolean(fieldErrors.fullName)}
                          className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {fieldErrors.fullName ? (
                          <p className="mt-1 text-xs text-destructive">{fieldErrors.fullName}</p>
                        ) : null}
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="profile-bio" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bio
                        </label>
                        <textarea
                          id="profile-bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          rows={3}
                          placeholder="Short introduction for peers and faculty…"
                          className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-phone" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          Phone
                        </label>
                        <input
                          id="profile-phone"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2 border-b border-border pb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-container/30 text-secondary">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-card-foreground">Academic info</h2>
                        <p className="text-xs text-muted-foreground">Program and cohort context.</p>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="profile-cohort" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        School / cohort
                      </label>
                      <input
                        id="profile-cohort"
                        type="text"
                        value={schoolCohort}
                        onChange={(e) => setSchoolCohort(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {fieldErrors.form ? (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.form}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={saving} disabled={uploading}>
                      <Save className="h-4 w-4" />
                      Save changes
                    </Button>
                  </div>
                </form>
              </div>

              <aside className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Lock className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-card-foreground">Account security</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Password, sessions, and notification preferences live in Settings.
                  </p>
                  <Link
                    href="/settings"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 py-2.5 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
                  >
                    <Shield className="h-4 w-4 text-primary" />
                    Open settings
                  </Link>
                </div>
                <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-5">
                  <div className="flex gap-2">
                    <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Complete your profile to help lecturers and experts recognize you in class rosters and QA
                      workflows.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </ListPageLayout>
  );
}
