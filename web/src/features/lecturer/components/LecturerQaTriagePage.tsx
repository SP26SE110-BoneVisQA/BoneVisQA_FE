'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { ListPageLayout } from '@/components/layouts';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/EmptyState';
import { TriageWorkbenchSkeleton } from '@/components/shared/DashboardSkeletons';
import {
  useEscalateTriageItem,
  useExpertSpecialties,
  useLecturerTriageClasses,
  useLecturerTriageQueue,
  useRejectTriageAnswer,
  TRIAGE_ALREADY_ESCALATED,
  WORKFLOW_CONFLICT,
} from '@/features/lecturer/queries/use-lecturer-triage';
import {
  triageEscalationSchema,
  triageRejectSchema,
  type TriageEscalationValues,
  type TriageRejectValues,
} from '@/features/lecturer/schemas/triage-decision-schema';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileSearch,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiErrorMessage, resolveApiAssetUrl } from '@/lib/api/client';
import type {
  LectStudentQuestionDto,
  LecturerTriageRequestKind,
  NormalizedImageBoundingBox,
  PercentageBoundingBox,
  VisualQaTurn,
} from '@/lib/api/types';
import { RectangleAnnotationOverlay } from '@/components/shared/RectangleAnnotationOverlay';
import { DicomMetadataSummary } from '@/components/shared/DicomMetadataSummary';
import { isValidNormalizedBoundingBox, isValidPercentageBoundingBox } from '@/lib/utils/annotations';
import { isEscalationBlocked } from '@/lib/visual-qa-workflow';
import {
  formatTriageCaseLabel,
  formatTriageSubmittedAt,
  triageHistoryStatusLabel,
} from '@/lib/lecturer/triage-display';
import { formatReviewFeedbackDisplay } from '@/lib/student/visual-qa-feedback';

function scoreLabel(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) {
    return {
      label: 'No confidence',
      tone: 'border-slate-200 bg-slate-100 text-slate-700',
      bar: 'bg-slate-400',
    };
  }
  if (score >= 0.8) {
    return {
      label: 'High confidence',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      bar: 'bg-emerald-500',
    };
  }
  if (score >= 0.5) {
    return {
      label: 'Medium confidence',
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
      bar: 'bg-amber-500',
    };
  }
  return {
    label: 'Low confidence',
    tone: 'border-rose-200 bg-rose-50 text-rose-900',
    bar: 'bg-rose-500',
  };
}

/** Answer-row GUID for PUT /api/lecturer/reviews/{id}/escalate — never the question id. */
function resolveEscalationAnswerRowId(item: LectStudentQuestionDto): string | null {
  const answerId = item.answerId?.trim();
  if (answerId) return answerId;
  const caseAnswerId = item.caseAnswerId?.trim();
  if (caseAnswerId) return caseAnswerId;
  return null;
}

function hasAnswerIdForEscalateUi(item: LectStudentQuestionDto): boolean {
  return Boolean(item.answerId?.trim());
}

