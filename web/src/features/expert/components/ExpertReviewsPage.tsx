'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ListPageLayout } from '@/components/layouts';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { appToast } from '@/lib/api/errors/app-toast';
import { useExpertReviewQueue } from '@/features/expert/queries/use-expert-reviews';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { EmptyState } from '@/components/shared/EmptyState';
import { ExpertReviewQueueSkeleton } from '@/components/shared/DashboardSkeletons';
import { ExpertReviewWorkspace, reflectiveQuestionsToEditText } from '@/components/expert/reviews/ExpertReviewWorkspace';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  approveExpertReview,
  deleteExpertReviewDraft,
  fetchExpertReviewDetail,
  fetchExpertReviewDraft,
  hasExpertReviewSelectedPairMismatch,
  putExpertReviewDraft,
  REVIEW_WORKFLOW_CONFLICT,
  type ExpertReviewDraftPayload,
  type ExpertReviewUpdatePayload,
  type PromoteExpertReviewPayload,
  promoteExpertReview,
  resolveExpertReview,
} from '@/lib/api/expert-reviews';
import { fetchExpertCategories, fetchExpertTags, type ExpertCategory, type ExpertTag } from '@/lib/api/expert-cases';
import type { ExpertReviewItem, ExpertReviewSavedDraft } from '@/lib/api/types';
import { getWorkflowStatusMeta, normalizeWorkflowStatus } from '@/lib/visual-qa-workflow';
import { toast as sonnerToast } from 'sonner';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { deriveExpertCaseFormPrefillFromDicom } from '@/features/expert/lib/apply-dicom-metadata-to-form';
import { CheckCircle, ChevronDown, ChevronRight, Clock, Inbox, RefreshCw, User, XCircle } from 'lucide-react';

function clearServerReviewDraft(sessionId: string) {
  void deleteExpertReviewDraft(sessionId).catch(() => {});
}

function toWorkflowFriendlyError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === REVIEW_WORKFLOW_CONFLICT) {
    return 'This review state was already updated by another action. Please refresh the queue.';
  }
  return error instanceof Error ? error.message : fallback;
}

function firstStudentQuestion(item: ExpertReviewItem): string {
  const firstTurn = item.turns?.[0];
  if (!firstTurn) return item.questionText?.trim() || item.question?.trim() || '';
  const messageQuestion = (firstTurn.messages ?? []).find((message) => {
    const role = (message.role ?? '').toLowerCase();
    return role === 'student' || role === 'user';
  });
  return (
    messageQuestion?.content?.trim() ||
    firstTurn.questionText?.trim() ||
    item.questionText?.trim() ||
    item.question?.trim() ||
    ''
  );
}

function buildResolvePayload(
  item: ExpertReviewItem,
  ctx: {
    active: ExpertReviewItem | null;
    diag: string;
    keyText: string;
    keyImagingEdit: string;
    reflectiveEdit: string;
    replyDrafts: Record<string, string>;
    status: 'Approved' | 'Rejected';
    roi?: number[] | null;
  },
  options?: { explicitRejectNote?: string },
): ExpertReviewUpdatePayload {
  const useEdited = ctx.active?.id === item.id;
  const normalizedFindings = useEdited
    ? ctx.keyText.split('\n').map((s) => s.trim()).filter(Boolean)
    : [];
  const draftNote = ctx.replyDrafts[item.sessionId]?.trim();
  const reviewNote =
    ctx.status === 'Rejected'
      ? options?.explicitRejectNote?.trim() || draftNote || 'Rejected by expert reviewer.'
      : draftNote || 'Approved by expert reviewer.';
  const decision = ctx.status === 'Rejected' ? ('reject' as const) : undefined;
  return {
    answerText: item.report.answerText || '',
    structuredDiagnosis: useEdited
      ? ctx.diag.trim() || item.report.suggestedDiagnosis || ''
      : item.report.suggestedDiagnosis || '',
    differentialDiagnoses:
      normalizedFindings.length > 0 ? normalizedFindings : item.report.differentialDiagnoses,
    reviewNote,
    keyImagingFindings: useEdited
      ? ctx.keyImagingEdit.trim() || null
      : item.report.keyImagingFindings ?? item.keyImagingFindings ?? null,
    reflectiveQuestions: useEdited
      ? ctx.reflectiveEdit.trim() || null
      : reflectiveQuestionsToEditText(item.report, item.reflectiveQuestions) || null,
    correctedRoiBoundingBox:
      Array.isArray(ctx.roi) && ctx.roi.length >= 4 ? ctx.roi.slice(0, 4) : undefined,
    decision,
  };
}

function joinDifferentialFromReport(item: ExpertReviewItem): string {
  const d = item.report.differentialDiagnoses ?? [];
  if (d.length) return d.map((s) => String(s).trim()).filter(Boolean).join('\n');
  return (item.report.keyFindings ?? []).join('\n');
}

function joinKeyImagingFindings(item: ExpertReviewItem, keyImagingEdit: string, useEdited: boolean): string {
  if (useEdited && keyImagingEdit.trim()) return keyImagingEdit.trim();
  const k = item.report.keyImagingFindings?.trim();
  if (k) return k;
  return (item.report.keyFindings ?? []).map((s) => String(s).trim()).filter(Boolean).join('\n');
}

