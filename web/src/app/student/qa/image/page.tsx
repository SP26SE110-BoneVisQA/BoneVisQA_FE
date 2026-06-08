import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return value?.trim() ?? '';
}

/**
 * Legacy Visual QA image route → unified workspace.
 * Maps old query names (`catalogCaseId`, `historySessionId`, …) to workspace params.
 */
export default async function LegacyStudentQaImageRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();

  const caseId =
    firstParam(raw.caseId) ||
    firstParam(raw.catalogCaseId) ||
    firstParam(raw.catalogCaseID);
  if (caseId) {
    params.set('caseId', caseId);
    params.set('flow', 'catalog');
  }

  const sessionId =
    firstParam(raw.sessionId) ||
    firstParam(raw.historySessionId);
  if (sessionId) {
    params.set('sessionId', sessionId);
    if (!params.has('flow')) {
      params.set('flow', firstParam(raw.flow) || 'personal');
    }
  }

  const imageId =
    firstParam(raw.imageId) ||
    firstParam(raw.catalogImageId) ||
    firstParam(raw.catalogImageID);
  if (imageId) params.set('imageId', imageId);

  const flow = firstParam(raw.flow);
  if (flow === 'catalog' || flow === 'personal') {
    params.set('flow', flow);
  }

  const qs = params.toString();
  const isCaseStudy = params.has('caseId') || params.get('flow') === 'catalog';
  const base = isCaseStudy ? '/student/visual-qa/case-workspace' : '/student/visual-qa/workspace';
  if (isCaseStudy) params.delete('flow');
  const nextQs = params.toString();
  redirect(nextQs ? `${base}?${nextQs}` : base);
}
