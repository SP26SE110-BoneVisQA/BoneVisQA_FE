'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
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
import { Button } from '@/components/ui/button';
import { DicomMetadataSummary } from '@/components/shared/DicomMetadataSummary';
import {
  expertCaseFormSchema,
  type ExpertCaseFormValues,
} from '@/features/expert/schemas/expert-case-form-schema';
import {
  EXPERT_ANATOMY_SITES,
  EXPERT_DIFFICULTY_OPTIONS,
  EXPERT_IMAGE_MODALITIES,
  resolveExpertCategoryIdForSubmit,
  resolveExpertPathologyGroupForSubmit,
} from '@/features/expert/lib/expert-ontology';
import { sanitizeGuidList } from '@/lib/api/sanitize-guids';
import {
  useCreateExpertCase,
  useExpertCaseMeta,
  useUpdateExpertCase,
} from '@/features/expert/queries/use-expert-cases';
import { useExpertProfile } from '@/features/expert/queries/use-expert-profile';
import {
  uploadExpertCaseDicomArchive,
  validateExpertStudyArchive,
} from '@/lib/api/expert-cases';
import { applyDicomMetadataToExpertForm } from '@/features/expert/lib/apply-dicom-metadata-to-form';
import { appToast } from '@/lib/api/errors/app-toast';
import { queryKeys } from '@/lib/query-keys';
import type { CreateExpertCaseJsonInput } from '@/lib/api/expert-cases';
import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';
import { Loader2 } from 'lucide-react';

type Props = {
  onCreated: (caseId: string | undefined) => void;
  onCancel: () => void;
};

