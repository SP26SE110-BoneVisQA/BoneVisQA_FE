import { http, getApiErrorMessage } from './client';
import type { LecturerDashboardStats, LecturerLeaderboardEntry } from './types';

function optStr(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function optDateStr(v: unknown): string | undefined {
  const s = optStr(v);
  if (!s) return undefined;
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export async function fetchLecturerDashboardStats(): Promise<LecturerDashboardStats> {
  try {
    const { data } = await http.get<LecturerDashboardStats>('/api/lecturer/dashboard/stats');
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function mapLeaderboardEntry(row: unknown): LecturerLeaderboardEntry | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const studentName = String(item.studentName ?? item.fullName ?? '');
  if (!studentName) return null;

  const entry: LecturerLeaderboardEntry = {
    studentName,
    totalCasesViewed: Number(item.totalCasesViewed ?? 0),
    totalQuestionsAsked: Number(item.totalQuestionsAsked ?? 0),
    averageQuizScore: Number(item.averageQuizScore ?? 0),
  };
  if (item.studentId != null && String(item.studentId).trim() !== '') {
    entry.studentId = String(item.studentId);
  }
  return entry;
}

export async function fetchLecturerClassLeaderboard(
  classId: string,
): Promise<LecturerLeaderboardEntry[]> {
  try {
    const { data } = await http.get<unknown>('/api/lecturer/monitoring/class-leaderboard', {
      params: { classId },
    });
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? (data as { items?: unknown[] }).items ?? []
        : [];
    return list.map(mapLeaderboardEntry).filter((item): item is NonNullable<typeof item> => item !== null);
  } catch {
    return [];
  }
}

// ── Lecturer Analytics ─────────────────────────────────────────────────────────

export interface LecturerAnalyticsData {
  classPerformance: Array<{
    classId: string;
    className: string;
    semester: string;
    studentCount: number;
    totalCasesViewed: number;
    avgQuizScore: number | null;
    completionRate: number;
    trendPercent: number;
    totalQuestions: number;
    escalatedCount: number;
  }>;
  topicScores: Array<{
    topic: string;
    avgScore: number;
    attempts: number;
    commonErrors: string[];
  }>;
  topStudents: LecturerLeaderboardEntry[];
  bottomStudents: LecturerLeaderboardEntry[];
}

function mapClassPerfRow(item: unknown): LecturerAnalyticsData['classPerformance'][0] {
  const o = item as Record<string, unknown>;
  return {
    classId: String(o.classId ?? o.ClassId ?? ''),
    className: String(o.className ?? o.ClassName ?? ''),
    semester: String(o.semester ?? o.Semester ?? ''),
    studentCount: Number(o.studentCount ?? o.StudentCount ?? 0),
    totalCasesViewed: Number(o.totalCasesViewed ?? o.TotalCasesViewed ?? 0),
    avgQuizScore: (() => { const v = o.avgQuizScore ?? o.AvgQuizScore; return typeof v === 'number' ? v : null; })(),
    completionRate: Number(o.completionRate ?? o.CompletionRate ?? 0),
    trendPercent: Number(o.trendPercent ?? o.TrendPercent ?? 0),
    totalQuestions: Number(o.totalQuestions ?? o.TotalQuestions ?? 0),
    escalatedCount: Number(o.escalatedCount ?? o.EscalatedCount ?? 0),
  };
}

function mapTopicRow(item: unknown): LecturerAnalyticsData['topicScores'][0] {
  const o = item as Record<string, unknown>;
  const avgScore = Number(o.avgScore ?? o.AvgScore ?? 0);
  const attempts = Number(o.attempts ?? o.Attempts ?? 0);
  return {
    topic: String(o.topic ?? o.Topic ?? ''),
    avgScore: isNaN(avgScore) ? 0 : avgScore,
    attempts: isNaN(attempts) ? 0 : attempts,
    commonErrors: Array.isArray(o.commonErrors ?? o.CommonErrors)
      ? (o.commonErrors as unknown[]).map(String)
      : [],
  };
}

export async function fetchLecturerAnalytics(): Promise<LecturerAnalyticsData> {
  try {
    const { data } = await http.get<unknown>('/api/lecturer/dashboard/analytics');
    const r = data as Record<string, unknown>;
    return {
      classPerformance: Array.isArray(r.classPerformance ?? r.ClassPerformance)
        ? (r.classPerformance as unknown[]).map(mapClassPerfRow)
        : [],
      topicScores: Array.isArray(r.topicScores ?? r.TopicScores)
        ? (r.topicScores as unknown[]).map(mapTopicRow)
        : [],
      topStudents: Array.isArray(r.topStudents ?? r.TopStudents)
        ? (r.topStudents as unknown[]).map(mapLeaderboardEntry).filter((x): x is NonNullable<typeof x> => x !== null)
        : [],
      bottomStudents: Array.isArray(r.bottomStudents ?? r.BottomStudents)
        ? (r.bottomStudents as unknown[]).map(mapLeaderboardEntry).filter((x): x is NonNullable<typeof x> => x !== null)
        : [],
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ── Lecturer Profile ──────────────────────────────────────────────────────────

export interface LecturerProfile {
  id: string;
  fullName: string;
  email: string;
  department?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  roles: string[];
  dateOfBirth?: string;
  phoneNumber?: string;
  gender?: string;
  studentSchoolId?: string;
  classCode?: string;
  address?: string;
  bio?: string;
  emergencyContact?: string;
  // Preferences
  notifyNewStudent: boolean;
  notifyQuizComplete: boolean;
  notifyNewQuestion: boolean;
}

export interface UpdateLecturerProfilePayload {
  fullName: string;
  department?: string;
  avatarUrl?: string;
  dateOfBirth?: string | null;
  phoneNumber?: string;
  gender?: string;
  studentSchoolId?: string;
  classCode?: string;
  address?: string;
  bio?: string;
  emergencyContact?: string;
  notifyNewStudent: boolean;
  notifyQuizComplete: boolean;
  notifyNewQuestion: boolean;
}

function mapLecturerProfile(raw: Record<string, unknown>): LecturerProfile {
  return {
    id: String(raw.id ?? ''),
    fullName: String(raw.fullName ?? ''),
    email: String(raw.email ?? ''),
    department: optStr(raw.department),
    avatarUrl: optStr(raw.avatarUrl),
    isActive: Boolean(raw.isActive ?? true),
    createdAt: optStr(raw.createdAt),
    updatedAt: optStr(raw.updatedAt),
    lastLogin: optStr(raw.lastLogin),
    roles: Array.isArray(raw.roles) ? (raw.roles as unknown[]).map(String) : [],
    dateOfBirth: optDateStr(raw.dateOfBirth),
    phoneNumber: optStr(raw.phoneNumber),
    gender: optStr(raw.gender),
    studentSchoolId: optStr(raw.studentSchoolId),
    classCode: optStr(raw.classCode),
    address: optStr(raw.address),
    bio: optStr(raw.bio),
    emergencyContact: optStr(raw.emergencyContact),
    notifyNewStudent: Boolean(raw.notifyNewStudent ?? true),
    notifyQuizComplete: Boolean(raw.notifyQuizComplete ?? true),
    notifyNewQuestion: Boolean(raw.notifyNewQuestion ?? false),
  };
}

export async function fetchLecturerProfile(): Promise<LecturerProfile> {
  try {
    const { data } = await http.get<unknown>('/api/lecturer/profile');
    return mapLecturerProfile(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateLecturerProfile(
  payload: UpdateLecturerProfilePayload,
): Promise<LecturerProfile> {
  try {
    const { data } = await http.put<unknown>('/api/lecturer/profile', payload);
    return mapLecturerProfile(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ── Expert Profile ───────────────────────────────────────────────────────────

export interface ExpertProfile {
  id: string;
  fullName: string;
  email: string;
  specialty?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  roles: string[];
  dateOfBirth?: string;
  phoneNumber?: string;
  gender?: string;
  studentSchoolId?: string;
  classCode?: string;
  address?: string;
  bio?: string;
  emergencyContact?: string;
  autoApproveThreshold: number;
  notifyNewQA: boolean;
  notifyFlagged: boolean;
  notifyQuizComplete: boolean;
}

export interface UpdateExpertProfilePayload {
  fullName: string;
  specialty?: string;
  avatarUrl?: string;
  dateOfBirth?: string | null;
  phoneNumber?: string;
  gender?: string;
  studentSchoolId?: string;
  classCode?: string;
  address?: string;
  bio?: string;
  emergencyContact?: string;
  autoApproveThreshold: number;
  notifyNewQA: boolean;
  notifyFlagged: boolean;
  notifyQuizComplete: boolean;
}

function mapExpertProfile(raw: Record<string, unknown>): ExpertProfile {
  const rolesFromActive =
    raw.activeRole != null && String(raw.activeRole).trim()
      ? [String(raw.activeRole)]
      : [];
  const rolesList = Array.isArray(raw.roles) ? (raw.roles as unknown[]).map(String) : rolesFromActive;
  return {
    id: String(raw.id ?? raw.userId ?? ''),
    fullName: String(raw.fullName ?? ''),
    email: String(raw.email ?? ''),
    specialty: optStr(raw.specialty),
    avatarUrl: optStr(raw.avatarUrl),
    isActive: Boolean(raw.isActive ?? true),
    createdAt: optStr(raw.createdAt),
    updatedAt: optStr(raw.updatedAt),
    lastLogin: optStr(raw.lastLogin),
    roles: rolesList.length > 0 ? rolesList : ['Expert'],
    dateOfBirth: optDateStr(raw.dateOfBirth),
    phoneNumber: optStr(raw.phoneNumber),
    gender: optStr(raw.gender),
    studentSchoolId: optStr(raw.studentSchoolId),
    classCode: optStr(raw.classCode ?? raw.schoolCohort),
    address: optStr(raw.address),
    bio: optStr(raw.bio),
    emergencyContact: optStr(raw.emergencyContact),
    autoApproveThreshold: Number(raw.autoApproveThreshold ?? 90),
    notifyNewQA: Boolean(raw.notifyNewQA ?? true),
    notifyFlagged: Boolean(raw.notifyFlagged ?? true),
    notifyQuizComplete: Boolean(raw.notifyQuizComplete ?? false),
  };
}

/** Canonical profile — `GET /api/profile`. */
export async function fetchExpertProfile(): Promise<ExpertProfile> {
  try {
    const { data } = await http.get<unknown>('/api/profile');
    return mapExpertProfile(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/** Canonical profile update — `PUT /api/profile` (expert-only prefs kept client-side if BE omits them). */
export async function updateExpertProfile(
  payload: UpdateExpertProfilePayload,
): Promise<ExpertProfile> {
  try {
    const { data } = await http.put<unknown>('/api/profile', {
      fullName: payload.fullName,
      schoolCohort: payload.classCode?.trim() || null,
      phoneNumber: payload.phoneNumber?.trim() || null,
      bio: payload.bio?.trim() || null,
      address: payload.address?.trim() || null,
    });
    const mapped = mapExpertProfile(data as Record<string, unknown>);
    return {
      ...mapped,
      fullName: payload.fullName || mapped.fullName,
      specialty: payload.specialty ?? mapped.specialty,
      avatarUrl: payload.avatarUrl ?? mapped.avatarUrl,
      dateOfBirth: payload.dateOfBirth ?? mapped.dateOfBirth,
      phoneNumber: payload.phoneNumber ?? mapped.phoneNumber,
      gender: payload.gender ?? mapped.gender,
      studentSchoolId: payload.studentSchoolId ?? mapped.studentSchoolId,
      classCode: payload.classCode ?? mapped.classCode,
      address: payload.address ?? mapped.address,
      bio: payload.bio ?? mapped.bio,
      emergencyContact: payload.emergencyContact ?? mapped.emergencyContact,
      autoApproveThreshold: payload.autoApproveThreshold,
      notifyNewQA: payload.notifyNewQA,
      notifyFlagged: payload.notifyFlagged,
      notifyQuizComplete: payload.notifyQuizComplete,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ── Admin Profile ─────────────────────────────────────────────────────────────

export interface AdminProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  roles: string[];
  dateOfBirth?: string;
  phoneNumber?: string;
  gender?: string;
  studentSchoolId?: string;
  classCode?: string;
  address?: string;
  bio?: string;
  emergencyContact?: string;
}

export interface UpdateAdminProfilePayload {
  fullName: string;
  avatarUrl?: string;
  dateOfBirth?: string | null;
  phoneNumber?: string;
  gender?: string;
  studentSchoolId?: string;
  classCode?: string;
  address?: string;
  bio?: string;
  emergencyContact?: string;
}

function mapAdminProfile(raw: Record<string, unknown>): AdminProfile {
  return {
    id: String(raw.id ?? ''),
    fullName: String(raw.fullName ?? ''),
    email: String(raw.email ?? ''),
    avatarUrl: optStr(raw.avatarUrl),
    isActive: Boolean(raw.isActive ?? true),
    createdAt: optStr(raw.createdAt),
    updatedAt: optStr(raw.updatedAt),
    lastLogin: optStr(raw.lastLogin),
    roles: Array.isArray(raw.roles) ? (raw.roles as unknown[]).map(String) : [],
    dateOfBirth: optDateStr(raw.dateOfBirth),
    phoneNumber: optStr(raw.phoneNumber),
    gender: optStr(raw.gender),
    studentSchoolId: optStr(raw.studentSchoolId),
    classCode: optStr(raw.classCode),
    address: optStr(raw.address),
    bio: optStr(raw.bio),
    emergencyContact: optStr(raw.emergencyContact),
  };
}

export async function fetchAdminProfile(): Promise<AdminProfile> {
  try {
    const { data } = await http.get<unknown>('/api/admin/profile');
    return mapAdminProfile(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateAdminProfile(
  payload: UpdateAdminProfilePayload,
): Promise<AdminProfile> {
  try {
    const { data } = await http.put<unknown>('/api/admin/profile', payload);
    return mapAdminProfile(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export { fetchLecturerTriageList } from './lecturer-triage';

// ── Teaching Objectives ─────────────────────────────────────────────────────────

export interface TeachingObjectiveItem {
  id: string;
  topic: string;
  objective: string;
  level: string;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeachingObjectivesDto {
  classId: string;
  className?: string;
  lecturerId: string;
  lecturerName?: string;
  expertId?: string;
  expertName?: string;
  objectives: TeachingObjectiveItem[];
  totalObjectives: number;
  activeObjectives: number;
  lastUpdated?: string;
}

export interface TeachingObjectiveSuggestionDto {
  id: string;
  classId: string;
  className?: string;
  expertId: string;
  expertName?: string;
  topic: string;
  objective: string;
  level: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface UpdateTeachingObjectivesRequestDto {
  objectives: TeachingObjectiveItem[];
  replaceAll: boolean;
}

export interface ConfirmSuggestionRequestDto {
  suggestionId: string;
  approve: boolean;
  rejectionReason?: string;
  order?: number;
}

export async function fetchTeachingObjectives(classId?: string): Promise<TeachingObjectivesDto> {
  try {
    const url = classId
      ? `/api/lecturer/classes/${classId}/objectives`
      : '/api/lecturer/class/objectives';
    const { data } = await http.get<unknown>(url);
    return mapTeachingObjectives(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateTeachingObjectives(
  classId: string,
  request: UpdateTeachingObjectivesRequestDto
): Promise<TeachingObjectivesDto> {
  try {
    const { data } = await http.put<unknown>(`/api/lecturer/classes/${classId}/objectives`, request);
    return mapTeachingObjectives(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertSuggestions(classId: string): Promise<TeachingObjectiveSuggestionDto[]> {
  try {
    const { data } = await http.get<unknown[]>(`/api/lecturer/classes/${classId}/objectives/suggestions`);
    return (data as unknown[]).map((item) => mapSuggestion(item as Record<string, unknown>));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function confirmSuggestion(
  classId: string,
  suggestionId: string,
  request: ConfirmSuggestionRequestDto
): Promise<TeachingObjectiveSuggestionDto> {
  try {
    const { data } = await http.post<unknown>(
      `/api/lecturer/classes/${classId}/objectives/suggestions/${suggestionId}/confirm`,
      request
    );
    return mapSuggestion(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function mapTeachingObjectives(raw: Record<string, unknown>): TeachingObjectivesDto {
  const objectives = Array.isArray(raw.objectives ?? raw.Objectives)
    ? (raw.objectives as unknown[]).map(mapObjectiveItem)
    : [];
  return {
    classId: String(raw.classId ?? raw.ClassId ?? ''),
    className: optStr(raw.className ?? raw.ClassName),
    lecturerId: String(raw.lecturerId ?? raw.LecturerId ?? ''),
    lecturerName: optStr(raw.lecturerName ?? raw.LecturerName),
    expertId: raw.expertId ? String(raw.expertId) : undefined,
    expertName: optStr(raw.expertName ?? raw.ExpertName),
    objectives,
    totalObjectives: Number(raw.totalObjectives ?? raw.TotalObjectives ?? objectives.length),
    activeObjectives: Number(raw.activeObjectives ?? raw.ActiveObjectives ?? objectives.filter((o: TeachingObjectiveItem) => o.isActive).length),
    lastUpdated: optStr(raw.lastUpdated ?? raw.LastUpdated),
  };
}

function mapObjectiveItem(raw: unknown): TeachingObjectiveItem {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? o.Id ?? ''),
    topic: String(o.topic ?? o.Topic ?? ''),
    objective: String(o.objective ?? o.Objective ?? ''),
    level: String(o.level ?? o.Level ?? 'Basic'),
    order: Number(o.order ?? o.Order ?? 0),
    isActive: Boolean(o.isActive ?? o.IsActive ?? true),
    createdAt: optStr(o.createdAt ?? o.CreatedAt),
    updatedAt: optStr(o.updatedAt ?? o.UpdatedAt),
  };
}

function mapSuggestion(raw: Record<string, unknown>): TeachingObjectiveSuggestionDto {
  return {
    id: String(raw.id ?? ''),
    classId: String(raw.classId ?? raw.ClassId ?? ''),
    className: optStr(raw.className ?? raw.ClassName),
    expertId: String(raw.expertId ?? raw.ExpertId ?? ''),
    expertName: optStr(raw.expertName ?? raw.ExpertName),
    topic: String(raw.topic ?? raw.Topic ?? ''),
    objective: String(raw.objective ?? raw.Objective ?? ''),
    level: String(raw.level ?? raw.Level ?? 'Basic'),
    status: String(raw.status ?? raw.Status ?? 'Pending'),
    rejectionReason: optStr(raw.rejectionReason ?? raw.RejectionReason),
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ''),
    reviewedAt: optStr(raw.reviewedAt ?? raw.ReviewedAt),
  };
}

// ── Student Progress ────────────────────────────────────────────────────────────

export interface StudentProgressSummaryDto {
  classId: string;
  className?: string;
  totalStudents: number;
  activeStudents: number;
  students: StudentProgressItemDto[];
  overview: {
    classAverageScore: number;
    classAverageProgress: number;
    totalQuizzes: number;
    totalCases: number;
    quizCompletionRate: number;
    caseCompletionRate: number;
    calculatedAt: string;
  };
}

export interface StudentProgressItemDto {
  studentId: string;
  studentName?: string;
  email?: string;
  avatarUrl?: string;
  averageScore: number;
  quizzesCompleted: number;
  totalQuizzes: number;
  casesViewed: number;
  totalCases: number;
  overallProgress: number;
  progressStatus: string;
  competencies: CompetencyScoreDto[];
  lastActivity?: string;
}

export interface StudentProgressDetailDto {
  studentId: string;
  studentName?: string;
  email?: string;
  classId: string;
  enrolledAt: string;
  lastActivity?: string;
  quizProgress: QuizProgressDetailDto;
  caseProgress: CaseProgressDetailDto;
  competencyDetail: CompetencyDetailDto;
  recentActivities: RecentActivityDto[];
}

export interface QuizProgressDetailDto {
  totalQuizzes: number;
  completedQuizzes: number;
  pendingQuizzes: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  quizScores: QuizScoreItemDto[];
}

export interface QuizScoreItemDto {
  quizId: string;
  quizTitle?: string;
  topic?: string;
  score: number;
  maxScore: number;
  percentage: number;
  completedAt?: string;
  isPassed: boolean;
}

export interface CaseProgressDetailDto {
  totalAssignedCases: number;
  viewedCases: number;
  completedCases: number;
  completionRate: number;
  recentCases: CaseViewItemDto[];
}

export interface CaseViewItemDto {
  caseId: string;
  caseTitle?: string;
  caseImageUrl?: string;
  viewedAt?: string;
  viewCount: number;
  isCompleted: boolean;
}

export interface CompetencyDetailDto {
  overallCompetency: number;
  competencies: CompetencyScoreDto[];
  topicMasteries: TopicMasteryDto[];
  history: CompetencyHistoryDto[];
}

export interface CompetencyScoreDto {
  competencyId: string;
  competencyName?: string;
  score: number;
  maxScore: number;
  percentage: number;
  level: string;
  iconUrl?: string;
}

export interface ClassCompetencyOverviewDto {
  classId: string;
  className?: string;
  totalStudents: number;
  averageCompetency: number;
  classCompetencies: CompetencyScoreDto[];
  topicMasteries: TopicMasteryDto[];
  competencyDistribution: CompetencyDistributionDto[];
  weakTopics: WeakTopicDto[];
  strongTopics: StrongTopicDto[];
}

export interface TopicMasteryDto {
  topicId: string;
  topicName?: string;
  category?: string;
  masteryScore: number;
  maxScore: number;
  masteryPercentage: number;
  masteryLevel: string;
  studentsAssessed: number;
  classAverage: number;
}

export interface CompetencyDistributionDto {
  level: string;
  studentCount: number;
  percentage: number;
}

export interface WeakTopicDto {
  topicName: string;
  averageScore: number;
  studentsNeedingHelp: number;
  recommendation: string;
}

export interface StrongTopicDto {
  topicName: string;
  averageScore: number;
  studentsMastered: number;
}

export interface RecentActivityDto {
  activityId: string;
  activityType: string;
  type?: string;
  description?: string;
  timestamp: string;
  score?: number;
}

export async function fetchStudentProgressSummary(classId: string): Promise<StudentProgressSummaryDto> {
  try {
    const { data } = await http.get<unknown>(`/api/lecturer/dashboard/classes/${classId}/student-progress`);
    return mapStudentProgressSummary(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchStudentProgressDetail(
  classId: string,
  studentId: string
): Promise<StudentProgressDetailDto> {
  try {
    const { data } = await http.get<unknown>(
      `/api/lecturer/dashboard/classes/${classId}/students/${studentId}/progress`
    );
    return mapStudentProgressDetail(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchClassCompetencyOverview(classId: string): Promise<ClassCompetencyOverviewDto> {
  try {
    const { data } = await http.get<unknown>(`/api/lecturer/dashboard/classes/${classId}/competency-overview`);
    return mapCompetencyOverview(data as Record<string, unknown>);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchClassTopicsMastery(classId: string): Promise<TopicMasteryDto[]> {
  try {
    const { data } = await http.get<unknown[]>(`/api/lecturer/dashboard/classes/${classId}/topics-mastery`);
    return (data as unknown[]).map(mapTopicMastery);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function mapStudentProgressSummary(raw: Record<string, unknown>): StudentProgressSummaryDto {
  const overview = raw.overview ?? raw.Overview ?? {};
  const o = overview as Record<string, unknown>;
  return {
    classId: String(raw.classId ?? raw.ClassId ?? ''),
    className: optStr(raw.className ?? raw.ClassName),
    totalStudents: Number(raw.totalStudents ?? raw.TotalStudents ?? 0),
    activeStudents: Number(raw.activeStudents ?? raw.ActiveStudents ?? 0),
    students: Array.isArray(raw.students ?? raw.Students)
      ? (raw.students as unknown[]).map(mapStudentProgressItem)
      : [],
    overview: {
      classAverageScore: Number(o.classAverageScore ?? o.ClassAverageScore ?? 0),
      classAverageProgress: Number(o.classAverageProgress ?? o.ClassAverageProgress ?? 0),
      totalQuizzes: Number(o.totalQuizzes ?? o.TotalQuizzes ?? 0),
      totalCases: Number(o.totalCases ?? o.TotalCases ?? 0),
      quizCompletionRate: Number(o.quizCompletionRate ?? o.QuizCompletionRate ?? 0),
      caseCompletionRate: Number(o.caseCompletionRate ?? o.CaseCompletionRate ?? 0),
      calculatedAt: String(o.calculatedAt ?? o.CalculatedAt ?? new Date().toISOString()),
    },
  };
}

function mapStudentProgressItem(raw: unknown): StudentProgressItemDto {
  const o = raw as Record<string, unknown>;
  return {
    studentId: String(o.studentId ?? o.StudentId ?? ''),
    studentName: optStr(o.studentName ?? o.StudentName),
    email: optStr(o.email ?? o.Email),
    avatarUrl: optStr(o.avatarUrl ?? o.AvatarUrl),
    averageScore: Number(o.averageScore ?? o.AverageScore ?? 0),
    quizzesCompleted: Number(o.quizzesCompleted ?? o.QuizzesCompleted ?? 0),
    totalQuizzes: Number(o.totalQuizzes ?? o.TotalQuizzes ?? 0),
    casesViewed: Number(o.casesViewed ?? o.CasesViewed ?? 0),
    totalCases: Number(o.totalCases ?? o.TotalCases ?? 0),
    overallProgress: Number(o.overallProgress ?? o.OverallProgress ?? 0),
    progressStatus: String(o.progressStatus ?? o.ProgressStatus ?? 'NotStarted'),
    competencies: Array.isArray(o.competencies ?? o.Competencies)
      ? (o.competencies as unknown[]).map(mapCompetencyScore)
      : [],
    lastActivity: optStr(o.lastActivity ?? o.LastActivity),
  };
}

function mapStudentProgressDetail(raw: Record<string, unknown>): StudentProgressDetailDto {
  const quizProgress = raw.quizProgress ?? raw.QuizProgress ?? {};
  const caseProgress = raw.caseProgress ?? raw.CaseProgress ?? {};
  const competencyDetail = raw.competencyDetail ?? raw.CompetencyDetail ?? {};
  return {
    studentId: String(raw.studentId ?? raw.StudentId ?? ''),
    studentName: optStr(raw.studentName ?? raw.StudentName),
    email: optStr(raw.email ?? raw.Email),
    classId: String(raw.classId ?? raw.ClassId ?? ''),
    enrolledAt: String(raw.enrolledAt ?? raw.EnrolledAt ?? ''),
    lastActivity: optStr(raw.lastActivity ?? raw.LastActivity),
    quizProgress: mapQuizProgress(quizProgress as Record<string, unknown>),
    caseProgress: mapCaseProgress(caseProgress as Record<string, unknown>),
    competencyDetail: mapCompetencyDetail(competencyDetail as Record<string, unknown>),
    recentActivities: Array.isArray(raw.recentActivities ?? raw.RecentActivities)
      ? (raw.recentActivities as unknown[]).map(mapRecentActivity)
      : [],
  };
}

function mapQuizProgress(raw: Record<string, unknown>): QuizProgressDetailDto {
  return {
    totalQuizzes: Number(raw.totalQuizzes ?? raw.TotalQuizzes ?? 0),
    completedQuizzes: Number(raw.completedQuizzes ?? raw.CompletedQuizzes ?? 0),
    pendingQuizzes: Number(raw.pendingQuizzes ?? raw.PendingQuizzes ?? 0),
    averageScore: Number(raw.averageScore ?? raw.AverageScore ?? 0),
    highestScore: Number(raw.highestScore ?? raw.HighestScore ?? 0),
    lowestScore: Number(raw.lowestScore ?? raw.LowestScore ?? 0),
    quizScores: Array.isArray(raw.quizScores ?? raw.QuizScores)
      ? (raw.quizScores as unknown[]).map(mapQuizScore)
      : [],
  };
}

function mapQuizScore(raw: unknown): QuizScoreItemDto {
  const o = raw as Record<string, unknown>;
  return {
    quizId: String(o.quizId ?? o.QuizId ?? ''),
    quizTitle: optStr(o.quizTitle ?? o.QuizTitle),
    topic: optStr(o.topic ?? o.Topic),
    score: Number(o.score ?? o.Score ?? 0),
    maxScore: Number(o.maxScore ?? o.MaxScore ?? 100),
    percentage: Number(o.percentage ?? o.Percentage ?? 0),
    completedAt: optStr(o.completedAt ?? o.CompletedAt),
    isPassed: Boolean(o.isPassed ?? o.IsPassed ?? false),
  };
}

function mapCaseProgress(raw: Record<string, unknown>): CaseProgressDetailDto {
  return {
    totalAssignedCases: Number(raw.totalAssignedCases ?? raw.TotalAssignedCases ?? 0),
    viewedCases: Number(raw.viewedCases ?? raw.ViewedCases ?? 0),
    completedCases: Number(raw.completedCases ?? raw.CompletedCases ?? 0),
    completionRate: Number(raw.completionRate ?? raw.CompletionRate ?? 0),
    recentCases: Array.isArray(raw.recentCases ?? raw.RecentCases)
      ? (raw.recentCases as unknown[]).map(mapCaseView)
      : [],
  };
}

function mapCaseView(raw: unknown): CaseViewItemDto {
  const o = raw as Record<string, unknown>;
  return {
    caseId: String(o.caseId ?? o.CaseId ?? ''),
    caseTitle: optStr(o.caseTitle ?? o.CaseTitle),
    caseImageUrl: optStr(o.caseImageUrl ?? o.CaseImageUrl),
    viewedAt: optStr(o.viewedAt ?? o.ViewedAt),
    viewCount: Number(o.viewCount ?? o.ViewCount ?? 1),
    isCompleted: Boolean(o.isCompleted ?? o.IsCompleted ?? false),
  };
}

function mapCompetencyDetail(raw: Record<string, unknown>): CompetencyDetailDto {
  return {
    overallCompetency: Number(raw.overallCompetency ?? raw.OverallCompetency ?? 0),
    competencies: Array.isArray(raw.competencies ?? raw.Competencies)
      ? (raw.competencies as unknown[]).map(mapCompetencyScore)
      : [],
    topicMasteries: Array.isArray(raw.topicMasteries ?? raw.TopicMasteries)
      ? (raw.topicMasteries as unknown[]).map(mapTopicMastery)
      : [],
    history: Array.isArray(raw.history ?? raw.History)
      ? (raw.history as unknown[]).map(mapCompetencyHistory)
      : [],
  };
}

function mapCompetencyScore(raw: unknown): CompetencyScoreDto {
  const o = raw as Record<string, unknown>;
  return {
    competencyId: String(o.competencyId ?? o.CompetencyId ?? ''),
    competencyName: optStr(o.competencyName ?? o.CompetencyName),
    score: Number(o.score ?? o.Score ?? 0),
    maxScore: Number(o.maxScore ?? o.MaxScore ?? 100),
    percentage: Number(o.percentage ?? o.Percentage ?? 0),
    level: String(o.level ?? o.Level ?? 'Beginner'),
    iconUrl: optStr(o.iconUrl ?? o.IconUrl),
  };
}

function mapTopicMastery(raw: unknown): TopicMasteryDto {
  const o = raw as Record<string, unknown>;
  return {
    topicId: String(o.topicId ?? o.TopicId ?? ''),
    topicName: optStr(o.topicName ?? o.TopicName),
    category: optStr(o.category ?? o.Category),
    masteryScore: Number(o.masteryScore ?? o.MasteryScore ?? 0),
    maxScore: Number(o.maxScore ?? o.MaxScore ?? 100),
    masteryPercentage: Number(o.masteryPercentage ?? o.MasteryPercentage ?? 0),
    masteryLevel: String(o.masteryLevel ?? o.MasteryLevel ?? 'Beginner'),
    studentsAssessed: Number(o.studentsAssessed ?? o.StudentsAssessed ?? 0),
    classAverage: Number(o.classAverage ?? o.ClassAverage ?? 0),
  };
}

function mapCompetencyHistory(raw: unknown): CompetencyHistoryDto {
  const o = raw as Record<string, unknown>;
  return {
    date: String(o.date ?? o.Date ?? ''),
    score: Number(o.score ?? o.Score ?? 0),
    activityType: optStr(o.activityType ?? o.ActivityType),
    description: optStr(o.description ?? o.Description),
  };
}

interface CompetencyHistoryDto {
  date: string;
  score: number;
  activityType?: string;
  description?: string;
}

function mapRecentActivity(raw: unknown): RecentActivityDto {
  const o = raw as Record<string, unknown>;
  return {
    activityId: String(o.activityId ?? o.ActivityId ?? ''),
    activityType: String(o.activityType ?? o.ActivityType ?? ''),
    description: optStr(o.description ?? o.Description),
    timestamp: String(o.timestamp ?? o.Timestamp ?? ''),
    score: o.score != null ? Number(o.score) : undefined,
  };
}

function mapCompetencyOverview(raw: Record<string, unknown>): ClassCompetencyOverviewDto {
  return {
    classId: String(raw.classId ?? raw.ClassId ?? ''),
    className: optStr(raw.className ?? raw.ClassName),
    totalStudents: Number(raw.totalStudents ?? raw.TotalStudents ?? 0),
    averageCompetency: Number(raw.averageCompetency ?? raw.AverageCompetency ?? 0),
    classCompetencies: Array.isArray(raw.classCompetencies ?? raw.ClassCompetencies)
      ? (raw.classCompetencies as unknown[]).map(mapCompetencyScore)
      : [],
    topicMasteries: Array.isArray(raw.topicMasteries ?? raw.TopicMasteries)
      ? (raw.topicMasteries as unknown[]).map(mapTopicMastery)
      : [],
    competencyDistribution: Array.isArray(raw.competencyDistribution ?? raw.CompetencyDistribution)
      ? (raw.competencyDistribution as unknown[]).map(mapCompetencyDistribution)
      : [],
    weakTopics: Array.isArray(raw.weakTopics ?? raw.WeakTopics)
      ? (raw.weakTopics as unknown[]).map(mapWeakTopic)
      : [],
    strongTopics: Array.isArray(raw.strongTopics ?? raw.StrongTopics)
      ? (raw.strongTopics as unknown[]).map(mapStrongTopic)
      : [],
  };
}

function mapCompetencyDistribution(raw: unknown): CompetencyDistributionDto {
  const o = raw as Record<string, unknown>;
  return {
    level: String(o.level ?? o.Level ?? ''),
    studentCount: Number(o.studentCount ?? o.StudentCount ?? 0),
    percentage: Number(o.percentage ?? o.Percentage ?? 0),
  };
}

function mapWeakTopic(raw: unknown): WeakTopicDto {
  const o = raw as Record<string, unknown>;
  return {
    topicName: String(o.topicName ?? o.TopicName ?? ''),
    averageScore: Number(o.averageScore ?? o.AverageScore ?? 0),
    studentsNeedingHelp: Number(o.studentsNeedingHelp ?? o.StudentsNeedingHelp ?? 0),
    recommendation: String(o.recommendation ?? o.Recommendation ?? ''),
  };
}

function mapStrongTopic(raw: unknown): StrongTopicDto {
  const o = raw as Record<string, unknown>;
  return {
    topicName: String(o.topicName ?? o.TopicName ?? ''),
    averageScore: Number(o.averageScore ?? o.AverageScore ?? 0),
    studentsMastered: Number(o.studentsMastered ?? o.StudentsMastered ?? 0),
  };
}
