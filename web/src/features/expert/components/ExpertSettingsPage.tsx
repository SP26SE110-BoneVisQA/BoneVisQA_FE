'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DetailPageLayout } from '@/components/layouts';
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
import { useExpertProfile, useUpdateExpertProfile } from '@/features/expert/queries/use-expert-profile';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { Bell, RotateCcw, Save, Shield } from 'lucide-react';

const expertSettingsSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  specialty: z.string().trim(),
  avatarUrl: z.string(),
  autoApproveThreshold: z.number().min(0).max(100),
  notifyNewQA: z.boolean(),
  notifyFlagged: z.boolean(),
  notifyQuizComplete: z.boolean(),
  dateOfBirth: z.string(),
  phoneNumber: z.string(),
  gender: z.string(),
  studentSchoolId: z.string(),
  address: z.string(),
  bio: z.string(),
});

type ExpertSettingsFormValues = z.infer<typeof expertSettingsSchema>;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-success' : 'bg-muted'
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

export function ExpertSettingsPage() {
  const profileQuery = useExpertProfile();
  const updateMutation = useUpdateExpertProfile();
  const profile = profileQuery.data;

  const form = useForm<ExpertSettingsFormValues>({
    resolver: zodResolver(expertSettingsSchema),
    defaultValues: {
      fullName: '',
      specialty: '',
      avatarUrl: '',
      autoApproveThreshold: 90,
      notifyNewQA: true,
      notifyFlagged: true,
      notifyQuizComplete: false,
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
        specialty: profile.specialty ?? '',
        avatarUrl: profile.avatarUrl ?? '',
        autoApproveThreshold: profile.autoApproveThreshold,
        notifyNewQA: profile.notifyNewQA,
        notifyFlagged: profile.notifyFlagged,
        notifyQuizComplete: profile.notifyQuizComplete,
        ...personal,
      });
    }
  }, [profile, form]);

  const fullName = form.watch('fullName');
  const avatarUrl = form.watch('avatarUrl');

  const initials = useMemo(() => {
    const name = fullName || profile?.fullName || 'E';
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
        specialty: values.specialty.trim() || undefined,
        avatarUrl: values.avatarUrl.trim() || undefined,
        autoApproveThreshold: values.autoApproveThreshold,
        notifyNewQA: values.notifyNewQA,
        notifyFlagged: values.notifyFlagged,
        notifyQuizComplete: values.notifyQuizComplete,
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
      title="Expert settings"
      isLoading={profileQuery.isPending}
      error={errorMessage}
      maxWidthClass="max-w-3xl"
    >
      {profile ? (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:text-left">
              <ProfileAvatarPicker
                avatarUrl={avatarUrl}
                initials={initials || 'E'}
                alt={fullName || 'Expert'}
                size="sm"
                onUrlChange={(url) => form.setValue('avatarUrl', url, { shouldDirty: true })}
                onError={(msg) => appToast.error(msg)}
              />
              <div>
                <h2 className="text-xl font-semibold">{fullName || 'Expert'}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <RoleBadgeList roles={profile.roles ?? []} emptyLabel="Expert" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
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
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Specialty</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Musculoskeletal radiology" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <h4 className="mb-4 mt-8 text-sm font-semibold">Personal information</h4>
              <PersonalInfoFields
                idPrefix="exp-pi"
                values={personalValues}
                onChange={(next) => {
                  (Object.keys(next) as (keyof PersonalInfoValues)[]).forEach((key) => {
                    form.setValue(key, next[key], { shouldDirty: true });
                  });
                }}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Shield className="h-5 w-5 text-primary" />
                Review preferences
              </h3>
              <FormField
                control={form.control}
                name="autoApproveThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto-approve threshold (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="notifyNewQA"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel className="font-normal">New Q&amp;A submissions</FormLabel>
                      <Toggle checked={field.value} onChange={field.onChange} />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notifyFlagged"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel className="font-normal">Flagged content</FormLabel>
                      <Toggle checked={field.value} onChange={field.onChange} />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notifyQuizComplete"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel className="font-normal">Quiz completions</FormLabel>
                      <Toggle checked={field.value} onChange={field.onChange} />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => profile && form.reset()}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                <Save className="h-4 w-4" />
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      ) : null}
    </DetailPageLayout>
  );
}
