import { inferCaseLibraryOrigin, type CaseLibraryOrigin } from '@/lib/case-origin';
import { normalizeMedicalCaseDifficultyTier } from '@/lib/medical-case-difficulty';
import { http, getApiErrorMessage } from './client';

export interface ExpertDashboardStats {
  totalCases: number;
  totalReviews: number;
  pendingReviews: number;
  approvedThisMonth: number;
  studentInteractions: number;
}

export interface ExpertPendingReview {
  id: string;
  studentName: string;
  caseTitle: string;
  caseId?: string | null;
  questionSnippet: string;
  aiAnswerSnippet: string;
  submittedAt: string;
  priority: 'high' | 'normal' | 'low';
  category: string;
}

export interface ExpertRecentCase {
  id: string;
  title: string;
  boneLocation: string;
  lesionType: string;
  difficulty: 'easy' | 'medium' | 'hard';
  /** @deprecated Prefer `caseOrigin`. */
  status: 'approved' | 'pending' | 'draft';
  caseOrigin: CaseLibraryOrigin;
  addedBy: string;
  addedDate: string;
  viewCount: number;
  usageCount: number;
  thumbnailUrl?: string | null;
}

export interface ExpertDailyActivity {
  day: string;
  reviews: number;
  cases: number;
}

export interface ExpertActivity {
  weeklyActivity: ExpertDailyActivity[];
  avgDailyReviews: number;
}

function mapPriority(raw: unknown): 'high' | 'normal' | 'low' {
  const val = String(raw ?? '').toLowerCase();
  if (val === 'high') return 'high';
  if (val === 'low') return 'low';
  return 'normal';
}

function mapDifficulty(raw: unknown): 'easy' | 'medium' | 'hard' {
  return normalizeMedicalCaseDifficultyTier(raw) ?? 'easy';
}

function pickDisplayStr(value: unknown, fallback: string): string {
  const s = value != null ? String(value).trim() : '';
  return s || fallback;
}

function mapRecentCaseStatus(item: Record<string, unknown>): ExpertRecentCase['status'] {
  const s = String(item.status ?? item.Status ?? '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'pending') return 'pending';
  if (s === 'draft') return 'draft';
  if (s === 'rejected') return 'draft';
  if (Boolean(item.isApproved ?? item.IsApproved)) return 'approved';
  if (Boolean(item.isActive ?? item.IsActive)) return 'pending';
  return 'draft';
}

function mapPendingReview(row: unknown): ExpertPendingReview | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const id = String(item.id ?? '');
  if (!id) return null;

  const caseIdRaw = item.caseId ?? item.CaseId;
  const caseId =
    caseIdRaw != null && String(caseIdRaw).trim() !== '' ? String(caseIdRaw).trim() : null;

  return {
    id,
    studentName: String(item.studentName ?? 'Unknown'),
    caseTitle: String(item.caseTitle ?? 'Unknown Case'),
    caseId,
    questionSnippet: String(item.questionSnippet ?? ''),
    aiAnswerSnippet: String(item.aiAnswerSnippet ?? ''),
    submittedAt: String(item.submittedAt ?? item.submittedAt ?? ''),
    priority: mapPriority(item.priority),
    category: String(item.category ?? 'General'),
  };
}

function pickRecentCaseThumbnailUrl(item: Record<string, unknown>): string | null {
  const direct =
    item.thumbnailUrl ??
    item.ThumbnailUrl ??
    item.coverImageUrl ??
    item.CoverImageUrl ??
    item.previewImageUrl;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const flatImg = item.imageUrl ?? item.ImageUrl;
  if (typeof flatImg === 'string' && flatImg.trim()) return flatImg.trim();
  const raw = item.medicalImages ?? item.MedicalImages;
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === 'object') {
    const m0 = raw[0] as Record<string, unknown>;
    const u = m0.imageUrl ?? m0.ImageUrl ?? m0.url ?? m0.Url;
    if (typeof u === 'string' && u.trim()) return u.trim();
  }
  return null;
}