function triageStudyImageSrc(item: LectStudentQuestionDto): string {
  const raw = (item.imageUrl ?? item.customImageUrl ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  return resolveApiAssetUrl(raw);
}

function isEscalationBlockedByStatus(item: LectStudentQuestionDto): boolean {
  if (item.escalatedById != null && String(item.escalatedById).trim() !== '') return true;
  return isEscalationBlocked(item.answerStatus ?? null);
}

function escalateButtonTitle(item: LectStudentQuestionDto, hasClassExpert: boolean): string | undefined {
  if (isEscalationBlockedByStatus(item)) return 'Already escalated or approved.';
  if (!hasAnswerIdForEscalateUi(item)) {
    return 'Cannot escalate: AI answer is missing or incomplete.';
  }
  if (!hasClassExpert) {
    return "No expert assigned to this class. Escalation can still be sent, but routing improves after expert assignment.";
  }
  return undefined;
}

function confidencePercent(score: number | null | undefined): number | null {
  if (score == null || Number.isNaN(score)) return null;
  const pct = score <= 1 ? score * 100 : score;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/** BE: no catalog `caseId` => personal upload; trimmed empty string treated as personal. */
function triageRequestKind(item: LectStudentQuestionDto): LecturerTriageRequestKind {
  return item.caseId != null && item.caseId.trim() !== '' ? 'case-catalog' : 'adhoc-upload';
}

function triageWorkflowLabel(item: LectStudentQuestionDto): string {
  return triageRequestKind(item) === 'case-catalog' ? 'Case Catalog' : 'Ad-hoc Upload';
}

function caseCatalogBadgeClass(): string {
  return 'rounded-full border border-sky-200 bg-sky-50 font-medium text-sky-950';
}

function adhocUploadBadgeClass(): string {
  return 'rounded-full border border-amber-200 bg-amber-50 font-medium text-amber-950';
}

function resolveSelectedTurn(item: LectStudentQuestionDto | null): VisualQaTurn | null {
  if (!item?.turns || item.turns.length === 0) return null;
  const requestedReviewMessageId = item.requestedReviewMessageId?.trim();
  const selectedAssistantMessageId = item.selectedAssistantMessageId?.trim();
  const selectedUserMessageId = item.selectedUserMessageId?.trim();

  const matchedByMessage = item.turns.find((turn) => {
    const assistantId = turn.assistantMessageId?.trim();
    const userId = turn.userMessageId?.trim();
    if (selectedAssistantMessageId && assistantId && selectedAssistantMessageId === assistantId) return true;
    if (selectedUserMessageId && userId && selectedUserMessageId === userId) return true;
    if (requestedReviewMessageId) {
      if (assistantId && assistantId === requestedReviewMessageId) return true;
      if (userId && userId === requestedReviewMessageId) return true;
    }
    return false;
  });
  if (matchedByMessage) return matchedByMessage;
  return item.turns[item.turns.length - 1] ?? null;
}

function hasSelectedPairMismatch(item: LectStudentQuestionDto | null): boolean {
  if (!item?.turns || item.turns.length === 0) return false;
  const requestedReviewMessageId = item.requestedReviewMessageId?.trim();
  if (!requestedReviewMessageId) return false;
  const selected = resolveSelectedTurn(item);
  if (!selected) return true;
  const userId = selected.userMessageId?.trim();
  const assistantId = selected.assistantMessageId?.trim();
  const selectedUserMessageId = item.selectedUserMessageId?.trim();
  const selectedAssistantMessageId = item.selectedAssistantMessageId?.trim();

  if (selectedUserMessageId && userId && selectedUserMessageId !== userId) return true;
  if (selectedAssistantMessageId && assistantId && selectedAssistantMessageId !== assistantId) return true;

  if (
    requestedReviewMessageId &&
    requestedReviewMessageId !== userId &&
    requestedReviewMessageId !== assistantId
  ) {
    return true;
  }
  return false;
}

function percentageBoxToNormalized(box: PercentageBoundingBox): NormalizedImageBoundingBox {
  return {
    x: box.xPct / 100,
    y: box.yPct / 100,
    width: box.widthPct / 100,
    height: box.heightPct / 100,
  };
}

/** ROI theo turn (`roiBoundingBox` / `questionCoordinates`) hoặc fallback `customCoordinates` (%). */
function resolvedTriageStudyRoi(
  selectedTurn: VisualQaTurn | null,
  selectedQuestion: LectStudentQuestionDto,
): NormalizedImageBoundingBox | null {
  if (selectedTurn) {
    for (const candidate of [selectedTurn.roiBoundingBox, selectedTurn.questionCoordinates]) {
      if (candidate && isValidNormalizedBoundingBox(candidate)) return candidate;
    }
  }
  const pct = selectedQuestion.customCoordinates;
  if (pct && isValidPercentageBoundingBox(pct)) {
    return percentageBoxToNormalized(pct);
  }
  return null;
}

const panelClass =
  'rounded-[1.75rem] border border-slate-200/70 bg-white/92 shadow-[0_8px_30px_rgb(15,23,42,0.04)] backdrop-blur-md';

const innerCardClass =
  'rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]';

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className={`${panelClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{hint}</p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export function LecturerQaTriagePage() {
  const searchParams = useSearchParams();
  const classesQuery = useLecturerTriageClasses();
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const specialtiesQuery = useExpertSpecialties();
  const specialties = useMemo(() => specialtiesQuery.data ?? [], [specialtiesQuery.data]);
  const specialtyById = useMemo(
    () => new Map(specialties.map((item) => [item.id, item])),
    [specialties],
  );

  const [selectedClassIdOverride, setSelectedClassIdOverride] = useState('');
  const [queueTab, setQueueTab] = useState<'Pending' | 'History'>('Pending');
  const selectedClassId = useMemo(() => {
    if (selectedClassIdOverride && classes.some((item) => item.id === selectedClassIdOverride)) {
      return selectedClassIdOverride;
    }
    if (classes.length === 0) return '';
    const fromUrl = searchParams.get('classId')?.trim();
    return fromUrl && classes.some((item) => item.id === fromUrl) ? fromUrl : classes[0].id;
  }, [classes, searchParams, selectedClassIdOverride]);

  const queueQuery = useLecturerTriageQueue(selectedClassId, queueTab);
  const isHistoryTab = queueTab === 'History';
  const escalateMutation = useEscalateTriageItem(selectedClassId);
  const rejectMutation = useRejectTriageAnswer(selectedClassId);
  const questions = useMemo(() => queueQuery.data ?? [], [queueQuery.data]);
  const loading = queueQuery.isFetching;
  const loadError = queueQuery.error
    ? getQueryErrorMessage(queueQuery.error, 'Failed to load triage queue.')
    : null;

  const [selectedQuestionIdOverride, setSelectedQuestionIdOverride] = useState<string | null>(null);
  const [escalateConfirmOpen, setEscalateConfirmOpen] = useState(false);
  const [pendingEscalationItem, setPendingEscalationItem] = useState<LectStudentQuestionDto | null>(null);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const escalateForm = useForm<TriageEscalationValues>({
    resolver: zodResolver(triageEscalationSchema),
    defaultValues: { specialtyId: '' },
  });
  const rejectForm = useForm<TriageRejectValues>({
    resolver: zodResolver(triageRejectSchema),
    defaultValues: { reason: '' },
  });

  const selectedQuestionId = useMemo(() => {
    if (selectedQuestionIdOverride && questions.some((item) => item.id === selectedQuestionIdOverride)) {
      return selectedQuestionIdOverride;
    }
    return questions[0]?.id ?? null;
  }, [questions, selectedQuestionIdOverride]);

  const selectedQuestion = useMemo(
    () => questions.find((item) => item.id === selectedQuestionId) ?? null,
    [questions, selectedQuestionId],
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const hasClassExpert = Boolean(selectedClass?.expertId?.trim());
  const selectedStudyImageSrc = useMemo(
    () => (selectedQuestion ? triageStudyImageSrc(selectedQuestion) : ''),
    [selectedQuestion],
  );
  const selectedTurn = useMemo(() => {
    if (!selectedQuestion?.turns || selectedQuestion.turns.length === 0) return null;
    return resolveSelectedTurn(selectedQuestion);
  }, [selectedQuestion]);
  const selectedPairMismatch = useMemo(
    () => hasSelectedPairMismatch(selectedQuestion),
    [selectedQuestion],
  );
  const selectedConfidence = confidencePercent(selectedQuestion?.aiConfidenceScore);
  const selectedScoreBadge = scoreLabel(selectedQuestion?.aiConfidenceScore);
  const selectedHistoryFeedback = useMemo(() => {
    if (!selectedQuestion) return null;
    const text = formatReviewFeedbackDisplay(selectedQuestion.reviewFeedback);
    if (!text) return null;
    const rejected = triageHistoryStatusLabel(selectedQuestion) === 'Rejected';
    return { text, rejected };
  }, [selectedQuestion]);
  const selectedSpecialtyId = useWatch({
    control: escalateForm.control,
    name: 'specialtyId',
  });
  const selectedSpecialtyName =
    selectedSpecialtyId && selectedSpecialtyId !== 'auto'
      ? specialtyById.get(selectedSpecialtyId)?.name ?? null
      : null;

  useEffect(() => {
    setSelectedQuestionIdOverride(null);
  }, [queueTab, selectedClassId]);

  useEffect(() => {
    if (!escalateConfirmOpen) {
      escalateForm.reset({ specialtyId: '' });
    }
  }, [escalateConfirmOpen, escalateForm]);

  useEffect(() => {
    if (!rejectConfirmOpen) {
      rejectForm.reset({ reason: '' });
    }
  }, [rejectConfirmOpen, rejectForm]);

  const handleEscalate = async (
    item: LectStudentQuestionDto,
    specialtyId?: string | null,
  ): Promise<boolean> => {
    if (hasSelectedPairMismatch(item)) {
      appToast.error('Selected pair mismatch detected. Refresh queue data and try again.');
      return false;
    }
    const targetId = resolveEscalationAnswerRowId(item);
    if (!targetId) {
      appToast.error('Cannot escalate: AI answer is missing or incomplete.');
      return false;
    }

    if (!hasClassExpert) {
      appToast.info(
        'No expert is assigned to this class. Escalation will still be sent if the server accepts it.',
      );
    }

    try {
      await escalateMutation.mutateAsync({
        questionId: item.id,
        body: {
          answerText:
            item.turns?.find((turn) => {
              const assistantId = turn.assistantMessageId?.trim();
              const selectedAssistantId = item.selectedAssistantMessageId?.trim();
              const requestedReviewMessageId = item.requestedReviewMessageId?.trim();
              if (selectedAssistantId && assistantId === selectedAssistantId) return true;
              if (requestedReviewMessageId && assistantId === requestedReviewMessageId) return true;
              return false;
            })?.answerText?.trim() ||
            item.answerText?.trim() ||
            '',
          approve: true,
          decision: 'approve_and_escalate',
          requestedReviewMessageId: item.requestedReviewMessageId ?? null,
          selectedUserMessageId: item.selectedUserMessageId ?? null,
          selectedAssistantMessageId: item.selectedAssistantMessageId ?? null,
          specialtyId: specialtyId?.trim() || null,
        },
      });
      if (selectedQuestionId === item.id) setSelectedQuestionIdOverride(null);
      appToast.success('Escalated to expert successfully.');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message === TRIAGE_ALREADY_ESCALATED ||
        message === WORKFLOW_CONFLICT ||
        (axios.isAxiosError(error) && error.response?.status === 409)
      ) {
        appToast.info('This case has already been escalated.');
        void queueQuery.refetch();
      } else {
        appToast.error(getApiErrorMessage(error));
      }
      return false;
    }
  };

  const openEscalateDialog = (item: LectStudentQuestionDto) => {
    setPendingEscalationItem(item);
    escalateForm.reset({ specialtyId: '' });
    setEscalateConfirmOpen(true);
  };

  const handleEscalateSubmit = escalateForm.handleSubmit(async (values) => {
    if (!pendingEscalationItem) return;
    const ok = await handleEscalate(
      pendingEscalationItem,
      values.specialtyId === 'auto' ? null : values.specialtyId,
    );
    if (ok) {
      setEscalateConfirmOpen(false);
      setPendingEscalationItem(null);
      escalateForm.reset({ specialtyId: '' });
    }
  });

  const openRejectDialog = () => {
    rejectForm.reset({ reason: '' });
    setRejectConfirmOpen(true);
  };

  const handleRejectSubmit = rejectForm.handleSubmit(async (values) => {
    if (!selectedQuestion) return;
    if (hasSelectedPairMismatch(selectedQuestion)) {
      rejectForm.setError('root', {
        message: 'Selected pair mismatch detected. Please reload queue data before rejecting.',
      });
      return;
    }

    const targetId = resolveEscalationAnswerRowId(selectedQuestion);
    if (!targetId) {
      rejectForm.setError('root', {
        message: 'Cannot reject: AI answer is missing or incomplete.',
      });
      return;
    }

    try {
      await rejectMutation.mutateAsync({ answerId: targetId, reason: values.reason.trim() });
      setRejectConfirmOpen(false);
      appToast.success('Answer rejected and feedback sent to student.');
    } catch (error) {
      rejectForm.setError('root', { message: getApiErrorMessage(error) });
    }
  });

  return (
    <ListPageLayout title="QA triage workbench" maxWidthClass="max-w-[1680px]">
      <div className="space-y-6 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.08),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))]">
        <div className={`${panelClass} p-5 lg:p-6`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Lecturer review orchestration
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Review the highest-risk AI answers in a clean clinical workbench.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Select a class, inspect the study image, compare the chosen Q/A pair, and route difficult cases into expert review with validated escalation notes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,300px)_auto] sm:items-end">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Teaching class
                </p>
                <Select value={selectedClassId} onValueChange={setSelectedClassIdOverride}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200/70 bg-white/90 shadow-sm">
                    <SelectValue placeholder="Choose class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        No classes found
                      </SelectItem>
                    ) : (
                      classes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.className} ({item.semester})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-slate-200/70 bg-white/90 px-4 shadow-sm hover:bg-slate-50"
                disabled={!selectedClassId || loading}
                title="Reload Visual QA triage queue"
                onClick={() => void queueQuery.refetch()}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh queue
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <MetricCard
            icon={Activity}
            label="Queue depth"
            value={String(questions.length)}
            hint="Requests currently waiting for lecturer action."
          />
          <MetricCard
            icon={ShieldCheck}
            label="Expert coverage"
            value={hasClassExpert ? 'Assigned' : 'Unassigned'}
            hint={
              hasClassExpert
                ? `Primary expert: ${selectedClass?.expertName?.trim() || 'Class expert configured'}`
                : 'Escalation still works, but routing quality improves after expert assignment.'
            }
          />
          <MetricCard
            icon={Stethoscope}
            label="Selected risk"
            value={
              selectedConfidence != null
                ? `${selectedConfidence}%`
                : selectedQuestion
                  ? 'Review needed'
                  : 'None selected'
            }
            hint="Confidence helps prioritize the cases most likely to need expert attention."
          />
        </div>

        {loading ? (
          <TriageWorkbenchSkeleton />
        ) : loadError ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
              <AlertCircle className="h-4 w-4" />
              {loadError}
            </div>
            <Button className="mt-4 rounded-2xl" onClick={() => void queueQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
            title={isHistoryTab ? 'No history yet' : 'All caught up!'}
            description={
              isHistoryTab
                ? 'Approved and rejected Visual QA requests will appear here.'
                : 'No Visual QA answers need lecturer triage right now.'
            }
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className={`${panelClass} min-h-[720px] p-4`}>
              <div className="mb-4 space-y-3 px-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {isHistoryTab ? 'Past decisions' : 'Incoming requests'}
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                      {questions.length} item{questions.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                    {selectedClass?.className ?? 'No class'}
                  </Badge>
                </div>
                <Tabs
                  value={queueTab}
                  onValueChange={(value) => setQueueTab(value as 'Pending' | 'History')}
                >
                  <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-100/90 p-1">
                    <TabsTrigger value="Pending" className="rounded-xl text-xs font-semibold">
                      Pending
                    </TabsTrigger>
                    <TabsTrigger value="History" className="rounded-xl text-xs font-semibold">
                      History
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="max-h-[74vh] space-y-3 overflow-y-auto pr-1">
                {questions.map((question) => {
                  const isSelected =
                    selectedQuestionId != null
                      ? selectedQuestionId === question.id
                      : selectedQuestion?.id === question.id;
                  const score = scoreLabel(question.aiConfidenceScore);
                  const caseLabel = formatTriageCaseLabel(question);
                  const submittedAt = formatTriageSubmittedAt(question);
                  const isCatalog = triageRequestKind(question) === 'case-catalog';
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setSelectedQuestionIdOverride(question.id)}
                      className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                        isSelected
                          ? 'border-primary/20 bg-primary/10 text-foreground shadow-[0_18px_36px_rgba(37,99,235,0.10)]'
                          : 'border-slate-200/70 bg-white/85 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-relaxed text-foreground">
                          {question.questionText}
                        </p>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${score.tone}`}
                        >
                          {score.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                          <User className="h-3 w-3" />
                          {question.studentName}
                        </span>
                        <Badge
                          variant="outline"
                          className={isCatalog ? caseCatalogBadgeClass() : adhocUploadBadgeClass()}
                        >
                          {triageWorkflowLabel(question)}
                        </Badge>
                        {caseLabel ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                            {caseLabel}
                          </span>
                        ) : null}
                        {isHistoryTab ? (
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                              triageHistoryStatusLabel(question) === 'Rejected'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {triageHistoryStatusLabel(question)}
                          </span>
                        ) : null}
                        {submittedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                            <Clock3 className="h-3 w-3" />
                            {submittedAt}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={`${panelClass} overflow-hidden`}>
              {!selectedQuestion ? null : (
                <>
                  <div className="border-b border-slate-200/70 bg-white/90 px-6 py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Selected request
                        </p>
                        <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                          {selectedQuestion.studentName}
                        </h3>
                        <p className="text-sm text-slate-500">{selectedQuestion.studentEmail}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge
                          variant="outline"
                          className={
                            triageRequestKind(selectedQuestion) === 'case-catalog'
                              ? caseCatalogBadgeClass()
                              : adhocUploadBadgeClass()
                          }
                        >
                          {triageWorkflowLabel(selectedQuestion)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`rounded-full border ${
                            isHistoryTab
                              ? triageHistoryStatusLabel(selectedQuestion) === 'Rejected'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          {isHistoryTab
                            ? triageHistoryStatusLabel(selectedQuestion)
                            : isEscalationBlockedByStatus(selectedQuestion)
                              ? 'Already escalated'
                              : 'Pending decision'}
                        </Badge>
                        <Badge className={`rounded-full border ${selectedScoreBadge.tone}`}>
                          {selectedConfidence != null
                            ? `AI confidence: ${selectedConfidence}%`
                            : 'AI confidence unavailable'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-6 py-6">
                    <div className={innerCardClass}>
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <span>Confidence profile</span>
                        <span className="font-mono text-slate-900">
                          {selectedConfidence != null ? `${selectedConfidence}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-in-out ${selectedScoreBadge.bar}`}
                          style={{
                            width: selectedConfidence != null ? `${selectedConfidence}%` : '12%',
                          }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        {selectedConfidence != null
                          ? 'Lower scores often warrant expert review before students rely on the answer.'
                          : 'The model did not return a confidence score for this answer. Escalate if clinical review is needed.'}
                      </p>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                      <article className={`${innerCardClass} overflow-hidden`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Study viewer
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              Inspect the student image and the routed turn ROI.
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                            {triageWorkflowLabel(selectedQuestion)}
                          </span>
                        </div>
                        {selectedStudyImageSrc ? (
                          <div className="relative mx-auto max-h-[min(460px,60vh)] w-full overflow-hidden rounded-[1.4rem] border border-slate-200/70 bg-slate-950">
                            <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-slate-900/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 backdrop-blur-md">
                              Imaging study
                            </div>
                            <div className="relative mx-auto w-fit">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={selectedStudyImageSrc}
                                alt={`Study image for ${selectedQuestion.studentName}`}
                                className="mx-auto max-h-[min(460px,60vh)] w-auto max-w-full object-contain"
                                loading="lazy"
                              />
                              <RectangleAnnotationOverlay
                                closed={resolvedTriageStudyRoi(selectedTurn, selectedQuestion)}
                                draft={null}
                                label="Turn ROI"
                                className="drop-shadow-[0_0_8px_rgba(239,68,68,0.45)]"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-[320px] items-center justify-center rounded-[1.4rem] border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                            No study preview available for this request.
                          </div>
                        )}
                      </article>

                      <div className="space-y-5">
                        <div className={innerCardClass}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Routing snapshot
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Student
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-900">
                                {selectedQuestion.studentName}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Submitted
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-900">
                                {formatTriageSubmittedAt(selectedQuestion) ?? 'Unknown'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {formatTriageCaseLabel(selectedQuestion) ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800">
                                {formatTriageCaseLabel(selectedQuestion)}
                              </span>
                            ) : null}
                            {triageRequestKind(selectedQuestion) === 'case-catalog' ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800">
                                {hasClassExpert ? 'Expert assigned' : 'Expert not assigned'}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <DicomMetadataSummary
                          metadata={selectedQuestion.dicomMetadata}
                          title="Study metadata"
                          description="Clinical imaging context extracted from the uploaded DICOM study."
                          emptyLabel="This request does not include DICOM metadata."
                        />
                      </div>
                    </div>

                    {selectedTurn ? (
                      <article className={innerCardClass}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Review target (single Q to A)
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          This is the pair the student submitted for lecturer review, not the full chat history.
                          {selectedQuestion.turns && selectedQuestion.turns.length > 1 ? (
                            <span className="block pt-1">
                              Session has {selectedQuestion.turns.length} turn(s); triage uses turn{' '}
                              <span className="font-mono">{selectedTurn.turnIndex}</span> only.
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Question
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-900">
                              {selectedTurn.questionText?.trim() || '—'}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Assistant answer
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-900">
                              {selectedTurn.answerText?.trim() || '—'}
                            </p>
                          </div>
                        </div>
                      </article>
                    ) : (
                      <article className={innerCardClass}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Review request (no per-turn data)
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          The API did not return turn history; showing the row-level question and answer only.
                        </p>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Question
                            </p>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {selectedQuestion.questionText}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Assistant answer
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-900">
                              {(selectedQuestion.answerText || '').trim() || 'No generated answer available.'}
                            </p>
                          </div>
                        </div>
                      </article>
                    )}

                    {selectedTurn &&
                    (selectedTurn.structuredDiagnosis?.trim() ||
                      selectedTurn.keyImagingFindings?.trim()) ? (
                      <article className={innerCardClass}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Structured assistant fields (selected turn)
                        </p>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          {selectedTurn.structuredDiagnosis?.trim() ? (
                            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Structured diagnosis
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-900">
                                {selectedTurn.structuredDiagnosis.trim()}
                              </p>
                            </div>
                          ) : null}
                          {selectedTurn.keyImagingFindings?.trim() ? (
                            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Key imaging findings
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-900">
                                {selectedTurn.keyImagingFindings.trim()}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ) : null}

                    {isHistoryTab && selectedHistoryFeedback ? (
                      <article
                        className={`${innerCardClass} ${
                          selectedHistoryFeedback.rejected
                            ? 'border-red-200 bg-red-50/90'
                            : 'border-emerald-200 bg-emerald-50/90'
                        }`}
                      >
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            selectedHistoryFeedback.rejected ? 'text-red-800' : 'text-emerald-800'
                          }`}
                        >
                          {selectedHistoryFeedback.rejected ? 'Rejection feedback' : 'Approval feedback'}
                        </p>
                        <p
                          className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${
                            selectedHistoryFeedback.rejected ? 'text-red-950' : 'text-emerald-950'
                          }`}
                        >
                          {selectedHistoryFeedback.text}
                        </p>
                      </article>
                    ) : null}

                    {selectedPairMismatch ? (
                      <article className="rounded-[1.35rem] border border-amber-200 bg-amber-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                          Selected pair mismatch
                        </p>
                        <p className="mt-2 text-sm text-amber-950">
                          The selected review message IDs no longer match this loaded turn after refresh. Reload queue data before rejecting or escalating.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 rounded-2xl border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100"
                          disabled={!selectedClassId || loading}
                          onClick={() => void queueQuery.refetch()}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                          Reload queue
                        </Button>
                      </article>
                    ) : null}
                  </div>

                  {!isHistoryTab ? (
                  <div className="flex flex-col gap-3 border-t border-slate-200/70 bg-white/95 px-6 pb-6 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <div className="mr-auto flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
                      <FileSearch className="h-3.5 w-3.5" />
                      Lecturer decision affects the student thread and expert queue.
                    </div>
                    <div className="relative z-20 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        disabled={selectedPairMismatch}
                        onClick={openRejectDialog}
                      >
                        Reject
                      </Button>
                      <span
                        className="inline-flex max-w-full cursor-default"
                        title={
                          escalateMutation.isPending
                            ? 'Sending escalation…'
                            : escalateButtonTitle(selectedQuestion, hasClassExpert)
                        }
                      >
                        <Button
                          type="button"
                          disabled={
                            escalateMutation.isPending ||
                            selectedPairMismatch ||
                            isEscalationBlockedByStatus(selectedQuestion) ||
                            !hasAnswerIdForEscalateUi(selectedQuestion)
                          }
                          isLoading={escalateMutation.isPending}
                          variant="primary"
                          className="pointer-events-auto rounded-2xl !border-red-700 !bg-red-600 px-5 font-semibold !text-white shadow-[0_12px_28px_rgba(220,38,38,0.24)] hover:!bg-red-700 focus-visible:!ring-red-500"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openEscalateDialog(selectedQuestion);
                          }}
                        >
                          <Send className="h-4 w-4" />
                          {isEscalationBlockedByStatus(selectedQuestion)
                            ? 'Escalated'
                            : 'Escalate to Expert'}
                        </Button>
                      </span>
                    </div>
                  </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <AlertDialog
        open={escalateConfirmOpen}
        onOpenChange={(open) => {
          setEscalateConfirmOpen(open);
          if (!open) {
            setPendingEscalationItem(null);
            escalateForm.reset({ specialtyId: '' });
          }
        }}
      >
        <AlertDialogContent className="max-w-lg rounded-[1.75rem] border-slate-200/70 bg-white/95 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
          <AlertDialogHeader className="border-b border-slate-200/70 px-6 py-5">
            <AlertDialogTitle>Escalate to expert?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a target specialty before routing this case to expert review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Form {...escalateForm}>
            <form onSubmit={handleEscalateSubmit} className="space-y-4 px-6 py-5">
              <FormField
                control={escalateForm.control}
                name="specialtyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Expert Specialty</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (escalateForm.formState.errors.specialtyId) {
                          escalateForm.clearErrors('specialtyId');
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="mt-2 h-12 rounded-2xl border-slate-200/70 bg-white shadow-sm">
                          <SelectValue placeholder="Choose specialty routing" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="auto">Auto-route / General expert pool</SelectItem>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty.id} value={specialty.id}>
                            {specialty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                {selectedSpecialtyId === 'auto'
                  ? 'Auto-route leaves the final expert assignment to backend routing rules.'
                  : selectedSpecialtyName
                    ? `Selected specialty: ${selectedSpecialtyName}`
                    : 'Choose a specialty or explicitly select Auto-route before escalating.'}
              </div>
              {specialtiesQuery.isFetching ? (
                <p className="text-xs text-slate-500">Loading specialty options…</p>
              ) : null}
              {pendingEscalationItem?.dicomMetadata ? (
                <DicomMetadataSummary
                  metadata={pendingEscalationItem.dicomMetadata}
                  title="Routing context"
                  description="Use the imaging metadata below to route this case to the best-fit specialist."
                  emptyLabel="No metadata available for specialty routing."
                  compact
                />
              ) : null}
              {escalateForm.formState.errors.root?.message ? (
                <p className="text-sm text-destructive">{escalateForm.formState.errors.root.message}</p>
              ) : null}
              <AlertDialogFooter className="px-0 pt-2">
                <AlertDialogCancel disabled={escalateMutation.isPending} className="rounded-2xl">
                  Cancel
                </AlertDialogCancel>
                <Button
                  type="submit"
                  disabled={escalateMutation.isPending}
                  className="rounded-2xl border-danger bg-danger text-white hover:bg-danger/90"
                >
                  {escalateMutation.isPending ? 'Escalating…' : 'Confirm escalation'}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={rejectConfirmOpen}
        onOpenChange={(open) => {
          setRejectConfirmOpen(open);
          if (!open) {
            rejectForm.reset({ reason: '' });
          }
        }}
      >
        <AlertDialogContent className="max-w-lg rounded-[1.75rem] border-slate-200/70 bg-white/95 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
          <AlertDialogHeader className="border-b border-slate-200/70 px-6 py-5">
            <AlertDialogTitle>Reject AI answer?</AlertDialogTitle>
            <AlertDialogDescription>
              The student will receive your rejection reason. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Form {...rejectForm}>
            <form onSubmit={handleRejectSubmit} className="space-y-4 px-6 py-5">
              <FormField
                control={rejectForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rejection reason</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={5}
                        className="rounded-2xl border-slate-200/70 bg-white shadow-sm"
                        placeholder="Explain why this AI response is clinically insufficient…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {rejectForm.formState.errors.root?.message ? (
                <p className="text-sm text-destructive">{rejectForm.formState.errors.root.message}</p>
              ) : null}
              <AlertDialogFooter className="px-0 pt-2">
                <AlertDialogCancel disabled={rejectMutation.isPending} className="rounded-2xl">
                  Cancel
                </AlertDialogCancel>
                <Button
                  type="submit"
                  disabled={rejectMutation.isPending}
                  className="rounded-2xl border-danger bg-danger text-white hover:bg-danger/90"
                >
                  {rejectMutation.isPending ? 'Rejecting…' : 'Confirm rejection'}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
    </ListPageLayout>
  );
}
