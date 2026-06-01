import axios from 'axios';
import { http, getApiErrorMessage } from './client';
import type {
  QuizDto,
  ClassQuizDto,
  CreateQuizRequest,
  QuizQuestionDto,
  CreateQuizQuestionRequest,
  UpdateQuizQuestionRequest,
  AssignedQuizDto,
} from './types';

/**
 * Normalize QuizQuestionDto from backend (PascalCase) to frontend interface (camelCase).
 * BE trả PascalCase: Id, QuizId, QuizTitle, CaseId, CaseTitle, QuestionText,
 * Type, OptionA-D, CorrectAnswer, ImageUrl, MaxScore, Hint, Explanation, CorrectAnswers, AcceptedAnswers
 */
function normalizeQuizQuestionDto(raw: unknown): QuizQuestionDto {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const getStr = (camel: string, pascal: string): string | null => {
    const v = r[camel] ?? r[pascal];
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };

  const getNum = (camel: string, pascal: string): number | undefined => {
    const v = r[camel] ?? r[pascal];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
  };

  return {
    id: getStr('id', 'Id') ?? '',
    quizId: getStr('quizId', 'QuizId') ?? '',
    quizTitle: getStr('quizTitle', 'QuizTitle'),
    caseId: getStr('caseId', 'CaseId'),
    caseTitle: getStr('caseTitle', 'CaseTitle'),
    questionText: getStr('questionText', 'QuestionText') ?? '',
    type: getStr('type', 'Type'),
    optionA: getStr('optionA', 'OptionA'),
    optionB: getStr('optionB', 'OptionB'),
    optionC: getStr('optionC', 'OptionC'),
    optionD: getStr('optionD', 'OptionD'),
    correctAnswer: getStr('correctAnswer', 'CorrectAnswer'),
    imageUrl: getStr('imageUrl', 'ImageUrl') ?? undefined,
    hint: getStr('hint', 'Hint'),
    explanation: getStr('explanation', 'Explanation'),
    correctAnswers: getStr('correctAnswers', 'CorrectAnswers'),
    acceptedAnswers: getStr('acceptedAnswers', 'AcceptedAnswers'),
    maxScore: getNum('maxScore', 'MaxScore'),
  };
}

export interface UpdateQuizRequest {
  title: string;
  openTime?: string | null;
  closeTime?: string | null;
  timeLimit?: number | null;
  passingScore?: number | null;
  topic?: string | null;
  difficulty?: string | null;
  classification?: string | null;
  boneSpecialtyId?: string | null;
  pathologyCategoryId?: string | null;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number;
}

// ========== Quiz Management ==========

/** BE có thể trả camelCase hoặc PascalCase. */
function normalizeClassQuizDto(raw: ClassQuizDto & Record<string, unknown>): ClassQuizDto {
  const r = raw as ClassQuizDto & {
    ClassId?: string;
    QuizId?: string;
    QuizName?: string | null;
    ClassName?: string | null;
    Topic?: string | null;
    AssignedAt?: string | null;
    OpenTime?: string | null;
    CloseTime?: string | null;
    QuestionCount?: number;
    IsFromExpertLibrary?: boolean;
    QuizMode?: number;
  };
  return {
    classId: raw.classId ?? r.ClassId ?? '',
    quizId: raw.quizId ?? r.QuizId ?? '',
    quizName: raw.quizName ?? r.QuizName ?? null,
    className: raw.className ?? r.ClassName ?? null,
    topic: raw.topic ?? r.Topic ?? null,
    assignedAt: raw.assignedAt ?? r.AssignedAt ?? null,
    openTime: raw.openTime ?? r.OpenTime ?? null,
    closeTime: raw.closeTime ?? r.CloseTime ?? null,
    questionCount: raw.questionCount ?? r.QuestionCount,
    isFromExpertLibrary: raw.isFromExpertLibrary ?? r.IsFromExpertLibrary ?? false,
    quizMode: raw.quizMode ?? r.QuizMode ?? 1,
  };
}

/**
 * Get all quizzes for a lecturer across all classes
 */
