import axios from 'axios';
import { http, getApiErrorMessage } from './client';
import type { ExpertQuizQuestion } from './types';

export type ExpertQuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface ExpertQuiz {
  id: string;
  title: string;
  topic: string | null;
  openTime: string;
  closeTime: string;
  timeLimit: number;
  passingScore: number;
  isAiGenerated: boolean;
  difficulty: ExpertQuizDifficulty | string;
  classification: string | null;
  createdAt: string;
  expertName?: string;
}

interface ExpertQuizListResponse {
  message?: string;
  result?: {
    items?: unknown[];
    totalCount?: number;
    pageIndex?: number;
    pageSize?: number;
  };
}

export interface ExpertQuizPagedResponse {
  items: ExpertQuiz[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export interface CreateExpertQuizRequest {
  title: string;
  topic: string | null;
  openTime: string; // ISO
  closeTime: string; // ISO
  timeLimit?: number; // Optional - Lecturer sẽ override khi gán vào lớp
  passingScore?: number; // Optional - Lecturer sẽ override khi gán vào lớp
  isAiGenerated: boolean;
  difficulty: ExpertQuizDifficulty | string;
  classification: string | null;
  createdByExpertId?: string;
}

export type UpdateExpertQuizRequest = Partial<CreateExpertQuizRequest>;

function normalizeBoolean(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (raw == null) return false;
  const s = String(raw).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

function mapExpertQuiz(row: unknown, fallbackId?: string): ExpertQuiz | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const id = String(r.id ?? r.Id ?? fallbackId ?? '');
  if (!id) return null;

  const openTime = String(r.openTime ?? r.OpenTime ?? '');
  const closeTime = String(r.closeTime ?? r.CloseTime ?? '');

  return {
    id,
    title: String(r.title ?? r.Title ?? 'Untitled quiz'),
    topic: r.topic != null ? String(r.topic) : r.Topic != null ? String(r.Topic) : null,
    openTime,
    closeTime,
    timeLimit: Number(r.timeLimit ?? r.TimeLimit ?? 0),
    passingScore: Number(r.passingScore ?? r.PassingScore ?? 0),
    isAiGenerated: normalizeBoolean(r.isAiGenerated ?? r.IsAiGenerated),
    difficulty: String(r.difficulty ?? r.Difficulty ?? 'Easy'),
    classification:
      r.classification != null
        ? String(r.classification)
        : r.Classification != null
          ? String(r.Classification)
          : null,
    createdAt: String(r.createdAt ?? r.CreatedAt ?? ''),
    expertName: r.expertName != null ? String(r.expertName) : r.ExpertName != null ? String(r.ExpertName) : undefined,
  };
}

export async function fetchExpertQuizzes(pageIndex = 1, pageSize = 100): Promise<ExpertQuiz[]> {
  try {
    const res = await fetchExpertQuizzesPaged(pageIndex, pageSize);
    return res.items;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertQuizzesPaged(pageIndex = 1, pageSize = 100): Promise<ExpertQuizPagedResponse> {
  try {
    const { data } = await http.get<ExpertQuizListResponse>(
      `/api/expert/quizzes?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    );

    const itemsRaw = data?.result?.items;
    const totalCount = Number(data?.result?.totalCount ?? 0);
    const pageIndexOut = Number(data?.result?.pageIndex ?? pageIndex);
    const pageSizeOut = Number(data?.result?.pageSize ?? pageSize);

    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((row) => mapExpertQuiz(row)).filter((q): q is ExpertQuiz => q !== null)
      : [];

    return {
      items,
      totalCount,
      pageIndex: pageIndexOut,
      pageSize: pageSizeOut,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createExpertQuiz(input: CreateExpertQuizRequest): Promise<ExpertQuiz> {
  try {
    const { data } = await http.post<ExpertQuizListResponse | { result?: unknown; message?: string }>(
      '/api/expert/quizzes',
      input,
    );

    // BE thường trả: { message, result: { ... } }
    const row =
      (data as any)?.result ??
      (data as any)?.Result ??
      data;

    const mapped = mapExpertQuiz(row);
    if (!mapped) throw new Error('Invalid quiz response from server');
    return mapped;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateExpertQuiz(id: string, input: UpdateExpertQuizRequest): Promise<ExpertQuiz> {
  // BE C# thường bind DTO.Id, nên gửi cả `Id` và `id` để chắc chắn.
  const bodyWithId = { Id: id, id, ...(input ?? {}) };
  try {
    // Theo BE của bạn: update chạy ở PUT /api/expert/quizzes (id nằm trong body)
    const { data } = await http.put<{ result?: unknown; message?: string }>(
      `/api/expert/quizzes`,
      bodyWithId,
    );

    const row = data?.result ?? data;
    const mapped = mapExpertQuiz(row, id);
    if (!mapped) throw new Error('Invalid quiz response from server');
    return mapped;
  } catch (e) {
    // fallback tối thiểu nếu PUT không được phép
    if (!axios.isAxiosError(e)) throw new Error(getApiErrorMessage(e));

    const status = e.response?.status;
    if (status !== 405 && status !== 400 && status !== 404) throw new Error(getApiErrorMessage(e));

    // Thử PATCH /api/expert/quizzes (cũng là kiểu id trong body)
    try {
      const { data } = await http.patch<{ result?: unknown; message?: string }>(`/api/expert/quizzes`, bodyWithId);
      const row = data?.result ?? data;
      const mapped = mapExpertQuiz(row, id);
      if (!mapped) throw new Error('Invalid quiz response from server');
      return mapped;
    } catch {
      // fallthrough
    }

    // Thử update theo route có {id}
    try {
      const { data } = await http.put<{ result?: unknown; message?: string }>(`/api/expert/quizzes/${id}`, bodyWithId);
      const row = data?.result ?? data;
      const mapped = mapExpertQuiz(row, id);
      if (!mapped) throw new Error('Invalid quiz response from server');
      return mapped;
    } catch {
      // fallthrough
    }

    try {
      const { data } = await http.patch<{ result?: unknown; message?: string }>(`/api/expert/quizzes/${id}`, bodyWithId);
      const row = data?.result ?? data;
      const mapped = mapExpertQuiz(row, id);
      if (!mapped) throw new Error('Invalid quiz response from server');
      return mapped;
    } catch {
      // fallthrough
    }

    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteExpertQuiz(id: string): Promise<void> {
  try {
    await http.delete(`/api/expert/quizzes/${id}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Expert Assign & Score ==========

export interface AssignQuizRequest {
  classId: string;
  quizId: string;
  assignedExpertId?: string | null;
  openTime?: string | null; // ISO
  closeTime?: string | null; // ISO
  passingScore?: number | null;
  timeLimitMinutes?: number | null;
}

export interface AssignQuizResult {
  classId: string;
  className: string;
  quizId: string;
  quizName: string;
  expertName: string;
  assignedAt: string;
  openTime: string;
  closeTime: string;
  passingScore: number;
  timeLimitMinutes: number;
}

function mapAssignQuizResult(row: unknown): AssignQuizResult {
  const body = row as Record<string, unknown>;
  return {
    classId: String(body?.classId ?? body?.ClassId ?? ''),
    className: String(body?.className ?? body?.ClassName ?? ''),
    quizId: String(body?.quizId ?? body?.QuizId ?? ''),
    quizName: String(body?.quizName ?? body?.QuizName ?? ''),
    expertName: String(body?.expertName ?? body?.ExpertName ?? ''),
    assignedAt: String(body?.assignedAt ?? body?.AssignedAt ?? ''),
    openTime: String(body?.openTime ?? body?.OpenTime ?? ''),
    closeTime: String(body?.closeTime ?? body?.CloseTime ?? ''),
    passingScore: Number(body?.passingScore ?? body?.PassingScore ?? 0),
    timeLimitMinutes: Number(
      body?.timeLimitMinutes ?? body?.TimeLimitMinutes ?? body?.timeLimit ?? 0,
    ),
  };
}

/** POST `/api/expert/quizzes/assign` (canonical); falls back to `/api/expert/assign`. */
export async function assignExpertQuiz(payload: AssignQuizRequest): Promise<AssignQuizResult> {
  const parse = (data: unknown) => {
    const outer = data as { result?: unknown; Result?: unknown };
    const row = outer?.result ?? outer?.Result ?? data;
    return mapAssignQuizResult(row);
  };
  try {
    const { data } = await http.post<unknown>('/api/expert/quizzes/assign', payload);
    return parse(data);
  } catch (e) {
    if (!axios.isAxiosError(e)) throw new Error(getApiErrorMessage(e));
    const st = e.response?.status;
    if (st !== 404 && st !== 405) throw new Error(getApiErrorMessage(e));
    try {
      const { data } = await http.post<unknown>('/api/expert/assign', payload);
      return parse(data);
    } catch (e2) {
      throw new Error(getApiErrorMessage(e2));
    }
  }
}

// ========== Attempt lookup ==========

export interface QuizAttempt {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
}

export async function fetchAttemptsByQuizId(quizId: string): Promise<QuizAttempt[]> {
  try {
    const { data } = await http.get<unknown>(`/api/expert/attempts/${quizId}`);
    const body = data as any;
    const rawList = body?.result ?? body?.Result ?? body;
    const list = Array.isArray(rawList) ? rawList : [];
    return list.map((a: any): QuizAttempt => ({
      attemptId: String(a.attemptId ?? a.AttemptId ?? ''),
      quizId: String(a.quizId ?? a.QuizId ?? quizId),
      quizTitle: String(a.quizTitle ?? a.QuizTitle ?? ''),
      studentId: String(a.studentId ?? a.StudentId ?? ''),
      studentName: String(a.studentName ?? a.StudentName ?? 'Unknown'),
      startedAt: String(a.startedAt ?? a.StartedAt ?? ''),
      completedAt: a.completedAt ?? a.CompletedAt ?? null,
      score: a.score != null ? Number(a.score) : a.Score != null ? Number(a.Score) : null,
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Assigned Quizzes list ==========

export interface AssignedQuizRecord {
  classId: string;
  className: string;
  quizId: string;
  quizName: string;
  assignedAt: string;
  openTime: string;
  closeTime: string;
  passingScore: number;
  timeLimitMinutes: number;
}

export async function fetchAssignedQuizzes(pageIndex = 1, pageSize = 50): Promise<AssignedQuizRecord[]> {
  try {
    const { data } = await http.get<unknown>(`/api/expert/assign?pageIndex=${pageIndex}&pageSize=${pageSize}`);
    const body = data as any;
    const rawList = body?.result?.items ?? body?.result ?? body?.items ?? body;
    const list = Array.isArray(rawList) ? rawList : [];
    return list.map((r: any): AssignedQuizRecord => ({
      classId: String(r.classId ?? r.ClassId ?? ''),
      className: String(r.className ?? r.ClassName ?? ''),
      quizId: String(r.quizId ?? r.QuizId ?? ''),
      quizName: String(r.quizName ?? r.QuizName ?? ''),
      assignedAt: String(r.assignedAt ?? r.AssignedAt ?? ''),
      openTime: String(r.openTime ?? r.OpenTime ?? ''),
      closeTime: String(r.closeTime ?? r.CloseTime ?? ''),
      passingScore: Number(r.passingScore ?? r.PassingScore ?? 0),
      timeLimitMinutes: Number(r.timeLimitMinutes ?? r.TimeLimitMinutes ?? 0),
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface CalculateAttemptScoreResult {
  attemptId: string;
  studentId: string;
  quizId: string;
  quizTitle: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  passingScore: number;
  isPassed: boolean;
  completedAt: string;
}

/** GET `/api/expert/quizzes/attempts/{id}/score` (canonical); falls back to `/api/expert/attempts/{id}/score`. */
export async function calculateAttemptScore(attemptId: string): Promise<CalculateAttemptScoreResult> {
  const mapRow = (data: unknown): CalculateAttemptScoreResult => {
    const body = data as { result?: unknown; Result?: unknown };
    const row = (body?.result ?? body?.Result ?? data) as Record<string, unknown>;
    return {
      attemptId: String(row?.attemptId ?? row?.AttemptId ?? attemptId),
      studentId: String(row?.studentId ?? row?.StudentId ?? ''),
      quizId: String(row?.quizId ?? row?.QuizId ?? ''),
      quizTitle: String(row?.quizTitle ?? row?.QuizTitle ?? ''),
      totalQuestions: Number(row?.totalQuestions ?? row?.TotalQuestions ?? 0),
      correctAnswers: Number(row?.correctAnswers ?? row?.CorrectAnswers ?? 0),
      score: Number(row?.score ?? row?.Score ?? 0),
      passingScore: Number(row?.passingScore ?? row?.PassingScore ?? 0),
      isPassed: Boolean(row?.isPassed ?? row?.IsPassed),
      completedAt: String(row?.completedAt ?? row?.CompletedAt ?? ''),
    };
  };
  try {
    const { data } = await http.get<unknown>(`/api/expert/quizzes/attempts/${attemptId}/score`);
    return mapRow(data);
  } catch (e) {
    if (!axios.isAxiosError(e)) throw new Error(getApiErrorMessage(e));
    const st = e.response?.status;
    if (st !== 404 && st !== 405) throw new Error(getApiErrorMessage(e));
    try {
      const { data } = await http.get<unknown>(`/api/expert/attempts/${attemptId}/score`);
      return mapRow(data);
    } catch (e2) {
      throw new Error(getApiErrorMessage(e2));
    }
  }
}

export async function fetchExpertClassesPaged(pageIndex = 1, pageSize = 100): Promise<{ id: string; className: string }[]> {
  try {
    const { data } = await http.get<unknown>(`/api/expert/class?pageIndex=${pageIndex}&pageSize=${pageSize}`);
    const body = data as any;
    const rawList = body?.result?.items ?? body?.result ?? body?.items ?? body;
    const list = Array.isArray(rawList) ? rawList : [];
    return list.map((c: any) => ({
      id: String(c.id ?? c.Id ?? ''),
      className: String(c.className ?? c.ClassName ?? c.name ?? c.Name ?? 'Unknown Class'),
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertUsersPaged(pageIndex = 1, pageSize = 100): Promise<{ id: string; fullName: string }[]> {
  try {
    const { data } = await http.get<unknown>(`/api/expert/expert?pageIndex=${pageIndex}&pageSize=${pageSize}`);
    const body = data as any;
    const rawList = body?.result?.items ?? body?.result ?? body?.items ?? body;
    const list = Array.isArray(rawList) ? rawList : [];
    return list.map((u: any) => ({
      id: String(u.id ?? u.Id ?? u.userId ?? u.UserId ?? ''),
      fullName: String(u.fullName ?? u.FullName ?? u.name ?? u.Name ?? 'Unknown Expert'),
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Expert Quiz Library ==========

export interface ExpertQuizLibraryItem {
  id: string;
  title: string;
  topic: string | null;
  openTime: string;
  closeTime: string;
  timeLimit: number;
  passingScore: number;
  isAiGenerated: boolean;
  difficulty: string;
  classification: string | null;
  createdAt: string;
  expertName: string;
  questionCount: number;
}

interface ExpertQuizLibraryResponse {
  items?: unknown[];
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
}

export interface ExpertQuizLibraryPagedResponse {
  items: ExpertQuizLibraryItem[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

function mapExpertQuizLibraryItem(row: unknown, fallbackId?: string): ExpertQuizLibraryItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const id = String(r.id ?? r.Id ?? fallbackId ?? '');
  if (!id) return null;

  return {
    id,
    title: String(r.title ?? r.Title ?? 'Untitled quiz'),
    topic: r.topic != null ? String(r.topic) : r.Topic != null ? String(r.Topic) : null,
    openTime: String(r.openTime ?? r.OpenTime ?? ''),
    closeTime: String(r.closeTime ?? r.CloseTime ?? ''),
    timeLimit: Number(r.timeLimit ?? r.TimeLimit ?? 0),
    passingScore: Number(r.passingScore ?? r.PassingScore ?? 0),
    isAiGenerated: normalizeBoolean(r.isAiGenerated ?? r.IsAiGenerated),
    difficulty: String(r.difficulty ?? r.Difficulty ?? 'Easy'),
    classification: r.classification != null
      ? String(r.classification)
      : r.Classification != null
        ? String(r.Classification)
        : null,
    createdAt: String(r.createdAt ?? r.CreatedAt ?? ''),
    expertName: r.expertName != null ? String(r.expertName) : r.ExpertName != null ? String(r.ExpertName) : 'Unknown',
    questionCount: Number(r.questionCount ?? r.QuestionCount ?? 0),
  };
}

export async function fetchExpertQuizLibrary(
  pageIndex = 1,
  pageSize = 10,
  topic?: string | null,
  difficulty?: string | null,
  classification?: string | null,
): Promise<ExpertQuizLibraryPagedResponse> {
  try {
    const params = new URLSearchParams();
    params.append('pageIndex', String(pageIndex));
    params.append('pageSize', String(pageSize));
    if (topic) params.append('topic', topic);
    if (difficulty) params.append('difficulty', difficulty);
    if (classification) params.append('classification', classification);

    const { data } = await http.get<ExpertQuizLibraryResponse>(`/api/expert/library/quizzes?${params.toString()}`);

    const itemsRaw = data?.items;
    const totalCount = Number(data?.totalCount ?? 0);
    const pageIndexOut = Number(data?.pageIndex ?? pageIndex);
    const pageSizeOut = Number(data?.pageSize ?? pageSize);

    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((row) => mapExpertQuizLibraryItem(row)).filter((q): q is ExpertQuizLibraryItem => q !== null)
      : [];

    return { items, totalCount, pageIndex: pageIndexOut, pageSize: pageSizeOut };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertQuizLibraryQuestions(quizId: string): Promise<ExpertQuizQuestion[]> {
  try {
    const { data } = await http.get<any>(`/api/expert/library/quizzes/${quizId}/questions`);
    const rawQuestions = data?.questions ?? data?.result ?? [];
    return (Array.isArray(rawQuestions) ? rawQuestions : []).map((q: any) => ({
      id: String(q.id ?? q.Id ?? q.questionId ?? q.QuestionId ?? ''),
      quizId: String(q.quizId ?? q.QuizId ?? quizId),
      quizTitle: q.quizTitle ?? q.QuizTitle ?? null,
      caseId: q.caseId ?? q.CaseId ?? null,
      caseTitle: q.caseTitle ?? q.CaseTitle ?? null,
      questionText: String(q.questionText ?? q.QuestionText ?? ''),
      type: String(q.type ?? q.Type ?? 'selection-choice'),
      optionA: q.optionA ?? q.OptionA ?? null,
      optionB: q.optionB ?? q.OptionB ?? null,
      optionC: q.optionC ?? q.OptionC ?? null,
      optionD: q.optionD ?? q.OptionD ?? null,
      correctAnswer: String(q.correctAnswer ?? q.CorrectAnswer ?? ''),
      imageUrl: q.imageUrl ?? q.ImageUrl ?? null,
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function assignExpertQuizFromLibrary(
  classId: string,
  quizId: string,
  options?: {
    openTime?: string;
    closeTime?: string;
    passingScore?: number;
    timeLimitMinutes?: number;
  },
): Promise<AssignQuizResult> {
  try {
    const payload = {
      openTime: options?.openTime ?? null,
      closeTime: options?.closeTime ?? null,
      passingScore: options?.passingScore ?? null,
      timeLimitMinutes: options?.timeLimitMinutes ?? null,
    };
    const { data } = await http.post<unknown>(`/api/expert/classes/${classId}/library-quizzes/${quizId}`, payload);
    const row = (data as any)?.result ?? data;
    return mapAssignQuizResult(row);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Quiz Assignment Status ==========

export interface QuizAssignmentStatus {
  isAssigned: boolean;
  assignedClassCount: number;
  message: string;
}

/**
 * Kiểm tra xem quiz đã được gán vào lớp nào chưa.
 * Dùng để hiển thị warning cho Expert khi edit quiz.
 */
export async function fetchQuizAssignmentStatus(quizId: string): Promise<QuizAssignmentStatus> {
  try {
    const { data } = await http.get<QuizAssignmentStatus>(`/api/expert/quizzes/${quizId}/assignment-status`);
    return {
      isAssigned: Boolean(data?.isAssigned ?? false),
      assignedClassCount: Number(data?.assignedClassCount ?? 0),
      message: String(data?.message ?? ''),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