function structuredDiagnosisForPromote(item: ExpertReviewItem, diag: string, useEdited: boolean): string {
  if (useEdited && diag.trim()) return diag.trim();
  return (
    item.report.suggestedDiagnosis?.trim() ||
    item.report.diagnosis?.trim() ||
    item.report.answerText?.trim() ||
    ''
  );
}

function collectTurnAnnotationsForPromote(
  item: ExpertReviewItem,
  correctedRoi?: number[] | null,
): Array<Record<string, unknown>> {
  const turns = item.turns ?? [];
  const out: Array<Record<string, unknown>> = [];
  const expertRoi =
    Array.isArray(correctedRoi) && correctedRoi.length >= 4 ? correctedRoi.slice(0, 4) : null;

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const studentRoi = t.roiBoundingBox ?? t.questionCoordinates ?? null;
    const roi = i === 0 && expertRoi ? expertRoi : studentRoi;
    if (!roi) continue;
    out.push({
      turnIndex: t.turnIndex,
      turnId: t.turnId,
      userMessageId: t.userMessageId,
      assistantMessageId: t.assistantMessageId,
      roiBoundingBox: roi,
      ...(i === 0 && expertRoi ? { source: 'expert_corrected' } : {}),
    });
  }

  if (out.length === 0 && expertRoi) {
    const first = turns[0];
    out.push({
      turnIndex: first?.turnIndex ?? 0,
      turnId: first?.turnId,
      userMessageId: first?.userMessageId,
      assistantMessageId: first?.assistantMessageId,
      roiBoundingBox: expertRoi,
      source: 'expert_corrected',
    });
  }

  return out;
}

function buildExpertReviewDraftPayload(
  item: ExpertReviewItem,
  ctx: {
    diag: string;
    keyText: string;
    keyImagingEdit: string;
    reflectiveEdit: string;
    libraryTitle: string;
    libraryCategoryId: string;
    libraryDifficulty: string;
    libraryTagIds: string[];
    libraryAnatomySite: string;
    libraryClinicalDescription: string;
    categories: ExpertCategory[];
    roi?: number[] | null;
    explicitNote?: string;
  },
): ExpertReviewDraftPayload {
  const differentialLines = ctx.keyText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const reviewNote =
    ctx.explicitNote?.trim() ||
    buildExpertReviewDraftNote({
      diag: ctx.diag,
      keyText: ctx.keyText,
      keyImagingEdit: ctx.keyImagingEdit,
      reflectiveEdit: ctx.reflectiveEdit,
      libraryTitle: ctx.libraryTitle,
      libraryCategoryId: ctx.libraryCategoryId,
      libraryClinicalDescription: ctx.libraryClinicalDescription,
      categories: ctx.categories,
    });

  return {
    answerText: item.report.answerText || '',
    structuredDiagnosis: ctx.diag.trim() || item.report.suggestedDiagnosis || '',
    differentialDiagnoses:
      differentialLines.length > 0 ? differentialLines : item.report.differentialDiagnoses,
    keyImagingFindings: ctx.keyImagingEdit.trim() || item.report.keyImagingFindings || null,
    reflectiveQuestions:
      ctx.reflectiveEdit.trim() ||
      reflectiveQuestionsToEditText(item.report, item.reflectiveQuestions) ||
      null,
    reviewNote,
    ...(Array.isArray(ctx.roi) && ctx.roi.length >= 4
      ? { correctedRoiBoundingBox: ctx.roi.slice(0, 4) }
      : {}),
    ...(ctx.libraryTitle.trim() ? { libraryTitle: ctx.libraryTitle.trim() } : {}),
    ...(ctx.libraryCategoryId.trim() ? { libraryCategoryId: ctx.libraryCategoryId.trim() } : {}),
    ...(ctx.libraryDifficulty.trim() ? { libraryDifficulty: ctx.libraryDifficulty.trim() } : {}),
    ...(ctx.libraryClinicalDescription.trim()
      ? { libraryClinicalDescription: ctx.libraryClinicalDescription.trim() }
      : {}),
    ...(ctx.libraryAnatomySite?.trim() ? { libraryAnatomySite: ctx.libraryAnatomySite.trim() } : {}),
    ...(ctx.libraryTagIds.length > 0 ? { libraryTagIds: ctx.libraryTagIds } : {}),
  };
}

