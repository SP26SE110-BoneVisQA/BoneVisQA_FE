/**
 * Lecturer - Expert Quiz Library API
 * 
 * API cho Lecturer xem và gán quiz từ thư viện của Expert vào lớp học
 */

import { http, getApiErrorMessage } from './client';

// ========== Types ==========

export interface ExpertQuizForLecturer {
  id: string;
  title: string;
  topic: string | null;
  openTime: string | null;
  closeTime: string | null;
  timeLimit: number | null;
  passingScore: number | null;
  isAiGenerated: boolean;
  difficulty: string | null;
  classification: string | null;
  createdAt: string | null;
  expertName: string | null;
  questionCount: number;  // Số câu hỏi trong quiz - QUAN TRỌNG
}

export interface ExpertQuizQuestion {
  questionId: string;
  questionText: string;
  type: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  caseTitle: string | null;
  correctAnswer: string | null;  // Đáp án đúng: A, B, C hoặc D
  imageUrl: string | null;  // URL ảnh câu hỏi
}

export interface ExpertQuizPagedResult {
  items: ExpertQuizForLecturer[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export interface AssignExpertQuizRequest {
  openTime?: string | null;
  closeTime?: string | null;
  passingScore?: number | null;
  timeLimitMinutes?: number | null;
}

export interface AssignExpertQuizResult {
  message: string;
  result: {
    classId: string;
    className: string;
    quizId: string;
    quizName: string;
    assignedAt: string;
    openTime: string | null;
    closeTime: string | null;
    passingScore: number | null;
    timeLimitMinutes: number | null;
    isAlreadyAssigned: boolean;  // True nếu quiz đã được assign cho lớp trước đó
  };
  questionCount: number;
  note: string;
}

// ========== Normalize Functions ==========

function normalizeExpertQuiz(raw: unknown): ExpertQuizForLecturer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  return {
    id: String(r.id ?? r.Id ?? ''),
    title: String(r.title ?? r.Title ?? ''),
    topic: r.topic != null ? String(r.topic) : r.Topic != null ? String(r.Topic) : null,
    openTime: r.openTime != null ? String(r.openTime) : r.OpenTime != null ? String(r.OpenTime) : null,
    closeTime: r.closeTime != null ? String(r.closeTime) : r.CloseTime != null ? String(r.CloseTime) : null,
    timeLimit: Number(r.timeLimit ?? r.TimeLimit ?? 0) || null,
    passingScore: Number(r.passingScore ?? r.PassingScore ?? 0) || null,
    isAiGenerated: Boolean(r.isAiGenerated ?? r.IsAiGenerated ?? false),
    difficulty: r.difficulty != null ? String(r.difficulty) : r.Difficulty != null ? String(r.Difficulty) : null,
    classification: r.classification != null ? String(r.classification) : r.Classification != null ? String(r.Classification) : null,
    createdAt: r.createdAt != null ? String(r.createdAt) : r.CreatedAt != null ? String(r.CreatedAt) : null,
    expertName: r.expertName != null ? String(r.expertName) : r.ExpertName != null ? String(r.ExpertName) : null,
    questionCount: Number(r.questionCount ?? r.QuestionCount ?? 0),
  };
}

function normalizeExpertQuestion(raw: unknown): ExpertQuizQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  return {
    questionId: String(r.questionId ?? r.QuestionId ?? ''),
    questionText: String(r.questionText ?? r.QuestionText ?? ''),
    type: r.type != null ? String(r.type) : r.Type != null ? String(r.Type) : null,
    optionA: r.optionA != null ? String(r.optionA) : r.OptionA != null ? String(r.OptionA) : null,
    optionB: r.optionB != null ? String(r.optionB) : r.OptionB != null ? String(r.OptionB) : null,
    optionC: r.optionC != null ? String(r.optionC) : r.OptionC != null ? String(r.OptionC) : null,
    optionD: r.optionD != null ? String(r.optionD) : r.OptionD != null ? String(r.OptionD) : null,
    caseTitle: r.caseTitle != null ? String(r.caseTitle) : r.CaseTitle != null ? String(r.CaseTitle) : null,
    correctAnswer: r.correctAnswer != null ? String(r.correctAnswer) : r.CorrectAnswer != null ? String(r.CorrectAnswer) : null,
    imageUrl: r.imageUrl != null ? String(r.imageUrl) : (r as any).ImageUrl != null ? String((r as any).ImageUrl) : null,
  };
}

// ========== API Functions ==========

/**
 * Lấy danh sách quiz từ thư viện của Expert cho Lecturer.
 * 
 * MÔ TẢ LUỒNG:
 * 1. Lecturer muốn xem thư viện quiz của Expert
 * 2. API này trả về danh sách quiz kèm số câu hỏi trong mỗi quiz
 * 3. Chỉ trả về quiz do Expert tạo (CreatedByExpertId != null)
 * 
 * @param pageIndex - Trang hiện tại (mặc định: 1)
 * @param pageSize - Số item mỗi trang (mặc định: 10)
 * @param topic - Lọc theo chủ đề (optional)
 * @param difficulty - Lọc theo độ khó: Easy, Medium, Hard (optional)
 * @param classification - Lọc theo phân loại khóa học (optional)
 */
