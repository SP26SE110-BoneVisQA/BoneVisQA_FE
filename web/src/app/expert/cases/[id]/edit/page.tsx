'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSWRConfig } from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import Header from '@/components/Header';
import { PageLoadingSkeleton, SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  fetchExpertCase,
  fetchExpertCategories,
  fetchExpertTags,
  updateExpertCase,
  createExpertCaseImage,
  deleteExpertCaseImage,
  createExpertCaseTag,
  deleteExpertCaseTag,
  DB_IMAGE_MODALITIES,
  type ExpertCategory,
  type ExpertTag,
  type SaveExpertCaseInput,
  type ExpertCase,
  type ExpertCaseMedicalImageJson,
} from '@/lib/api/expert-cases';
import { getApiProblemDetails } from '@/lib/api/client';
import { EXPERT_DASHBOARD_QUERY_KEY } from '@/lib/api/expert-dashboard';
import { fetchExpertProfile } from '@/lib/api/lecturer-dashboard';
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

export default function ExpertCaseEditPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { mutate: swrMutate } = useSWRConfig();
  const id = String(params?.id ?? '');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [difficulty, setDifficulty] = useState<SaveExpertCaseInput['difficulty']>('Medium');
  const [suggestedDiagnosis, setSuggestedDiagnosis] = useState('');
  const [reflectiveQuestions, setReflectiveQuestions] = useState('');
  const [keyFindings, setKeyFindings] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => new Set());

  // Image handling state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [modality, setModality] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const caseQuery = useQuery({
    queryKey: ['expert', 'case', id],
    queryFn: () => fetchExpertCase(id),
    enabled: Boolean(id),
  });

  const categoriesQuery = useQuery({
    queryKey: ['expert', 'categories'],
    queryFn: fetchExpertCategories,
  });

  const tagsQuery = useQuery({
    queryKey: ['expert', 'tags', 'case-edit'],
    queryFn: () => fetchExpertTags(1, 200),
    enabled: Boolean(id),
  });

  const profileQuery = useQuery({
    queryKey: ['expert', 'profile'],
    queryFn: fetchExpertProfile,
  });

  useEffect(() => {
    const c = caseQuery.data;
    if (!c) return;
    setTitle(c.title);
    setDescription(c.description);
    setCategoryId(c.categoryId || '');
    setDifficulty(c.difficulty);
    setSuggestedDiagnosis(c.suggestedDiagnosis);
    setReflectiveQuestions(c.reflectiveQuestions);
    setKeyFindings(c.keyFindings);
    setIsActive(c.isActive);
    setIsApproved(c.isApproved);
    setSelectedTagIds(new Set((c.tags ?? []).map((t) => t.id).filter(Boolean)));
  }, [caseQuery.data]);

  type SaveCaseVariables = {
    payload: SaveExpertCaseInput;
    selectedTagIdsSnapshot: string[];
    serverTagsSnapshot: ExpertCase['tags'] | undefined;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ payload, selectedTagIdsSnapshot, serverTagsSnapshot }: SaveCaseVariables) => {
      await updateExpertCase(id, payload);
      const serverSet = new Set((serverTagsSnapshot ?? []).map((t) => t.id).filter(Boolean));
      const desired = new Set(selectedTagIdsSnapshot);
      const toAdd = [...desired].filter((tid) => !serverSet.has(tid));
      const toRemove = [...serverSet].filter((tid) => !desired.has(tid));
      const caseId = id.trim();
      for (const tagId of toAdd) {
        await createExpertCaseTag({ medicalCaseId: caseId, tagId });
      }
      for (const tagId of toRemove) {
        await deleteExpertCaseTag({ caseId, tagId });
      }
    },
    onSuccess: () => {
      toast.success('Case updated successfully.');
      void queryClient.invalidateQueries({ queryKey: ['expert', 'case', id] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'cases'] });
      void swrMutate('expert-case-library');
      void queryClient.invalidateQueries({ queryKey: EXPERT_DASHBOARD_QUERY_KEY });
      router.push('/expert/cases');
    },
    onError: (err: unknown) => {
      const { title: errTitle, detail } = getApiProblemDetails(err);
      toast.error(detail ? `${errTitle}: ${detail}` : errTitle);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const expertId = profileQuery.data?.id?.trim();
    if (!expertId) {
      toast.error('Missing expert profile. Please sign in again.');
      return;
    }
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!categoryId.trim()) {
      toast.error('Please select a category.');
      return;
    }

    saveMutation.mutate({
      payload: {
        title: title.trim(),
        createdByExpertId: expertId,
        description: description.trim(),
        difficulty,
        isApproved,
        isActive,
        categoryId: categoryId.trim(),
        suggestedDiagnosis: suggestedDiagnosis.trim(),
        reflectiveQuestions: reflectiveQuestions.trim(),
        keyFindings: keyFindings.trim(),
      },
      selectedTagIdsSnapshot: Array.from(selectedTagIds),
      serverTagsSnapshot: caseQuery.data?.tags,
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be 100 MB or smaller.');
      return;
    }

    setUploadingImage(true);

    try {
      // Upload to Supabase storage
      await uploadExpertWorkbenchImage(file);

      // Upload to backend case (POST /api/expert/images)
      await createExpertCaseImage(id, file, modality);

      toast.success('Image added to case successfully.');

      // Invalidate queries to reload case with new image
      void queryClient.invalidateQueries({ queryKey: ['expert', 'case', id] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'cases'] });
      void swrMutate('expert-case-library');
      void queryClient.invalidateQueries({ queryKey: EXPERT_DASHBOARD_QUERY_KEY });

      // Reset form
      setModality('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!imageId) return;
    if (!confirm('Are you sure you want to delete this image?')) return;

    setDeletingImageId(imageId);
    try {
      await deleteExpertCaseImage(imageId);
      toast.success('Image deleted successfully.');
      void queryClient.invalidateQueries({ queryKey: ['expert', 'case', id] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'cases'] });
      void swrMutate('expert-case-library');
      void queryClient.invalidateQueries({ queryKey: EXPERT_DASHBOARD_QUERY_KEY });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  const loading = caseQuery.isPending || categoriesQuery.isPending || profileQuery.isPending;
  const categories: ExpertCategory[] = categoriesQuery.data ?? [];
  const catalogTags: ExpertTag[] = tagsQuery.data ?? [];
  const busy = saveMutation.isPending || uploadingImage || deletingImageId !== null;
  const caseData: ExpertCase | undefined = caseQuery.data;

  const selectedTagChips = useMemo(() => {
    return Array.from(selectedTagIds).map((tid) => {
      const fromCatalog = catalogTags.find((t) => t.id === tid);
      if (fromCatalog) return { id: tid, name: fromCatalog.name };
      const fromCase = caseData?.tags?.find((t) => t.id === tid);
      return { id: tid, name: fromCase?.name ?? 'Tag' };
    });
  }, [selectedTagIds, catalogTags, caseData?.tags]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Header
        title="Edit Medical Case"
        subtitle={caseData?.title || 'Update case details'}
      />
      
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {caseQuery.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center">
            <p className="text-sm text-destructive">
              {caseQuery.error instanceof Error ? caseQuery.error.message : 'Could not load case.'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.back()}
            >
              Go Back
            </Button>
          </div>
        ) : loading ? (
          <PageLoadingSkeleton>
            <SkeletonBlock className="h-10 w-full rounded-lg" />
            <SkeletonBlock className="mt-4 h-64 w-full rounded-lg" />
          </PageLoadingSkeleton>
        ) : (
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
                              onClick={() => handleDeleteImage(img.id!)}
                              disabled={busy || deletingImageId === img.id}
                              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive/90 text-white opacity-0 transition-opacity hover:bg-destructive disabled:opacity-50 group-hover:opacity-100"
                              aria-label="Delete image"
                            >
                              {deletingImageId === img.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
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
                      <select
                        value={modality}
                        onChange={(e) => setModality(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Select modality...</option>
                        {DB_IMAGE_MODALITIES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
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
                    {/* Title */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Title <span className="text-destructive">*</span>
                      </label>
                      <input
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={busy}
                        placeholder="Enter descriptive case title"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
                      />
                    </div>

                    {/* Category & Difficulty */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-foreground">
                          Category <span className="text-destructive">*</span>
                        </label>
                        <select
                          value={categoryId}
                          onChange={(e) => setCategoryId(e.target.value)}
                          disabled={busy}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
                        >
                          <option value="">— Select category —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          {caseData?.categoryId &&
                            !categories.some((c) => c.id === caseData.categoryId) && (
                              <option value={caseData.categoryId}>
                                {caseData.categoryName || 'Current category'}
                              </option>
                            )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-foreground">
                          Difficulty Level
                        </label>
                        <select
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value as SaveExpertCaseInput['difficulty'])}
                          disabled={busy}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Description <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={busy}
                        rows={5}
                        placeholder="Provide a comprehensive description of the case including patient history, clinical findings, and relevant context"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 resize-none"
                      />
                    </div>

                    {/* Suggested Diagnosis */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Suggested Diagnosis
                      </label>
                      <input
                        type="text"
                        value={suggestedDiagnosis}
                        onChange={(e) => setSuggestedDiagnosis(e.target.value)}
                        disabled={busy}
                        placeholder="e.g. Osteosarcoma, Pneumonia"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
                      />
                    </div>

                    {/* Key Findings */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Key Findings
                      </label>
                      <textarea
                        value={keyFindings}
                        onChange={(e) => setKeyFindings(e.target.value)}
                        disabled={busy}
                        rows={3}
                        placeholder="List the key diagnostic findings and observations"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 resize-none"
                      />
                    </div>

                    {/* Reflective Questions */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Reflective Questions
                      </label>
                      <textarea
                        value={reflectiveQuestions}
                        onChange={(e) => setReflectiveQuestions(e.target.value)}
                        disabled={busy}
                        rows={3}
                        placeholder="Prompts for learner reflection and critical thinking"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 resize-none"
                      />
                    </div>

                    {catalogTags.length > 0 ? (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Tags (optional)</p>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Tag changes apply when you click Save Changes. Selected:{' '}
                          {selectedTagIds.size > 0 ? `${selectedTagIds.size} tag(s)` : 'None'}
                        </p>
                        {selectedTagChips.length > 0 ? (
                          <div className="mb-3">
                            <p className="mb-1.5 text-xs text-muted-foreground">
                              Current selection — click to remove from selection
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedTagChips.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleTag(t.id)}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                                >
                                  {t.name}
                                  <X className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
                          {catalogTags.map((t) => (
                            <label
                              key={t.id}
                              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted/60"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTagIds.has(t.id)}
                                onChange={() => toggleTag(t.id)}
                                disabled={busy}
                                className="rounded border-border"
                              />
                              {t.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : tagsQuery.isPending ? (
                      <p className="text-xs text-muted-foreground">Loading tags…</p>
                    ) : null}

                    {/* Toggle Switches */}
                    <div className="flex flex-wrap gap-6 rounded-lg border border-border bg-muted/30 p-4">
                      <label className="flex cursor-pointer items-center gap-3 text-card-foreground hover:text-foreground transition-colors">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          disabled={busy}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-sm font-medium">Active</span>
                        <span className="text-xs text-muted-foreground">(visible to students)</span>
                      </label>
                      
                      <label className="flex cursor-pointer items-center gap-3 text-card-foreground hover:text-foreground transition-colors">
                        <input
                          type="checkbox"
                          checked={isApproved}
                          onChange={(e) => setIsApproved(e.target.checked)}
                          disabled={busy}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-sm font-medium">Approved</span>
                        <span className="text-xs text-muted-foreground">(ready for use)</span>
                      </label>
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
                onClick={() => router.push('/expert/cases')}
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
        )}
      </div>
    </div>
  );
}
