import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';

/** Normalized Visual QA report (accepts camelCase or PascalCase from backend). */
export interface VisualQaCitation {
  documentUrl?: string;
  chunkOrder?: number;
  pageNumber?: number;
  startPage?: number;
  endPage?: number;
  title?: string;
  label?: string;
  displayLabel?: string;
  snippet?: string;
  pageLabel?: string;
  kind?: 'doc' | 'case' | string;
  href?: string;
  /** Knowledge-base document id when API provides it (for markers & versioned links). */
  documentId?: string;
  /** Clinical case id when citation points at a case. */
  caseId?: string;
  /** RAG chunk id when API returns retrieval rows (`chunkId`, etc.). */
  chunkId?: string;
  /** Document revision — appended as `?v=` on file URLs when present. */
  version?: string;
}

export type VisualQaResponseKind =
  | 'analysis'
  | 'refusal'
  | 'clarification'
  | 'review_update'
  | 'system_notice'
  | string;

export type VisualQaReviewState =
  | 'none'
  | 'pending'
  | 'escalated'
  | 'reviewed'
  | 'resolved'
  | string;

export interface VisualQaReport {
  /** Echoed from the request when the API returns it. */
  questionText?: string;
  answerText?: string;
  suggestedDiagnosis?: string;
  keyFindings: string[];
  keyImagingFindings?: string | null;
  diagnosis?: string;
  findings?: string[];
  reflectiveQuestions?: string[] | string | null;
  differentialDiagnoses: string[];
  citations: VisualQaCitation[];
  /** Model confidence when provided by the backend (0–100). */
  aiConfidenceScore?: number;
  responseKind?: VisualQaResponseKind | null;
  clientRequestId?: string | null;
  policyReason?: string | null;
  systemNoticeCode?: string | null;
}

export interface VisualQaTurn {
  turnId?: string | null;
  turnIndex: number;
  questionText?: string;
  answerText?: string;
  messages?: VisualQaMessage[];
  /**
   * BE `VisualQaTurnDto.questionCoordinates` — user question ROI (normalized JSON).
   * FE merges into `roiBoundingBox` when the latter is absent so the viewer can reuse one field.
   */
  questionCoordinates?: NormalizedImageBoundingBox | null;
  /** Message-level ROI for this specific Q/A turn (normalized 0-1). */
  roiBoundingBox?: NormalizedImageBoundingBox | null;
  expertCorrectedRoiBoundingBox?: NormalizedImageBoundingBox | null;
  /** Assistant structured diagnosis (JSON string or plain text) from triage / thread DTOs. */
  structuredDiagnosis?: string | null;
  /** Assistant key imaging line (string or JSON) from triage DTOs. */
  keyImagingFindings?: string | null;
  diagnosis?: string;
  findings?: string[];
  reflectiveQuestions?: string[];
  differentialDiagnoses: string[];
  citations: VisualQaCitation[];
  aiConfidenceScore?: number;
  createdAt?: string | null;
  responseKind?: VisualQaResponseKind | null;
  clientRequestId?: string | null;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  reviewState?: VisualQaReviewState | null;
  /** BE answer row workflow (e.g. EscalatedToExpert) when `reviewState` is absent. */
  answerStatus?: string | null;
  lastResponderRole?: string | null;
  actorRole?: string | null;
  isReviewTarget?: boolean;
  reviewTargetAssistantMessageId?: string | null;
  reviewTargetTurnId?: string | null;
  reviewTargetTurnIndex?: number | null;
  policyReason?: string | null;
  systemNoticeCode?: string | null;
  /** FE-only: optimistic row waiting for assistant payload (merged away when BE echoes same `clientRequestId`). */
  awaitingAssistant?: boolean;
}

export interface VisualQaMessage {
  role: 'Student' | 'Assistant' | 'Lecturer' | string;
  content: string;
  createdAt?: string | null;
}