function mapRecentCase(row: unknown): ExpertRecentCase | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const id = String(item.id ?? item.Id ?? '');
  if (!id) return null;

  const boneLocation = pickDisplayStr(
    item.boneLocation ?? item.BoneLocation ?? item.anatomicalRegion ?? item.AnatomicalRegion,
    '—',
  );
  const addedBy = pickDisplayStr(
    item.expertName ?? item.ExpertName ?? item.addedBy ?? item.AddedBy,
    '—',
  );
  const addedRaw = String(
    item.addedDate ?? item.AddedDate ?? item.createdAt ?? item.created_at ?? item.CreatedAt ?? '',
  ).trim();

  const thumbnailUrl = pickRecentCaseThumbnailUrl(item);

  return {
    id,
    title: pickDisplayStr(item.title ?? item.Title, 'Untitled'),
    boneLocation,
    lesionType: pickDisplayStr(
      item.categoryName ?? item.category_name ?? item.CategoryName ?? item.lesionType ?? item.LesionType,
      '—',
    ),
    difficulty: mapDifficulty(item.difficulty ?? item.Difficulty),
    status: mapRecentCaseStatus(item),
    caseOrigin: inferCaseLibraryOrigin(item),
    addedBy,
    addedDate: addedRaw,
    viewCount: Number(item.viewCount ?? item.ViewCount ?? 0),
    usageCount: Number(item.usageCount ?? item.UsageCount ?? 0),
    thumbnailUrl,
  };
}

function mapDailyActivity(row: unknown): ExpertDailyActivity | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  return {
    day: String(item.day ?? ''),
    reviews: Number(item.reviews ?? 0),
    cases: Number(item.cases ?? 0),
  };
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const b = data as Record<string, unknown>;
  if (Array.isArray(b.items)) return b.items;
  if (Array.isArray(b.data)) return b.data;
  if (Array.isArray(b.results)) return b.results;
  const res = b.result;
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    if (Array.isArray(r.items)) return r.items;
    if (Array.isArray(r.data)) return r.data;
  }
  return [];
}

