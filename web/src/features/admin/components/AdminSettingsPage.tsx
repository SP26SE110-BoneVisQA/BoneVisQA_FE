'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useAdminProfile, useUpdateAdminProfile } from '@/features/admin/queries/use-admin-settings';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { RotateCcw, Save } from 'lucide-react';

const adminSettingsSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  avatarUrl: z.string(),
  dateOfBirth: z.string(),
  phoneNumber: z.string(),
  gender: z.string(),
  studentSchoolId: z.string(),
  address: z.string(),
  bio: z.string(),
});

type AdminSettingsFormValues = z.infer<typeof adminSettingsSchema>;

export function AdminSettingsPage() {
  const profileQuery = useAdminProfile();
  const updateMutation = useUpdateAdminProfile();
  const profile = profileQuery.data;

  const form = useForm<AdminSettingsFormValues>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: {
      fullName: '',
      avatarUrl: '',
      dateOfBirth: '',
      phoneNumber: '',
      gender: '',
      studentSchoolId: '',
      address: '',
      bio: '',
    },
  });

  useEffect(() => {
    if (profile) {
      const personal = profileToPersonalValues(profile);
      form.reset({
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? '',
        ...personal,
      });
    }
  }, [profile, form]);

  const fullName = form.watch('fullName');
  const avatarUrl = form.watch('avatarUrl');

  const initials = useMemo(() => {
    const name = fullName || profile?.fullName || 'A';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }, [fullName, profile?.fullName]);

  const personalValues: PersonalInfoValues = {
    dateOfBirth: form.watch('dateOfBirth') ?? '',
    phoneNumber: form.watch('phoneNumber') ?? '',
    gender: form.watch('gender') ?? '',
    studentSchoolId: form.watch('studentSchoolId') ?? '',
    address: form.watch('address') ?? '',
    bio: form.watch('bio') ?? '',
  };

  const onSubmit = form.handleSubmit((values) => {
    updateMutation.mutate(
      {
        fullName: values.fullName.trim(),
        avatarUrl: values.avatarUrl.trim() || undefined,
        ...personalValuesToApiPatch({
          dateOfBirth: values.dateOfBirth,
          phoneNumber: values.phoneNumber,
          gender: values.gender,
          studentSchoolId: values.studentSchoolId,
          address: values.address,
          bio: values.bio,
        }),
      },
      {
        onSuccess: () => appToast.success('Profile updated successfully.'),
        onError: (err) =>
          appToast.error(err instanceof Error ? err.message : 'Failed to update profile.'),
      },
    );
  });

  const errorMessage = profileQuery.error
    ? getQueryErrorMessage(profileQuery.error, 'Failed to load profile.')
    : null;

  return (
    <DetailPageLayout
      title="Settings"
      isLoading={profileQuery.isPending}
      error={errorMessage}
      maxWidthClass="max-w-3xl"
    >
      {!profile && !profileQuery.isPending && !profileQuery.error ? (
        <EmptyState title="No profile data" description="Unable to load admin profile for this session." />
      ) : profile ? (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:text-left">
              <ProfileAvatarPicker
                avatarUrl={avatarUrl}
                initials={initials || 'A'}
                alt={fullName || 'Admin'}
                size="sm"
                onUrlChange={(url) => form.setValue('avatarUrl', url, { shouldDirty: true })}
                onError={(msg) => appToast.error(msg)}
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-foreground">{fullName || 'Admin'}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <RoleBadgeList roles={profile.roles ?? []} emptyLabel="Admin" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <h4 className="mb-4 mt-8 text-sm font-semibold text-foreground">Personal information</h4>
              <PersonalInfoFields
                idPrefix="admin-pi"
                values={personalValues}
                onChange={(next) => {
                  (Object.keys(next) as (keyof PersonalInfoValues)[]).forEach((key) => {
                    form.setValue(key, next[key], { shouldDirty: true });
                  });
                }}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Email is tied to login and cannot be changed here:{' '}
                <span className="font-medium text-foreground">{profile.email}</span>
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!profile) return;
                  const personal = profileToPersonalValues(profile);
                  form.reset({
                    fullName: profile.fullName,
                    avatarUrl: profile.avatarUrl ?? '',
                    ...personal,
                  });
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending} disabled={updateMutation.isPending}>
                {!updateMutation.isPending && <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      ) : null}
    </DetailPageLayout>
  );
}
