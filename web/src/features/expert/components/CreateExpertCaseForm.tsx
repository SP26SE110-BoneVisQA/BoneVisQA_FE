'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  expertCaseFormSchema,
  type ExpertCaseFormValues,
} from '@/features/expert/schemas/expert-case-form-schema';
import {
  EXPERT_ANATOMY_SITES,
  EXPERT_DIFFICULTY_OPTIONS,
  EXPERT_IMAGE_MODALITIES,
  resolveExpertCategoryIdForSubmit,
} from '@/features/expert/lib/expert-ontology';
import { sanitizeGuidList } from '@/lib/api/sanitize-guids';
import { useCreateExpertCase, useExpertCaseMeta } from '@/features/expert/queries/use-expert-cases';
import { uploadExpertCaseDicomArchive } from '@/lib/api/expert-cases';
import { applyDicomMetadataToExpertForm } from '@/features/expert/lib/apply-dicom-metadata-to-form';
import { appToast } from '@/lib/api/errors/app-toast';
import type { CreateExpertCaseJsonInput } from '@/lib/api/expert-cases';
import { Loader2 } from 'lucide-react';

const MAX_DICOM_BYTES = 500 * 1024 * 1024;

type Props = {
  onCreated: (caseId: string | undefined) => void;
  onCancel: () => void;
};

export function CreateExpertCaseForm({ onCreated, onCancel }: Props) {
  const metaQuery = useExpertCaseMeta();
  const createMutation = useCreateExpertCase();
  const [dicomArchive, setDicomArchive] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

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

  const onDicomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith('.zip') && !lower.endsWith('.rar')) {
      appToast.error('Only DICOM archive files (.zip or .rar) are supported.');
      return;
    }
    if (f.size > MAX_DICOM_BYTES) {
      appToast.error('DICOM archive must be 500 MB or smaller.');
      return;
    }
    setDicomArchive(f);
  };

  const buildPayload = async (): Promise<{ payload: CreateExpertCaseJsonInput; caseId?: string }> => {
    const values = form.getValues();

    const anatomyNote = `Anatomy site: ${values.anatomySite}`;
    const description =
      values.description.trim() +
      (values.description.includes(values.anatomySite) ? '' : `\n\n${anatomyNote}`);

    const categoryId = resolveExpertCategoryIdForSubmit(values.categoryId, categories);
    const tagIds = sanitizeGuidList(values.tagIds);

    const payload: CreateExpertCaseJsonInput = {
      title: values.title.trim(),
      description,
      difficulty: values.difficulty,
      categoryId,
      suggestedDiagnosis: values.suggestedDiagnosis.trim() || null,
      reflectiveQuestions: values.reflectiveQuestions.trim() || null,
      keyFindings: values.keyFindings.trim() || null,
      tagIds: tagIds.length > 0 ? tagIds : null,
      medicalImages: null,
    };

    const caseId = await createMutation.mutateAsync(payload);

    if (dicomArchive && caseId) {
      const uploadPromise = uploadExpertCaseDicomArchive(caseId, dicomArchive, values.modality);
      void appToast.promise(uploadPromise, {
        loading: 'Ingesting DICOM archive…',
        success: 'DICOM archive uploaded and processing started.',
        error: 'DICOM archive upload failed.',
      });
      const ingest = await uploadPromise;
      if (ingest.dicomMetadata) {
        applyDicomMetadataToExpertForm(form.setValue, ingest.dicomMetadata);
        appToast.success('Form auto-filled from DICOM metadata.');
      }
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
          loading: dicomArchive ? 'Creating case and ingesting DICOM…' : 'Creating teaching case…',
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
                    <Input {...field} placeholder="e.g. Distal radius fracture" disabled={busy} />
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
                      rows={4}
                      disabled={busy}
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
              <Input type="file" accept=".zip,.rar" disabled={busy} onChange={onDicomChange} />
              {dicomArchive ? (
                <p className="text-xs text-muted-foreground">{dicomArchive.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Required for imaging — preview is extracted automatically after ingest.
                </p>
              )}
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
                    <Input {...field} disabled={busy} />
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
                    <textarea {...field} rows={3} disabled={busy} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
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
                    <textarea {...field} rows={3} disabled={busy} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
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
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" isLoading={busy} disabled={busy}>
            Create case
          </Button>
        </div>
      </form>
    </Form>
  );
}