function buildExpertReviewDraftNote(ctx: {
  diag: string;
  keyText: string;
  keyImagingEdit: string;
  reflectiveEdit: string;
  libraryTitle: string;
  libraryCategoryId: string;
  libraryClinicalDescription: string;
  categories: ExpertCategory[];
}): string {
  const parts: string[] = [];
  if (ctx.diag.trim()) parts.push(`Suggested diagnosis: ${ctx.diag.trim()}`);
  if (ctx.keyText.trim()) parts.push(`Differential diagnoses:\n${ctx.keyText.trim()}`);
  if (ctx.keyImagingEdit.trim()) parts.push(`Key imaging findings:\n${ctx.keyImagingEdit.trim()}`);
  if (ctx.reflectiveEdit.trim()) parts.push(`Reflective questions:\n${ctx.reflectiveEdit.trim()}`);
  if (ctx.libraryTitle.trim()) parts.push(`Library title: ${ctx.libraryTitle.trim()}`);
  if (ctx.libraryClinicalDescription.trim()) {
    parts.push(`Clinical description: ${ctx.libraryClinicalDescription.trim()}`);
  }
  const cat = ctx.categories.find((c) => c.id === ctx.libraryCategoryId.trim());
  if (cat?.name) parts.push(`Pathology group: ${cat.name}`);
  return parts.length > 0 ? parts.join('\n\n') : 'Expert review draft saved.';
}

function prefillClinicalFieldsFromItem(
  item: ExpertReviewItem,
  setters: {
    setDiag: (v: string) => void;
    setKeyText: (v: string) => void;
    setKeyImagingEdit: (v: string) => void;
    setReflectiveEdit: (v: string) => void;
  },
): void {
  setters.setDiag(
    item.report.suggestedDiagnosis?.trim() ||
      item.report.diagnosis?.trim() ||
      item.report.answerText?.trim() ||
      '',
  );
  const differential = item.report.differentialDiagnoses ?? [];
  setters.setKeyText(
    differential.length > 0
      ? differential.map((s) => String(s).trim()).filter(Boolean).join('\n')
      : (item.report.keyFindings ?? []).join('\n'),
  );
  setters.setKeyImagingEdit(
    item.report.keyImagingFindings?.trim() ?? item.keyImagingFindings?.trim() ?? '',
  );
  setters.setReflectiveEdit(reflectiveQuestionsToEditText(item.report, item.reflectiveQuestions));
}

async function resolveExpertReviewSavedDraft(
  item: ExpertReviewItem,
): Promise<ExpertReviewSavedDraft | null> {
  if (item.savedDraft) return item.savedDraft;
  if (getWorkflowStatusMeta(item.status).terminal) return null;
  return fetchExpertReviewDraft(item.sessionId);
}

function applyExpertReviewSavedDraft(
  sessionId: string,
  draft: ExpertReviewSavedDraft,
  setters: {
    setDiag: (v: string) => void;
    setKeyText: (v: string) => void;
    setKeyImagingEdit: (v: string) => void;
    setReflectiveEdit: (v: string) => void;
    setLibraryTitle: (v: string) => void;
    setLibraryCategoryId: (v: string) => void;
    setLibraryDifficulty: (v: string) => void;
    setLibraryTagIds: (v: string[]) => void;
    setLibraryAnatomySite: (v: string) => void;
    setLibraryClinicalDescription: (v: string) => void;
    setReplyDraft: (sid: string, note: string) => void;
  },
): number[] | undefined {
  if (draft.structuredDiagnosis?.trim()) {
    setters.setDiag(draft.structuredDiagnosis.trim());
  }
  if (draft.differentialDiagnoses?.length) {
    setters.setKeyText(
      draft.differentialDiagnoses.map((s) => String(s).trim()).filter(Boolean).join('\n'),
    );
  }
  if (draft.keyImagingFindings != null && String(draft.keyImagingFindings).trim()) {
    setters.setKeyImagingEdit(String(draft.keyImagingFindings).trim());
  }
  if (draft.reflectiveQuestions != null && String(draft.reflectiveQuestions).trim()) {
    setters.setReflectiveEdit(String(draft.reflectiveQuestions).trim());
  }
  if (draft.libraryTitle?.trim()) setters.setLibraryTitle(draft.libraryTitle.trim());
  if (draft.libraryCategoryId?.trim()) setters.setLibraryCategoryId(draft.libraryCategoryId.trim());
  if (draft.libraryDifficulty?.trim()) setters.setLibraryDifficulty(draft.libraryDifficulty.trim());
  if (draft.libraryTagIds?.length) {
    setters.setLibraryTagIds(draft.libraryTagIds.map((id) => String(id).trim()).filter(Boolean));
  }
  if (draft.libraryAnatomySite?.trim()) setters.setLibraryAnatomySite(draft.libraryAnatomySite.trim());
  if (draft.libraryClinicalDescription?.trim()) {
    setters.setLibraryClinicalDescription(draft.libraryClinicalDescription.trim());
  }
  if (draft.reviewNote?.trim()) setters.setReplyDraft(sessionId, draft.reviewNote.trim());
  return draft.correctedRoiBoundingBox;
}

