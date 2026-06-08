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
  resolveExpertPathologyGroupForSubmit,
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
  deleteExpertCaseImage,
  uploadExpertCaseDicomArchive,
  validateExpertStudyArchive,
  type ExpertCase,
} from '@/lib/api/expert-cases';
import { DicomMetadataSummary } from '@/components/shared/DicomMetadataSummary';
import { getPublicApiOrigin } from '@/lib/api/client';
import { appToast } from '@/lib/api/errors/app-toast';
import { queryKeys } from '@/lib/query-keys';
import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';
import { applyDicomMetadataToExpertForm } from '@/features/expert/lib/apply-dicom-metadata-to-form';
import { Loader2, X, ImagePlus } from 'lucide-react';

const getBackendBaseUrl = () => getPublicApiOrigin() || 'http://localhost:5046';

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

  const [dicomIngestBusy, setDicomIngestBusy] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [extractedMetadata, setExtractedMetadata] = useState<VisualQaDicomMetadata | null>(null);
  const dicomInputRef = useRef<HTMLInputElement>(null);

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
      isApproved: true,
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
      tagIds: (c.tags ?? []).map((t) => t.id).filter(Boolean),
    });
    if (c.dicomMetadata) setExtractedMetadata(c.dicomMetadata);
  }, [caseQuery.data, form]);

  const categories = metaQuery.data?.categories ?? [];
  const tags = metaQuery.data?.tags ?? [];

  useEffect(() => {
    if (!extractedMetadata) return;
    applyDicomMetadataToExpertForm(
      form.setValue as unknown as Parameters<typeof applyDicomMetadataToExpertForm>[0],
      extractedMetadata,
      categories,
    );
  }, [extractedMetadata, categories, form]);

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
          isApproved: true,
          isActive: true,
          categoryId:
            resolveExpertCategoryIdForSubmit(values.categoryId, categories) ?? '',
          suggestedDiagnosis: values.suggestedDiagnosis.trim(),
          reflectiveQuestions: values.reflectiveQuestions.trim(),
          keyFindings: values.keyFindings.trim(),
          tagIds: values.tagIds,
          anatomySite: values.anatomySite,
          pathologyGroup: resolveExpertPathologyGroupForSubmit(values.categoryId, categories),
          modality: values.modality,
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

  const handleDicomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validationError = validateExpertStudyArchive(file);
    if (validationError) {
      appToast.error(validationError);
      return;
    }
    setDicomIngestBusy(true);
    try {
      const ingestPromise = uploadExpertCaseDicomArchive(file, {
        caseId: id,
        diagnosisText: form.getValues('description') || undefined,
        skipApiToast: true,
      });
      void appToast.promise(ingestPromise, {
        loading: 'Ingesting DICOM archive…',
        success: 'DICOM archive ingested — images and metadata updated.',
        error: 'DICOM ingest failed.',
      });
      const ingest = await ingestPromise;
      if (ingest.dicomMetadata) setExtractedMetadata(ingest.dicomMetadata);
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.caseDetail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() });
    } catch {
      /* toast handled */
    } finally {
      setDicomIngestBusy(false);
    }
  };

  const toggleTag = (tagId: string) => {
    const current = form.getValues('tagIds') ?? [];
    const next = current.includes(tagId)
      ? current.filter((tid) => tid !== tagId)
      : [...current, tagId];
    form.setValue('tagIds', next, { shouldDirty: true });
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
  const busy = updateMutation.isPending || dicomIngestBusy || deleteImageId !== null;
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

                  <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-card-foreground">Replace / add DICOM archive</p>
                    <input
                      ref={dicomInputRef}
                      type="file"
                      accept=".zip,.rar"
                      disabled={busy}
                      onChange={(e) => void handleDicomChange(e)}
                      className="w-full text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload a .zip or .rar study archive. Metadata will refresh anatomy site and modality.
                    </p>
                    {extractedMetadata ? (
                      <DicomMetadataSummary metadata={extractedMetadata} compact />
                    ) : null}
                  </div>
                </div>

                {/* Quick Info Card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-card-foreground">Case Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Source</p>
                      <p className="mt-1 font-medium text-card-foreground">
                        {caseData?.caseOrigin === 'fromStudentRequest'
                          ? 'From student request'
                          : 'Created by you'}
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
                      <p className="text-xs text-muted-foreground">Pathology group</p>
                      <p className="mt-1 font-medium text-card-foreground">
                        {caseData?.pathologyGroup || caseData?.categoryName || 'Uncategorized'}
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

                    {tags.length > 0 ? (
                      <div>
                        <p className="mb-2 text-sm font-medium">Tags (optional)</p>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((t) => {
                            const selected = (form.watch('tagIds') ?? []).includes(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                disabled={busy}
                                onClick={() => toggleTag(t.id)}
                                className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                  selected
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card text-muted-foreground'
                                }`}
                              >
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
                      Saved changes are published immediately to your case library and to students in your supported
                      classes.
                    </p>
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
                    {dicomIngestBusy ? 'Ingesting DICOM…' : 'Saving changes…'}
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
