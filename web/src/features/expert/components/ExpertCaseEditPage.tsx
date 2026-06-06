'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DetailPageLayout } from '@/components/layouts';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { PageLoadingSkeleton, SkeletonBlock } from '@/components/shared/DashboardSkeletons';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  expertCaseEditFormSchema,
  type ExpertCaseEditFormValues,
} from '@/features/expert/schemas/expert-case-form-schema';
import {
  EXPERT_ANATOMY_SITES,
  EXPERT_DIFFICULTY_OPTIONS,
  EXPERT_IMAGE_MODALITIES,
  resolveExpertCategoryIdForSubmit,
  parseAnatomySiteFromDescription,
  stripAnatomySiteNote,
} from '@/features/expert/lib/expert-ontology';
import {
  useExpertCaseDetail,
  useExpertCaseMeta,
  useUpdateExpertCase,
} from '@/features/expert/queries/use-expert-cases';
import { useExpertProfile } from '@/features/expert/queries/use-expert-profile';
import {
  createExpertCaseImage,
  deleteExpertCaseImage,
  type ExpertCase,
} from '@/lib/api/expert-cases';
import { appToast } from '@/lib/api/errors/app-toast';
import { queryKeys } from '@/lib/query-keys';
import { uploadExpertWorkbenchImage } from '@/lib/supabase/upload-medical-case-image';
import { Loader2, X, ImagePlus, Upload } from 'lucide-react';

const MAX_IMAGE_BYTES = 100 * 1024 * 1024;

// Backend API base URL (from env or default)
const getBackendBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Try to get from environment variable
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5046';
    return backendUrl.replace(/\/+$/, ''); // Remove trailing slash
  }
  return 'http://localhost:5046';
};

// Convert image URL to absolute if relative
const normalizeImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Relative URL - prepend backend base URL
  const base = getBackendBaseUrl();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