export interface VisualQaSessionReport {
  sessionId: string;
  /**
   * Root study image on thread (`VisualQaThreadDto`). BE may also send `imageUrl` / `studyImageUrl`
   * with the same value — FE normalizes into this field.
   */
  sessionImageUrl?: string | null;
  /**
   * Thread-level ROI: BE derives from latest user message with non-empty coordinates
   * (parallel to per-turn `questionCoordinates` / `roiBoundingBox` on turns).
   */
  roiBoundingBox?: NormalizedImageBoundingBox | null;
  clientRequestId?: string | null;
  responseKind?: VisualQaResponseKind | null;
  /** Root-level analysis text from the API when not only present on `latest` / `turns`. */
  answerText?: string | null;
  diagnosis?: string;
  findings?: string[];
  differentialDiagnoses?: string[];
  reflectiveQuestions?: string[];
  citations?: VisualQaCitation[];
  caseId?: string | null;
  imageId?: string | null;
  dicomMetadata?: VisualQaDicomMetadata | null;
  status?: string | null;
  /** BE VisualQaSessionReportDto — canonical workflow status for banners. */
  sessionStatus?: string | null;
  /** Lecturer/expert decision text on the session (not embedded in AI turns). */
  reviewFeedback?: string | null;
  updatedAt?: string | null;
  reviewState?: VisualQaReviewState | null;
  lastResponderRole?: string | null;
  /** Thread-level banner when BE blocks interaction (VisualQaThreadDto). */
  blockingNotice?: string | null;
  systemNotice?: string | null;
  /** Chuỗi reject mới nhất từ lecturer/expert khi session Rejected (BE VisualQaThreadDto). */
  rejectionReason?: string | null;
  policyReason?: string | null;
  systemNoticeCode?: string | null;
  capabilities?: {
    canAskNext?: boolean;
    canRequestReview?: boolean;
    isReadOnly?: boolean;
    turnsUsed?: number;
    turnLimit?: number;
    reason?: string | null;
  };
  messages?: VisualQaMessage[];
  turns: VisualQaTurn[];
  latest: VisualQaTurn | null;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface TagOption {
  id: string;
  name: string;
}

export interface DocumentUploadResponse {
  documentId?: string;
  indexingStatus?: DocumentIndexingStatus | string;
  message?: string;
}

export type DocumentIndexingStatus =
  | 'Pending'
  | 'Processing'
  | 'Indexing'
  | 'Reindexing'
  | 'Completed'
  | 'Failed';

export interface DocumentStatusResponse {
  status: DocumentIndexingStatus | string;
  progressPercentage: number;
  currentOperation: string;
  /** 1-based page currently being indexed (when provided by pipeline). */
  currentPageIndexing?: number;
  totalPages?: number;
  /** Some pipelines report chunk totals instead of page totals. */
  totalChunks?: number;
}

/** Real-time ingestion update payload from SignalR `DocumentIndexingProgressUpdated`. */
export interface DocumentIngestionStatusDto {
  documentId: string;
  status?: string;
  totalPages?: number;
  totalChunks?: number;
  currentPageIndexing?: number;
  progressPercentage?: number;
  operation?: string;
  /** Backend pipeline phase hint (e.g. Download, Parsing, Vectorizing). */
  phase?: string;
  /** Failure detail when status is Failed. */
  errorMessage?: string;
}

export type LecturerTriageRequestKind = 'case-catalog' | 'adhoc-upload';

export interface LecturerTriageRow {
  id: string;
  studentName: string;
  questionSnippet: string;
  thumbnailUrl: string;
  askedAt: string;
  similarityScore: number;
  escalated?: boolean;
  requestedReviewMessageId?: string | null;
  selectedUserMessageId?: string | null;
  selectedAssistantMessageId?: string | null;
  /** BE triage row: VisualQA vs CaseQA when present. */
  questionSource?: 'CaseQA' | 'VisualQA' | null;
  /** Resolved catalog case id when session references a library case. */
  caseId?: string | null;
  /** Short case snapshot for list (e.g. medical_cases.description). */
  caseDescription?: string | null;
  caseTitle?: string | null;
  /** Parsed tag labels when BE sends tags / CSV / nested case tags. */
  caseTags?: string[];
  /** Derived UX bucket for conditional metadata UI. */
  requestKind: LecturerTriageRequestKind;
}

export interface ClassItem {
  id: string;
  className: string;
  semester: string;
  lecturerId: string;
  createdAt: string;
  expertId?: string | null;
  expertName?: string | null;
}

export interface StudentEnrollment {
  enrollmentId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  studentCode: string | null;
  className: string | null;
  enrolledAt: string | null;
}

export interface CaseDto {
  id: string;
  title: string | null;
  description: string | null;
  difficulty: string | null;
  categoryName: string | null;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string | null;
  imageUrl: string | null;
}

/** GET /api/lecturer/classes/{classId}/questions */
export interface LectStudentQuestionDto {
  id: string;
  /** Use for POST /api/lecturer/triage/{answerId}/escalate when distinct from question id. */
  answerId?: string | null;
  /** Alternate answer-row id from some API shapes (escalation fallback). */
  caseAnswerId?: string | null;
  /** Explicit study image URL when the API uses ImageUrl (see also customImageUrl). */
  imageUrl?: string | null;
  dicomMetadata?: VisualQaDicomMetadata | null;
  studentId: string;
  studentName: string;
  studentEmail: string;
  /** `null` when the session is a personal/ad-hoc upload (no catalog case). */
  caseId: string | null;
  /** Catalog snapshot title; empty string when ad-hoc / missing. */
  caseTitle: string;
  questionText: string;
  language?: string | null;
  createdAt: string | null;
  answerText?: string | null;
  answerStatus?: string | null;
  escalatedById?: string | null;
  escalatedAt?: string | null;
  aiConfidenceScore?: number | null;
  /** Student study image or case thumbnail for triage (URLs from API). */
  customImageUrl?: string | null;
  /** Session chat history for this question; latest turn drives final assessment. */
  turns?: VisualQaTurn[];
  requestedReviewMessageId?: string | null;
  selectedUserMessageId?: string | null;
  selectedAssistantMessageId?: string | null;
  customCoordinates?: PercentageBoundingBox | null;
  citations?: Citation[];
  /** Present when `GET .../questions` is called with an explicit `source` query (not legacy). */
  questionSource?: 'CaseQA' | 'VisualQA' | null;
  /** Snapshot from `medical_cases` when the session references a catalog case. */
  caseDescription?: string | null;
  caseSuggestedDiagnosis?: string | null;
  caseKeyFindings?: string | null;
  /** BE: explicit personal / ad-hoc upload session (hide catalog metadata when true). */
  isPersonalUpload?: boolean | null;
  /** Normalized tag labels from BE (`caseTags`, `tags`, or nested `case.tags`). */
  caseTags?: string[] | null;
  /** Lecturer/expert decision note on history rows. */
  reviewFeedback?: string | null;
}

export interface AnnouncementAssignmentInfo {
  assignmentId?: string | null;
  assignmentTitle?: string | null;
  /** "case" or "quiz" */
  assignmentType?: string | null;
}

export interface Announcement {
  id: string;
  classId: string;
  className: string;
  title: string;
  content: string;
  sendEmail: boolean;
  createdAt: string;
  /** Optional: related assignment info to help students identify related work */
  relatedAssignment?: AnnouncementAssignmentInfo | null;
}

// Forward declaration for ClassAssignment
export interface ClassAssignment {
  id: string;
  classId: string;
  className: string;
  /** "case" or "quiz" */
  type: string;
  title: string;
  dueDate: string | null;
  isMandatory: boolean;
  assignedAt: string | null;
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
}

// ========== Assignment Types ==========

export interface AssignmentDetail {
  id: string;
  classId: string;
  className: string;
  classCode?: string | null;
  /** "case" or "quiz" */
  type: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  dueDate: string | null;
  openDate?: string | null;
  isMandatory: boolean;
  assignedAt: string | null;
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
  maxScore?: number | null;
  passingScore?: number | null;
  allowLate: boolean;
  avgScore?: number | null;
  createdAt: string;
}

export interface AssignmentSubmission {
  studentId: string;
  studentName: string;
  studentCode: string | null;
  submittedAt: string | null;
  score: number | null;
  status: 'graded' | 'pending' | 'not-submitted';
}

export interface UpdateAssignmentRequest {
  title?: string;
  description?: string | null;
  instructions?: string | null;
  dueDate?: string | null;
  openDate?: string | null;
  isMandatory?: boolean;
  maxScore?: number | null;
  passingScore?: number | null;
  allowLate?: boolean;
  allowRetake?: boolean;
}

export interface AssignmentSubmissionUpdate {
  studentId: string;
  score: number | null;
}

export interface UpdateAssignmentSubmissionRequest {
  submissions: AssignmentSubmissionUpdate[];
}

// ========== Manual Assignment Types ==========

export interface CreateAssignmentManualRequest {
  /** "case" or "quiz" */
  assignmentType: string;
  classIds: string[];
  caseId?: string | null;
  quizId?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  timeLimitMinutes?: number | null;
  passingScore?: number | null;
  shuffleQuestions?: boolean;
  allowRetake?: boolean;
  allowLate?: boolean;
  showResultsAfterSubmission?: boolean;
  useExpertTime?: boolean;
  dueDate?: string | null;
  isMandatory?: boolean;
  /** Nếu true, gửi email notification cho sinh viên */
  sendNotification?: boolean;
}

export interface ManualAssignmentResult {
  classId: string;
  className: string;
  assignmentId: string;
  success: boolean;
  message?: string;
}

export interface CreateAssignmentManualResponse {
  results: ManualAssignmentResult[];
}

export interface ClassStats {
  classId: string;
  totalStudents: number;
  totalCasesViewed: number;
  totalQuestionsAsked: number;
  avgQuizScore: number | null;
  totalAssignments: number;
  completedAssignments: number;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  userId: string;
  fullName: string;
  email: string;
  token: string;
  roles: string[];
  /** Backend account lifecycle status (e.g. Pending, Active). */
  status?: string;
  userStatus?: string;
  requiresMedicalVerification?: boolean;
}

export interface LecturerDashboardStats {
  totalClasses: number;
  totalStudents: number;
  totalQuestions: number;
  escalatedItems: number;
  pendingReviews: number;
  /** Backend may return null when no quiz attempts exist. */
  averageQuizScore: number | null;
  totalQuizAttempts: number;
  averageTimeMinutes: number | null;
  participationTrendPercent: number | null;
}

export interface LecturerLeaderboardEntry {
  studentId?: string;
  studentName: string;
  totalCasesViewed: number;
  totalQuestionsAsked: number;
  averageQuizScore: number;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  schoolCohort: string;
  avatarUrl: string;
  isActive: boolean;
  roles: string[];
  /** ISO date string `YYYY-MM-DD` from API */
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  gender?: string | null;
  studentSchoolId?: string | null;
  classCode?: string | null;
  address?: string | null;
  bio?: string | null;
  emergencyContact?: string | null;
}

export interface StudentProfileUpdatePayload {
  fullName: string;
  schoolCohort: string;
  avatarUrl: string;
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  gender?: string | null;
  studentSchoolId?: string | null;
  classCode?: string | null;
  address?: string | null;
  bio?: string | null;
  emergencyContact?: string | null;
}

export interface StudentProgress {
  totalCasesViewed: number;
  totalQuestionsAsked: number;
  /** Null when the student has no scored / completed quiz attempts yet. */
  avgQuizScore: number | null;
  totalQuizAttempts: number;
  completedQuizzes: number;
  escalatedAnswers: number;
  /** Null when the student has no completed quiz with a score yet. */
  latestQuizScore: number | null;
  /** Null when there are no submitted quiz answers to compute accuracy from. */
  quizAccuracyRate: number | null;
}

export interface StudentTopicStat {
  topicName: string;
  /** Null when there are no quiz attempts for this topic yet. */
  accuracyRate: number | null;
  quizAttempts: number;
}

export interface StudentRecentActivityItem {
  id: string;
  title: string;
  description?: string;
  occurredAt: string;
  type: string;
  status?: string;
  /** Absolute or app-relative navigation target when the API provides one. */
  targetUrl?: string;
  /** Same semantics as notifications `route` when BE sends normalized SPA path. */
  route?: string;
  caseId?: string;
  quizId?: string;
  /** Visual QA session id when `type` is lecturer/expert reply notifications. */
  sessionId?: string;
}

export interface StudentQuizQuestion {
  questionId: string;
  questionText: string;
  type: string;
  imageUrl?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** Hint - only shown in practice mode */
  hint?: string | null;
  /** Whether hints are allowed (based on quiz mode) */
  hintAvailable?: boolean;
  /** Correct answers for MultiSelect - JSON array like ["A", "C"] */
  correctAnswers?: string | null;
  /** Accepted answers for FillInBlank - JSON array */
  acceptedAnswers?: string | null;
}

export interface StudentPracticeQuiz {
  attemptId: string;
  quizId: string;
  title: string;
  topic: string;
  difficulty?: string;
  timeLimit?: number;
  questions: StudentQuizQuestion[];
}

export interface StudentQuizAnswer {
  questionId: string;
  studentAnswer: string;
}

export interface StudentQuizSubmissionResult {
  attemptId: string;
  quizId: string;
  score: number | null;
  passingScore: number | null;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
}

export interface AssignedQuizItem {
  quizId: string;
  quizName: string;
  classId: string;
  className: string;
  /** Topic of the quiz */
  topic?: string | null;
  totalQuestions: number;
  timeLimit: number | null;
  passingScore: number | null;
  openTime: string | null;
  closeTime: string | null;
  isCompleted: boolean;
  score: number | null;
  /** Attempt ID of the most recent attempt (used for review) */
  attemptId?: string | null;
  /** Quiz creation time — used for sorting by newest first */
  createdAt?: string | null;
  /** True nếu quiz đã đóng HOẶC lecturer đã release đáp án. Sinh viên chỉ xem được đáp án khi field này = true */
  answersReleased?: boolean;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number | null;
}

export interface QuizSessionDto {
  attemptId: string;
  quizId: string;
  title: string;
  topic: string | null;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number | null;
  timeLimit?: number | null;
  /** Quiz closing time (ISO string) - used for auto-submit when time is up */
  closeTime?: string | null;
  /** Whether hints are available for this quiz session */
  allowHints?: boolean;
  questions: StudentSessionQuestion[];
}

export interface StudentSessionQuestion {
  questionId: string;
  questionText: string;
  type: string | null;
  caseId: string | null;
  caseTitle: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  imageUrl?: string | null;
  essayAnswer?: string | null; // Model answer for essay questions (from backend)
  correctAnswer?: string | null; // Correct answer (available in Practice Mode after submit)
  /** Hint - only shown in practice mode */
  hint?: string | null;
  /** Whether hints are allowed (based on quiz mode) */
  hintAvailable?: boolean;
  /** Correct answers for MultiSelect - JSON array like ["A", "C"] */
  correctAnswers?: string | null;
  /** Accepted answers for FillInBlank - JSON array */
  acceptedAnswers?: string | null;
  explanation?: string | null; // Explanation of correct answer (available in Practice Mode)
}

export interface StudentSubmitQuestionDto {
  questionId: string;
  studentAnswer: string;
  essayAnswer?: string; // For essay-type questions
  /** For MultiSelect - JSON array of selected answers like ["A", "C"] */
  selectedAnswers?: string;
  /** For FillInBlank - text answer */
  textAnswer?: string;
}

export interface StudentQuizResultDto {
  attemptId: string;
  quizId: string;
  score: number | null;
  passingScore: number | null;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  /** Number of ungraded essay questions by the instructor. If > 0, the score may change. */
  ungradedEssayCount?: number | null;
}

/**
 * ================================================================
 * CẤU TRÚC DỮ LIỆU KẾT QUẢ QUIZ - StudentQuizResultDto
 * ================================================================
 * 
 * DÙNG ĐỂ HIỂN THỊ ĐIỂM SAU KHI STUDENT NỘP BÀI
 * 
 * CÁC TRƯỜNG QUAN TRỌNG:
 * 
 * @score - Điểm phần trăm (0-100)
 *   - Là điểm trên thang 100 (ví dụ: 85.5 nghĩa là 85.5%)
 *   - Backend tính: tổng điểm = 100, chia đều cho các câu hỏi
 *   - null = chưa có điểm (ví dụ: đang chờ lecturer chấm essay)
 * 
 * @passingScore - Ngưỡng để pass (ví dụ: 80 nghĩa là 80%)
 *   - Điểm tối thiểu để được coi là PASSED
 * 
 * @passed - Kết quả pass/fail
 *   - true = score >= passingScore
 *   - false = score < passingScore
 * 
 * @correctAnswers - Số câu đúng
 *   - Dùng để hiển thị "X/Y correct"
 *   - CHỈ tính câu hỏi MCQ/TrueFalse/MultiSelect (không tính Essay)
 * 
 * @totalQuestions - Tổng số câu hỏi
 *   - Bao gồm cả Essay
 * 
 * @ungradedEssayCount - Số câu Essay chưa được chấm
 *   - Nếu > 0: điểm hiện tại CHƯA bao gồm điểm essay
 *   - Điểm sẽ được cập nhật sau khi lecturer chấm xong
 * 
 * VÍ DỤ HIỂN THỊ:
 *   Score: 85.0 /100 (màu xanh)
 *   ✓ PASSED
 *   Passing: 80%
 *   3/4 MCQ correct
 *   PASSED
 */

/** Question review item - for showing after quiz submission */
export interface QuizReviewItem {
  questionId: string;
  questionText: string;
  type?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  studentAnswer?: string | null;
  essayAnswer?: string | null;
  studentSelectedAnswers?: string | null; // MultiSelect
  studentTextAnswer?: string | null; // FillInBlank
  correctAnswer?: string | null;
  correctAnswers?: string | null; // MultiSelect
  acceptedAnswers?: string | null; // FillInBlank
  isCorrect: boolean;
  imageUrl?: string | null;
  caseId?: string | null;
  scoreAwarded?: number | null;
  lecturerFeedback?: string | null;
  isGraded: boolean;
  maxScore: number;
  explanation?: string | null;
  hint?: string | null;
}

/** Distinguishes expert library case work vs student-upload Visual QA in history UI. */
export type StudentHistoryKind = 'caseStudy' | 'personalQa';

export interface StudentCaseHistoryItem {
  id: string;
  sessionId?: string | null;
  title: string;
  lastQuestionAsked?: string | null;
  /** BE list DTO (`VisualQaSessionHistoryItemDto`): short preview for cards. */
  questionSnippet?: string | null;
  thumbnailUrl?: string;
  boneLocation: string;
  lesionType: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  duration?: string;
  progress?: number;
  status?: 'Pending' | 'PendingExpert' | 'Approved' | 'Revised' | string;
  /** Session-level review workflow (list + thread; may overlap with `status`). */
  reviewState?: string | null;
  lastResponderRole?: string | null;
  askedAt?: string;
  /** BE often sends `updatedAt` on history list items. */
  updatedAt?: string | null;
  keyImagingFindings?: string | null;
  reflectiveQuestions?: string | null;
  historyKind: StudentHistoryKind;
  /** Published catalog case id when this row is tied to the case library (deep link to `/student/cases/[id]`). */
  catalogCaseId?: string | null;
  /** Lecturer rejection message when session status is Rejected (BE: VisualQaSessionHistoryItemDto). */
  rejectionReason?: string | null;
}

/** Nguồn case trong thư viện công khai — chỉ hai nhãn UI theo nghiệp vụ. */
export type StudentCaseCatalogOrigin = 'expertCreated' | 'communityPromoted';

export interface StudentCaseCatalogItem {
  id: string;
  title: string;
  imageUrl?: string;
  /** Vùng giải phẫu / bone location (hiển thị chip). */
  location: string;
  /** Category hiển thị (tách khỏi lesionType khi BE trả đủ). */
  categoryDisplay?: string;
  lesionType: string;
  /**
   * Tier chuẩn hóa khi map được từ enum BE; `null` khi không khớp — không ép 'basic'.
   * Giữ optional để tương thích code cũ dùng `difficulty`.
   */
  difficultyTier?: 'basic' | 'intermediate' | 'advanced' | null;
  /** Nhãn hiển thị độ khó (ưu tiên raw từ BE). */
  difficultyLabel: string;
  /** @deprecated Dùng difficultyLabel + difficultyTier */
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  tags: string[];
  createdAt?: string;
  caseOrigin: StudentCaseCatalogOrigin;
}

/** Ảnh ẩn danh + ROI tùy chọn trên chi tiết case catalog. */
export interface StudentCatalogCaseImage {
  imageUrl: string;
  roiBoundingBox?: NormalizedImageBoundingBox | null;
}

export interface StudentCaseCatalogDetail extends StudentCaseCatalogItem {
  description?: string;
  expertSummary?: string;
  keyFindings?: string[];
  approvedAt?: string;
  diagnosis?: string;
  keyLearningPoints?: string[];
  images?: StudentCatalogCaseImage[];
  /** true = chỉ tham khảo, không mở Visual QA “Ask AI”. */
  communityReferenceOnly?: boolean;
}

/** Real-time payload from SignalR `ReceiveNotification` (aligned with backend hub). */
export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: string;
  /** BE-normalized SPA path (pathname + query + fragment); prefer over `targetUrl` when set. */
  route?: string;
  targetUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AppNotificationItem {
  id: string;
  type: string;
  title: string;
  message?: string;
  route?: string;
  createdAt?: string;
  isRead?: boolean;
}

/** From GET /api/admin/users — enrollments snapshot (BE `classAssignments`). */
export interface AdminClassAssignment {
  classId: string;
  className: string;
  roleInClass: string;
  enrolledAt?: string | null;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt?: string;
  schoolCohort?: string;
  classAssignments?: AdminClassAssignment[];
}

export interface PercentageBoundingBox {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

/** Polygon vertices in normalized image space (0–1 per axis); legacy student ROI payloads. */
export interface NormalizedPolygonPoint {
  x: number;
  y: number;
}

/** Axis-aligned bounding box in normalized image space (0–1). Preferred for Visual QA + expert case annotations. */
export interface NormalizedImageBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExpertReviewItem {
  sessionId: string;
  answerId?: string | null;
  id: string;
  studentName: string;
  className?: string;
  questionText: string;
  question: string;
  /** Catalog case id when session is tied to library case. */
  caseId?: string | null;
  /** Snapshot from `medical_cases` (aligned with lecturer triage). */
  caseDescription?: string | null;
  caseSuggestedDiagnosis?: string | null;
  caseKeyFindings?: string | null;
  /** Snapshot title from catalog case when present. */
  caseTitle?: string | null;
  imageUrl?: string;
  imageId?: string | null;
  dicomMetadata?: VisualQaDicomMetadata | null;
  customImageUrl?: string | null;
  promotedCaseId?: string | null;
  customCoordinates?: PercentageBoundingBox | null;
  /** Normalized rectangle ROI `{ x, y, width, height }` in 0–1 (preferred when present). */
  customBoundingBox?: NormalizedImageBoundingBox | null;
  /** Legacy: polygon vertices (0–1). */
  customPolygon?: NormalizedPolygonPoint[] | null;
  askedAt: string;
  status: 'PendingExpert' | 'Approved' | 'Rejected' | string;
  report: VisualQaReport;
  turns?: VisualQaTurn[];
  latestTurnIndex?: number | null;
  requestedReviewMessageId?: string | null;
  selectedUserMessageId?: string | null;
  selectedAssistantMessageId?: string | null;
  citations?: Citation[];
  keyImagingFindings?: string | null;
  reflectiveQuestions?: string | null;
  /**
   * `dashboard-summary`: row từ fallback `/expert/dashboard/pending-reviews` (không đủ ảnh/citations như queue chính).
   */
  queueSource?: 'queue' | 'dashboard-summary';
}

export interface Citation {
  chunkId: string;
  sourceText: string;
  /** Knowledge-base document id when BE sends `ExpertCitationDto.documentId`. */
  documentId?: string;
  referenceUrl?: string;
  pageNumber?: number;
  flagged?: boolean;
}

export type ExpertReviewCitation = Citation;
// ========== Lecturer Quiz Types ==========

export interface QuizDto {
  id: string;
  classId: string;
  className?: string | null;
  title: string;
  topic: string | null;
  isAiGenerated: boolean;
  isVerifiedCurriculum?: boolean;
  difficulty: string | null;
  classification: string | null;
  openTime: string | null;
  closeTime: string | null;
  timeLimit: number | null;
  passingScore: number | null;
  createdAt: string | null;
  /** Deep classification - Bone Specialty */
  boneSpecialtyId?: string | null;
  boneSpecialtyName?: string | null;
  /** Deep classification - Pathology Category */
  pathologyCategoryId?: string | null;
  pathologyCategoryName?: string | null;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number | null;
  /** Present when API returns aggregate question count. */
  questionCount?: number | null;
  quizName?: string | null;
  /** True nếu quiz này từ Expert Library (CreatedByExpertId != null). */
  isFromExpertLibrary?: boolean;
}

export interface QuizWithQuestionsDto {
  quiz: QuizDto;
  questions: QuizQuestionDto[];
  totalQuestions: number;
}

export interface ClassQuizDto {
  classId: string;
  quizId: string;
  quizName: string | null;
  className: string | null;
  /** Quiz topic (different from class name). */
  topic?: string | null;
  assignedAt: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  questionCount?: number;
  /** Quiz from Expert Library or created by lecturer */
  isFromExpertLibrary: boolean;
  /** Time limit in minutes (set by Expert or Lecturer) */
  timeLimit?: number | null;
  /** Passing score percentage (set by Expert or Lecturer) */
  passingScore?: number | null;
  /** Whether assignment card was auto-created (now false - manual creation required) */
  isAutoCreated?: boolean;
  /** Message about manual assignment card creation */
  message?: string;
  /** Name of quiz creator: "You" if created by lecturer, Expert name if copied from Expert Library */
  creatorName?: string | null;
  /** Creator type: "Lecturer" or "Expert" */
  creatorType?: string | null;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number;
}

export interface AssignedQuizDto {
  assignmentId: string; // ClassQuizSession.Id
  classId: string;
  quizId: string;
  quizName: string | null;
  className: string | null;
  topic?: string | null;
  assignedAt: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  questionCount: number;
  isFromExpertLibrary: boolean;
  creatorName?: string | null;
  creatorType?: string | null; // "Expert" or "Lecturer"
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number;
}

export interface CreateQuizRequest {
  title: string;
  topic?: string;
  isAiGenerated?: boolean;
  isVerifiedCurriculum?: boolean;
  difficulty?: string;
  classification?: string;
  openTime?: string;
  closeTime?: string;
  timeLimit?: number;
  passingScore?: number;
  classId: string;
  boneSpecialtyId?: string;
  pathologyCategoryId?: string;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number;
}

export interface QuizQuestionDto {
  id: string;
  quizId: string;
  quizTitle: string | null;
  caseId: string | null;
  caseTitle: string | null;
  questionText: string;
  type: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  imageUrl?: string | null;
  hint?: string | null;
  explanation?: string | null;
  correctAnswers?: string | null;
  acceptedAnswers?: string | null;
  maxScore?: number;
}

export interface ExpertQuizQuestion {
  id: string;
  quizId: string;
  quizTitle: string | null;
  caseId: string | null;
  caseTitle: string | null;
  questionText: string;
  type: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  imageUrl?: string | null;
  hint?: string | null;
  explanation?: string | null;
  correctAnswers?: string | null;
  acceptedAnswers?: string | null;
}

export interface CreateQuizQuestionRequest {
  quizId: string;
  caseId?: string;
  questionText: string;
  type: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  essayAnswer?: string;
  imageUrl?: string;
  hint?: string;
  explanation?: string;
  correctAnswers?: string | string[];
  acceptedAnswers?: string | string[];
  maxScore?: number;
}

export interface UpdateQuizQuestionRequest {
  questionText: string;
  type?: string;
  correctAnswer?: string;
  essayAnswer?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  imageUrl?: string;
  hint?: string;
  explanation?: string;
  correctAnswers?: string | string[];
  acceptedAnswers?: string | string[];
  maxScore?: number;
}

// ========== AI Quiz Types ==========

export interface AIQuizQuestion {
  questionText: string;
  type: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  essayAnswer?: string;
  caseId?: string;
  caseTitle?: string;
  explanation?: string;
}

export interface AIQuizGenerationResult {
  success: boolean;
  message?: string;
  questions: AIQuizQuestion[];
  topic?: string;
  difficulty?: string;
}

export interface AIAutoGenerateQuizRequest {
  title: string;
  topic: string;
  difficulty?: string;
  classification?: string;
  questionCount?: number;
  classId?: string;
  openTime?: string;
  closeTime?: string;
  timeLimit?: number;
  passingScore?: number;
}

export interface AISuggestQuestionsRequest {
  cases: Array<{
    caseId?: string | null;
    caseTitle?: string | null;
    caseDescription?: string | null;
    imageUrl?: string | null;
    modality?: string | null;
    keyFindings?: string | null;
    suggestedDiagnosis?: string | null;
    difficulty?: string | null;
  }>;
  questionsPerCase?: number;
  difficulty?: string | null;
}

// ========== AI Image Quiz Types ==========

export interface VisualQAGeneratedQuestion {
  questionText: string;
  type: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  caseId?: string;
  caseTitle?: string;
  imageUrl?: string;
}

export interface VisualQAGenerateQuizResponse {
  success: boolean;
  message?: string;
  questions: VisualQAGeneratedQuestion[];
  generatedTopic?: string;
  difficulty?: string;
  imageAnalysis?: string;
}

export interface ImportStudentsSummary {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
  importedStudents: Array<{
    studentId: string;
    studentName: string;
    studentCode: string;
  }>;
}

// ========== Student Types ==========

export interface StudentAnnouncement {
  id: string;
  classId: string;
  className: string | null;
  title: string;
  content: string;
  createdAt: string | null;
  /** Optional: related assignment info to help students identify related work */
  relatedAssignment?: AnnouncementAssignmentInfo | null;
}

// ========== Lecturer Missing Types ==========

export interface UpdateClassRequest {
  className: string;
  semester: string;
  expertId?: string;
}

export interface ExpertOption {
  id: string;
  fullName: string;
  email?: string | null;
}

export interface ClassStudentProgress {
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  studentCode: string | null;
  totalCasesViewed: number;
  totalQuestionsAsked: number;
  avgQuizScore: number | null;
  quizAttempts: number;
  escalatedAnswers: number;
  lastActivityAt: string | null;
}

export interface LectStudentQuestionDetail {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  caseId: string | null;
  caseTitle: string | null;
  caseDescription: string | null;
  caseSuggestedDiagnosis?: string | null;
  caseKeyFindings?: string | null;
  caseThumbnailUrl: string | null;
  caseDifficulty: string | null;
  questionText: string;
  language: string | null;
  createdAt: string | null;
  answerId: string | null;
  answerText: string | null;
  structuredDiagnosis: string | null;
  differentialDiagnoses: string | null;
  answerStatus: string | null;
  aiConfidenceScore: number | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  isEscalated: boolean;
  escalatedByName: string | null;
  escalatedAt: string | null;
}

export interface LecturerAnswer {
  answerId: string;
  answerText: string;
  structuredDiagnosis: string | null;
  differentialDiagnoses: string | null;
  status: string;
  updatedAt: string;
}

// ── Quiz Review Types ────────────────────────────────────────────────────────────

export interface StudentQuizAttemptDto {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  totalQuestions: number;
  correctCount: number;
  isGraded: boolean;
}

export interface QuizAttemptDetailDto {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  passingScore: number | null;
  questions: QuestionWithAnswerDto[];
}

export interface QuestionWithAnswerDto {
  questionId: string;
  questionText: string;
  type: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  studentAnswer: string | null;
  essayAnswer: string | null;
  isCorrect: boolean | null;
  answerId: string;
  maxScore: number;
  scoreAwarded: number | null;
  lecturerFeedback: string | null;
  isGraded: boolean;
  referenceAnswer: string | null;
  imageUrl?: string | null;
}

export interface UpdateQuizAttemptRequestDto {
  score?: number | null;
  answers: UpdateAnswerDto[];
}

export interface UpdateAnswerDto {
  answerId: string;
  studentAnswer?: string | null;
  essayAnswer?: string | null;
  isCorrect?: boolean | null;
  scoreAwarded?: number | null;
  lecturerFeedback?: string | null;
  isGraded?: boolean;
}

// ── Assignment DTOs ───────────────────────────────────────────────────────────

export interface ClassCaseAssignmentDto {
  classId: string;
  caseId: string;
  caseTitle: string;
  assignedAt: string | null;
  dueDate: string | null;
  isMandatory: boolean;
}

export interface ClassQuizSessionDto {
  id: string;
  classId: string;
  quizId: string;
  quizTitle: string;
  openTime: string | null;
  closeTime: string | null;
  timeLimitMinutes: number | null;
  passingScore: number | null;
  createdAt: string | null;
  shuffleQuestions: boolean;
  allowRetake: boolean;
  allowLate: boolean;
  showResultsAfterSubmission: boolean;
  retakeResetAt: string | null;
  warning?: string | null;
}