function prefillLibraryFieldsFromItem(
  item: ExpertReviewItem,
  setters: {
    setLibraryTitle: (v: string) => void;
    setLibraryCategoryId: (v: string) => void;
    setLibraryDifficulty: (v: string) => void;
    setLibraryTagIds: (v: string[]) => void;
    setLibraryAnatomySite: (v: string) => void;
    setLibraryModality: (v: string) => void;
    setLibraryClinicalDescription: (v: string) => void;
  },
  tags: ExpertTag[],
): void {
  const derived = deriveExpertCaseFormPrefillFromDicom(item.dicomMetadata);
  const metadataTags = buildMetadataTagCandidates(item);
  const seedTitleBase =
    item.caseTitle?.trim() ||
    firstStudentQuestion(item) ||
    [derived.modality, derived.anatomySite].filter(Boolean).join(' ');
  setters.setLibraryTitle(seedTitleBase.slice(0, 200));
  setters.setLibraryCategoryId('');
  setters.setLibraryDifficulty('intermediate');
  setters.setLibraryTagIds(resolveTagIdsFromNames(metadataTags, tags));
  setters.setLibraryAnatomySite(derived.anatomySite);
  setters.setLibraryModality(derived.modality);
  const clinicalSeed =
    item.report.answerText?.trim() ||
    item.report.suggestedDiagnosis?.trim() ||
    item.report.diagnosis?.trim() ||
    '';
  setters.setLibraryClinicalDescription(clinicalSeed);
}

function formatReferencesFromReviewItem(item: ExpertReviewItem): string {
  const citations = item.citations ?? [];
  if (citations.length === 0) return '';
  return citations
    .map((c) => {
      const parts = [c.sourceText?.trim(), c.referenceUrl?.trim()].filter(Boolean);
      if (c.pageNumber != null) parts.push(`p.${c.pageNumber}`);
      return parts.join(' — ');
    })
    .filter(Boolean)
    .join('\n');
}