export async function fetchExpertDashboardStats(): Promise<ExpertDashboardStats> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/stats', { skipApiToast: true });
    if (data && typeof data === 'object' && 'result' in data && (data as { result: unknown }).result) {
      return (data as { result: ExpertDashboardStats }).result;
    }
    return data as ExpertDashboardStats;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertPendingReviews(): Promise<ExpertPendingReview[]> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/pending-reviews');
    return unwrapList(data)
      .map(mapPendingReview)
      .filter((item): item is ExpertPendingReview => item !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
export async function fetchExpertRecentCases(params?: { pageIndex?: number; pageSize?: number }): Promise<ExpertRecentCase[]> {
  const pageIndex = params?.pageIndex ?? 1;
  const pageSize = params?.pageSize ?? 50; // Increased default page size to show more cases
  try {
    const { data } = await http.get<unknown>(`/api/expert/dashboard/recent-cases?pageIndex=${pageIndex}&pageSize=${pageSize}`, {
      skipApiToast: true,
    });
    return unwrapList(data)
      .map(mapRecentCase)
      .filter((item): item is ExpertRecentCase => item !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}


export async function fetchExpertActivity(): Promise<ExpertActivity> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/activity', { skipApiToast: true });
    const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const nested =
      body.result && typeof body.result === 'object' ? (body.result as Record<string, unknown>) : null;
    const weeklyRaw = Array.isArray(body.weeklyActivity)
      ? body.weeklyActivity
      : nested && Array.isArray(nested.weeklyActivity)
        ? nested.weeklyActivity
        : [];
    const avgRaw = body.avgDailyReviews ?? nested?.avgDailyReviews ?? 0;
    return {
      weeklyActivity: weeklyRaw
        .map(mapDailyActivity)
        .filter((a): a is ExpertDailyActivity => a !== null),
      avgDailyReviews: Number(avgRaw ?? 0),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export const EXPERT_DASHBOARD_QUERY_KEY = ['expert-dashboard'] as const;

export type ExpertDashboardBundle = {
  stats: ExpertDashboardStats;
  pendingReviews: ExpertPendingReview[];
  recentCases: ExpertRecentCase[];
  activity: ExpertActivity;
};

export async function fetchExpertDashboardBundle(): Promise<ExpertDashboardBundle> {
  const [stats, pendingReviews, recentCases, activity] = await Promise.all([
    fetchExpertDashboardStats(),
    fetchExpertPendingReviews(),
    fetchExpertRecentCases(),
    fetchExpertActivity(),
  ]);
  return { stats, pendingReviews, recentCases, activity };
}

export interface ExpertPerformanceMetrics {
  avgReviewTimeMinutes: number;
  approvalRate: number;
  qualityScore: number;
  avgStudentScore: number;
  expertRanking: number;
  totalReviewsThisMonth: number;
  humanOverrideCount: number;
  humanOverrideRate: number;
}

export interface WeekComparison {
  currentPeriodReviews: number;
  previousPeriodReviews: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MonthlyDataPoint {
  month: string;
  reviews: number;
  cases: number;
}

export interface MonthTrend {
  dataPoints: MonthlyDataPoint[];
  average: number;
  growthRate: number;
}

export interface ExpertComparativeAnalytics {
  weekOverWeek: WeekComparison;
  monthOverMonth: WeekComparison;
  monthlyTrend: MonthTrend;
}

export interface ExpertAiConfidenceInsights {
  lowConfidenceCount: number;
  avgAiConfidence: number;
  totalAiAssistedAnswers: number;
  highConfidenceCount: number;
}

export interface CategoryMetric {
  category: string;
  reviewCount: number;
  avgReviewTimeMinutes: number;
  percentage: number;
}

export interface ExpertCategoryBreakdown {
  boneLocationBreakdown: CategoryMetric[];
  lesionTypeBreakdown: CategoryMetric[];
}

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'normal' | 'low';
  type: 'review' | 'confidence';
}

export interface ExpertQuickActions {
  urgentReviews: QuickActionItem[];
  lowConfidenceItems: QuickActionItem[];
  totalActionableItems: number;
}

export async function fetchExpertPerformanceMetrics(): Promise<ExpertPerformanceMetrics> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/performance-metrics', { skipApiToast: true });
    if (data && typeof data === 'object' && 'result' in data) {
      return (data as { result: ExpertPerformanceMetrics }).result;
    }
    return data as ExpertPerformanceMetrics;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertComparativeAnalytics(): Promise<ExpertComparativeAnalytics> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/comparative-analytics', { skipApiToast: true });
    if (data && typeof data === 'object' && 'result' in data) {
      return (data as { result: ExpertComparativeAnalytics }).result;
    }
    return data as ExpertComparativeAnalytics;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertAiConfidenceInsights(): Promise<ExpertAiConfidenceInsights> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/ai-confidence-insights', { skipApiToast: true });
    if (data && typeof data === 'object' && 'result' in data) {
      return (data as { result: ExpertAiConfidenceInsights }).result;
    }
    return data as ExpertAiConfidenceInsights;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertCategoryBreakdown(): Promise<ExpertCategoryBreakdown> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/category-breakdown', { skipApiToast: true });
    if (data && typeof data === 'object' && 'result' in data) {
      return (data as { result: ExpertCategoryBreakdown }).result;
    }
    return data as ExpertCategoryBreakdown;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertQuickActions(): Promise<ExpertQuickActions> {
  try {
    const { data } = await http.get<unknown>('/api/expert/dashboard/quick-actions', { skipApiToast: true });
    if (data && typeof data === 'object' && 'result' in data) {
      return (data as { result: ExpertQuickActions }).result;
    }
    return data as ExpertQuickActions;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export type ExpertDashboardFullBundle = ExpertDashboardBundle & {
  performanceMetrics: ExpertPerformanceMetrics;
  comparativeAnalytics: ExpertComparativeAnalytics;
  aiConfidenceInsights: ExpertAiConfidenceInsights;
};

export async function fetchExpertDashboardFullBundle(): Promise<ExpertDashboardFullBundle> {
  const [bundle, performanceMetrics, comparativeAnalytics, aiConfidenceInsights] = await Promise.all([
    fetchExpertDashboardBundle(),
    fetchExpertPerformanceMetrics(),
    fetchExpertComparativeAnalytics(),
    fetchExpertAiConfidenceInsights(),
  ]);
  return {
    ...bundle,
    performanceMetrics,
    comparativeAnalytics,
    aiConfidenceInsights,
  };
}