export async function getLecturerQuizzes(lecturerId: string): Promise<ClassQuizDto[]> {
  try {
    const { data } = await http.get<ClassQuizDto[]>('/api/lecturer/quizzes', {
      params: { lecturerId },
    });
    const list = Array.isArray(data) ? data : [];
    return list.map((row) => normalizeClassQuizDto(row as ClassQuizDto & Record<string, unknown>));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get unassigned quizzes created by lecturer (My Quizzes tab)
 */
export async function getUnassignedLecturerQuizzes(lecturerId: string): Promise<QuizDto[]> {
  try {
    const { data } = await http.get<QuizDto[]>('/api/lecturer/quizzes/my', {
      params: { lecturerId },
    });
    return data.map(normalizeQuizDto);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get all quizzes for lecturer with their assigned classes (for My Quizzes tab)
 */
export interface MyQuizClassInfo {
  classId: string;
  className: string;
  assignedAt: string | null;
  assignmentId: string;
}

export interface MyQuizWithClasses {
  quizId: string;
  quizName: string;
  topic: string | null;
  openTime: string | null;
  closeTime: string | null;
  timeLimit: number | null;
  passingScore: number | null;
  createdAt: string | null;
  questionCount: number;
  isAiGenerated: boolean;
  isFromExpertLibrary: boolean;
  difficulty: string | null;
  creatorName?: string | null;
  creatorType?: string | null;
  classes: MyQuizClassInfo[];
}

export async function getMyQuizzesWithClasses(lecturerId: string): Promise<MyQuizWithClasses[]> {
  try {
    const { data } = await http.get<MyQuizWithClasses[]>('/api/lecturer/quizzes/my-with-classes', {
      params: { lecturerId },
    });
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Normalize an AssignedQuizDto from backend (PascalCase) to frontend interface (camelCase).
 */
function normalizeAssignedQuizDto(raw: unknown): AssignedQuizDto {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  // Helper to safely get a string value
  const getStr = (camel: string, pascal: string): string | null => {
    const v = r[camel] ?? r[pascal];
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };

  // Helper to safely get a date string from PascalCase DateTime
  const getDateStr = (camel: string, pascal: string): string | null => {
    const v = r[camel] ?? r[pascal];
    if (v == null || v === '') return null;
    // Handle Date objects from JSON, ISO strings, or timestamps
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return new Date(v).toISOString();
    return null;
  };

  // Helper for boolean
  const getBool = (camel: string, pascal: string): boolean => {
    const v = r[camel] ?? r[pascal];
    return Boolean(v);
  };

  // Helper for numbers
  const getNum = (camel: string, pascal: string): number => {
    const v = r[camel] ?? r[pascal];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    }
    return 0;
  };

  return {
    assignmentId: getStr('assignmentId', 'AssignmentId') ?? '',
    classId: getStr('classId', 'ClassId') ?? '',
    quizId: getStr('quizId', 'QuizId') ?? '',
    quizName: getStr('quizName', 'QuizName'),
    className: getStr('className', 'ClassName'),
    topic: getStr('topic', 'Topic'),
    assignedAt: getDateStr('assignedAt', 'AssignedAt'),
    openTime: getDateStr('openTime', 'OpenTime'),
    closeTime: getDateStr('closeTime', 'CloseTime'),
    questionCount: getNum('questionCount', 'QuestionCount'),
    isFromExpertLibrary: getBool('isFromExpertLibrary', 'IsFromExpertLibrary'),
    creatorName: getStr('creatorName', 'CreatorName'),
    creatorType: getStr('creatorType', 'CreatorType'),
    quizMode: getNum('quizMode', 'QuizMode') || undefined,
  };
}

/**
 * Get assigned quizzes (Assigned Quizzes tab)
 */
export async function getAssignedQuizzes(lecturerId: string): Promise<AssignedQuizDto[]> {
  try {
    const { data } = await http.get<unknown>('/api/lecturer/quizzes/assigned', {
      params: { lecturerId },
    });
    // Backend returns PascalCase, normalize to camelCase for frontend
    if (Array.isArray(data)) {
      return (data as unknown[]).map(normalizeAssignedQuizDto);
    }
    return [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/** BE có thể trả camelCase hoặc PascalCase — giống normalizeClassQuizDto để dropdown Class không bị trống. */
export function normalizeQuizDto(raw: unknown): QuizDto {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const id = String(r.id ?? r.Id ?? '').trim();
  const cid = String(r.classId ?? r.ClassId ?? '').trim();
  const classId =
    !cid || cid.toLowerCase() === EMPTY_GUID ? '' : cid;

  return {
    id,
    classId,
    className: (r.className ?? r.ClassName ?? null) as string | null,
    title: String(r.title ?? r.Title ?? ''),
    topic: (r.topic ?? r.Topic ?? null) as string | null,
    isAiGenerated: Boolean(r.isAiGenerated ?? r.IsAiGenerated ?? false),
    difficulty: (r.difficulty ?? r.Difficulty ?? null) as string | null,
    classification: (r.classification ?? r.Classification ?? null) as string | null,
    openTime: (r.openTime ?? r.OpenTime ?? null) as string | null,
    closeTime: (r.closeTime ?? r.CloseTime ?? null) as string | null,
    timeLimit: (r.timeLimit ?? r.TimeLimit ?? null) as number | null,
    passingScore: (r.passingScore ?? r.PassingScore ?? null) as number | null,
    createdAt: (r.createdAt ?? r.CreatedAt ?? null) as string | null,
    questionCount: (r.questionCount ?? r.QuestionCount ?? undefined) as number | undefined,
    quizName: (r.quizName ?? r.QuizName ?? null) as string | null,
    isFromExpertLibrary: Boolean(r.isFromExpertLibrary ?? r.IsFromExpertLibrary ?? false),
    // Deep classification fields
    boneSpecialtyId: (r.boneSpecialtyId ?? r.BoneSpecialtyId ?? null) as string | null,
    boneSpecialtyName: (r.boneSpecialtyName ?? r.BoneSpecialtyName ?? null) as string | null,
    pathologyCategoryId: (r.pathologyCategoryId ?? r.PathologyCategoryId ?? null) as string | null,
    pathologyCategoryName: (r.pathologyCategoryName ?? r.PathologyCategoryName ?? null) as string | null,
    // Quiz mode: 1=Exam, 2=Practice, 3=Adaptive
    quizMode: (r.quizMode ?? r.QuizMode ?? null) as number | null,
  };
}

/**
 * Get quizzes for a specific class
 */
export async function getClassQuizzes(classId: string): Promise<QuizDto[]> {
  try {
    const { data } = await http.get<QuizDto[]>(`/api/lecturer/classes/${classId}/quizzes`);
    const list = Array.isArray(data) ? data : [];
    return list.map((row) => normalizeQuizDto(row));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get a single quiz by ID
 */
export async function getQuiz(quizId: string, signal?: AbortSignal): Promise<QuizDto> {
  try {
    const { data } = await http.get<QuizDto>(`/api/lecturer/quizzes/${quizId}`, { signal });
    return normalizeQuizDto(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get batch quizzes by IDs
 */
export async function getQuizzesByIds(quizIds: string[]): Promise<QuizDto[]> {
  try {
    const { data } = await http.get<QuizDto[]>('/api/lecturer/quizzes/batch', {
      params: { quizIds },
    });
    const list = Array.isArray(data) ? data : [];
    return list.map((row) => normalizeQuizDto(row));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Create a new quiz
 */
export async function createQuiz(body: CreateQuizRequest): Promise<QuizDto> {
  try {
    const { data } = await http.post<QuizDto>('/api/lecturer', body);
    return normalizeQuizDto(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Update quiz information
 */
export async function updateQuiz(quizId: string, body: UpdateQuizRequest): Promise<QuizDto> {
  try {
    const { data } = await http.put<QuizDto>(`/api/lecturer/quizzes/${quizId}`, body);
    return normalizeQuizDto(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Assign a quiz to a class
 */
export async function assignQuizToClass(classId: string, quizId: string): Promise<ClassQuizDto> {
  try {
    const { data } = await http.post<ClassQuizDto>(
      `/api/lecturer/classes/${classId}/quizzes/${quizId}`,
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Quiz Questions ==========

/**
 * Get questions for a quiz
 */
export async function getQuizQuestions(quizId: string): Promise<QuizQuestionDto[]> {
  try {
    const { data } = await http.get<QuizQuestionDto[]>(`/api/lecturer/quizzes/${quizId}/questions`);
    const list = Array.isArray(data) ? data : [];
    return list.map(normalizeQuizQuestionDto);
  } catch (e) {
    // BE trả 404 khi quiz chưa có câu hỏi — coi như danh sách rỗng
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return [];
    }
    throw new Error(getApiErrorMessage(e));
  }
}

const DEFAULT_QUESTION_BATCH = 6;

/** Gửi nhiều câu hỏi song song theo lô để publish nhanh hơn (tránh nối tuần tự). */
export async function addQuizQuestionsBatched(
  quizId: string,
  items: CreateQuizQuestionRequest[],
  batchSize = DEFAULT_QUESTION_BATCH,
): Promise<void> {
  const list = items.map((q) => ({ ...q, quizId }));
  for (let i = 0; i < list.length; i += batchSize) {
    const slice = list.slice(i, i + batchSize);
    await Promise.all(slice.map((q) => addQuizQuestion(q)));
  }
}

/**
 * Get a single question by ID
 */
export async function getQuizQuestion(questionId: string): Promise<QuizQuestionDto> {
  try {
    const { data } = await http.get<QuizQuestionDto>(
      `/api/lecturer/quizzes/questions/${questionId}`,
    );
    return normalizeQuizQuestionDto(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Add a new question to a quiz
 */
export async function addQuizQuestion(body: CreateQuizQuestionRequest): Promise<QuizQuestionDto> {
  try {
    const { data } = await http.post<QuizQuestionDto>(
      `/api/lecturer/quizzes/${body.quizId}/questions`,
      body,
    );
    return normalizeQuizQuestionDto(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Update an existing question
 */
export async function updateQuizQuestion(
  questionId: string,
  body: UpdateQuizQuestionRequest,
): Promise<void> {
  try {
    await http.put(`/api/lecturer/quizzes/questions/${questionId}`, body);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Delete a question
 */
export async function deleteQuizQuestion(questionId: string): Promise<void> {
  try {
    await http.delete(`/api/lecturer/quizzes/questions/${questionId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Delete a quiz and all its related data
 */
export async function deleteQuiz(quizId: string): Promise<void> {
  try {
    await http.delete(`/api/lecturer/quizzes/${quizId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Remove a quiz from a class (only removes ClassQuizSession, keeps the quiz in Expert Library)
 */
export async function removeQuizFromClass(classId: string, quizId: string): Promise<void> {
  try {
    await http.delete(`/api/lecturer/classes/${classId}/quizzes/${quizId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== AI Quiz Functions ==========

import type {
  AIQuizGenerationResult,
  AIAutoGenerateQuizRequest,
  AISuggestQuestionsRequest,
} from './types';

/**
 * AI Auto-Generate Quiz: Tạo quiz tự động từ topic
 */
export async function aiAutoGenerateQuiz(
  request: AIAutoGenerateQuizRequest
): Promise<AIQuizGenerationResult> {
  try {
    const { data } = await http.post<AIQuizGenerationResult>(
      '/api/lecturer/ai/generate-quiz',
      request
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * AI Suggest Questions: Gợi ý câu hỏi từ các cases đã chọn
 */
export async function aiSuggestQuestions(
  request: AISuggestQuestionsRequest
): Promise<AIQuizGenerationResult> {
  try {
    const { data } = await http.post<AIQuizGenerationResult>(
      '/api/lecturer/ai/suggest-questions',
      request
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * AI Create Complete Quiz: Tạo quiz hoàn chỉnh từ AI
 */
export async function aiCreateQuiz(
  request: AIAutoGenerateQuizRequest
): Promise<{ quizId: string; title: string; questionsCreated: number; message: string }> {
  try {
    const { data } = await http.post<{ quizId: string; title: string; questionsCreated: number; message: string }>(
      '/api/lecturer/ai/create-quiz',
      request
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Release/Hide Answers ==========

export interface QuizReleaseStatus {
  classId: string;
  quizId: string;
  quizTitle: string;
  isReleased: boolean;
  releasedAt: string | null;
  isQuizClosed: boolean;
}

/**
 * Get release status for a quiz in a class.
 */
export async function getQuizReleaseStatus(classId: string, quizId: string): Promise<QuizReleaseStatus> {
  try {
    const { data } = await http.get<QuizReleaseStatus>(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/release-status`
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Release quiz answers for all students in a class.
 */
export async function releaseQuizAnswers(classId: string, quizId: string): Promise<{ message: string }> {
  try {
    const { data } = await http.post<{ message: string }>(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/release-answers`
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Hide quiz answers (undo release) for all students in a class.
 */
export async function hideQuizAnswers(classId: string, quizId: string): Promise<{ message: string }> {
  try {
    const { data } = await http.post<{ message: string }>(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/hide-answers`
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