function resolveTagIdsFromNames(tagNames: string[], tags: ExpertTag[]): string[] {
  if (tagNames.length === 0 || tags.length === 0) return [];
  const byName = new Map(tags.map((tag) => [tag.name.trim().toLowerCase(), tag.id]));
  const ids: string[] = [];
  for (const name of tagNames) {
    const id = byName.get(name.trim().toLowerCase());
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function buildMetadataTagCandidates(item: ExpertReviewItem): string[] {
  const metadata = item.dicomMetadata;
  if (!metadata) return [];
  return [
    metadata.modality,
    metadata.anatomySite,
    metadata.bodyPartExamined,
    metadata.laterality,
    metadata.viewPosition,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .filter((value, index, array) => array.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index);
}

function buildPromotePayload(
  item: ExpertReviewItem,
  ctx: {
    diag: string;
    keyText: string;
    keyImagingEdit: string;
    reflectiveEdit: string;
    libraryTitle: string;
    libraryCategoryId: string;
    libraryDifficulty: string;
    libraryTagIds: string[];
    libraryClinicalDescription: string;
    libraryAnatomySite?: string;
    categories: ExpertCategory[];
    tags: ExpertTag[];
    correctedRoi?: number[] | null;
  },
): PromoteExpertReviewPayload {
  const catId = ctx.libraryCategoryId.trim();
  const cat = ctx.categories.find((c) => c.id === catId);
  const tagIds = ctx.libraryTagIds.filter(Boolean);
  const tagNames = tagIds
    .map((id) => ctx.tags.find((tag) => tag.id === id)?.name ?? '')
    .filter(Boolean);
  const mainDiagnosis = structuredDiagnosisForPromote(item, ctx.diag, true);
  const differentialLines = ctx.keyText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const differentialText =
    differentialLines.join('\n') || joinDifferentialFromReport(item);
  const description =
    ctx.libraryClinicalDescription.trim() || mainDiagnosis || item.report.answerText?.trim() || '';
  const keyFindings =
    ctx.keyImagingEdit.trim() || joinKeyImagingFindings(item, ctx.keyImagingEdit, true);
  const reflectiveQuestions =
    ctx.reflectiveEdit.trim() ||
    reflectiveQuestionsToEditText(item.report, item.reflectiveQuestions) ||
    '';
  return {
    title: ctx.libraryTitle.trim(),
    categoryId: catId || undefined,
    categoryName: cat?.name ?? (catId || undefined),
    difficulty: ctx.libraryDifficulty.trim() || 'intermediate',
    tagIds,
    tagNames: tagNames.length > 0 ? tagNames : undefined,
    clinicalDescription: ctx.libraryClinicalDescription.trim() || undefined,
    description,
    suggestedMainDiagnosis: mainDiagnosis || undefined,
    suggestedDiagnosis: differentialText,
    differentialDiagnoses: differentialLines.length > 0 ? differentialLines : undefined,
    keyFindings,
    reflectiveQuestions,
    studentQuestion: item.question?.trim() || firstStudentQuestion(item) || undefined,
    referencesAndCitations: formatReferencesFromReviewItem(item) || undefined,
    anatomySite: ctx.libraryAnatomySite?.trim() || undefined,
    boneLocation: ctx.libraryAnatomySite?.trim() || undefined,
    pathologyGroup:
      ctx.categories.find((c) => c.id === ctx.libraryCategoryId.trim())?.name || undefined,
    turnAnnotations: collectTurnAnnotationsForPromote(item, ctx.correctedRoi),
  };
}

function validatePromotePayload(payload: PromoteExpertReviewPayload): string | null {
  if (!payload.title.trim()) return 'Enter a library case title before promoting.';
  if (!payload.categoryId) return 'Select a category for the library case.';
  if (!payload.tagIds.length && !(payload.tagNames?.length ?? 0)) {
    return 'Select at least one tag before promoting.';
  }
  if (!payload.description.trim()) return 'Enter a clinical description before promoting.';
  if (!payload.suggestedDiagnosis.trim()) {
    return 'Enter differential diagnoses before promoting.';
  }
  if (!payload.keyFindings.trim()) return 'Enter key imaging findings before promoting.';
  if (!payload.reflectiveQuestions.trim()) return 'Enter reflective questions before promoting.';
  return null;
}

async function saveReviewDraftIfNeeded(
  sessionId: string,
  payload: ExpertReviewDraftPayload,
): Promise<void> {
  await putExpertReviewDraft(sessionId, payload);
}

export function ExpertReviewsPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [queueTab, setQueueTab] = useState<'Pending' | 'History'>('Pending');
  const queueQuery = useExpertReviewQueue(queueTab);
  const isHistoryTab = queueTab === 'History';
  const [items, setItems] = useState<ExpertReviewItem[]>([]);
  const loading = queueQuery.isPending;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [active, setActive] = useState<ExpertReviewItem | null>(null);
  const [diag, setDiag] = useState('');
  const [keyText, setKeyText] = useState('');
  const [keyImagingEdit, setKeyImagingEdit] = useState('');
  const [reflectiveEdit, setReflectiveEdit] = useState('');
  const [saving, setSaving] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [roiClearEpochBySession, setRoiClearEpochBySession] = useState<Record<string, number>>({});
  const [draftRoiBySession, setDraftRoiBySession] = useState<Record<string, number[] | undefined>>({});
  const [rejectModalItem, setRejectModalItem] = useState<ExpertReviewItem | null>(null);
  const [rejectModalNote, setRejectModalNote] = useState('');
  const openedFocusRef = useRef<string | null>(null);
  const [expertCategories, setExpertCategories] = useState<ExpertCategory[]>([]);
  const [libraryTitle, setLibraryTitle] = useState('');
  const [libraryCategoryId, setLibraryCategoryId] = useState('');
  const [libraryDifficulty, setLibraryDifficulty] = useState('intermediate');
  const [libraryTagIds, setLibraryTagIds] = useState<string[]>([]);
  const [libraryAnatomySite, setLibraryAnatomySite] = useState('');
  const [libraryModality, setLibraryModality] = useState('');
  const [libraryClinicalDescription, setLibraryClinicalDescription] = useState('');

  const categoriesQuery = useQuery({
    queryKey: queryKeys.expert.caseMeta(),
    queryFn: fetchExpertCategories,
  });

  const tagsQuery = useQuery({
    queryKey: [...queryKeys.expert.caseMeta(), 'tags'],
    queryFn: () => fetchExpertTags(1, 500),
    staleTime: 60_000,
  });
  const expertTags = tagsQuery.data ?? [];

  const load = useCallback(async () => {
    const result = await queueQuery.refetch();
    if (result.data) setItems(result.data);
  }, [queueQuery]);

  useEffect(() => {
    if (queueQuery.data) setItems(queueQuery.data);
  }, [queueQuery.data]);

  useEffect(() => {
    if (queueQuery.error) {
      appToast.error(
        queueQuery.error instanceof Error ? queueQuery.error.message : 'Failed to load review queue.',
      );
    }
  }, [queueQuery.error]);

  useEffect(() => {
    if (categoriesQuery.data) setExpertCategories(categoriesQuery.data);
  }, [categoriesQuery.data]);

  const applySavedDraftForItem = useCallback(
    async (item: ExpertReviewItem, merged?: ExpertReviewItem) => {
      const source = merged ?? item;
      const draft = await resolveExpertReviewSavedDraft(source);
      if (!draft) return;
      const roi = applyExpertReviewSavedDraft(source.sessionId, draft, {
        setDiag,
        setKeyText,
        setKeyImagingEdit,
        setReflectiveEdit,
        setLibraryTitle,
        setLibraryCategoryId,
        setLibraryDifficulty,
        setLibraryTagIds,
        setLibraryAnatomySite,
        setLibraryClinicalDescription,
        setReplyDraft: (sid, note) =>
          setReplyDrafts((prev) => (prev[sid] === note ? prev : { ...prev, [sid]: note })),
      });
      if (roi?.length === 4) {
        setDraftRoiBySession((prev) => ({ ...prev, [source.sessionId]: roi }));
      }
    },
    [],
  );

  /** Bổ sung citations/turns đầy đủ khi BE chỉ trả tóm tắt trên queue list. */
  useEffect(() => {
    if (!active?.sessionId) return;
    let cancelled = false;
    const sessionId = active.sessionId;
    void (async () => {
      const detail = await fetchExpertReviewDetail(sessionId);
      if (cancelled) return;
      let merged = active;
      if (detail) {
        const dc = detail.citations ?? [];
        const ic = active.citations ?? [];
        const cite =
          dc.length > ic.length ? dc : dc.length > 0 && ic.length === 0 ? dc : ic;
        const dt = detail.turns ?? [];
        const it = active.turns ?? [];
        const turns =
          dt.length > it.length ? dt : dt.length > 0 && it.length === 0 ? dt : it;
        merged = {
          ...active,
          ...detail,
          report: detail.report ?? active.report,
          citations: cite,
          turns,
          savedDraft: detail.savedDraft ?? active.savedDraft,
        };
        setItems((prev) =>
          prev.map((i) => (i.sessionId !== sessionId ? i : { ...i, ...merged })),
        );
        setActive(merged);
      }
      prefillClinicalFieldsFromItem(merged, {
        setDiag,
        setKeyText,
        setKeyImagingEdit,
        setReflectiveEdit,
      });
      prefillLibraryFieldsFromItem(
        merged,
        {
          setLibraryTitle,
          setLibraryCategoryId,
          setLibraryDifficulty,
          setLibraryTagIds,
          setLibraryAnatomySite,
          setLibraryModality,
          setLibraryClinicalDescription,
        },
        expertTags,
      );
      await applySavedDraftForItem(merged, merged);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the opened session changes
  }, [active?.sessionId]);

  const openEdit = useCallback(
    (item: ExpertReviewItem) => {
      setActive(item);
      setDraftRoiBySession((prev) => {
        const next = { ...prev };
        delete next[item.sessionId];
        return next;
      });
      setExpanded(item.id);
    },
    [],
  );

  useEffect(() => {
    const focus = searchParams.get('focus')?.trim();
    if (!focus || items.length === 0) return;
    if (openedFocusRef.current === focus) return;
    const match = items.find((i) => i.id === focus || i.sessionId === focus || i.answerId === focus);
    if (match) {
      openedFocusRef.current = focus;
      openEdit(match);
    }
  }, [items, searchParams, openEdit]);

  const saveDraftForItem = async (
    item: ExpertReviewItem,
    roi?: number[] | null,
    options?: { silent?: boolean },
  ) => {
    if (hasExpertReviewSelectedPairMismatch(item)) {
      toast.error('Selected pair mismatch. Refresh the queue and open this case again.');
      return;
    }
    setSaving(true);
    try {
      await putExpertReviewDraft(
        item.sessionId,
        buildExpertReviewDraftPayload(item, {
          diag,
          keyText,
          keyImagingEdit,
          reflectiveEdit,
          libraryTitle,
          libraryCategoryId,
          libraryDifficulty,
          libraryTagIds,
          libraryAnatomySite,
          libraryClinicalDescription,
          categories: expertCategories,
          roi,
          explicitNote: replyDrafts[item.sessionId],
        }),
      );
      if (!options?.silent) toast.success('Draft saved.');
    } catch (e) {
      if (!options?.silent) {
        toast.error(e instanceof Error ? e.message : 'Failed to save draft');
      }
    } finally {
      setSaving(false);
    }
  };

  const approveAndPromoteForItem = async (item: ExpertReviewItem, roi?: number[] | null) => {
    if (hasExpertReviewSelectedPairMismatch(item)) {
      toast.error('Selected pair mismatch. Refresh the queue before approving.');
      return;
    }
    const derived = deriveExpertCaseFormPrefillFromDicom(item.dicomMetadata);
    const metadataTags = buildMetadataTagCandidates(item);
    let effectiveLibraryTagIds = libraryTagIds.filter(Boolean);
    if (effectiveLibraryTagIds.length === 0) {
      effectiveLibraryTagIds = resolveTagIdsFromNames(metadataTags, expertTags);
      if (effectiveLibraryTagIds.length > 0) {
        setLibraryTagIds(effectiveLibraryTagIds);
      }
    }
    if (!libraryAnatomySite && derived.anatomySite) {
      setLibraryAnatomySite(derived.anatomySite);
    }
    if (!libraryModality && derived.modality) {
      setLibraryModality(derived.modality);
    }
    const promotePayload = buildPromotePayload(item, {
      diag,
      keyText,
      keyImagingEdit,
      reflectiveEdit,
      libraryTitle,
      libraryCategoryId,
      libraryDifficulty,
      libraryTagIds: effectiveLibraryTagIds,
      libraryClinicalDescription,
      libraryAnatomySite,
      categories: expertCategories,
      tags: expertTags,
      correctedRoi: roi,
    });
    const validationError = validatePromotePayload(promotePayload);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    let approved = false;
    try {
      await saveReviewDraftIfNeeded(
        item.sessionId,
        buildExpertReviewDraftPayload(item, {
          diag,
          keyText,
          keyImagingEdit,
          reflectiveEdit,
          libraryTitle,
          libraryCategoryId,
          libraryDifficulty,
          libraryTagIds,
          libraryAnatomySite,
          libraryClinicalDescription,
          categories: expertCategories,
          roi,
          explicitNote: replyDrafts[item.sessionId],
        }),
      );
      await approveExpertReview(item.sessionId);
      approved = true;
      await promoteExpertReview(item.sessionId, promotePayload);
      clearServerReviewDraft(item.sessionId);
      setRoiClearEpochBySession((prev) => ({
        ...prev,
        [item.sessionId]: (prev[item.sessionId] ?? 0) + 1,
      }));
      setDraftRoiBySession((prev) => {
        const next = { ...prev };
        delete next[item.sessionId];
        return next;
      });
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[item.sessionId];
        return next;
      });
      const rid = item.id;
      setItems((prev) => prev.filter((i) => i.id !== rid));
      setExpanded((e) => (e === rid ? null : e));
      if (active?.id === rid) setActive(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expert.reviews('Pending') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expert.reviews('History') }),
      ]);
      sonnerToast.success('Review approved and published to the case library.', { duration: 6000 });
    } catch (error) {
      if (approved) {
        void load();
        toast.error(
          `${toWorkflowFriendlyError(error, 'Case was approved but publishing to the library failed. Refresh the queue — contact an administrator if the case is missing from the library.')}`,
        );
      } else {
        toast.error(toWorkflowFriendlyError(error, 'Approve and promote failed.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const openRejectModal = (item: ExpertReviewItem) => {
    setRejectModalItem(item);
    setRejectModalNote(replyDrafts[item.sessionId]?.trim() ?? '');
  };

  const closeRejectModal = () => {
    setRejectModalItem(null);
    setRejectModalNote('');
  };

  const submitRejectModal = async () => {
    const item = rejectModalItem;
    if (!item) return;
    const reason = rejectModalNote.trim();
    if (!reason) {
      toast.error('Enter a rejection reason before submitting.');
      return;
    }
    if (hasExpertReviewSelectedPairMismatch(item)) {
      toast.error('Selected pair mismatch. Refresh the queue before rejecting.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildResolvePayload(
        item,
        {
          active,
          diag,
          keyText,
          keyImagingEdit,
          reflectiveEdit,
          replyDrafts,
          status: 'Rejected',
          roi: undefined,
        },
        { explicitRejectNote: reason },
      );
      await resolveExpertReview(item.sessionId, payload);
      clearServerReviewDraft(item.sessionId);
      setRoiClearEpochBySession((prev) => ({
        ...prev,
        [item.sessionId]: (prev[item.sessionId] ?? 0) + 1,
      }));
      setDraftRoiBySession((prev) => {
        const next = { ...prev };
        delete next[item.sessionId];
        return next;
      });
      const jid = item.id;
      setItems((prev) => prev.filter((i) => i.id !== jid));
      setExpanded((e) => (e === jid ? null : e));
      if (active?.id === jid) setActive(null);
      closeRejectModal();
      sonnerToast.message('Review recorded', {
        description: 'The student will be notified. This item is removed from your pending queue.',
        duration: 5000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const isLg = useMediaQuery('(min-width: 1024px)');
  const selectedItem = expanded ? (items.find((i) => i.id === expanded) ?? null) : null;

  const selectDesktopQueueItem = useCallback(
    (item: ExpertReviewItem) => {
      if (expanded === item.id) {
        setExpanded(null);
        setActive(null);
      } else {
        openEdit(item);
      }
    },
    [expanded, openEdit],
  );

  const workspaceForItem = (item: ExpertReviewItem) => (
    <ExpertReviewWorkspace
      key={item.id}
      item={item}
      pairMismatch={hasExpertReviewSelectedPairMismatch(item)}
      loading={loading}
      onReloadQueue={() => void load()}
      isEditing={!getWorkflowStatusMeta(item.status).terminal}
      diag={diag}
      keyText={keyText}
      keyImagingEdit={keyImagingEdit}
      reflectiveEdit={reflectiveEdit}
      onDiagChange={setDiag}
      onKeyTextChange={setKeyText}
      onKeyImagingChange={setKeyImagingEdit}
      onReflectiveChange={setReflectiveEdit}
      roiClearEpoch={roiClearEpochBySession[item.sessionId] ?? 0}
      initialCorrectedRoiBoundingBox={draftRoiBySession[item.sessionId]}
      onOpenEdit={() => openEdit(item)}
      onSaveDraft={(roi, opts) => void saveDraftForItem(item, roi, opts)}
      onApproveAndPromote={(roi) => void approveAndPromoteForItem(item, roi)}
      onRejectRequest={() => openRejectModal(item)}
      saving={saving}
      libraryTitle={libraryTitle}
      libraryCategoryId={libraryCategoryId}
      libraryDifficulty={libraryDifficulty}
      libraryTagIds={libraryTagIds}
      libraryAnatomySite={libraryAnatomySite}
      libraryModality={libraryModality}
      libraryClinicalDescription={libraryClinicalDescription}
      categories={expertCategories}
      tags={expertTags}
      studentQuestion={firstStudentQuestion(item)}
      mainDiagnosis={diag}
      differentialText={keyText}
      referencesText={formatReferencesFromReviewItem(item)}
      onLibraryTitleChange={setLibraryTitle}
      onLibraryCategoryIdChange={setLibraryCategoryId}
      onLibraryDifficultyChange={setLibraryDifficulty}
      onLibraryTagIdsChange={setLibraryTagIds}
      onLibraryClinicalDescriptionChange={setLibraryClinicalDescription}
    />
  );

  return (
    <>
      <ListPageLayout
        title="Expert review"
        isLoading={loading && items.length === 0}
        error={
          queueQuery.error
            ? queueQuery.error instanceof Error
              ? queueQuery.error.message
              : 'Failed to load review queue.'
            : null
        }
        skeletonVariant="list"
        maxWidthClass="max-w-[1680px]"
        actions={
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
        toolbar={
        <div className="space-y-4">
          <Tabs
            value={queueTab}
            onValueChange={(value) => {
              setQueueTab(value as 'Pending' | 'History');
              setExpanded(null);
              setActive(null);
            }}
          >
            <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl bg-muted/80 p-1">
              <TabsTrigger value="Pending" className="rounded-xl text-xs font-semibold">
                Pending
              </TabsTrigger>
              <TabsTrigger value="History" className="rounded-xl text-xs font-semibold">
                History
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/25 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 max-w-3xl text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Escalated Visual QA</p>
            <p className="mt-1">
              {isHistoryTab
                ? 'Review previously approved or rejected escalations.'
                : 'Verify imaging, chat context, and RAG citations before approving for the student library or rejecting with clear feedback.'}
            </p>
          </div>
          <Link
            href="/expert/cases"
            className={cn(
              'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted',
            )}
          >
            Case library
          </Link>
        </div>
        </div>
        }
      >
        {loading && items.length === 0 ? (
          <ExpertReviewQueueSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-7 w-7 text-primary" />}
            title={isHistoryTab ? 'No history yet' : 'All caught up'}
            description={
              isHistoryTab
                ? 'Completed expert reviews will appear here.'
                : 'No escalated Visual QA sessions need your attention right now.'
            }
          />
        ) : isLg ? (
          <div className="flex items-start gap-6">
            <aside className="sticky top-24 w-[min(400px,34vw)] shrink-0 space-y-2 overflow-y-auto pr-1 max-h-[calc(100vh-7rem)]">
              {items.map((item) => {
                const selected = expanded === item.id;
                const confidence = getConfidenceScore(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectDesktopQueueItem(item)}
                    className={cn(
                      'w-full rounded-xl border p-4 text-left transition-shadow',
                      selected
                        ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                    )}
                  >
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{item.question}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.studentName}
                      </span>
                      {item.className ? (
                        <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">{item.className}</span>
                      ) : null}
                      <StatusBadge status={item.status} />
                    </div>
                    {confidence != null ? (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>AI confidence</span>
                          <span className="text-primary">{confidence.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${confidence}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </aside>
            <main className="min-w-0 flex-1">
              {selectedItem ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  {workspaceForItem(selectedItem)}
                </div>
              ) : (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-base font-semibold text-foreground">Choose a session</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Select a row on the left to load imaging, chat, and evidence in this pane.
                  </p>
                </div>
              )}
            </main>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const isExp = expanded === item.id;
              const confidence = getConfidenceScore(item);
              return (
                <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      if (isExp) {
                        setExpanded(null);
                        setActive(null);
                      } else {
                        openEdit(item);
                      }
                    }}
                    className="flex w-full items-start gap-3 px-5 py-5 text-left hover:bg-muted/30"
                  >
                    {isExp ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-relaxed text-foreground">{item.question}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.studentName}
                            </span>
                            {item.className ? (
                              <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">{item.className}</span>
                            ) : null}
                            <span>{item.askedAt}</span>
                            <StatusBadge status={item.status} />
                          </div>
                        </div>
                        {confidence != null ? (
                          <div className="w-full max-w-[180px]">
                            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              <span>AI confidence</span>
                              <span className="text-primary">{confidence.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${confidence}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                  {isExp ? workspaceForItem(item) : null}
                </div>
              );
            })}
          </div>
        )}
      </ListPageLayout>

      <DestructiveConfirmDialog
        open={Boolean(rejectModalItem)}
        onOpenChange={(open) => !open && closeRejectModal()}
        title="Reject this review?"
        description="Provide a clear reason so the student and lecturer understand why this escalation was rejected."
        confirmLabel="Submit rejection"
        isLoading={saving}
        onConfirm={() => void submitRejectModal()}
      >
        <label htmlFor="reject-note" className="text-sm font-medium text-foreground">
          Rejection reason (required)
        </label>
        <textarea
          id="reject-note"
          value={rejectModalNote}
          onChange={(e) => setRejectModalNote(e.target.value)}
          rows={4}
          placeholder="Explain why this escalation is rejected or how the student should proceed…"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          disabled={saving}
        />
      </DestructiveConfirmDialog>
    </>
  );
}

function getConfidenceScore(item: ExpertReviewItem): number | null {
  const raw =
    (item as ExpertReviewItem & { aiConfidenceScore?: number }).aiConfidenceScore ??
    item.report.aiConfidenceScore;

  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return raw <= 1 ? raw * 100 : raw;
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeWorkflowStatus(status);
  if (normalized === 'EscalatedToExpert') return null;
  const meta = getWorkflowStatusMeta(status);
  if (meta.tone === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
        <CheckCircle className="h-3 w-3" /> {meta.label}
      </span>
    );
  }
  if (meta.tone === 'danger') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" /> {meta.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
      <Clock className="h-3 w-3" /> {meta.label}
    </span>
  );
}
