'use client';

import { useMemo } from 'react';
import { BookOpen, GraduationCap, SearchCheck, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownExternalLinkComponents } from '@/components/shared/markdownExternalLinks';
import type { VisualQaCitation } from '@/lib/api/types';
import {
  dedupeNarrativeAgainstClinicalFields,
  mergeDiagnosisForDisplay,
  shouldSuppressLeakedMedicalJsonMarkdown,
} from '@/components/student/VisualQaRichAnswer';
import { WorkspaceRagSources } from '@/features/visual-qa/components/WorkspaceRagSources';
import type { EducatorFeedbackEntry } from '@/lib/student/educator-feedback';
import { cn } from '@/lib/utils';

export type WorkspaceAnswerVariant = 'full' | 'catalog';

export type WorkspaceStructuredAnswerProps = {
  markdown?: string;
  diagnosis?: string | null;
  structuredDiagnosis?: string | null;
  findings?: string[];
  keyImagingFindings?: string | null;
  differentialDiagnoses?: string[];
  reflectiveQuestions?: string[];
  citations?: VisualQaCitation[];
  /** Lecturer / expert review entries — shown in the educator section only. */
  educatorFeedbackEntries?: EducatorFeedbackEntry[];
  variant?: WorkspaceAnswerVariant;
  className?: string;
};

