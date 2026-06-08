'use client';

import { AnnotationOverlay } from '@/components/shared/AnnotationOverlay';
import { markdownExternalLinkComponents } from '@/components/shared/markdownExternalLinks';
import { PolygonAnnotationOverlay } from '@/components/shared/PolygonAnnotationOverlay';
import { RectangleAnnotationOverlay } from '@/components/shared/RectangleAnnotationOverlay';
import { DicomMetadataSummary } from '@/components/shared/DicomMetadataSummary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MedicalImageViewer } from '@/components/student/MedicalImageViewer';
import type {
  ExpertReviewCitation,
  ExpertReviewItem,
  NormalizedImageBoundingBox,
  VisualQaReport,
} from '@/lib/api/types';
import type { ExpertCategory, ExpertTag } from '@/lib/api/expert-cases';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { isValidNormalizedBoundingBox } from '@/lib/utils/annotations';

function roiArrayToNormalizedBox(raw: number[] | undefined | null): NormalizedImageBoundingBox | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const nums = raw.slice(0, 4).map((n) => Number(n));
  if (!nums.every((n) => Number.isFinite(n))) return null;
  const scalePct = (n: number) => (n > 1 && n <= 100 ? n / 100 : n);
  const candidate: NormalizedImageBoundingBox = {
    x: scalePct(nums[0]),
    y: scalePct(nums[1]),
    width: scalePct(nums[2]),
    height: scalePct(nums[3]),
  };
  return isValidNormalizedBoundingBox(candidate) ? candidate : null;
}
import { withPageAnchor } from '@/components/student/VisualQaRichAnswer';
import { splitLearningBullets } from '@/lib/utils/learning-text';
import { getWorkflowStatusMeta, normalizeWorkflowStatus, type WorkflowStatusTone } from '@/lib/visual-qa-workflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Library,
  Link2,
  RefreshCw,
  Save,
  XCircle,
} from 'lucide-react';

