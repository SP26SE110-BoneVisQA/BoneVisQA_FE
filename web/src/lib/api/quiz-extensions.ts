import { http } from './client';

// Detailed Review Types
export interface DetailedReview {
  attemptId: string;
  quizTitle: string;
  score: number | null;
  completedAt: string | null;
  totalQuestions: number;
  correctAnswers: number;
  questions: QuestionReview[];
}

export interface QuestionReview {
  questionId: string;
  questionText: string;
  studentAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  aiExplanation: string | null;
  topicTags: string[];
  relatedCases: RelatedCase[];
  /** Lecturer feedback for this specific question answer */
  lecturerFeedback?: string | null;
  /** Reference answer provided by lecturer/expert */
  referenceAnswer?: string | null;
  /** Image URL for X-ray images associated with this question */
  imageUrl?: string | null;
  /** Case title associated with this question */
  caseTitle?: string | null;
  /** Option A text */
  optionA?: string | null;
  /** Option B text */
  optionB?: string | null;
  /** Option C text */
  optionC?: string | null;
  /** Option D text */
  optionD?: string | null;
}

export interface RelatedCase {
  caseId: string;
  caseTitle: string;
  boneSpecialty: string | null;
}

// Spaced Repetition Types
export interface ReviewItem {
  scheduleId: string;
  caseId: string | null;
  quizId: string | null;
  questionId: string | null;
  caseTitle: string;
  questionText: string;
  correctAnswer: string | null;
  nextReviewDate: string;
  repetitionCount: number;
  daysOverdue: number;
}

export interface SpacedRepetitionStats {
  totalReviews: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  overdue: number;
  mastered: number;
}

// Adaptive Quiz Types
export interface AdaptiveQuizPreview {
  quizId: string;
  quizTitle: string;
  isAdaptive: boolean;
  difficulty: string;
  totalQuestions: number;
  questionsByDifficulty: Record<string, number>;
  estimatedDifficulty: string;
}

export interface AdaptiveQuestion {
  questionId: string;
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  currentDifficulty: string;
  imageUrl: string | null;
  index: number;
}

export const quizExtensionsApi = {
  // Detailed Review
  getDetailedReview: async (attemptId: string): Promise<DetailedReview> => {
    const { data } = await http.get<DetailedReview>(`/api/quiz-extensions/review/${attemptId}/detailed`);
    return data;
  },

  generateReviewItems: async (attemptId: string, aiExplanations?: string): Promise<void> => {
    await http.post(`/api/quiz-extensions/review/${attemptId}/generate`, aiExplanations);
  },

  getQuestionExplanation: async (attemptId: string, questionId: string): Promise<{ explanation: string | null }> => {
    const { data } = await http.get<{ explanation: string | null }>(`/api/quiz-extensions/review/${attemptId}/explanation/${questionId}`);
    return data;
  },

  updateExplanation: async (reviewItemId: string, explanation: string): Promise<void> => {
    await http.put(`/api/quiz-extensions/review/${reviewItemId}/explanation`, explanation);
  },

  // Spaced Repetition
  getDueReviews: async (limit = 20): Promise<ReviewItem[]> => {
    const { data } = await http.get<ReviewItem[]>('/api/quiz-extensions/spaced-repetition/due', { params: { limit } });
    return data;
  },

  getSpacedRepetitionStats: async (): Promise<SpacedRepetitionStats> => {
    const { data } = await http.get<SpacedRepetitionStats>('/api/quiz-extensions/spaced-repetition/stats');
    return data;
  },

  scheduleReview: async (request: {
    studentId: string;
    caseId?: string;
    quizId?: string;
    questionId?: string;
    wasCorrect: boolean;
  }): Promise<void> => {
    await http.post('/api/quiz-extensions/spaced-repetition/schedule', request);
  },

  submitReview: async (scheduleId: string, quality: number): Promise<void> => {
    await http.post('/api/quiz-extensions/spaced-repetition/review', { scheduleId, quality });
  },

  deleteReview: async (scheduleId: string): Promise<void> => {
    await http.delete(`/api/quiz-extensions/spaced-repetition/${scheduleId}`);
  },

  // Adaptive Quiz
  getAdaptiveQuizPreview: async (quizId: string): Promise<AdaptiveQuizPreview> => {
    const { data } = await http.get<AdaptiveQuizPreview>(`/api/quiz-extensions/adaptive/${quizId}/preview`);
    return data;
  },

  getNextQuestions: async (attemptId: string, count = 1): Promise<AdaptiveQuestion[]> => {
    const { data } = await http.get<AdaptiveQuestion[]>(`/api/quiz-extensions/adaptive/${attemptId}/next-questions`, { params: { count } });
    return data;
  },

  submitAdaptiveAnswer: async (request: {
    studentId: string;
    caseId?: string;
    quizId?: string;
    questionId?: string;
    wasCorrect: boolean;
    spacedRepetitionEnabled: boolean;
  }): Promise<{ newDifficulty: string }> => {
    const { data } = await http.post<{ newDifficulty: string }>(`/api/quiz-extensions/adaptive/${request.quizId}/answer`, request);
    return data;
  },

  enableAdaptiveMode: async (quizId: string): Promise<void> => {
    await http.post(`/api/quiz-extensions/quiz/${quizId}/enable-adaptive`);
  },

  enableSpacedRepetition: async (quizId: string): Promise<void> => {
    await http.post(`/api/quiz-extensions/quiz/${quizId}/enable-spaced-repetition`);
  },
};
