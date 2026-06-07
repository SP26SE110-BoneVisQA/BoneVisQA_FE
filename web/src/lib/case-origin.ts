/** How a teaching case entered the library (expert UI + student catalog). */
export type CaseLibraryOrigin = 'expertCreated' | 'fromStudentRequest';

export function inferCaseLibraryOrigin(item: Record<string, unknown>): CaseLibraryOrigin {
  const raw =
    String(
      item.caseOrigin ??
        item.CaseOrigin ??
        item.origin ??
        item.Origin ??
        item.source ??
        item.Source ??
        item.caseSource ??
        item.CaseSource ??
        item.libraryCaseSource ??
        '',
    ).toLowerCase() ?? '';
  const promoted =
    item.isPromotedFromStudentRequest === true ||
    item.promotedFromStudentRequest === true ||
    item.wasPromotedFromStudent === true ||
    item.fromStudentRequest === true ||
    item.IsPromotedFromStudentRequest === true ||
    item.promotedFromReview === true ||
    item.PromotedFromReview === true;
  if (
    promoted ||
    raw.includes('community') ||
    raw.includes('studentrequest') ||
    raw.includes('student_request') ||
    raw.includes('promoted') ||
    raw.includes('request') ||
    raw.includes('fromstudent')
  ) {
    return 'fromStudentRequest';
  }
  return 'expertCreated';
}

export function caseOriginLabel(origin: CaseLibraryOrigin): string {
  return origin === 'fromStudentRequest' ? 'From student request' : 'Created by expert';
}