function formatExpertAskedAt(raw: string): string {
  const d = new Date(raw);
  if (!raw?.trim() || Number.isNaN(d.getTime())) return raw?.trim() || '—';
  return d.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function workflowToneBadgeClass(tone: WorkflowStatusTone): string {
  switch (tone) {
    case 'success':
      return 'border border-slate-300 bg-emerald-100 font-semibold text-emerald-950 shadow-sm';
    case 'danger':
      return 'border border-slate-300 bg-red-100 font-semibold text-red-950 shadow-sm';
    case 'pending':
      return 'border border-slate-300 bg-amber-100 font-semibold text-amber-950 shadow-sm';
    default:
      return 'border border-slate-300 bg-slate-100 font-semibold text-slate-900 shadow-sm';
  }
}

function ExpertImagingOverlays({ item }: { item: ExpertReviewItem }) {
  if (item.customBoundingBox && isValidNormalizedBoundingBox(item.customBoundingBox)) {
    return (
      <RectangleAnnotationOverlay
        closed={item.customBoundingBox}
        draft={null}
        label="STUDENT ROI"
        className="drop-shadow-[0_0_12px_rgba(239,68,68,0.35)]"
      />
    );
  }
  if (item.customPolygon && item.customPolygon.length >= 3) {
    return (
      <PolygonAnnotationOverlay
        closed={item.customPolygon}
        draft={[]}
        label="STUDENT ROI"
        className="drop-shadow-[0_0_12px_rgba(239,68,68,0.35)]"
      />
    );
  }
  return (
    <AnnotationOverlay
      box={item.customCoordinates}
      label="STUDENT ROI"
      className="border-dashed border-cyan-accent text-cyan-accent shadow-[0_0_28px_rgba(0,229,255,0.3)]"
    />
  );
}

export function reflectiveQuestionsToEditText(
  report: VisualQaReport,
  itemFallback: string | null | undefined,
): string {
  const r = report.reflectiveQuestions;
  if (r != null) {
    if (Array.isArray(r)) {
      return r.map((x) => String(x).trim()).filter(Boolean).join('\n');
    }
    return String(r).trim();
  }
  return itemFallback?.trim() ?? '';
}

function isTerminal(status: string) {
  return getWorkflowStatusMeta(status).terminal;
}

function PromoteClinicalReadiness({
  clinicalDescription,
  mainDiagnosis,
  differential,
  keyImaging,
  reflective,
  references,
  studentQuestion,
}: {
  clinicalDescription: string;
  mainDiagnosis: string;
  differential: string;
  keyImaging: string;
  reflective: string;
  references: string;
  studentQuestion: string;
}) {
  const rows = [
    { label: 'Clinical description', ok: Boolean(clinicalDescription.trim()), required: true },
    { label: 'Student question', ok: Boolean(studentQuestion.trim()), required: true },
    { label: 'Suggested main diagnosis', ok: Boolean(mainDiagnosis.trim()), required: true },
    { label: 'Differential diagnoses', ok: Boolean(differential.trim()), required: true },
    { label: 'Key imaging findings', ok: Boolean(keyImaging.trim()), required: true },
    { label: 'Reflective questions', ok: Boolean(reflective.trim()), required: true },
    { label: 'References & citations', ok: Boolean(references.trim()), required: false },
  ];
  const allReady = rows.filter((row) => row.required).every((row) => row.ok);
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-xs ${
        allReady ? 'border-emerald-300 bg-white/80' : 'border-amber-300 bg-amber-50/80'
      }`}
    >
      <p className="font-semibold text-slate-900">
        {allReady
          ? 'Case content ready — sourced from Expert clinical override above.'
          : 'Complete the missing fields in Expert clinical override above before promoting.'}
      </p>
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-slate-800">
            {row.ok ? (
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
            )}
            {row.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidencePanel({
  citations,
  queueSummary,
}: {
  citations: ExpertReviewCitation[];
  /** Hàng từ dashboard pending: thường không có chunk đầy đủ tới khi queue chính tải. */
  queueSummary?: boolean;
}) {
  return (
    <section className="scrollbar-hide [&::-webkit-scrollbar]:hidden rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-900">RAG evidence & citations</h4>
          <p className="mt-1 text-sm font-medium text-slate-800">
            Review the exact evidence chunks the model used before approving this answer.
          </p>
        </div>
      </div>

      {citations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm font-medium text-slate-800 shadow-sm">
          {queueSummary
            ? 'No citations in this summary row. Refresh after the escalated queue loads, or open the session from the full review API.'
            : 'No evidence chunks were returned for this case.'}
        </div>
      ) : (
        <div className="scrollbar-hide max-h-[640px] space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden">
          {citations.map((citation, index) => (
            <article
              key={`${citation.chunkId}-${index}`}
              className={`rounded-xl border p-4 shadow-sm ${
                citation.flagged
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-slate-800 px-2 py-1 font-medium text-white">
                    Chunk {index + 1}
                  </span>
                  {citation.pageNumber != null ? (
                    <span className="rounded-md bg-slate-800 px-2 py-1 font-medium text-white">
                      Page {citation.pageNumber}
                    </span>
                  ) : null}
                  {citation.flagged ? (
                    <span className="rounded-md bg-red-700 px-2 py-1 font-medium text-white">Flagged</span>
                  ) : null}
                </div>

              <blockquote className="rounded-lg border-y border-r border-slate-200 border-l-4 border-l-blue-600 bg-slate-100 px-4 py-3 text-sm font-medium leading-relaxed text-slate-900 shadow-inner">
                {citation.sourceText}
              </blockquote>

              {citation.referenceUrl ? (
                <a
                  href={withPageAnchor(
                    citation.referenceUrl.replace(/#.*$/, ''),
                    citation.pageNumber != null && Number.isFinite(Number(citation.pageNumber))
                      ? Math.floor(Number(citation.pageNumber))
                      : undefined,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-950 shadow-sm underline decoration-blue-800 underline-offset-4 hover:bg-slate-50"
                >
                  <Link2 className="h-4 w-4 shrink-0" />
                  Open PDF
                  {citation.pageNumber != null ? ` (page ${citation.pageNumber})` : ''}
                </a>
              ) : (
                <p className="mt-3 text-xs font-medium text-slate-800">No reference URL was supplied for this chunk.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportSections({ report }: { report: VisualQaReport }) {
  const imagingLines = splitLearningBullets(report.keyImagingFindings ?? undefined);
  const differentialLines =
    report.differentialDiagnoses?.length > 0
      ? report.differentialDiagnoses
      : report.keyFindings;
  const reflectiveText = reflectiveQuestionsToEditText(report, null);
  const hasStructured =
    Boolean(report.suggestedDiagnosis?.trim()) ||
    differentialLines.length > 0 ||
    imagingLines.length > 0 ||
    Boolean(reflectiveText.trim());

  if (!hasStructured && report.answerText?.trim()) {
    return (
      <section>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">
          Suggested main diagnosis
        </h4>
        <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-900 shadow-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...markdownExternalLinkComponents }}>
            {report.answerText.trim()}
          </ReactMarkdown>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {report.suggestedDiagnosis ? (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">
            Suggested main diagnosis
          </h4>
          <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 shadow-sm">
            <p className="text-base font-semibold leading-relaxed text-slate-900">{report.suggestedDiagnosis}</p>
          </div>
        </section>
      ) : null}
      {differentialLines.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">
            Differential diagnoses
          </h4>
          <ul className="space-y-3 rounded-xl border border-slate-300 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm">
            {differentialLines.map((k, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <span>{k}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {imagingLines.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">Key imaging findings</h4>
          <ul className="space-y-2 rounded-xl border border-slate-300 bg-blue-50/80 px-4 py-4 text-sm font-medium text-slate-900 shadow-sm">
            {imagingLines.map((k, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                <span>{k}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {(() => {
        const rq = reflectiveQuestionsToEditText(report, null);
        return rq ? (
          <section className="rounded-xl border border-slate-300 bg-amber-50 px-4 py-4 shadow-sm">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">
              Reflective questions
            </h4>
            <div className="text-sm font-medium leading-relaxed text-slate-900">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...markdownExternalLinkComponents }}>
                {rq}
              </ReactMarkdown>
            </div>
          </section>
        ) : null;
      })()}
    </div>
  );
}

function ReportWorkbench({
  report,
  isEditing,
  lockFields,
  diag,
  keyText,
  keyImagingText,
  reflectiveText,
  onDiagChange,
  onKeyTextChange,
  onKeyImagingChange,
  onReflectiveChange,
  onBeginEdit,
}: {
  report: VisualQaReport;
  isEditing: boolean;
  lockFields?: boolean;
  diag: string;
  keyText: string;
  keyImagingText: string;
  reflectiveText: string;
  onDiagChange: (value: string) => void;
  onKeyTextChange: (value: string) => void;
  onKeyImagingChange: (value: string) => void;
  onReflectiveChange: (value: string) => void;
  onBeginEdit: () => void;
}) {
  if (!isEditing) {
    return <ReportSections report={report} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-900">Suggested main diagnosis</h4>
          <button
            type="button"
            onClick={onBeginEdit}
            disabled={lockFields}
            className="text-xs font-semibold text-slate-800 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Editing
          </button>
        </div>
        <textarea
          value={diag}
          onChange={(e) => onDiagChange(e.target.value)}
          rows={4}
          disabled={lockFields}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 placeholder:text-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </section>

      <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">
          Differential diagnoses
        </h4>
        <textarea
          value={keyText}
          onChange={(e) => onKeyTextChange(e.target.value)}
          rows={8}
          disabled={lockFields}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="One key finding per line"
        />
      </section>

      <section className="rounded-xl border border-slate-300 bg-blue-50/90 p-4 shadow-sm">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">Key imaging findings</h4>
        <p className="mb-2 text-xs font-medium text-slate-800">
          Radiology-focused teaching points. Use line breaks or semicolons for separate bullets.
        </p>
        <textarea
          value={keyImagingText}
          onChange={(e) => onKeyImagingChange(e.target.value)}
          rows={6}
          disabled={lockFields}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="e.g. Cortical thickening along the diaphysis..."
        />
      </section>

      <section className="rounded-xl border border-slate-300 bg-amber-50 p-4 shadow-sm">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-900">
          Reflective questions
        </h4>
        <p className="mb-2 text-xs font-medium text-slate-800">
          Prompts for learner self-assessment before you resolve this case.
        </p>
        <textarea
          value={reflectiveText}
          onChange={(e) => onReflectiveChange(e.target.value)}
          rows={5}
          disabled={lockFields}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="What features would you look for on the next view?"
        />
      </section>
    </div>
  );
}

export type ExpertReviewWorkspaceProps = {
  item: ExpertReviewItem;
  pairMismatch: boolean;
  loading: boolean;
  onReloadQueue: () => void;
  isEditing: boolean;
  diag: string;
  keyText: string;
  keyImagingEdit: string;
  reflectiveEdit: string;
  onDiagChange: (v: string) => void;
  onKeyTextChange: (v: string) => void;
  onKeyImagingChange: (v: string) => void;
  onReflectiveChange: (v: string) => void;
  roiClearEpoch?: number;
  initialCorrectedRoiBoundingBox?: number[];
  onOpenEdit: () => void;
  onSaveDraft: (
    correctedRoiBoundingBox?: number[] | null,
    options?: { silent?: boolean },
  ) => void;
  onApproveAndPromote: (correctedRoiBoundingBox?: number[] | null) => void;
  onRejectRequest: () => void;
  saving: boolean;
  /** Trường bắt buộc trước khi đưa case vào thư viện công khai. */
  libraryTitle: string;
  libraryCategoryId: string;
  libraryDifficulty: string;
  libraryTagIds: string[];
  libraryAnatomySite?: string;
  libraryModality?: string;
  libraryClinicalDescription: string;
  categories: ExpertCategory[];
  tags: ExpertTag[];
  studentQuestion: string;
  mainDiagnosis: string;
  differentialText: string;
  referencesText: string;
  onLibraryTitleChange: (v: string) => void;
  onLibraryCategoryIdChange: (v: string) => void;
  onLibraryDifficultyChange: (v: string) => void;
  onLibraryTagIdsChange: (v: string[]) => void;
  onLibraryClinicalDescriptionChange: (v: string) => void;
};

export function ExpertReviewWorkspace({
  item,
  pairMismatch,
  loading,
  onReloadQueue,
  isEditing,
  diag,
  keyText,
  keyImagingEdit,
  reflectiveEdit,
  onDiagChange,
  onKeyTextChange,
  onKeyImagingChange,
  onReflectiveChange,
  roiClearEpoch,
  initialCorrectedRoiBoundingBox,
  onOpenEdit,
  onSaveDraft,
  onApproveAndPromote,
  onRejectRequest,
  saving,
  libraryTitle,
  libraryCategoryId,
  libraryDifficulty,
  libraryTagIds,
  libraryAnatomySite,
  libraryModality,
  libraryClinicalDescription,
  categories,
  tags,
  studentQuestion,
  mainDiagnosis,
  differentialText,
  referencesText,
  onLibraryTitleChange,
  onLibraryCategoryIdChange,
  onLibraryDifficultyChange,
  onLibraryTagIdsChange,
  onLibraryClinicalDescriptionChange,
}: ExpertReviewWorkspaceProps) {
  const [correctedRoi, setCorrectedRoi] = useState<NormalizedImageBoundingBox | null>(() =>
    roiArrayToNormalizedBox(initialCorrectedRoiBoundingBox),
  );

  useEffect(() => {
    setCorrectedRoi(roiArrayToNormalizedBox(initialCorrectedRoiBoundingBox));
  }, [item.sessionId, initialCorrectedRoiBoundingBox, roiClearEpoch]);

  const toggleLibraryTag = (tagId: string) => {
    const next = libraryTagIds.includes(tagId)
      ? libraryTagIds.filter((id) => id !== tagId)
      : [...libraryTagIds, tagId];
    onLibraryTagIdsChange(next);
  };

  const tagsByType = tags.reduce<Record<string, ExpertTag[]>>((acc, tag) => {
    const type = tag.type?.trim() || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(tag);
    return acc;
  }, {});

  useEffect(() => {
    if (pairMismatch || saving) return;
    const sid = item.sessionId;
    const hasRoi = correctedRoi !== null && isValidNormalizedBoundingBox(correctedRoi);
    if (!hasRoi) return;
    const timer = window.setTimeout(() => {
      const roiPayload =
        correctedRoi !== null && isValidNormalizedBoundingBox(correctedRoi)
          ? [correctedRoi.x, correctedRoi.y, correctedRoi.width, correctedRoi.height]
          : undefined;
      onSaveDraft(roiPayload ?? null, { silent: true });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [correctedRoi, item.sessionId, onSaveDraft, pairMismatch, saving]);

  const statusMeta = getWorkflowStatusMeta(item.status);
  const catalogCase = item.caseId != null && String(item.caseId).trim() !== '';
  const resolvedImageSrc = item.imageUrl ? resolveApiAssetUrl(item.imageUrl) : null;
  const rectRoi =
    item.customBoundingBox && isValidNormalizedBoundingBox(item.customBoundingBox)
      ? item.customBoundingBox
      : null;
  const useLegacyExpertOverlays = !rectRoi;

  return (
    <div className="border-t border-border px-4 py-6 sm:px-6">
      {pairMismatch ? (
        <div className="mb-4 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold text-slate-950">Selected pair mismatch</p>
          <p className="mt-1 font-medium leading-relaxed text-slate-900">
            Review message IDs do not match the loaded session turns. Refresh the queue before saving, approving, or
            promoting.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-amber-600/50 bg-white font-semibold text-slate-900 hover:bg-amber-100"
            disabled={loading}
            onClick={() => void onReloadQueue()}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Reload queue
          </Button>
        </div>
      ) : null}

      <Card className="mb-5 border-border/50 bg-white/90 shadow-sm backdrop-blur-md">
        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.22em]">
              Expert review request
            </CardDescription>
            <CardTitle className="text-xl">{item.studentName}</CardTitle>
            {item.className?.trim() ? (
              <p className="text-sm text-muted-foreground">{item.className.trim()}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border border-slate-300 bg-slate-100 font-semibold text-slate-900 shadow-sm"
            >
              {formatExpertAskedAt(item.askedAt)}
            </Badge>
            {normalizeWorkflowStatus(item.status) !== 'EscalatedToExpert' ? (
              <Badge variant="outline" className={workflowToneBadgeClass(statusMeta.tone)}>
                {statusMeta.label}
              </Badge>
            ) : null}
            {item.queueSource === 'dashboard-summary' ? (
              <Badge
                variant="outline"
                title="Loaded from dashboard pending list; imaging and citations may be incomplete until the escalated queue returns this session."
                className="border border-slate-300 bg-amber-100 font-semibold text-amber-950 shadow-sm"
              >
                Summary row
              </Badge>
            ) : null}
            {catalogCase ? (
              <Badge variant="outline" className="border-sky-200 bg-sky-50 font-medium text-sky-950">
                Case chat
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 font-medium text-amber-950">
                Personal Upload
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:gap-5">
        <Card className="overflow-hidden border-border/50 shadow-sm shadow-black/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Medical imaging</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[500px] overflow-hidden rounded-xl border border-border/50 bg-slate-50 shadow-sm">
              {resolvedImageSrc ? (
                <MedicalImageViewer
                  key={`${item.sessionId}:${roiClearEpoch ?? 0}`}
                  src={resolvedImageSrc}
                  alt="Study radiograph"
                  readOnly={pairMismatch}
                  compact
                  initialAnnotation={correctedRoi ?? rectRoi}
                  onAnnotationComplete={setCorrectedRoi}
                  extraOverlay={
                    useLegacyExpertOverlays ? <ExpertImagingOverlays item={item} /> : null
                  }
                />
              ) : (
                <div className="flex min-h-[280px] items-center justify-center bg-slate-50 px-4 text-sm text-muted-foreground">
                  No image available for this request.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <DicomMetadataSummary
          metadata={item.dicomMetadata}
          title="DICOM metadata"
          description="Use modality, anatomy, and acquisition context before approving or publishing."
          emptyLabel="No DICOM metadata was returned for this escalated review."
        />
      </div>

      <div className="mt-6 space-y-4">
        <EvidencePanel
          citations={item.citations ?? []}
          queueSummary={item.queueSource === 'dashboard-summary'}
        />

        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Student question</CardTitle>
            <CardDescription className="text-xs">Original escalation from the learner</CardDescription>
          </CardHeader>
          <CardContent className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium leading-relaxed text-foreground">
            {item.question}
          </CardContent>
        </Card>

        <Card className="border-amber-200/60 bg-amber-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Expert clinical override</CardTitle>
            <CardDescription className="text-xs">
              Refine structured diagnosis, imaging findings, and reflective prompts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportWorkbench
              report={item.report}
              isEditing={isEditing}
              lockFields={pairMismatch}
              diag={diag}
              keyText={keyText}
              keyImagingText={keyImagingEdit}
              reflectiveText={reflectiveEdit}
              onDiagChange={onDiagChange}
              onKeyTextChange={onKeyTextChange}
              onKeyImagingChange={onKeyImagingChange}
              onReflectiveChange={onReflectiveChange}
              onBeginEdit={onOpenEdit}
            />
          </CardContent>
        </Card>
      </div>

      {!isTerminal(item.status) ? (
        <Card className="mt-6 border-emerald-200 bg-emerald-50/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-950">Publish to student library</CardTitle>
            <CardDescription className="text-xs text-emerald-900/90">
              Library metadata only. Case content (diagnosis, differential, imaging, reflection) is taken from{' '}
              <strong>Expert clinical override</strong> above — prefilled from the AI answer when you open a review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PromoteClinicalReadiness
              clinicalDescription={libraryClinicalDescription}
              mainDiagnosis={mainDiagnosis}
              differential={differentialText}
              keyImaging={keyImagingEdit}
              reflective={reflectiveEdit}
              references={referencesText}
              studentQuestion={studentQuestion}
            />
            <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-800">Anatomy site</span>
              <input
                type="text"
                value={libraryAnatomySite ?? ''}
                disabled
                placeholder="Auto-filled from DICOM metadata"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm opacity-80"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-800">Modality</span>
              <input
                type="text"
                value={libraryModality ?? ''}
                disabled
                placeholder="Auto-filled from DICOM metadata"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm opacity-80"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-800">Title <span className="text-red-600">*</span></span>
              <input
                type="text"
                value={libraryTitle}
                onChange={(e) => onLibraryTitleChange(e.target.value)}
                disabled={pairMismatch}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-800">
                Clinical description <span className="text-red-600">*</span>
              </span>
              <textarea
                value={libraryClinicalDescription}
                onChange={(e) => onLibraryClinicalDescriptionChange(e.target.value)}
                disabled={pairMismatch}
                rows={4}
                placeholder="Summary for learners — clinical context, presentation, and teaching focus"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-800">Category <span className="text-red-600">*</span></span>
              <select
                value={libraryCategoryId}
                onChange={(e) => onLibraryCategoryIdChange(e.target.value)}
                disabled={pairMismatch}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-800">Difficulty <span className="text-red-600">*</span></span>
              <select
                value={libraryDifficulty}
                onChange={(e) => onLibraryDifficultyChange(e.target.value)}
                disabled={pairMismatch}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-800">Student question</span>
              <textarea
                value={studentQuestion}
                disabled
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm opacity-80"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-800">
                Tags <span className="text-red-600">*</span>
              </span>
              {tags.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                  No tags loaded from the database.
                </p>
              ) : (
                <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
                  {Object.entries(tagsByType).map(([type, group]) => (
                    <div key={type}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {type}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.map((tag) => {
                          const selected = libraryTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              disabled={pairMismatch}
                              onClick={() => toggleLibraryTag(tag.id)}
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                selected
                                  ? 'border-emerald-700 bg-emerald-100 text-emerald-950'
                                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </label>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isTerminal(item.status) && (
        <div className="sticky bottom-0 z-10 mt-8 border-t border-border bg-card p-4 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-[min(520px,92vw)] items-start gap-2 text-sm font-semibold text-slate-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
              <span className="leading-snug">
                Approved responses are pushed to the public student reference library.
              </span>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                type="button"
                variant="default"
                disabled={saving || pairMismatch}
                onClick={() =>
                  onSaveDraft(
                    correctedRoi && isValidNormalizedBoundingBox(correctedRoi)
                      ? [correctedRoi.x, correctedRoi.y, correctedRoi.width, correctedRoi.height]
                      : undefined,
                  )
                }
              >
                <Save className="h-4 w-4" />
                Save draft
              </Button>
              <Button
                type="button"
                disabled={saving || pairMismatch}
                className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() =>
                  onApproveAndPromote(
                    correctedRoi && isValidNormalizedBoundingBox(correctedRoi)
                      ? [correctedRoi.x, correctedRoi.y, correctedRoi.width, correctedRoi.height]
                      : undefined,
                  )
                }
              >
                <Library className="h-4 w-4" />
                Approve &amp; Promote to Library
              </Button>
              <Button type="button" variant="destructive" disabled={saving || pairMismatch} onClick={onRejectRequest}>
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
