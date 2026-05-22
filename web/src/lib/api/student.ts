import { http, getApiErrorMessage } from './client';
import type {
  AnnouncementAssignmentInfo,
  AssignedQuizItem,
  QuizSessionDto,
  StudentAnnouncement,
  StudentCaseCatalogItem,
  StudentCaseCatalogDetail,
  StudentCaseCatalogOrigin,
  StudentCaseHistoryItem,
  StudentHistoryKind,
  StudentCatalogCaseImage,
  StudentPracticeQuiz,
  StudentProfile,
  StudentProfileUpdatePayload,
  StudentProgress,
  StudentQuizAnswer,
  StudentQuizSubmissionResult,
  StudentQuizResultDto,
  StudentRecentActivityItem,
  StudentSessionQuestion,
  StudentSubmitQuestionDto,
  StudentTopicStat,
} from './types';
import { isValidNormalizedBoundingBox } from '@/lib/utils/annotations';

function normalizeDifficulty(raw: unknown): StudentCaseHistoryItem['difficulty'] {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'advanced') return 'advanced';
  if (value === 'intermediate') return 'intermediate';
  return 'basic';
}

function pickStringAny(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized.length > 0) return normalized;
  }
  return null;
}

/** Hai nhãn catalog: expert tạo vs promote từ request sinh viên (theo field BE hoặc heuristic). */
function inferCatalogCaseOrigin(item: Record<string, unknown>): StudentCaseCatalogOrigin {
  const raw =
    pickStringAny(item, [
      'caseOrigin',
      'CaseOrigin',
      'origin',
      'Origin',
      'source',
      'Source',
      'caseSource',
      'CaseSource',
      'libraryCaseSource',
    ])?.toLowerCase() ?? '';
  const promoted =
    item.isPromotedFromStudentRequest === true ||
    item.promotedFromStudentRequest === true ||
    item.wasPromotedFromStudent === true ||
    item.fromStudentRequest === true ||
    item.IsPromotedFromStudentRequest === true;
  if (
    promoted ||
    raw.includes('community') ||
    raw.includes('studentrequest') ||
    raw.includes('student_request') ||
    raw.includes('promoted') ||
    raw.includes('request')
  ) {
    return 'communityPromoted';
  }
  return 'expertCreated';
}

function parseTagsFromCatalogRow(item: Record<string, unknown>): string[] {
  const tags = item.tags ?? item.Tags ?? item.tagNames ?? item.TagNames ?? item.caseTags;
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t ?? '').trim()).filter(Boolean);
  }
  if (typeof tags === 'string' && tags.trim()) {
    return tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Không ép mọi giá trị lạ thành Basic — hiển thị raw hoặc "—". */
function normalizeCatalogDifficultyLabel(raw: unknown): {
  tier: 'basic' | 'intermediate' | 'advanced' | null;
  label: string;
} {
  const rawStr = String(raw ?? '').trim();
  if (!rawStr) return { tier: null, label: '—' };
  const value = rawStr.toLowerCase();
  if (value === 'advanced' || value === 'expert') return { tier: 'advanced', label: rawStr };
  if (value === 'intermediate' || value === 'moderate') return { tier: 'intermediate', label: rawStr };
  if (value === 'basic' || value === 'beginner' || value === 'intro' || value === 'easy') {
    return { tier: 'basic', label: rawStr };
  }
  return { tier: null, label: rawStr };
}

/**
 * Classify history rows for the two student tabs. Prefer explicit API fields; fall back to light heuristics.
 */
function inferHistoryKind(item: Record<string, unknown>): StudentHistoryKind {
  const explicit =
    item.historyKind ??
    item.historyType ??
    item.interactionSource ??
    item.source ??
    item.origin ??
    item.caseSource;
  if (typeof explicit === 'string') {
    const e = explicit.toLowerCase();
    if (
      e.includes('catalog') ||
      e.includes('library') ||
      e.includes('expert') ||
      e.includes('published') ||
      e.includes('case_study') ||
      e === 'casestudy'
    ) {
      return 'caseStudy';
    }
    if (
      e.includes('upload') ||
      e.includes('custom') ||
      e.includes('personal') ||
      e.includes('student_image') ||
      e.includes('visualqa')
    ) {
      return 'personalQa';
    }
  }
  if (item.fromCatalog === true || item.isFromCatalog === true) return 'caseStudy';
  if (item.isCustomUpload === true || item.isUpload === true || item.hasCustomImage === true) {
    return 'personalQa';
  }
  const catalogId = item.catalogCaseId ?? item.publishedCaseId ?? item.caseCatalogId;
  if (catalogId != null && String(catalogId).trim()) return 'caseStudy';

  const thumb = String(item.thumbnailUrl ?? item.imageUrl ?? '').toLowerCase();
  if (
    thumb.includes('customimage') ||
    thumb.includes('student-visual') ||
    thumb.includes('/uploads/students/') ||
    thumb.includes('user-upload')
  ) {
    return 'personalQa';
  }

  return 'caseStudy';
}

function mapStudentCase(row: unknown): StudentCaseHistoryItem | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  /** Visual QA history list rows are keyed by `sessionId` (BE: VisualQaSessionHistoryItemDto). */
  const id = String(
    item.sessionId ??
      item.SessionId ??
      item.id ??
      item.caseId ??
      item.case_id ??
      item.answerId ??
      item.answer_id ??
      '',
  ).trim();
  if (!id) return null;

  const historyKind = inferHistoryKind(item);
  const catalogRaw =
    item.catalogCaseId ??
    item.catalog_case_id ??
    item.publishedCaseId ??
    item.caseCatalogId ??
    item.case_catalog_id ??
    item.libraryCaseId;
  const catalogCaseId =
    catalogRaw != null && String(catalogRaw).trim() ? String(catalogRaw).trim() : null;

  const qaMessages = Array.isArray(item.qa_messages)
    ? (item.qa_messages as Array<Record<string, unknown>>)
    : Array.isArray(item.qaMessages)
      ? (item.qaMessages as Array<Record<string, unknown>>)
      : Array.isArray(item.messages)
        ? (item.messages as Array<Record<string, unknown>>)
        : [];
  const sessionStatus = pickStringAny(item, ['status', 'session_status', 'sessionStatus']) ?? '';
  if (sessionStatus) {
    const normalizedStatus = sessionStatus.toLowerCase();
    const hiddenStatuses = new Set(['deleted', 'archived', 'cancelled']);
    if (hiddenStatuses.has(normalizedStatus)) return null;
  }
  const snippet =
    pickStringAny(item, ['questionSnippet', 'question_snippet', 'QuestionSnippet']) ?? null;
  const lastUserQuestion =
    [...qaMessages]
      .reverse()
      .find((msg) => {
        const role = String(msg.role ?? msg.sender ?? '').toLowerCase();
        return role === 'user' || role === 'student';
      })?.content ??
    pickStringAny(item, ['lastQuestion', 'last_question', 'lastQuestionAsked', 'questionText', 'question_text', 'question']);
  const normalizedLastQuestion =
    lastUserQuestion != null && String(lastUserQuestion).trim()
      ? String(lastUserQuestion).trim()
      : null;
  const firstQuestionFallback = pickStringAny(item, ['questionText', 'question_text', 'question']);
  const trimmedQuestionFallback = firstQuestionFallback ? firstQuestionFallback.slice(0, 50).trim() : null;
  const previewQuestion = normalizedLastQuestion ?? snippet ?? trimmedQuestionFallback;
  const imageFromMessages =
    [...qaMessages]
      .reverse()
      .find((msg) => msg.imageUrl != null || msg.image_url != null || msg.thumbnailUrl != null || msg.thumbnail_url != null)
      ?.imageUrl ??
    [...qaMessages]
      .reverse()
      .find((msg) => msg.imageUrl != null || msg.image_url != null || msg.thumbnailUrl != null || msg.thumbnail_url != null)
      ?.image_url ??
    [...qaMessages]
      .reverse()
      .find((msg) => msg.imageUrl != null || msg.image_url != null || msg.thumbnailUrl != null || msg.thumbnail_url != null)
      ?.thumbnailUrl ??
    [...qaMessages]
      .reverse()
      .find((msg) => msg.imageUrl != null || msg.image_url != null || msg.thumbnailUrl != null || msg.thumbnail_url != null)
      ?.thumbnail_url;

  const sessionIdMapped = pickStringAny(item, ['sessionId', 'SessionId', 'session_id']);
  const reviewStateRaw = pickStringAny(item, ['reviewState', 'ReviewState', 'review_state']);
  const lastResponderMapped = pickStringAny(item, ['lastResponderRole', 'LastResponderRole', 'last_responder_role']);
  const updatedAtMapped =
    pickStringAny(item, ['updatedAt', 'UpdatedAt', 'updated_at']) ?? undefined;

  return {
    id,
    sessionId: sessionIdMapped,
    title: String(
      pickStringAny(item, ['title']) ?? previewQuestion ?? 'Untitled session',
    ),
    lastQuestionAsked: normalizedLastQuestion ?? snippet ?? null,
    questionSnippet: snippet,
    thumbnailUrl:
      pickStringAny(item, ['thumbnailUrl', 'thumbnail_url', 'imageUrl', 'image_url']) != null
        ? String(pickStringAny(item, ['thumbnailUrl', 'thumbnail_url', 'imageUrl', 'image_url']))
        : imageFromMessages != null
            ? String(imageFromMessages)
          : undefined,
    boneLocation: (() => {
      const v = pickStringAny(item, ['boneLocation', 'bone_location', 'regionName', 'region']);
      if (v != null && String(v).trim()) return String(v).trim();
      return historyKind === 'personalQa' ? '' : 'Clinical case';
    })(),
    lesionType: (() => {
      const v = pickStringAny(item, ['lesionType', 'lesion_type', 'caseType', 'categoryName']);
      if (v != null && String(v).trim()) return String(v).trim();
      return historyKind === 'personalQa' ? '' : 'Visual QA';
    })(),
    difficulty: normalizeDifficulty(item.difficulty ?? item.level),
    duration: pickStringAny(item, ['duration']) ?? undefined,
    progress: typeof item.progress === 'number' ? item.progress : undefined,
    status: sessionStatus || undefined,
    reviewState: reviewStateRaw,
    lastResponderRole: lastResponderMapped,
    askedAt:
      pickStringAny(item, ['askedAt', 'asked_at', 'createdAt', 'created_at']) ??
      updatedAtMapped ??
      undefined,
    updatedAt: updatedAtMapped ?? null,
    keyImagingFindings:
      item.keyImagingFindings != null && item.keyImagingFindings !== ''
        ? String(item.keyImagingFindings)
        : null,
    reflectiveQuestions:
      item.reflectiveQuestions != null && item.reflectiveQuestions !== ''
        ? String(item.reflectiveQuestions)
        : null,
    historyKind,
    catalogCaseId,
    rejectionReason: pickStringAny(item, [
      'rejectionReason',
      'RejectionReason',
      'rejection_reason',
      'lecturerRejectionReason',
    ]),
  };
}

