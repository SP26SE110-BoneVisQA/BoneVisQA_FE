import { http, getApiErrorMessage } from './client';

export interface ExpertQuizQuestion {
  questionId: string;
  quizId?: string;
  quizTitle?: string;
  caseId?: string;
  caseTitle?: string;
  questionText: string;
  type: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: string;
  /** URL của ảnh câu hỏi */
  imageUrl?: string | null;
}

export interface CreateExpertQuizQuestionRequest {
  quizId: string;
  caseId?: string;
  questionText: string;
  type: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: string;
  /** URL của ảnh câu hỏi (bắt buộc) */
  imageUrl?: string;
}

export type UpdateExpertQuizQuestionRequest = CreateExpertQuizQuestionRequest & {
  questionId: string;
};

function strOrUndef(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v);
  return s.trim() ? s : undefined;
}

function mapExpertQuizQuestion(row: unknown, fallbackQuestionId?: string): ExpertQuizQuestion | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const questionId =
    strOrUndef(r.questionId) ??
    strOrUndef((r as any).QuestionId) ??
    strOrUndef(r.questionID) ??
    strOrUndef((r as any).QuestionID) ??
    strOrUndef(r.id) ??
    strOrUndef((r as any).Id) ??
    fallbackQuestionId ??
    '';

  if (!questionId) return null;

  return {
    questionId,
    quizId: strOrUndef(r.quizId) ?? strOrUndef((r as any).QuizId),
    quizTitle: strOrUndef(r.quizTitle) ?? strOrUndef((r as any).QuizTitle),
    caseId: strOrUndef(r.caseId) ?? strOrUndef((r as any).CaseId),
    caseTitle: strOrUndef(r.caseTitle) ?? strOrUndef((r as any).CaseTitle),
    questionText: String(r.questionText ?? (r as any).QuestionText ?? ''),
    type: String(r.type ?? (r as any).Type ?? ''),
    optionA: strOrUndef(r.optionA ?? (r as any).OptionA),
    optionB: strOrUndef(r.optionB ?? (r as any).OptionB),
    optionC: strOrUndef(r.optionC ?? (r as any).OptionC),
    optionD: strOrUndef(r.optionD ?? (r as any).OptionD),
    correctAnswer: String(r.correctAnswer ?? (r as any).CorrectAnswer ?? ''),
    imageUrl: r.imageUrl != null ? String(r.imageUrl) : (r as any).ImageUrl != null ? String((r as any).ImageUrl) : undefined,
  };
}

export async function fetchExpertQuizQuestions(quizId: string): Promise<ExpertQuizQuestion[]> {
  try {
    const { data } = await http.get<unknown>(`/api/expert/quizzes/${quizId}/questions`);
    const body = data as any;

    const listCandidate = body?.result ?? body?.items ?? body;
    const list = Array.isArray(listCandidate) ? listCandidate : [];
    return list
      .map((row) => mapExpertQuizQuestion(row))
      .filter((q): q is ExpertQuizQuestion => q !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertQuizQuestionById(questionId: string): Promise<ExpertQuizQuestion> {
  try {
    const { data } = await http.get<unknown>(`/api/expert/questions/${questionId}`);
    const body = data as any;
    const row = body?.result ?? body;
    const mapped = mapExpertQuizQuestion(row, questionId);
    if (!mapped) throw new Error('Invalid question response from server');
    return mapped;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createExpertQuizQuestion(
  quizId: string,
  input: Omit<CreateExpertQuizQuestionRequest, 'quizId'>,
): Promise<ExpertQuizQuestion> {
  try {
    // Build payload without quizId (already in URL route)
    const payload = {
      caseId: input.caseId || undefined,
      questionText: input.questionText,
      type: input.type || 'selection-choice',
      optionA: input.optionA || undefined,
      optionB: input.optionB || undefined,
      optionC: input.optionC || undefined,
      optionD: input.optionD || undefined,
      correctAnswer: input.correctAnswer,
      imageUrl: input.imageUrl || undefined,
    };
    const { data } = await http.post<unknown>(`/api/expert/quizzes/${quizId}/questions`, payload);
    const body = data as any;
    const row = body?.result ?? body;
    const mapped = mapExpertQuizQuestion(row);
    if (!mapped) throw new Error('Invalid quiz question response from server');
    return mapped;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateExpertQuizQuestion(
  questionId: string,
  input: Omit<UpdateExpertQuizQuestionRequest, 'questionId'>,
): Promise<ExpertQuizQuestion> {
  const bodyWithId = {
    questionId,
    QuestionId: questionId,
    ...input,
  };

  // Theo log của bạn: route `/api/expert/questions` không cho `PUT` (405),
  // nên ưu tiên `PATCH /api/expert/questions` trước.
  // Tránh `POST` để không gây hành vi "create".
  const attempts: Array<() => Promise<ExpertQuizQuestion>> = [
    async () => {
      const { data } = await http.patch<unknown>(`/api/expert/questions`, bodyWithId);
      const row = (data as any)?.result ?? data;
      const mapped = mapExpertQuizQuestion(row, questionId);
      if (!mapped) throw new Error('Invalid quiz question response from server');
      return mapped;
    },
    async () => {
      const { data } = await http.put<unknown>(`/api/expert/questions`, bodyWithId);
      const row = (data as any)?.result ?? data;
      const mapped = mapExpertQuizQuestion(row, questionId);
      if (!mapped) throw new Error('Invalid quiz question response from server');
      return mapped;
    },
    async () => {
      const { data } = await http.patch<unknown>(`/api/expert/questions/${questionId}`, bodyWithId);
      const row = (data as any)?.result ?? data;
      const mapped = mapExpertQuizQuestion(row, questionId);
      if (!mapped) throw new Error('Invalid quiz question response from server');
      return mapped;
    },
    async () => {
      const { data } = await http.put<unknown>(`/api/expert/questions/${questionId}`, bodyWithId);
      const row = (data as any)?.result ?? data;
      const mapped = mapExpertQuizQuestion(row, questionId);
      if (!mapped) throw new Error('Invalid quiz question response from server');
      return mapped;
    },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(getApiErrorMessage(lastErr));
}

export async function deleteExpertQuizQuestion(questionId: string): Promise<void> {
  try {
    await http.delete(`/api/expert/questions/${questionId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