export function CreateExpertCaseForm({ onCreated, onCancel }: Props) {
  const queryClient = useQueryClient();
  const metaQuery = useExpertCaseMeta();
  const profileQuery = useExpertProfile();
  const createMutation = useCreateExpertCase();
  const updateMutation = useUpdateExpertCase();
  const [dicomArchive, setDicomArchive] = useState<File | null>(null);
  const [extractedMetadata, setExtractedMetadata] = useState<VisualQaDicomMetadata | null>(null);
  const [ingestCaseId, setIngestCaseId] = useState<string | null>(null);
  const [dicomIngestBusy, setDicomIngestBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const ingestRequestId = useRef(0);

  const categories = metaQuery.data?.categories ?? [];
  const tags = metaQuery.data?.tags ?? [];

  const form = useForm<ExpertCaseFormValues>({
    resolver: zodResolver(expertCaseFormSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      anatomySite: 'Wrist & Hand',
      modality: 'X-Ray',
      difficulty: 'Medium',
      suggestedDiagnosis: '',
      keyFindings: '',
      reflectiveQuestions: '',
      tagIds: [],
    },
  });

  useEffect(() => {
    if (categories.length > 0 && !form.getValues('categoryId')) {
      form.setValue('categoryId', categories[0].id);
    }
  }, [categories, form]);

  useEffect(() => {
    if (!extractedMetadata) return;
    applyDicomMetadataToExpertForm(form.setValue, extractedMetadata, categories);
  }, [extractedMetadata, categories, form]);

  const ingestDicomArchive = async (file: File) => {
    const requestId = ++ingestRequestId.current;
    setDicomIngestBusy(true);
    setExtractedMetadata(null);
    setIngestCaseId(null);

    try {
      const ingestPromise = uploadExpertCaseDicomArchive(file, {
        diagnosisText: form.getValues('description') || undefined,
        skipApiToast: true,
      });
      void appToast.promise(ingestPromise, {
        loading: 'Extracting DICOM metadata…',
        success: 'DICOM metadata extracted — form fields updated.',
      });
      const ingest = await ingestPromise;

      if (requestId !== ingestRequestId.current) return;

      if (ingest.dicomMetadata) {
        setExtractedMetadata(ingest.dicomMetadata);
      }
      if (ingest.caseId) {
        setIngestCaseId(ingest.caseId);
      }
    } catch {
      /* toast shows BE message via Error; keep archive selected for retry */
    } finally {
      if (requestId === ingestRequestId.current) {
        setDicomIngestBusy(false);
      }
    }
  };

  const onDicomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const validationError = validateExpertStudyArchive(f);
    if (validationError) {
      appToast.error(validationError);
      return;
    }
    setDicomArchive(f);
    void ingestDicomArchive(f);
  };

  const buildPayload = async (): Promise<{ payload: CreateExpertCaseJsonInput; caseId?: string }> => {
    const values = form.getValues();

    const anatomyNote = `Anatomy site: ${values.anatomySite}`;
    const description =
      values.description.trim() +
      (values.description.includes(values.anatomySite) ? '' : `\n\n${anatomyNote}`);

    const categoryId = resolveExpertCategoryIdForSubmit(values.categoryId, categories);
    const pathologyGroup = resolveExpertPathologyGroupForSubmit(values.categoryId, categories);
    const tagIds = sanitizeGuidList(values.tagIds);

    const payload: CreateExpertCaseJsonInput = {
      title: values.title.trim(),
      description,
      difficulty: values.difficulty,
      categoryId,
      anatomySite: values.anatomySite,
      pathologyGroup,
      modality: values.modality,
      suggestedDiagnosis: values.suggestedDiagnosis.trim() || null,
      reflectiveQuestions: values.reflectiveQuestions.trim() || null,
      keyFindings: values.keyFindings.trim() || null,
      tagIds: tagIds.length > 0 ? tagIds : null,
      medicalImages: null,
    };

    const expertId = profileQuery.data?.id?.trim();
    const existingCaseId = ingestCaseId?.trim();

    if (existingCaseId && expertId) {
      await updateMutation.mutateAsync({
        caseId: existingCaseId,
        body: {
          title: payload.title,
          createdByExpertId: expertId,
          description: payload.description ?? '',
          difficulty: values.difficulty,
          isApproved: true,
          isActive: true,
          categoryId: categoryId ?? '',
          suggestedDiagnosis: payload.suggestedDiagnosis ?? '',
          reflectiveQuestions: payload.reflectiveQuestions ?? '',
          keyFindings: payload.keyFindings ?? '',
          tagIds: tagIds.length > 0 ? tagIds : null,
          anatomySite: values.anatomySite,
          pathologyGroup,
          modality: values.modality,
        },
      });
      return { payload, caseId: existingCaseId };
    }

    const caseId = await createMutation.mutateAsync(payload);

    if (dicomArchive && caseId && !existingCaseId) {
      await uploadExpertCaseDicomArchive(dicomArchive, {
        caseId,
        diagnosisText: values.description || undefined,
        skipApiToast: true,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
    }

    return { payload, caseId };
  };

  const onSubmit = form.handleSubmit(async () => {
    setBusy(true);
    try {
      let createdId: string | undefined;
      await appToast.promise(
        (async () => {
          const result = await buildPayload();
          createdId = result.caseId;
        })(),
        {
          loading: ingestCaseId
            ? 'Saving teaching case…'
            : dicomArchive
              ? 'Creating case and ingesting DICOM…'
              : 'Creating teaching case…',
          success: 'Case created successfully.',
          error: 'Failed to create case.',
        },
      );
      onCreated(createdId);
    } catch {
      /* toast handled */
    } finally {
      setBusy(false);
    }
  });

  const toggleTag = (tagId: string) => {
    const current = form.getValues('tagIds') ?? [];
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    form.setValue('tagIds', next, { shouldDirty: true });
  };

  const formDisabled = busy || dicomIngestBusy;

  if (metaQuery.isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading ontology metadata…
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Case title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Distal radius fracture" disabled={formDisabled} />
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
                    <Select value={field.value} onValueChange={field.onChange} disabled={formDisabled}>
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
                    <Select value={field.value} onValueChange={field.onChange} disabled={formDisabled}>
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
                    <FormLabel>Modality</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={formDisabled}>
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
                    <Select value={field.value} onValueChange={field.onChange} disabled={formDisabled}>
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
                      rows={4}
                      disabled={formDisabled}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                      placeholder="Summary for learners"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>DICOM archive (.zip / .rar)</FormLabel>
              <Input type="file" accept=".zip,.rar" disabled={formDisabled} onChange={onDicomChange} />
              {dicomIngestBusy ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Ingesting archive and extracting metadata…
                </p>
              ) : dicomArchive ? (
                <p className="text-xs text-muted-foreground">{dicomArchive.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Required for imaging — metadata auto-fills anatomy and modality after ingest.
                </p>
              )}
              {extractedMetadata ? (
                <div className="mt-2">
                  <DicomMetadataSummary metadata={extractedMetadata} compact />
                </div>
              ) : null}
            </FormItem>
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="suggestedDiagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Suggested diagnosis</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={formDisabled} />
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
                    <textarea {...field} rows={3} disabled={formDisabled} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
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
                    <textarea {...field} rows={3} disabled={formDisabled} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
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
                        disabled={formDisabled}
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
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" disabled={formDisabled} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" isLoading={busy} disabled={formDisabled}>
            Create case
          </Button>
        </div>
      </form>
    </Form>
  );
}