function mapStudentCaseCatalog(row: unknown): StudentCaseCatalogItem | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const id = String(item.id ?? item.caseId ?? '');
  if (!id) return null;

  const categoryName =
    pickStringAny(item, ['categoryName', 'CategoryName', 'category', 'Category']) ?? '';
  const boneLocation =
    pickStringAny(item, ['location', 'boneLocation', 'regionName', 'bone_location']) ?? '';
  const lesionType =
    pickStringAny(item, ['lesionType', 'lesion_type', 'caseType']) ??
    (categoryName || 'Unknown lesion');
  const location = boneLocation || categoryName || 'Unknown location';
  const { tier, label: difficultyLabel } = normalizeCatalogDifficultyLabel(
    item.difficulty ?? item.level ?? item.Difficulty,
  );
  const createdAt =
    pickStringAny(item, ['createdAt', 'CreatedAt', 'approvedAt', 'ApprovedAt', 'publishedAt']) ??
    undefined;

  return {
    id,
    title: String(item.title ?? 'Untitled case'),
    imageUrl:
      item.imageUrl != null
        ? String(item.imageUrl)
        : item.thumbnailUrl != null
          ? String(item.thumbnailUrl)
          : item.primaryImageUrl != null
            ? String(item.primaryImageUrl)
            : undefined,
    location,
    categoryDisplay: categoryName || undefined,
    lesionType,
    difficultyTier: tier,
    difficultyLabel,
    difficulty: tier ?? undefined,
    tags: parseTagsFromCatalogRow(item),
    createdAt,
    caseOrigin: inferCatalogCaseOrigin(item),
  };
}

function parseCatalogDetailImages(item: Record<string, unknown>): StudentCatalogCaseImage[] {
  const rawList =
    item.images ??
    item.Images ??
    item.caseImages ??
    item.CaseImages ??
    item.anonymousImages ??
    item.AnonymousImages;
  if (!Array.isArray(rawList)) return [];
  const out: StudentCatalogCaseImage[] = [];
  for (const row of rawList) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const url =
      pickStringAny(r, ['imageUrl', 'ImageUrl', 'url', 'Url', 'thumbnailUrl', 'ThumbnailUrl']) ?? '';
    if (!url.trim()) continue;
    const boxRaw =
      r.roiBoundingBox ??
      r.RoiBoundingBox ??
      r.boundingBox ??
      r.normalizedBoundingBox ??
      r.NormalizedBoundingBox;
    let roiBoundingBox: StudentCatalogCaseImage['roiBoundingBox'] = null;
    if (boxRaw && typeof boxRaw === 'object') {
      const b = boxRaw as Record<string, unknown>;
      const cand = {
        x: Number(b.x ?? b.X),
        y: Number(b.y ?? b.Y),
        width: Number(b.width ?? b.Width),
        height: Number(b.height ?? b.Height),
      };
      if (isValidNormalizedBoundingBox(cand)) roiBoundingBox = cand;
    }
    out.push({ imageUrl: url.trim(), roiBoundingBox });
  }
  return out;
}