export async function fetchExpertQuizzesForLecturer(
  pageIndex = 1,
  pageSize = 10,
  topic?: string,
  difficulty?: string,
  classification?: string
): Promise<ExpertQuizPagedResult> {
  try {
    const params = new URLSearchParams({
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
    });

    if (topic) params.append('topic', topic);
    if (difficulty) params.append('difficulty', difficulty);
    if (classification) params.append('classification', classification);

    const { data } = await http.get<ExpertQuizPagedResult>(
      `/api/lecturer/expert-quizzes?${params.toString()}`
    );

    const items = Array.isArray(data?.items)
      ? data.items.map(normalizeExpertQuiz).filter((q): q is ExpertQuizForLecturer => q !== null)
      : [];

    return {
      items,
      totalCount: data?.totalCount ?? 0,
      pageIndex: data?.pageIndex ?? pageIndex,
      pageSize: data?.pageSize ?? pageSize,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Lấy thông tin chi tiết một quiz từ thư viện Expert.
 * 
 * @param quizId - ID của quiz cần xem chi tiết
 */
export async function fetchExpertQuizDetail(quizId: string): Promise<ExpertQuizForLecturer> {
  try {
    const { data } = await http.get<ExpertQuizForLecturer>(
      `/api/lecturer/expert-quizzes/${quizId}`
    );

    const normalized = normalizeExpertQuiz(data);
    if (!normalized) throw new Error('Invalid quiz response from server');
    return normalized;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Lấy danh sách câu hỏi trong một quiz từ thư viện Expert.
 * 
 * MÔ TẢ LUỒNG:
 * 1. Lecturer đã chọn được quiz phù hợp
 * 2. Trước khi gán vào lớp, Lecturer muốn xem trước các câu hỏi
 * 3. API này trả về danh sách câu hỏi với các lựa chọn và đáp án đúng
 * 
 * @param quizId - ID của quiz cần xem câu hỏi
 */
export async function fetchExpertQuizQuestions(quizId: string): Promise<ExpertQuizQuestion[]> {
  try {
    const { data } = await http.get<{ message: string; quizId: string; questionCount: number; questions: unknown[] }>(
      `/api/lecturer/expert-quizzes/${quizId}/questions`
    );

    const questions = Array.isArray(data?.questions)
      ? data.questions.map(normalizeExpertQuestion).filter((q): q is ExpertQuizQuestion => q !== null)
      : [];

    return questions;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Gán quiz từ thư viện Expert vào lớp học.
 * 
 * MÔ TẢ LUỒNG:
 * 1. Lecturer đã xem và chọn được quiz phù hợp cho lớp mình
 * 2. Lecturer quyết định gán quiz này vào lớp
 * 3. Hệ thống sẽ gán TẤT CẢ câu hỏi trong quiz đó vào ClassQuizSession
 * 4. Không cần chọn số lượng câu hỏi - lấy cả bộ
 * 
 * VÍ DỤ:
 * - Quiz "Lower Limb Module" có 10 câu hỏi → Student nhận đủ 10 câu
 * - Quiz "Chest X-Ray Basics" có 5 câu hỏi → Student nhận đủ 5 câu
 * 
 * @param classId - ID của lớp học cần gán quiz
 * @param quizId - ID của quiz từ thư viện Expert
 * @param request - Thông tin tùy chọn: thời gian mở/đóng, thời gian làm bài, điểm đạt
 */
export async function assignExpertQuizToClass(
  classId: string,
  quizId: string,
  request?: AssignExpertQuizRequest
): Promise<AssignExpertQuizResult> {
  try {
    const { data } = await http.post<AssignExpertQuizResult>(
      `/api/lecturer/classes/${classId}/expert-quizzes/${quizId}`,
      request ?? {}
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Copy Expert Quiz ==========

export interface CopyExpertQuizRequest {
  title?: string;
}

export interface CopiedExpertQuizResult {
  newQuizId: string;
  newQuizTitle: string;
  originalQuizId: string;
  originalQuizTitle: string;
  questionCount: number;
  createdAt: string;
}

/**
 * Tạo bản copy của một Expert Quiz để Lecturer có thể tùy chỉnh.
 * Quiz mới sẽ không có CreatedByExpertId và có thể edit câu hỏi.
 */
export async function copyExpertQuiz(
  expertQuizId: string,
  request?: CopyExpertQuizRequest
): Promise<CopiedExpertQuizResult> {
  try {
    const { data } = await http.post<{ message: string; result: CopiedExpertQuizResult }>(
      `/api/lecturer/expert-quizzes/${expertQuizId}/copy`,
      request ?? {}
    );
    return data.result;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Update Quiz Question ==========

export interface UpdateQuestionRequest {
  questionText: string;
  type?: string | null;
  correctAnswer?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  imageUrl?: string | null;
  referenceAnswer?: string | null;
  maxScore?: number;
}

/**
 * Cập nhật thông tin một câu hỏi trong quiz của Lecturer.
 * Chỉ hoạt động với quiz do Lecturer tạo (không phải Expert Quiz gốc).
 */
export async function updateQuizQuestion(
  questionId: string,
  request: UpdateQuestionRequest
): Promise<void> {
  try {
    await http.put(
      `/api/lecturer/quizzes/questions/${questionId}`,
      request
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== Delete Quiz ==========

/**
 * Xóa một quiz của Lecturer.
 * Ai cũng có thể xóa quiz (không yêu cầu quyền Expert).
 */
export async function deleteQuiz(quizId: string): Promise<void> {
  try {
    await http.delete(`/api/lecturer/quizzes/${quizId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