export function ExpertCaseEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = String(params?.id ?? '');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [uploadModality, setUploadModality] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const caseQuery = useExpertCaseDetail(id);
  const metaQuery = useExpertCaseMeta();
  const profileQuery = useExpertProfile();
  const updateMutation = useUpdateExpertCase();

  const form = useForm<ExpertCaseEditFormValues>({
    resolver: zodResolver(expertCaseEditFormSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      anatomySite: 'Other',
      modality: EXPERT_IMAGE_MODALITIES[0],
      difficulty: 'Medium',
      suggestedDiagnosis: '',
      keyFindings: '',
      reflectiveQuestions: '',
      isActive: true,
      isApproved: false,
      tagIds: [],
    },
  });

  useEffect(() => {
    const c = caseQuery.data;
    if (!c) return;
    const anatomySite = parseAnatomySiteFromDescription(c.description);
    const firstModality = c.medicalImages?.[0]?.modality;
    form.reset({
      title: c.title,
      description: stripAnatomySiteNote(c.description),
      categoryId: c.categoryId || '',
      anatomySite,
      modality:
        firstModality && EXPERT_IMAGE_MODALITIES.includes(firstModality as (typeof EXPERT_IMAGE_MODALITIES)[number])
          ? (firstModality as ExpertCaseEditFormValues['modality'])
          : EXPERT_IMAGE_MODALITIES[0],
      difficulty: c.difficulty,
      suggestedDiagnosis: c.suggestedDiagnosis ?? '',
      reflectiveQuestions: c.reflectiveQuestions ?? '',
      keyFindings: c.keyFindings ?? '',
      isActive: c.isActive,
      isApproved: c.isApproved,
      tagIds: [],
    });
  }, [caseQuery.data, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const expertId = profileQuery.data?.id?.trim();
    if (!expertId) {
      appToast.error('Missing expert profile. Please sign in again.');
      return;
    }

    const anatomyNote = `Anatomy site: ${values.anatomySite}`;
    const description =
      values.description.trim() +
      (values.description.includes(values.anatomySite) ? '' : `\n\n${anatomyNote}`);

    try {
      await updateMutation.mutateAsync({
        caseId: id,
        body: {
          title: values.title.trim(),
          createdByExpertId: expertId,
          description,
          difficulty: values.difficulty,
          isApproved: values.isApproved,
          isActive: values.isActive,
          categoryId:
            resolveExpertCategoryIdForSubmit(values.categoryId, categories) ?? '',
          suggestedDiagnosis: values.suggestedDiagnosis.trim(),
          reflectiveQuestions: values.reflectiveQuestions.trim(),
          keyFindings: values.keyFindings.trim(),
        },
      });
      appToast.success('Case updated successfully.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() });
      router.push(`/expert/cases/${id}`);
    } catch {
      /* mutation error surfaced by API layer if configured */
    }
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      appToast.error('Image must be 100 MB or smaller.');
      return;
    }

    setUploadingImage(true);
    const modality = uploadModality || form.getValues('modality');

    try {
      await appToast.promise(
        (async () => {
          await uploadExpertWorkbenchImage(file);
          await createExpertCaseImage(id, file, modality);
        })(),
        {
          loading: 'Uploading medical image…',
          success: 'Image added to case successfully.',
          error: 'Image upload failed.',
        },
      );

      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.caseDetail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() });

      setUploadModality('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      /* toast handled */
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageId) return;
    try {
      await deleteExpertCaseImage(deleteImageId);
      appToast.success('Image deleted successfully.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.caseDetail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() });
      setDeleteImageId(null);
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const loading = caseQuery.isPending || metaQuery.isPending || profileQuery.isPending;
  const categories = metaQuery.data?.categories ?? [];
  const busy = updateMutation.isPending || uploadingImage || deleteImageId !== null;
  const caseData: ExpertCase | undefined = caseQuery.data;
  const errorMsg =
    caseQuery.error instanceof Error ? caseQuery.error.message : 'Could not load case.';

  return (
    <DetailPageLayout
      title="Edit medical case"
      showBack
      isLoading={loading && !caseData}
      error={caseQuery.isError ? errorMsg : undefined}
      maxWidthClass="max-w-7xl"
    >
        {caseQuery.isError ? (
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            Go back
          </Button>
        ) : loading ? (
          <PageLoadingSkeleton>
            <SkeletonBlock className="h-10 w-full rounded-lg" />
            <SkeletonBlock className="mt-4 h-64 w-full rounded-lg" />
          </PageLoadingSkeleton>
        ) : (
          <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              
              {/* LEFT COLUMN - Image Section */}
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h3 className="mb-4 text-base font-semibold text-card-foreground">Medical Images</h3>

                  {/* Image Grid - Display all images */}
                  {caseData?.medicalImages && caseData.medicalImages.length > 0 ? (
                    <div className="mb-4 grid grid-cols-2 gap-3">
                      {caseData.medicalImages.map((img) => (
                        <div
                          key={img.id}
                          className="group relative overflow-hidden rounded-lg border border-border bg-muted/20"
                        >
                          <img
                            src={normalizeImageUrl(img.imageUrl)}
                            alt={img.label || 'Medical image'}
                            className="h-32 w-full object-cover"
                          />
                          {img.modality && (
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                              {img.modality}
                            </span>
                          )}
                          {/* Delete button */}
                          {img.id && (
                            <button
                              type="button"
                              onClick={() => setDeleteImageId(img.id!)}
                              disabled={busy || deleteImageId === img.id}
                              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/90 text-white opacity-0 shadow-sm transition-opacity hover:bg-destructive disabled:opacity-50 group-hover:opacity-100"
                              aria-label="Delete image"
                            >
                              {deleteImageId === img.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-5 w-5" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-4 flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
                      <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">No images yet</p>
                    </div>
                  )}

                  {/* Upload New Image Section */}
                  <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-card-foreground">Add New Image</p>

                    {/* Modality Selector */}
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Modality (optional)</label>
                      <Select value={uploadModality} onValueChange={setUploadModality} disabled={busy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select modality for upload" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPERT_IMAGE_MODALITIES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* File Input & Upload Button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      disabled={busy}
                      onChange={handleImageChange}
                      className="hidden"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy}
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload Image
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Supported: PNG, JPG, GIF (max 100MB)
                    </p>
                  </div>
                </div>

                {/* Quick Info Card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-card-foreground">Case Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="mt-1 font-medium">
                        {caseData?.status === 'approved' ? (
                          <span className="text-green-600">✓ Approved</span>
                        ) : caseData?.status === 'pending' ? (
                          <span className="text-amber-600">⏳ Pending Review</span>
                        ) : (
                          <span className="text-gray-500">Draft</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="mt-1 font-medium text-card-foreground">
                        {caseData?.addedDate 
                          ? new Date(caseData.addedDate).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="mt-1 font-medium text-card-foreground">
                        {caseData?.categoryName || 'Uncategorized'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Difficulty</p>
                      <p className="mt-1 font-medium text-card-foreground">{caseData?.difficulty || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN - Form Fields */}
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h3 className="mb-5 text-base font-semibold text-card-foreground">Case Details</h3>
                  
                  <div className="space-y-5">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={busy} placeholder="Enter descriptive case title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="anatomySite"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Anatomy site</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select site" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {EXPERT_ANATOMY_SITES.map((site) => (
                                  <SelectItem key={site} value={site}>
                                    {site}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pathology group</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                                {caseData?.categoryId &&
                                  !categories.some((c) => c.id === caseData.categoryId) && (
                                    <SelectItem value={caseData.categoryId}>
                                      {caseData.categoryName || 'Current category'}
                                    </SelectItem>
                                  )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="modality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary modality</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {EXPERT_IMAGE_MODALITIES.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="difficulty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Difficulty</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {EXPERT_DIFFICULTY_OPTIONS.map((d) => (
                                  <SelectItem key={d.value} value={d.value}>
                                    {d.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clinical description</FormLabel>
                          <FormControl>
                            <textarea
                              {...field}
                              rows={5}
                              disabled={busy}
                              placeholder="Patient history, findings, and teaching context"
                              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="suggestedDiagnosis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Suggested diagnosis</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={busy} placeholder="e.g. Osteosarcoma" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="keyFindings"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key findings</FormLabel>
                          <FormControl>
                            <textarea
                              {...field}
                              rows={3}
                              disabled={busy}
                              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reflectiveQuestions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reflective questions</FormLabel>
                          <FormControl>
                            <textarea
                              {...field}
                              rows={3}
                              disabled={busy}
                              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-wrap gap-6 rounded-lg border border-border bg-muted/30 p-4">
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                                disabled={busy}
                                className="h-4 w-4 rounded border-border"
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium">Active</FormLabel>
                              <p className="text-xs text-muted-foreground">Visible to students</p>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isApproved"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                                disabled={busy}
                                className="h-4 w-4 rounded border-border"
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium">Approved</FormLabel>
                              <p className="text-xs text-muted-foreground">Ready for teaching use</p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 sm:flex-none px-6"
                onClick={() => router.push(`/expert/cases/${id}`)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 sm:flex-none px-6 gap-2"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadingImage ? 'Uploading image…' : 'Saving changes…'}
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>

          </form>
          </Form>
        )}

      <DestructiveConfirmDialog
        open={Boolean(deleteImageId)}
        onOpenChange={(open) => {
          if (!open) setDeleteImageId(null);
        }}
        title="Delete medical image?"
        confirmLabel="Delete image"
        onConfirm={handleDeleteImage}
      />
    </DetailPageLayout>
  );
}