function mapStudentCaseCatalogDetail(row: unknown): StudentCaseCatalogDetail | null {
  if (!row || typeof row !== 'object') return null;
  const base = mapStudentCaseCatalog(row);
  if (!base) return null;
  const item = row as Record<string, unknown>;

  const categoryName = pickStringAny(item, ['categoryName', 'CategoryName', 'category', 'Category']) ?? '';
  const images = parseCatalogDetailImages(item);
  const keyLearningRaw =
    item.keyLearningPoints ??
    item.KeyLearningPoints ??
    item.keyLearnings ??
    item.KeyLearnings ??
    item.keyLearning ??
    item.teachingPoints;
  let keyLearningPoints: string[] | undefined;
  if (Array.isArray(keyLearningRaw)) {
    keyLearningPoints = (keyLearningRaw as unknown[])
      .map((x) => String(x ?? '').trim())
      .filter(Boolean);
  } else if (typeof keyLearningRaw === 'string' && keyLearningRaw.trim()) {
    keyLearningPoints = keyLearningRaw
      .split(/[\n•]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const diagnosis =
    pickStringAny(item, ['diagnosis', 'Diagnosis', 'structuredDiagnosis', 'StructuredDiagnosis']) ??
    undefined;

  return {
    ...base,
    imageUrl: base.imageUrl ?? (item.primaryImageUrl != null ? String(item.primaryImageUrl) : undefined),
    location: base.location || categoryName || 'Unknown location',
    lesionType:
      pickStringAny(item, ['lesionType', 'lesion_type', 'caseType']) ?? (categoryName || base.lesionType),
    categoryDisplay: categoryName || base.categoryDisplay,
    description: item.description != null ? String(item.description) : undefined,
    expertSummary:
      item.expertSummary != null
        ? String(item.expertSummary)
        : item.summary != null
          ? String(item.summary)
          : undefined,
    keyFindings: Array.isArray(item.keyFindings)
      ? (item.keyFindings as unknown[]).map((f) => String(f ?? '').trim()).filter((s) => s.length > 0)
      : typeof item.keyFindings === 'string' && item.keyFindings
        ? item.keyFindings.split(/[\n,;]/).map((s) => s.trim()).filter((s) => s.length > 0)
        : [],
    approvedAt:
      item.approvedAt != null
        ? String(item.approvedAt)
        : item.updatedAt != null
          ? String(item.updatedAt)
          : undefined,
    diagnosis: diagnosis ?? undefined,
    keyLearningPoints,
    images: images.length > 0 ? images : undefined,
    communityReferenceOnly: base.caseOrigin === 'communityPromoted',
  };
}

export async function fetchStudentProfile(): Promise<StudentProfile> {
  try {
    // BE: UsersController — GET /api/users/me (không dùng /api/student/profile)
    const { data } = await http.get<StudentProfile>('/api/users/me', { skipApiToast: true });
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function normalizeStudentAnnouncement(raw: unknown): StudentAnnouncement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.Id ?? '');
  if (!id) return null;

  // Normalize related assignment
  const relRaw = r.relatedAssignment ?? r.RelatedAssignment;
  let relatedAssignment: AnnouncementAssignmentInfo | undefined = undefined;
  if (relRaw && typeof relRaw === 'object') {
    const rel = relRaw as Record<string, unknown>;
    relatedAssignment = {
      assignmentId: rel.assignmentId != null ? String(rel.assignmentId) : undefined,
      assignmentTitle: rel.assignmentTitle != null ? String(rel.assignmentTitle) : undefined,
      assignmentType: rel.assignmentType != null ? String(rel.assignmentType) : undefined,
    };
  }

  return {
    id,
    classId: String(r.classId ?? r.ClassId ?? ''),
    className: r.className != null ? String(r.className) : null,
    title: String(r.title ?? r.Title ?? ''),
    content: String(r.content ?? r.Content ?? ''),
    createdAt: r.createdAt != null ? String(r.createdAt) : null,
    relatedAssignment,
  };
}

export async function fetchStudentAnnouncements(): Promise<StudentAnnouncement[]> {
  try {
    const { data } = await http.get<unknown[]>('/api/student/announcements');
    const list = Array.isArray(data) ? data : [];
    return list.map(normalizeStudentAnnouncement).filter((item): item is StudentAnnouncement => item !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateStudentProfile(
  payload: StudentProfileUpdatePayload,
): Promise<StudentProfile> {
  try {
    const { data } = await http.put<StudentProfile>('/api/users/me', payload);
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchStudentProgress(): Promise<StudentProgress> {
  try {
    const { data } = await http.get<StudentProgress>('/api/student/progress', { skipApiToast: true });
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchStudentPracticeQuiz(topic: string): Promise<StudentPracticeQuiz> {
  try {
    const { data } = await http.get<StudentPracticeQuiz>('/api/student/quizzes/practice', {
      params: { topic },
    });
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * AI Generate Practice Quiz: Student tự tạo quiz ôn luyện bằng AI
 */
export async function generateAIPracticeQuiz(
  topic: string,
  questionCount?: number,
  difficulty?: string
): Promise<{
  success: boolean;
  message?: string;
  questions: Array<{
    questionText: string;
    type: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    caseId?: string;
    caseTitle?: string;
  }>;
}> {
  try {
    const { data } = await http.post<{
      success: boolean;
      message?: string;
      questions: Array<{
        questionText: string;
        type: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctAnswer: string;
        caseId?: string;
        caseTitle?: string;
      }>;
    }>('/api/student/quizzes/practice/generate', {
      topic,
      questionCount,
      difficulty,
    });
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function submitStudentQuiz(
  attemptId: string,
  answers: StudentQuizAnswer[],
): Promise<StudentQuizSubmissionResult> {
  try {
    const { data } = await http.post<StudentQuizSubmissionResult>('/api/student/quizzes/submit', {
      attemptId,
      answers,
    });
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get all quizzes assigned to the current student (from enrolled classes).
 */
export async function getAssignedQuizzes(): Promise<AssignedQuizItem[]> {
  try {
    const { data } = await http.get<unknown>('/api/student/quizzes');
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? (data as { items?: unknown[] }).items ?? []
        : [];
    return (list as Record<string, unknown>[]).map(mapQuizListItem);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function asOptionalNumber(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function mapQuizListItem(item: Record<string, unknown>): AssignedQuizItem {
  const totalQ =
    asOptionalNumber(item.totalQuestions) ??
    asOptionalNumber(item.TotalQuestions) ??
    0;
  const timeLimit =
    asOptionalNumber(item.timeLimit) ??
    asOptionalNumber(item.TimeLimit) ??
    asOptionalNumber(item.timeLimitMinutes) ??
    asOptionalNumber(item.TimeLimitMinutes);
  const passing =
    asOptionalNumber(item.passingScore) ?? asOptionalNumber(item.PassingScore);
  return {
    quizId: String(item.quizId ?? item.QuizId ?? ''),
    quizName: String(item.title ?? item.Title ?? item.quizName ?? 'Untitled quiz'),
    classId: String(item.classId ?? item.ClassId ?? ''),
    className: String(item.className ?? item.ClassName ?? ''),
    topic: item.topic != null ? String(item.topic) : item.Topic != null ? String(item.Topic) : null,
    totalQuestions: totalQ,
    timeLimit,
    passingScore: passing,
    openTime: item.openTime != null ? String(item.openTime) : null,
    closeTime: item.closeTime != null ? String(item.closeTime) : null,
    isCompleted: Boolean(item.isCompleted ?? item.IsCompleted ?? false),
    score: typeof item.score === 'number' ? item.score : null,
    attemptId: item.attemptId != null ? String(item.attemptId) : item.AttemptId != null ? String(item.AttemptId) : null,
    createdAt: item.createdAt != null ? String(item.createdAt) : item.CreatedAt != null ? String(item.CreatedAt) : null,
    answersReleased: Boolean(item.answersReleased ?? item.AnswersReleased ?? false),
  };
}

function pickStr(r: Record<string, unknown>, camel: string, pascal: string): string | null {
  const v = r[camel] ?? r[pascal];
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Đọc chuỗi từ nhiều kiểu tên thuộc tính (camelCase, PascalCase, snake_case). */
function pickStrAny(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length) return s;
  }
  return null;
}

function normalizeStudentSessionQuestion(row: unknown): StudentSessionQuestion {
  const q = row as Record<string, unknown>;
  return {
    questionId: String(pickStrAny(q, 'questionId', 'QuestionId', 'question_id') ?? ''),
    questionText: String(
      pickStrAny(q, 'questionText', 'QuestionText', 'question_text') ?? '',
    ),
    type: pickStrAny(q, 'type', 'Type'),
    caseId: pickStrAny(q, 'caseId', 'CaseId', 'case_id'),
    caseTitle: pickStrAny(q, 'caseTitle', 'CaseTitle', 'case_title'),
    optionA: pickStrAny(q, 'optionA', 'OptionA', 'option_a'),
    optionB: pickStrAny(q, 'optionB', 'OptionB', 'option_b'),
    optionC: pickStrAny(q, 'optionC', 'OptionC', 'option_c'),
    optionD: pickStrAny(q, 'optionD', 'OptionD', 'option_d'),
    imageUrl: pickStrAny(q, 'imageUrl', 'ImageUrl', 'image_url'),
    essayAnswer: pickStrAny(q, 'essayAnswer', 'EssayAnswer', 'essay_answer'),
    correctAnswer: pickStrAny(q, 'correctAnswer', 'CorrectAnswer', 'correct_answer'),
    hint: pickStrAny(q, 'hint', 'Hint'),
    hintAvailable: (() => {
      const v = pickStrAny(q, 'hintAvailable', 'hint_available', 'HintAvailable');
      return v === 'true' || v === 'True' || v === '1' || v === true;
    })(),
    correctAnswers: pickStrAny(q, 'correctAnswers', 'CorrectAnswers', 'correct_answers'),
    acceptedAnswers: pickStrAny(q, 'acceptedAnswers', 'AcceptedAnswers', 'accepted_answers'),
  };
}

function normalizeQuizSessionPayload(raw: unknown): QuizSessionDto {
  const o = raw as Record<string, unknown>;
  const rawQs = o.questions ?? o.Questions;
  const list = Array.isArray(rawQs) ? rawQs : [];
  const rawTl = o.timeLimit ?? o.TimeLimit;
  let timeLimit: number | null = null;
  if (rawTl != null && rawTl !== '') {
    const n = typeof rawTl === 'number' ? rawTl : Number(rawTl);
    if (Number.isFinite(n) && n > 0) timeLimit = Math.round(n);
  }
  // Handle closeTime from BE
  const closeTime = o.closeTime ?? o.CloseTime;
  const closeTimeStr = typeof closeTime === 'string' ? closeTime : (closeTime instanceof Date ? closeTime.toISOString() : null);
  return {
    attemptId: String(o.attemptId ?? o.AttemptId ?? ''),
    quizId: String(o.quizId ?? o.QuizId ?? ''),
    title: String(o.title ?? o.Title ?? ''),
    topic: pickStr(o, 'topic', 'Topic'),
    timeLimit,
    closeTime: closeTimeStr,
    questions: list.map(normalizeStudentSessionQuestion),
  };
}

/**
 * Start a quiz session: POST /api/student/quizzes/{quizId}/start
 * Returns questions so the student can begin answering.
 */
export async function startQuizSession(quizId: string): Promise<QuizSessionDto> {
  try {
    const { data } = await http.post<unknown>(`/api/student/quizzes/${quizId}/start`);
    return normalizeQuizSessionPayload(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Student requests retake: POST /api/student/quizzes/{quizId}/request-retake
 * Sends notification + email to the lecturer.
 */
export async function requestRetake(quizId: string): Promise<{ message: string }> {
  try {
    const { data } = await http.post<unknown>(`/api/student/quizzes/${quizId}/request-retake`);
    const o = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
    return { message: String(o.message ?? 'Request sent.') };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * ================================================================
 * HÀM MAP KẾT QUẢ SUBMIT QUIZ
 * ================================================================
 * Chuyển đổi response từ API thành StudentQuizResultDto
 * 
 * XỬ LÝ:
 * - Ép kiểu cả camelCase (JavaScript) và PascalCase (C#) 
 *   vì API backend có thể trả về cả 2 format
 * - score: chuyển thành number, null nếu không có
 * - passed: boolean, mặc định false
 * - correctAnswers: số nguyên, mặc định 0
 * 
 * LƯU Ý: score từ API là điểm phần trăm (0-100)
 * ================================================================
 */
function mapSubmitQuizResult(raw: unknown): StudentQuizResultDto {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const scoreRaw = r.score ?? r.Score;
  const passingRaw = r.passingScore ?? r.PassingScore;
  return {
    attemptId: String(r.attemptId ?? r.AttemptId ?? ''),
    quizId: String(r.quizId ?? r.QuizId ?? ''),
    score: scoreRaw != null && scoreRaw !== '' ? Number(scoreRaw) : null,
    passingScore: passingRaw != null && passingRaw !== '' ? Number(passingRaw) : null,
    passed: Boolean(r.passed ?? r.Passed ?? false),
    totalQuestions: Number(r.totalQuestions ?? r.TotalQuestions ?? 0),
    correctAnswers: Number(r.correctAnswers ?? r.CorrectAnswers ?? 0),
    ungradedEssayCount: r.ungradedEssayCount != null ? Number(r.ungradedEssayCount) : r.UngradedEssayCount != null ? Number(r.UngradedEssayCount) : null,
  };
}

/**
 * ================================================================
 * GỌI API SUBMIT QUIZ
 * ================================================================
 * POST /api/student/quizzes/submit
 * 
 * Body gửi lên:
 * {
 *   attemptId: string,
 *   answers: [
 *     { questionId, studentAnswer, essayAnswer?, selectedAnswers? }
 *   ]
 * }
 * 
 * Response trả về: StudentQuizResultDto (đã map bởi mapSubmitQuizResult)
 * 
 * Trả về:
 * - score: điểm phần trăm (0-100)
 * - passed: true/false
 * - correctAnswers: số câu đúng
 * - totalQuestions: tổng câu hỏi
 * - passingScore: ngưỡng pass
 * - ungradedEssayCount: số essay chưa chấm
 * ================================================================
 */
export async function submitQuizSession(
  attemptId: string,
  answers: StudentSubmitQuestionDto[],
): Promise<StudentQuizResultDto> {
  try {
    const { data } = await http.post<unknown>('/api/student/quizzes/submit', {
      attemptId,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        studentAnswer: a.studentAnswer,
        essayAnswer: a.essayAnswer ?? undefined,
        selectedAnswers: a.selectedAnswers ?? undefined,
      })),
    });
    return mapSubmitQuizResult(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchStudentCases(): Promise<StudentCaseHistoryItem[]> {
  try {
    const { data } = await http.get<unknown>('/api/student/visual-qa/history/cases');
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? (data as { items?: unknown[] }).items ?? []
        : [];
    return list.map(mapStudentCase).filter((item): item is StudentCaseHistoryItem => item !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface StudentHistoryPageResult {
  totalCount: number;
  items: StudentCaseHistoryItem[];
}

async function fetchStudentHistoryEndpoint(
  endpoint: string,
  forcedKind: StudentHistoryKind,
): Promise<StudentHistoryPageResult> {
  try {
    const { data } = await http.get<unknown>(endpoint, { params: { limit: 50, offset: 0 } });
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const list = Array.isArray(data)
      ? data
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.studies)
          ? payload.studies
          : Array.isArray(payload?.results)
            ? payload.results
        : Array.isArray(payload?.data)
          ? payload.data
          : payload?.data && typeof payload.data === 'object' && Array.isArray((payload.data as { items?: unknown[] }).items)
            ? ((payload.data as { items?: unknown[] }).items ?? [])
        : [];
    const items = list
      .map(mapStudentCase)
      .filter((item): item is StudentCaseHistoryItem => item !== null)
      .map((item) => ({ ...item, historyKind: forcedKind }));
    const rawTotal = payload?.totalCount ?? payload?.TotalCount;
    const totalCount =
      typeof rawTotal === 'number' && Number.isFinite(rawTotal)
        ? rawTotal
        : items.length;
    return { totalCount, items };
  } catch {
    return { totalCount: 0, items: [] };
  }
}

export async function fetchStudentPersonalStudiesHistory(): Promise<StudentHistoryPageResult> {
  return fetchStudentHistoryEndpoint('/api/student/visual-qa/history/personal', 'personalQa');
}

export async function fetchStudentCaseLibraryHistory(): Promise<StudentHistoryPageResult> {
  const primary = await fetchStudentHistoryEndpoint('/api/student/visual-qa/history/cases', 'caseStudy');
  if (primary.items.length > 0) return primary;
  const fallbackRows = await fetchStudentCases();
  return {
    totalCount: fallbackRows.length,
    items: fallbackRows.map((item) => ({ ...item, historyKind: 'caseStudy' as const })),
  };
}

export async function fetchCaseCatalog(filters: {
  location?: string;
  lesionType?: string;
  difficulty?: string;
  boneSpecialtyId?: string;
  pathologyCategoryId?: string;
  severity?: string;
  patientAgeGroup?: string;
  /** Tìm kiếm text — gửi lên BE (một số bản BE dùng `q`, một số dùng `search`). */
  q?: string;
}): Promise<StudentCaseCatalogItem[]> {
  try {
    const qTrim = filters.q?.trim();
    const params = Object.fromEntries(
      Object.entries(filters).filter(
        ([key, value]) => key !== 'q' && value && String(value).trim().length > 0,
      ),
    );
    if (qTrim) {
      params.q = qTrim;
      params.search = qTrim;
    }
    const { data } = await http.get<unknown>('/api/cases/catalog', { params });
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? (data as { items?: unknown[] }).items ?? []
        : [];
    return list
      .map(mapStudentCaseCatalog)
      .filter((item): item is StudentCaseCatalogItem => item !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface StudentCaseCatalogFilters {
  locations: string[];
  lesionTypes: string[];
  difficulties: string[];
  /** Deep classification: Bone Specialty IDs */
  boneSpecialtyIds: string[];
  /** Deep classification: Pathology Category IDs */
  pathologyCategoryIds: string[];
  /** Severity levels (Mild/Moderate/Severe) */
  severities: string[];
  /** Patient age groups (Pediatric/Adult/Geriatric) */
  patientAgeGroups: string[];
}

export interface BoneSpecialtyOption {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId: string | null;
  parentName: string | null;
}

export interface PathologyCategoryOption {
  id: string;
  code: string;
  name: string;
  boneSpecialtyName: string | null;
}

export async function fetchCaseCatalogFilters(): Promise<StudentCaseCatalogFilters> {
  try {
    const { data } = await http.get<unknown>('/api/cases/filters');
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const asList = (value: unknown) =>
      Array.isArray(value)
        ? value.map((v) => String(v ?? '').trim()).filter(Boolean)
        : [];
    return {
      locations: asList(payload.locations ?? payload.Locations),
      lesionTypes: asList(payload.lesionTypes ?? payload.LesionTypes ?? payload.lesionType),
      difficulties: asList(payload.difficulties ?? payload.Difficulties),
      boneSpecialtyIds: asList(payload.boneSpecialtyIds ?? payload.BoneSpecialtyIds),
      pathologyCategoryIds: asList(payload.pathologyCategoryIds ?? payload.PathologyCategoryIds),
      severities: asList(payload.severities ?? payload.Severities),
      patientAgeGroups: asList(payload.patientAgeGroups ?? payload.PatientAgeGroups),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchBoneSpecialtyOptions(): Promise<BoneSpecialtyOption[]> {
  try {
    const { data } = await http.get<unknown[]>('/api/common/classifications/bone-specialties');
    const list = Array.isArray(data) ? data : [];
    return list.map((item) => {
      const r = item as Record<string, unknown>;
      const parentId = r.parentId ?? r.ParentId ?? r.parentId ?? null;
      const parentName = r.parentName ?? r.ParentName ?? null;
      return {
        id: String(r.id ?? r.Id ?? ''),
        code: String(r.code ?? r.Code ?? ''),
        name: String(r.name ?? r.Name ?? ''),
        level: Number(r.level ?? r.Level ?? 0),
        parentId: parentId != null ? String(parentId) : null,
        parentName: parentName != null ? String(parentName) : null,
      };
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchPathologyCategoryOptions(): Promise<PathologyCategoryOption[]> {
  try {
    const { data } = await http.get<unknown[]>('/api/common/classifications/pathology-categories');
    const list = Array.isArray(data) ? data : [];
    return list.map((item) => {
      const r = item as Record<string, unknown>;
      return {
        id: String(r.id ?? r.Id ?? ''),
        code: String(r.code ?? r.Code ?? ''),
        name: String(r.name ?? r.Name ?? ''),
        boneSpecialtyName: r.boneSpecialtyName != null ? String(r.boneSpecialtyName) : r.BoneSpecialtyName != null ? String(r.BoneSpecialtyName) : null,
      };
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchCaseCatalogDetail(caseId: string): Promise<StudentCaseCatalogDetail> {
  try {
    const { data } = await http.get<unknown>(`/api/student/cases/${caseId}`);
    const mapped = mapStudentCaseCatalogDetail(data);
    if (!mapped) {
      throw new Error('Case detail is unavailable.');
    }
    return mapped;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function mapStudentTopicStat(row: unknown): StudentTopicStat | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const topicName = String(item.topicName ?? item.topic ?? item.name ?? '');
  if (!topicName) return null;
  return {
    topicName,
    accuracyRate: Number(item.accuracyRate ?? 0),
    quizAttempts: Number(item.quizAttempts ?? 0),
  };
}

function mapStudentRecentActivity(row: unknown, index: number): StudentRecentActivityItem | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const title = String(item.title ?? item.activityTitle ?? item.description ?? item.message ?? '');
  const occurredAt = String(item.occurredAt ?? item.createdAt ?? item.timestamp ?? '');
  if (!title || !occurredAt) return null;

  const routeRaw = item.route ?? item.Route;
  const route = routeRaw != null && String(routeRaw).trim() ? String(routeRaw).trim() : undefined;
  const targetRaw =
    item.targetUrl ?? item.TargetUrl ?? item.href ?? item.url ?? item.deepLink;
  const targetUrl =
    route ??
    (targetRaw != null && String(targetRaw).trim() ? String(targetRaw).trim() : undefined);
  const caseRaw = item.caseId ?? item.catalogCaseId ?? item.libraryCaseId;
  const caseId = caseRaw != null && String(caseRaw).trim() ? String(caseRaw).trim() : undefined;
  const quizRaw = item.quizId ?? item.assignedQuizId;
  const quizId = quizRaw != null && String(quizRaw).trim() ? String(quizRaw).trim() : undefined;
  const sessionRaw = item.sessionId ?? item.SessionId ?? item.visualQaSessionId ?? item.VisualQaSessionId;
  const sessionId =
    sessionRaw != null && String(sessionRaw).trim() ? String(sessionRaw).trim() : undefined;

  return {
    id: String(item.id ?? item.activityId ?? index),
    title,
    description: item.description != null ? String(item.description) : item.message != null ? String(item.message) : undefined,
    occurredAt,
    type: String(item.type ?? item.activityType ?? item.ActivityType ?? 'activity'),
    status: item.status != null ? String(item.status) : undefined,
    targetUrl,
    caseId,
    quizId,
    ...(sessionId ? { sessionId } : {}),
    ...(route ? { route } : {}),
  };
}

export async function fetchStudentTopicStats(): Promise<StudentTopicStat[]> {
  try {
    const { data } = await http.get<unknown>('/api/student/progress/topic-stats');
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? (data as { items?: unknown[] }).items ?? []
        : [];
    return list.map(mapStudentTopicStat).filter((item): item is StudentTopicStat => item !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchStudentRecentActivity(): Promise<StudentRecentActivityItem[]> {
  try {
    const { data } = await http.get<unknown>('/api/student/progress/recent-activity', {
      skipApiToast: true,
    });
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? (data as { items?: unknown[] }).items ?? []
        : [];
    return list
      .map((item, index) => mapStudentRecentActivity(item, index))
      .filter((item): item is StudentRecentActivityItem => item !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// Re-export types so other modules can import from '@/lib/api/student'
export type {
  AssignedQuizItem,
  QuizSessionDto,
  StudentSubmitQuestionDto,
};

/** ====== Student Classes ====== */

export interface StudentClassItem {
  classId: string;
  className: string;
  semester: string;
  lecturerId?: string | null;
  lecturerName?: string | null;
  expertId?: string | null;
  expertName?: string | null;
  totalAnnouncements: number;
  totalQuizzes: number;
  totalCases: number;
  enrolledAt?: string | null;
}

/** ====== AI Quiz Session (after save to DB) ====== */

export interface StudentGeneratedQuizSession {
  attemptId: string;
  quizId: string;
  title: string;
  topic?: string | null;
  questions: Array<{
    questionId: string;
    questionText: string;
    type?: string | null;
    caseId?: string | null;
    caseTitle?: string | null;
    optionA?: string | null;
    optionB?: string | null;
    optionC?: string | null;
    optionD?: string | null;
    imageUrl?: string | null;
  }>;
  savedToHistory: boolean;
}

/** ====== Quiz Attempt History ====== */

export interface QuizAttemptReview {
  attemptId: string;
  quizTitle: string;
  score: number | null;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  /** True nếu quiz đã đóng HOẶC lecturer đã release đáp án. */
  answersReleased: boolean;
  questions: Array<{
    questionId: string;
    questionText: string;
    optionA?: string | null;
    optionB?: string | null;
    optionC?: string | null;
    optionD?: string | null;
    studentAnswer?: string | null;
    correctAnswer?: string | null; // Chỉ có giá trị khi answersReleased = true
    isCorrect: boolean;
    imageUrl?: string | null;
    caseId?: string | null;
    essayAnswer?: string | null;
  }>;
}

export async function fetchQuizAttemptReview(attemptId: string): Promise<QuizAttemptReview> {
  try {
    const { data } = await http.get<unknown>(`/api/student/quizzes/${attemptId}/review`);
    const item = data as Record<string, unknown>;
    const questions = Array.isArray(item.questions) ? (item.questions as Record<string, unknown>[]) : [];
    return {
      attemptId: String(item.attemptId ?? item.AttemptId ?? ''),
      quizTitle: String(item.quizTitle ?? item.QuizTitle ?? ''),
      score: item.score != null ? Number(item.score) : item.Score != null ? Number(item.Score) : null,
      totalQuestions: Number(item.totalQuestions ?? item.TotalQuestions ?? 0),
      correctAnswers: Number(item.correctAnswers ?? item.CorrectAnswers ?? 0),
      passed: Boolean(item.passed ?? item.Passed ?? (Number(item.score ?? 0) >= 70)),
      answersReleased: true,
      questions: questions.map((q) => ({
        questionId: String(q.questionId ?? q.QuestionId ?? ''),
        questionText: String(q.questionText ?? q.QuestionText ?? ''),
        optionA: pickStr(q, 'optionA', 'OptionA'),
        optionB: pickStr(q, 'optionB', 'OptionB'),
        optionC: pickStr(q, 'optionC', 'OptionC'),
        optionD: pickStr(q, 'optionD', 'OptionD'),
        studentAnswer: pickStr(q, 'studentAnswer', 'StudentAnswer'),
        correctAnswer: pickStr(q, 'correctAnswer', 'CorrectAnswer'),
        isCorrect: Boolean(q.isCorrect ?? q.IsCorrect ?? false),
        imageUrl: pickStr(q, 'imageUrl', 'ImageUrl'),
        caseId: pickStr(q, 'caseId', 'CaseId'),
        essayAnswer: pickStr(q, 'essayAnswer', 'EssayAnswer'),
      })),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface StudentQuizAttemptSummary {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  topic?: string | null;
  difficulty?: string | null;
  className?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  passingScore?: number | null;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  isAiGenerated: boolean;
}

/** ====== Class Detail ====== */

export interface StudentClassDetail {
  classId: string;
  className: string;
  semester: string;
  lecturerId?: string | null;
  lecturerName?: string | null;
  expertId?: string | null;
  expertName?: string | null;
  expertEmail?: string | null;
  expertAvatarUrl?: string | null;
  enrolledAt?: string | null;
  /** Case assignments for this class. */
  assignedCases: Array<{
    caseId: string;
    title: string;
    dueDate?: string | null;
    isMandatory?: boolean;
  }>;
  quizzes: Array<{
    quizId: string;
    title: string;
    topic?: string | null;
    openTime?: string | null;
    closeTime?: string | null;
    totalQuestions: number;
    timeLimit?: number | null;
    passingScore?: number | null;
    isCompleted: boolean;
    score?: number | null;
  }>;
  students: Array<{
    studentId: string;
    studentName: string;
    studentCode?: string | null;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    createdAt?: string | null;
    relatedAssignment?: AnnouncementAssignmentInfo | null;
  }>;
}

export async function fetchStudentClassDetail(classId: string): Promise<StudentClassDetail> {
  try {
    const { data } = await http.get<unknown>(`/api/students/classes/${classId}`);
    const item = data as Record<string, unknown>;
    const expertRaw = item.expert ?? item.Expert;
    const expertObj =
      expertRaw && typeof expertRaw === 'object' ? (expertRaw as Record<string, unknown>) : null;
    const expertAvatarFromNested = expertObj
      ? pickStrAny(
          expertObj,
          'avatarUrl',
          'AvatarUrl',
          'photoUrl',
          'PhotoUrl',
          'imageUrl',
          'ImageUrl',
          'profileImageUrl',
          'ProfileImageUrl',
        )
      : null;
    const quizRows = item.quizzes ?? item.Quizzes;
    const studentRows = item.students ?? item.Students;
    const announcementRows = item.announcements ?? item.Announcements;
    const caseRows = item.assignedCases ?? item.AssignedCases ?? item.cases ?? item.Cases;
    const quizzes = Array.isArray(quizRows) ? (quizRows as Record<string, unknown>[]) : [];
    const students = Array.isArray(studentRows) ? (studentRows as Record<string, unknown>[]) : [];
    const announcements = Array.isArray(announcementRows) ? (announcementRows as Record<string, unknown>[]) : [];
    const cases = Array.isArray(caseRows) ? (caseRows as Record<string, unknown>[]) : [];
    return {
      classId: String(item.classId ?? item.ClassId ?? classId),
      className: String(item.className ?? item.ClassName ?? ''),
      semester: String(item.semester ?? item.Semester ?? ''),
      lecturerId: item.lecturerId != null ? String(item.lecturerId) : item.LecturerId != null ? String(item.LecturerId) : null,
      lecturerName: item.lecturerName != null ? String(item.lecturerName) : item.LecturerName != null ? String(item.LecturerName) : null,
      expertName:
        item.expertName != null
          ? String(item.expertName)
          : item.ExpertName != null
            ? String(item.ExpertName)
            : item.expertFullName != null
              ? String(item.expertFullName)
              : null,
      expertEmail:
        item.expertEmail != null
          ? String(item.expertEmail)
          : item.ExpertEmail != null
            ? String(item.ExpertEmail)
            : null,
      expertAvatarUrl:
        expertAvatarFromNested ??
        pickStrAny(item, 'expertAvatarUrl', 'ExpertAvatarUrl', 'expertPhotoUrl', 'ExpertPhotoUrl'),
      enrolledAt: item.enrolledAt != null ? String(item.enrolledAt) : item.EnrolledAt != null ? String(item.EnrolledAt) : null,
      assignedCases: cases.map((c) => ({
        caseId: String(c.caseId ?? c.CaseId ?? c.id ?? c.Id ?? ''),
        title: String(c.title ?? c.Title ?? c.caseTitle ?? c.CaseTitle ?? 'Case'),
        dueDate: c.dueDate != null ? String(c.dueDate) : c.DueDate != null ? String(c.DueDate) : null,
        isMandatory: Boolean(c.isMandatory ?? c.IsMandatory ?? false),
      })),
      quizzes: quizzes.map((q) => ({
        quizId: String(q.quizId ?? q.QuizId ?? ''),
        title: String(q.title ?? q.Title ?? ''),
        topic: q.topic != null ? String(q.topic) : q.Topic != null ? String(q.Topic) : null,
        openTime: q.openTime != null ? String(q.openTime) : q.OpenTime != null ? String(q.OpenTime) : null,
        closeTime: q.closeTime != null ? String(q.closeTime) : q.CloseTime != null ? String(q.CloseTime) : null,
        totalQuestions: Number(q.totalQuestions ?? q.TotalQuestions ?? 0),
        timeLimit: q.timeLimit != null ? Number(q.timeLimit) : q.TimeLimit != null ? Number(q.TimeLimit) : null,
        passingScore: q.passingScore != null ? Number(q.passingScore) : q.PassingScore != null ? Number(q.PassingScore) : null,
        isCompleted: Boolean(q.isCompleted ?? q.IsCompleted ?? false),
        score: q.score != null ? Number(q.score) : q.Score != null ? Number(q.Score) : null,
      })),
      students: students.map((s) => ({
        studentId: String(s.studentId ?? s.StudentId ?? ''),
        studentName: String(s.studentName ?? s.StudentName ?? ''),
        studentCode: s.studentCode != null ? String(s.studentCode) : s.StudentCode != null ? String(s.StudentCode) : null,
      })),
      announcements: announcements.map((a) => ({
        id: String(a.id ?? a.Id ?? ''),
        title: String(a.title ?? a.Title ?? ''),
        content: String(a.content ?? a.Content ?? ''),
        createdAt: a.createdAt != null ? String(a.createdAt) : a.CreatedAt != null ? String(a.CreatedAt) : null,
        relatedAssignment: (() => {
          const rel = a.relatedAssignment ?? a.RelatedAssignment;
          if (rel && typeof rel === 'object') {
            const r = rel as Record<string, unknown>;
            return {
              assignmentId: r.assignmentId != null ? String(r.assignmentId) : r.AssignmentId != null ? String(r.AssignmentId) : undefined,
              assignmentTitle: r.assignmentTitle != null ? String(r.assignmentTitle) : r.AssignmentTitle != null ? String(r.AssignmentTitle) : undefined,
              assignmentType: r.assignmentType != null ? String(r.assignmentType) : r.AssignmentType != null ? String(r.AssignmentType) : undefined,
            };
          }
          return null;
        })(),
      })),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchStudentClasses(): Promise<StudentClassItem[]> {
  try {
    const { data } = await http.get<unknown>('/api/students/classes');
    const list = Array.isArray(data) ? data : [];
    return (list as Record<string, unknown>[]).map((item) => ({
      classId: String(item.classId ?? item.ClassId ?? item.classId ?? ''),
      className: String(item.className ?? item.ClassName ?? ''),
      semester: String(item.semester ?? item.Semester ?? ''),
      lecturerId: item.lecturerId != null ? String(item.lecturerId) : item.LecturerId != null ? String(item.LecturerId) : null,
      lecturerName: item.lecturerName != null ? String(item.lecturerName) : item.LecturerName != null ? String(item.LecturerName) : null,
      expertId: item.expertId != null ? String(item.expertId) : item.ExpertId != null ? String(item.ExpertId) : null,
      expertName: item.expertName != null ? String(item.expertName) : item.ExpertName != null ? String(item.ExpertName) : null,
      totalAnnouncements: Number(item.totalAnnouncements ?? item.TotalAnnouncements ?? 0),
      totalQuizzes: Number(item.totalQuizzes ?? item.TotalQuizzes ?? 0),
      totalCases: Number(item.totalCases ?? item.TotalCases ?? 0),
      enrolledAt: item.enrolledAt != null ? String(item.enrolledAt) : item.EnrolledAt != null ? String(item.EnrolledAt) : null,
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/** Student self-unenrolls from a class (DELETE enrollment). */
export async function leaveStudentClass(classId: string): Promise<void> {
  try {
    await http.delete(`/api/students/classes/${classId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * AI Generate + Save to DB → returns quiz session.
 * POST /api/student/quizzes/practice/generate
 */
export async function generateAndSaveAIPracticeQuiz(
  topic: string,
  questionCount = 5,
  difficulty?: string,
): Promise<StudentGeneratedQuizSession> {
  try {
    const { data } = await http.post<unknown>('/api/student/quizzes/practice/generate', {
      topic,
      questionCount,
      difficulty,
    });
    const item = data as Record<string, unknown>;
    const questions = Array.isArray(item.questions) ? (item.questions as Record<string, unknown>[]) : [];
    return {
      attemptId: String(item.attemptId ?? item.AttemptId ?? ''),
      quizId: String(item.quizId ?? item.QuizId ?? ''),
      title: String(item.title ?? item.Title ?? ''),
      topic: item.topic != null ? String(item.topic) : item.Topic != null ? String(item.Topic) : null,
      questions: questions.map((q) => ({
        questionId: String(q.questionId ?? q.QuestionId ?? q.id ?? ''),
        questionText: String(q.questionText ?? q.QuestionText ?? ''),
        type: q.type != null ? String(q.type) : q.Type != null ? String(q.Type) : null,
        caseId: q.caseId != null ? String(q.caseId) : q.CaseId != null ? String(q.CaseId) : null,
        optionA: q.optionA != null ? String(q.optionA) : q.OptionA != null ? String(q.OptionA) : null,
        optionB: q.optionB != null ? String(q.optionB) : q.OptionB != null ? String(q.OptionB) : null,
        optionC: q.optionC != null ? String(q.optionC) : q.OptionC != null ? String(q.OptionC) : null,
        optionD: q.optionD != null ? String(q.optionD) : q.OptionD != null ? String(q.OptionD) : null,
        imageUrl: q.imageUrl != null ? String(q.imageUrl) : q.ImageUrl != null ? String(q.ImageUrl) : null,
      })),
      savedToHistory: Boolean(item.savedToHistory ?? item.SavedToHistory ?? true),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Submit answers for an AI-generated quiz attempt.
 */
export async function submitAIPracticeQuiz(
  attemptId: string,
  answers: Array<{ questionId: string; studentAnswer: string }>,
): Promise<{
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
}> {
  try {
    const { data } = await http.post<unknown>('/api/student/quizzes/submit', {
      attemptId,
      answers,
    });
    const item = data as Record<string, unknown>;
    return {
      score: Number(item.score ?? item.Score ?? 0),
      passed: Boolean(item.passed ?? item.Passed ?? false),
      totalQuestions: Number(item.totalQuestions ?? item.TotalQuestions ?? 0),
      correctAnswers: Number(item.correctAnswers ?? item.CorrectAnswers ?? 0),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Delete a quiz attempt from history.
 * DELETE /api/student/quizzes/{attemptId}
 */
export async function deleteQuizAttempt(attemptId: string): Promise<void> {
  try {
    await http.delete(`/api/student/quizzes/${attemptId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get quiz attempt history (all attempts including AI-generated).
 * GET /api/student/quizzes/history
 */
export async function fetchStudentQuizHistory(): Promise<StudentQuizAttemptSummary[]> {
  try {
    const { data } = await http.get<unknown>('/api/student/quizzes/history');
    const list = Array.isArray(data) ? data : [];
    return (list as Record<string, unknown>[]).map((item) => ({
      attemptId: String(item.attemptId ?? item.AttemptId ?? ''),
      quizId: String(item.quizId ?? item.QuizId ?? ''),
      quizTitle: String(item.quizTitle ?? item.QuizTitle ?? item.title ?? item.Title ?? ''),
      topic: item.topic != null ? String(item.topic) : item.Topic != null ? String(item.Topic) : null,
      difficulty: item.difficulty != null ? String(item.difficulty) : item.Difficulty != null ? String(item.Difficulty) : null,
      className: item.className != null ? String(item.className) : item.ClassName != null ? String(item.ClassName) : null,
      startedAt: item.startedAt != null ? String(item.startedAt) : item.StartedAt != null ? String(item.StartedAt) : null,
      completedAt: item.completedAt != null ? String(item.completedAt) : item.CompletedAt != null ? String(item.CompletedAt) : null,
      score: item.score != null ? Number(item.score) : item.Score != null ? Number(item.Score) : null,
      passingScore: item.passingScore != null ? Number(item.passingScore) : item.PassingScore != null ? Number(item.PassingScore) : null,
      passed: Boolean(item.passed ?? item.Passed ?? false),
      totalQuestions: Number(item.totalQuestions ?? item.TotalQuestions ?? 0),
      correctAnswers: Number(item.correctAnswers ?? item.CorrectAnswers ?? 0),
      isAiGenerated: Boolean(item.isAiGenerated ?? item.IsAiGenerated ?? false),
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
