'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useLecturerProfile, useUpdateLecturerProfile } from '@/features/lecturer/queries/use-lecturer-profile';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { Bell, RotateCcw, Save } from 'lucide-react';

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

export function LecturerSettingsPage() {
  const profileQuery = useLecturerProfile();
  const updateMutation = useUpdateLecturerProfile();
  const profile = profileQuery.data;

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

  return (
    <DetailPageLayout
      title="Settings"
      isLoading={profileQuery.isPending}
      error={errorMessage}
      maxWidthClass="max-w-3xl"
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-8">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <ProfileAvatarPicker
                avatarUrl={form.watch('avatarUrl')}
                initials={initials || 'L'}
                alt={form.watch('fullName') || 'Lecturer'}
                size="sm"
                onUrlChange={(url) => form.setValue('avatarUrl', url, { shouldDirty: true })}
              />
              <div className="flex-1 space-y-4">
                <RoleBadgeList roles={profile?.roles ?? ['Lecturer']} />
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
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
                        <Input {...field} placeholder="e.g. Radiology" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <PersonalInfoFields values={personal} onChange={setPersonal} />

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Bell className="h-4 w-4" />
              Notifications
            </h2>
            <div className="mt-4 space-y-4">
              {(
                [
                  ['notifyNewStudent', 'New student enrollments'],
                  ['notifyQuizComplete', 'Quiz completions'],
                  ['notifyNewQuestion', 'New student questions'],
                ] as const
              ).map(([key, label]) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={key}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4">
                      <FormLabel className="font-normal">{label}</FormLabel>
                      <FormControl>
                        <Toggle checked={field.value} onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4" />
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
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