function splitStructuredLines(value?: string | null): string[] {
  return String(value ?? '')
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueLines(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripEducatorDuplicateText(
  narrative: string | undefined,
  educatorEntries: EducatorFeedbackEntry[],
): string {
  let body = narrative?.trim() ?? '';
  if (!body || educatorEntries.length === 0) return body;
  for (const entry of educatorEntries) {
    const feedback = entry.content.trim();
    if (!feedback) continue;
    if (body === feedback) return '';
    if (body.includes(feedback)) {
      body = body.replace(feedback, '').trim();
    }
  }
  return body;
}

type StructuredSectionCardProps = {
  step: string;
  title: string;
  toneClass: string;
  icon: LucideIcon;
  items: string[];
};

function StructuredSectionCard({
  step,
  title,
  toneClass,
  icon: Icon,
  items,
}: StructuredSectionCardProps) {
  if (items.length === 0) return null;
  return (
    <section className={cn('rounded-xl border px-4 py-3 shadow-sm', toneClass)}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-current/20 bg-white/80 px-2 text-[10px] font-bold uppercase tracking-wide">
          {step}
        </span>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {title}
        </p>
      </div>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm font-medium leading-relaxed text-slate-900">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function WorkspaceStructuredAnswer({
  markdown,
  diagnosis,
  structuredDiagnosis,
  findings = [],
  keyImagingFindings,
  differentialDiagnoses = [],
  reflectiveQuestions = [],
  citations = [],
  educatorFeedbackEntries = [],
  variant = 'full',
  className,
}: WorkspaceStructuredAnswerProps) {
  const isCatalog = variant === 'catalog';

  const displayDiagnosis = useMemo(
    () => mergeDiagnosisForDisplay(diagnosis, structuredDiagnosis),
    [diagnosis, structuredDiagnosis],
  );

  const narrativeMarkdown = dedupeNarrativeAgainstClinicalFields(
    stripEducatorDuplicateText(markdown, educatorFeedbackEntries),
    displayDiagnosis || null,
    findings,
    differentialDiagnoses,
  );

  const showNarrative =
    Boolean(narrativeMarkdown?.trim()) &&
    !shouldSuppressLeakedMedicalJsonMarkdown(narrativeMarkdown);

  const keyImagingSigns = useMemo(
    () =>
      uniqueLines([
        ...splitStructuredLines(keyImagingFindings),
        ...findings.map((item) => item?.trim() ?? ''),
      ]),
    [findings, keyImagingFindings],
  );
  const diagnosisText =
    displayDiagnosis || 'The AI did not provide a structured main diagnosis for this turn.';

  if (isCatalog) {
    return (
      <div
        className={cn(
          'vqa-ai-voice-panel space-y-3 rounded-[1.2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]',
          className,
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Case library Q&amp;A</p>
            <p className="text-xs text-slate-500">Concise AI guidance using the teaching case context.</p>
          </div>
        </div>

        {displayDiagnosis ? (
          <section className="rounded-[1.1rem] border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Suggested focus</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-950">{displayDiagnosis}</p>
          </section>
        ) : null}

        {showNarrative ? (
          <div className="rounded-[1.1rem] border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-950 break-words [&_a]:break-all">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownExternalLinkComponents}>
              {narrativeMarkdown}
            </ReactMarkdown>
          </div>
        ) : null}

        {citations.length > 0 ? (
          <div className="rounded-[1.1rem] border border-emerald-200/70 bg-emerald-50/70 px-3 py-3 shadow-sm">
            <WorkspaceRagSources citations={citations} className="mt-0 border-t-0 pt-0" defaultExpanded />
          </div>
        ) : null}

        {educatorFeedbackEntries.length > 0 ? (
          <EducatorFeedbackSection entries={educatorFeedbackEntries} />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'vqa-ai-voice-panel space-y-3 rounded-[1.2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Educational answer structure
          </p>
          <p className="text-xs text-slate-500">
            Diagnosis, differential, imaging signs, reflection, sources, then educator feedback.
          </p>
        </div>
      </div>

      <section className="rounded-[1.1rem] border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 text-[10px] font-bold uppercase tracking-wide text-primary">
            01
          </span>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Suggested main diagnosis
          </p>
        </div>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-950">{diagnosisText}</p>
      </section>

      <div className="space-y-3">
        <StructuredSectionCard
          step="02"
          title="Important differential diagnoses"
          toneClass="border-amber-300/80 bg-amber-50/80 text-amber-950"
          icon={TriangleAlert}
          items={uniqueLines(differentialDiagnoses)}
        />
        <StructuredSectionCard
          step="03"
          title="Key imaging signs to focus on"
          toneClass="border-sky-300/80 bg-sky-50/80 text-sky-950"
          icon={SearchCheck}
          items={keyImagingSigns}
        />
        <StructuredSectionCard
          step="04"
          title="Reflective questions for self-assessment"
          toneClass="border-violet-300/80 bg-violet-50/80 text-violet-950"
          icon={BookOpen}
          items={uniqueLines(reflectiveQuestions)}
        />
      </div>

      {citations.length > 0 ? (
        <div className="rounded-[1.1rem] border border-emerald-200/70 bg-emerald-50/70 px-3 py-3 shadow-sm">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-950">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-emerald-300/70 bg-white/80 px-2 text-[10px]">
              05
            </span>
            References & citations
          </p>
          <WorkspaceRagSources citations={citations} className="mt-0 border-t-0 pt-0" defaultExpanded />
        </div>
      ) : null}

      {educatorFeedbackEntries.length > 0 ? (
        <EducatorFeedbackSection entries={educatorFeedbackEntries} />
      ) : null}
    </div>
  );
}

function EducatorFeedbackSection({ entries }: { entries: EducatorFeedbackEntry[] }) {
  return (
    <section className="rounded-[1.1rem] border border-indigo-200/90 bg-indigo-50/80 px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-indigo-800" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-950">Educator feedback</p>
      </div>
      <p className="mb-3 text-[11px] text-indigo-900/80">
        Responses from your lecturer or clinical expert on this question.
      </p>
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div
            key={`${entry.role}-${index}`}
            className="rounded-lg border border-indigo-200/70 bg-white/70 px-3 py-2.5"
          >
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-800">
              {entry.role === 'expert' ? 'Clinical expert' : 'Lecturer'}
            </p>
            <div className="text-sm leading-relaxed text-indigo-950 break-words [&_a]:break-all">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownExternalLinkComponents}>
                {entry.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
