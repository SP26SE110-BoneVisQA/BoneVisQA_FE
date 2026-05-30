'use client';

import { useMemo } from 'react';
import { BookOpen, SearchCheck, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export type WorkspaceStructuredAnswerProps = {
  markdown?: string;
  diagnosis?: string | null;
  structuredDiagnosis?: string | null;
  findings?: string[];
  keyImagingFindings?: string | null;
  differentialDiagnoses?: string[];
  reflectiveQuestions?: string[];
  citations?: VisualQaCitation[];
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
  className,
}: WorkspaceStructuredAnswerProps) {
  const displayDiagnosis = useMemo(
    () => mergeDiagnosisForDisplay(diagnosis, structuredDiagnosis),
    [diagnosis, structuredDiagnosis],
  );

  const narrativeMarkdown = dedupeNarrativeAgainstClinicalFields(
    markdown,
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
            Diagnosis, differential, imaging signs, reflection, and supporting sources.
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
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-950">
          {diagnosisText}
        </p>
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

      {showNarrative ? (
          <div className="rounded-[1.1rem] border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-950 break-words [&_a]:break-all">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
            Teaching explanation
          </p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownExternalLinkComponents}>
            {narrativeMarkdown}
          </ReactMarkdown>
        </div>
      ) : null}

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
    </div>
  );
}
