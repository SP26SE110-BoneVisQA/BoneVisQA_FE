import axios from 'axios';
import { http, getApiErrorMessage } from './client';
import type {
  Announcement,
  AnnouncementAssignmentInfo,
  ClassAssignment,
  CaseDto,
  ClassItem,
  ClassStats,
  StudentEnrollment,
  ImportStudentsSummary,
  LectStudentQuestionDto,
  UpdateClassRequest,
  ClassStudentProgress,
  StudentQuizAttemptDto,
  QuizAttemptDetailDto,
  UpdateQuizAttemptRequestDto,
  VisualQaTurn,
  AssignmentDetail,
  AssignmentSubmission,
  UpdateAssignmentRequest,
  UpdateAssignmentSubmissionRequest,
  QuizWithQuestionsDto,
  ClassCaseAssignmentDto,
} from './types';
import {
  isValidNormalizedBoundingBox,
  parseNormalizedBoundingBox,
  parsePercentageBoundingBox,
  percentageBoundingBoxToNormalized,
} from '@/lib/utils/annotations';
import { normalizeDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalize JSON from BE (camelCase or PascalCase) + attach classId when missing. */
export function normalizeAnnouncement(row: unknown, fallbackClassId: string): Announcement {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const id = String(r.id ?? r.Id ?? '').trim();
  const classId = String(r.classId ?? r.ClassId ?? fallbackClassId).trim() || fallbackClassId;

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
    classId,
    className: String(r.className ?? r.ClassName ?? '') || '',
    title: String(r.title ?? r.Title ?? '') || '',
    content: String(r.content ?? r.Content ?? '') || '',
    sendEmail: Boolean(r.sendEmail ?? r.SendEmail ?? true),
    createdAt: String(r.createdAt ?? r.CreatedAt ?? new Date().toISOString()),
    relatedAssignment,
  };
}

function assertValidGuid(label: string, value: string) {
  const v = String(value ?? '').trim();
  if (!v || !GUID_RE.test(v)) {
    throw new Error(`${label} is missing or not a valid id. Refresh the page and try again.`);
  }
  return v;
}

/** Used to filter records with insufficient id before calling update/delete API. */
export function isValidGuidString(value: string | undefined | null): boolean {
  return GUID_RE.test(String(value ?? '').trim());
}

/** Normalize a single assignment row from BE (camelCase or PascalCase). */
function normalizeAssignment(row: unknown): ClassAssignment | null {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const id = String(r.id ?? r.Id ?? '').trim();
  if (!id || !GUID_RE.test(id)) return null;
  return {
    id,
    classId: String(r.classId ?? r.ClassId ?? '') || '',
    className: String(r.className ?? r.ClassName ?? '') || '',
    type: String(r.type ?? r.Type ?? '') || '',
    title: String(r.title ?? r.Title ?? '') || '',
    dueDate: (r.dueDate ?? r.DueDate ?? null) as string | null,
    isMandatory: Boolean(r.isMandatory ?? r.IsMandatory ?? false),
    assignedAt: (r.assignedAt ?? r.AssignedAt ?? null) as string | null,
    totalStudents: Number(r.totalStudents ?? r.TotalStudents ?? 0) || 0,
    submittedCount: Number(r.submittedCount ?? r.SubmittedCount ?? 0) || 0,
    gradedCount: Number(r.gradedCount ?? r.GradedCount ?? 0) || 0,
  };
}

export async function createClass(body: {
  className: string;
  semester: string;
  lecturerId: string;
}): Promise<ClassItem> {
  try {
    const { data } = await http.post<ClassItem>('/api/lecturer/classes', body);
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function normalizeClassItem(raw: unknown): ClassItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.Id ?? '').trim();
  if (!id) return null;
  const expertRaw = r.expertId ?? r.ExpertId;
  const expertNameRaw = r.expertName ?? r.ExpertName;
  return {
    id,
    className: String(r.className ?? r.ClassName ?? ''),
    semester: String(r.semester ?? r.Semester ?? ''),
    lecturerId: String(r.lecturerId ?? r.LecturerId ?? ''),
    createdAt: String(r.createdAt ?? r.CreatedAt ?? ''),
    expertId:
      expertRaw !== undefined && expertRaw !== null && String(expertRaw).trim() !== ''
        ? String(expertRaw).trim()
        : null,
    expertName:
      expertNameRaw !== undefined && expertNameRaw !== null && String(expertNameRaw).trim() !== ''
        ? String(expertNameRaw)
        : null,
  };
}

export async function getLecturerClasses(lecturerId?: string): Promise<ClassItem[]> {
  void lecturerId;
  try {
    const { data } = await http.get<unknown[]>('/api/lecturer/classes');
    const list = Array.isArray(data) ? data : [];
    return list.map(normalizeClassItem).filter((c): c is ClassItem => c !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getClassStudents(classId: string): Promise<StudentEnrollment[]> {
  try {
    const { data } = await http.get<StudentEnrollment[]>(`/api/lecturer/classes/${classId}/students`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getAvailableStudents(classId: string): Promise<StudentEnrollment[]> {
  try {
    const { data } = await http.get<StudentEnrollment[]>(
      `/api/lecturer/classes/${classId}/students/available`,
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function enrollStudent(classId: string, studentId: string): Promise<void> {
  try {
    await http.post(`/api/lecturer/classes/${classId}/enroll`, { studentId });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function removeStudent(classId: string, studentId: string): Promise<void> {
  try {
    await http.delete(`/api/lecturer/classes/${classId}/students/${studentId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}


export async function getLecturerCases(): Promise<CaseDto[]> {
  try {
    const { data } = await http.get<CaseDto[]>('/api/lecturer/cases');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function assignCasesToClass(
  classId: string,
  payload: { caseIds: string[]; dueDate?: string; isMandatory: boolean },
): Promise<ClassCaseAssignmentDto[]> {
  try {
    const { data } = await http.post<ClassCaseAssignmentDto[]>(
      `/api/lecturer/classes/${classId}/assignments/cases`,
      {
      caseIds: payload.caseIds,
      dueDate: payload.dueDate,
      isMandatory: payload.isMandatory,
      },
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getAssignedCasesForClass(classId: string): Promise<ClassCaseAssignmentDto[]> {
  try {
    const { data } = await http.get<ClassCaseAssignmentDto[]>(
      `/api/lecturer/classes/${classId}/assignments/cases`,
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function assignQuizToClass(
  classId: string,
  payload: {
    quizId: string;
    openTime?: string;
    closeTime?: string;
    timeLimitMinutes?: number;
    passingScore?: number;
    shuffleQuestions?: boolean;
    allowRetake?: boolean;
  },
): Promise<void> {
  try {
    await http.post(`/api/lecturer/classes/${classId}/assignments/quizzes`, {
      quizId: payload.quizId,
      openTime: payload.openTime,
      closeTime: payload.closeTime,
      timeLimitMinutes: payload.timeLimitMinutes,
      passingScore: payload.passingScore,
      shuffleQuestions: payload.shuffleQuestions,
      allowRetake: payload.allowRetake,
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ĐÃ TẮT: getExperts — Giảng viên không gán chuyên gia
// /** Lấy danh sách Chuyên gia để gán cho một lớp. */
// export async function getExperts(): Promise<ExpertOption[]> {
//   try {
//     const { data } = await http.get<ExpertOption[]>('/api/lecturer/experts');
//     return Array.isArray(data) ? data : [];
//   } catch (e) {
//     throw new Error(getApiErrorMessage(e));
//   }
// }

// ĐÃ TẮT: assignExpertToClass — Giảng viên không gán chuyên gia
// /** Gán (hoặc xóa) một Chuyên gia khỏi một lớp. expertId = null → xóa chuyên gia. */
// export async function assignExpertToClass(classId: string, expertId: string | null): Promise<void> {
//   try {
//     await http.put(`/api/lecturer/classes/${classId}/expert`, { expertId });
//   } catch (e) {
//     throw new Error(getApiErrorMessage(e));
//   }
// }

export async function getClassAnnouncements(classId: string): Promise<Announcement[]> {
  try {
    const { data } = await http.get<unknown[]>(`/api/lecturer/classes/${classId}/announcements`);
    const list = Array.isArray(data) ? data : [];
    return list.map((row) => normalizeAnnouncement(row, classId));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createAnnouncement(
  classId: string,
  body: { title: string; content: string; sendEmail: boolean; assignmentId?: string | null },
): Promise<Announcement> {
  try {
    const { data } = await http.post<Announcement | ''>(
      `/api/lecturer/classes/${classId}/announcements`,
      body,
    );
    if (!data || typeof data === 'string') {
      return {
        id: '',
        classId,
        className: '',
        title: body.title,
        content: body.content,
        sendEmail: body.sendEmail,
        createdAt: new Date().toISOString(),
        relatedAssignment: body.assignmentId ? { assignmentId: body.assignmentId } : undefined,
      };
    }
    return normalizeAnnouncement(data, classId);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateAnnouncement(
  classId: string,
  announcementId: string,
  body: { title: string; content: string; sendEmail: boolean; assignmentId?: string | null },
): Promise<Announcement> {
  const cId = assertValidGuid('Class', classId);
  const aId = assertValidGuid('Announcement', announcementId);
  try {
    const { data } = await http.put<unknown>(
      `/api/lecturer/classes/${encodeURIComponent(cId)}/announcements/${encodeURIComponent(aId)}`,
      body,
    );
    return normalizeAnnouncement(data, cId);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteAnnouncement(classId: string, announcementId: string): Promise<void> {
  const cId = assertValidGuid('Class', classId);
  const aId = assertValidGuid('Announcement', announcementId);
  try {
    await http.delete(
      `/api/lecturer/classes/${encodeURIComponent(cId)}/announcements/${encodeURIComponent(aId)}`,
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function moveAnnouncement(announcementId: string, targetClassId: string): Promise<Announcement> {
  const aId = assertValidGuid('Announcement', announcementId);
  const cId = assertValidGuid('Class', targetClassId);
  try {
    const { data } = await http.put<unknown>(
      `/api/lecturer/announcements/${encodeURIComponent(aId)}/move`,
      { targetClassId: cId },
    );
    return normalizeAnnouncement(data, cId);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getClassAssignments(classId: string): Promise<ClassAssignment[]> {
  try {
    const { data } = await http.get<unknown[]>(
      `/api/lecturer/classes/${encodeURIComponent(classId)}/assignments`,
    );
    const list = Array.isArray(data) ? data : [];
    return list
      .map(normalizeAssignment)
      .filter((a): a is ClassAssignment => a !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getAllLecturerAssignments(lecturerId: string): Promise<ClassAssignment[]> {
  const lid = assertValidGuid('Lecturer', lecturerId);
  try {
    const { data } = await http.get<unknown[]>(
      `/api/lecturer/assignments?lecturerId=${encodeURIComponent(lid)}`,
    );
    const list = Array.isArray(data) ? data : [];
    const normalized = list
      .map(normalizeAssignment)
      .filter((a): a is ClassAssignment => a !== null);
    // Loại bỏ trùng lặp theo id (phòng thủ: đề phòng backend trả về dữ liệu trùng lặp)
    const seen = new Set<string>();
    return normalized.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getClassStats(classId: string): Promise<ClassStats> {
  try {
    const { data } = await http.get<ClassStats>(`/api/lecturer/classes/${classId}/stats`);
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Pulls the answer row GUID for POST /api/lecturer/triage/{answerId}/escalate from flat or nested payloads.
 */
export function extractAnswerIdFromQuestionRow(r: Record<string, unknown>): string | null {
  const direct =
    r.answerId ??
    r.AnswerId ??
    r.answer_id ??
    r.latestAnswerId ??
    r.LatestAnswerId ??
    r.answerGuid ??
    r.AnswerGuid ??
    r.visualQaAnswerId ??
    r.VisualQaAnswerId ??
    r.caseAnswerId ??
    r.CaseAnswerId ??
    r.triageAnswerId ??
    r.TriageAnswerId ??
    r.responseId ??
    r.ResponseId;
  if (direct != null && String(direct).trim() !== '') return String(direct).trim();

  const nestedCandidates = [
    r.answer,
    r.Answer,
    r.answerDto,
    r.AnswerDto,
    r.latestAnswer,
    r.LatestAnswer,
    r.visualQaAnswer,
    r.VisualQaAnswer,
    r.caseAnswer,
    r.CaseAnswer,
  ];
  for (const nested of nestedCandidates) {
    if (nested && typeof nested === 'object') {
      const a = nested as Record<string, unknown>;
      const id = a.id ?? a.Id ?? a.answerId ?? a.AnswerId ?? a.guid ?? a.Guid;
      if (id != null && String(id).trim() !== '') return String(id).trim();
    }
  }

  return null;
}

function normalizeQuestionSource(raw: unknown): LectStudentQuestionDto['questionSource'] {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const u = s.replace(/\s+/g, '');
  if (u === 'CaseQA' || u.toLowerCase() === 'caseqa') return 'CaseQA';
  if (u === 'VisualQA' || u.toLowerCase() === 'visualqa') return 'VisualQA';
  return null;
}

function parseCaseTagLabels(r: Record<string, unknown>): string[] {
  const direct = r.caseTags ?? r.CaseTags ?? r.tags ?? r.Tags;
  if (Array.isArray(direct)) {
    return direct.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof direct === 'string' && direct.trim()) {
    return direct
      .split(/[,;|]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const caseObj = r.case ?? r.Case;
  if (caseObj && typeof caseObj === 'object') {
    const c = caseObj as Record<string, unknown>;
    const nested = c.tags ?? c.Tags ?? c.labels ?? c.Labels;
    if (Array.isArray(nested)) return nested.map((x) => String(x).trim()).filter(Boolean);
    if (typeof nested === 'string' && nested.trim()) {
      return nested
        .split(/[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function normalizePersonalUploadFlag(r: Record<string, unknown>): boolean | null {
  const v = r.isPersonalUpload ?? r.IsPersonalUpload ?? r.isAdHoc ?? r.IsAdHoc;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return null;
}

/**
 * Maps GET /api/lecturer/classes/{classId}/questions rows to camelCase and ensures
 * `answerId` is populated when the backend sends PascalCase or alternate keys.
 * Escalation uses POST /api/lecturer/triage/{answerId}/escalate — the route id must be the answer GUID, not the question id.
 */
function normalizeLectStudentQuestionDto(raw: unknown): LectStudentQuestionDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  function extractDicomMetadata(row: Record<string, unknown>) {
    const candidates: unknown[] = [
      row.dicomMetadata,
      row.dicom_metadata,
      row.DicomMetadata,
      row.metadata,
      row.Metadata,
      row.studyMetadata,
      row.study_metadata,
    ];
    const session = row.session ?? row.visualQaSession ?? row.VisualQaSession;
    if (session && typeof session === 'object') {
      const s = session as Record<string, unknown>;
      candidates.push(s.dicomMetadata, s.dicom_metadata, s.DicomMetadata, s.metadata, s.Metadata);
    }
    for (const candidate of candidates) {
      const normalized = normalizeDicomMetadata(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  const questionId = String(
    r.questionId ?? r.QuestionId ?? r.id ?? r.Id ?? '',
  ).trim();
  if (!questionId) return null;

  let answerId = extractAnswerIdFromQuestionRow(r);
  const explicitQuestionId = String(r.questionId ?? r.QuestionId ?? '').trim();
  const explicitRowId = String(r.id ?? r.Id ?? '').trim();
  if (
    !answerId &&
    explicitQuestionId &&
    explicitRowId &&
    explicitQuestionId !== explicitRowId
  ) {
    // DTO danh sách chung: `id` là hàng câu trả lời, `questionId` là câu hỏi cha.
    answerId = explicitRowId;
  }

  const scoreRaw = r.aiConfidenceScore ?? r.AiConfidenceScore ?? r.similarityScore ?? r.SimilarityScore;
  let aiConfidenceScore: number | null = null;
  if (typeof scoreRaw === 'number' && !Number.isNaN(scoreRaw)) {
    aiConfidenceScore = scoreRaw > 1 ? Math.min(1, scoreRaw / 100) : scoreRaw;
  } else if (typeof scoreRaw === 'string' && scoreRaw.trim() !== '') {
    const n = parseFloat(scoreRaw);
    if (!Number.isNaN(n)) aiConfidenceScore = n > 1 ? Math.min(1, n / 100) : n;
  }

  const caseObj = r.case ?? r.Case;
  const fromCase =
    caseObj && typeof caseObj === 'object'
      ? String(
          (caseObj as Record<string, unknown>).customImageUrl ??
            (caseObj as Record<string, unknown>).CustomImageUrl ??
            (caseObj as Record<string, unknown>).imageUrl ??
            (caseObj as Record<string, unknown>).ImageUrl ??
            (caseObj as Record<string, unknown>).thumbnailUrl ??
            (caseObj as Record<string, unknown>).ThumbnailUrl ??
            '',
        ).trim()
      : '';
  const fromRow = String(
    r.customImageUrl ??
      r.CustomImageUrl ??
      r.studentImageUrl ??
      r.StudentImageUrl ??
      r.imageUrl ??
      r.ImageUrl ??
      r.thumbnailUrl ??
      r.ThumbnailUrl ??
      r.caseThumbnailUrl ??
      r.CaseThumbnailUrl ??
      '',
  ).trim();
  const customImageUrl = fromRow || fromCase || null;
  const imageUrlExplicit = String(r.imageUrl ?? r.ImageUrl ?? r.studyImageUrl ?? r.StudyImageUrl ?? '').trim() || null;

  const caseAnswerIdRaw =
    r.caseAnswerId ??
    r.CaseAnswerId ??
    r.visualQaAnswerId ??
    r.VisualQaAnswerId ??
    r.caseVisualAnswerId ??
    r.CaseVisualAnswerId;
  const caseAnswerId =
    caseAnswerIdRaw != null && String(caseAnswerIdRaw).trim() !== ''
      ? String(caseAnswerIdRaw).trim()
      : null;

  /**
   * BE `VisualQaTurnDto`: camelCase **`answerText`** và **`messageText`** cùng chuỗi hiển thị assistant.
   * Giữ các fallback nested cho API cũ hoặc payload không đầy đủ.
   */
  function extractTurnAssistantText(row: Record<string, unknown>): string {
    const tryStr = (v: unknown): string => {
      if (v == null) return '';
      if (typeof v === 'string') return v.trim();
      return String(v).trim();
    };

    for (const key of [
      row.answerText,
      row.AnswerText,
      row.messageText,
      row.MessageText,
      row.aiAnswerText,
      row.AiAnswerText,
      row.assistantAnswer,
      row.AssistantAnswer,
      row.responseText,
      row.ResponseText,
      row.reply,
      row.Reply,
      row.content,
      row.Content,
    ]) {
      const s = tryStr(key);
      if (s) return s;
    }

    const am =
      row.assistantMessage ??
      row.AssistantMessage ??
      row.assistant_message ??
      row.latestAssistantMessage ??
      row.LatestAssistantMessage;
    if (am && typeof am === 'object') {
      const amr = am as Record<string, unknown>;
      const fromAm = tryStr(
        amr.content ??
          amr.Content ??
          amr.text ??
          amr.Text ??
          amr.body ??
          amr.answerText ??
          amr.AnswerText,
      );
      if (fromAm) return fromAm;
    }

    const messagesRaw = row.messages ?? row.Messages;
    if (Array.isArray(messagesRaw)) {
      for (let i = messagesRaw.length - 1; i >= 0; i -= 1) {
        const m = messagesRaw[i];
        if (!m || typeof m !== 'object') continue;
        const mr = m as Record<string, unknown>;
        const role = String(mr.role ?? mr.Role ?? '').toLowerCase();
        if (!role.includes('assistant') && role !== 'ai' && role !== 'model') continue;
        const body = tryStr(
          mr.content ?? mr.Content ?? mr.text ?? mr.Text ?? mr.answerText ?? mr.AnswerText,
        );
        if (body) return body;
      }
    }

    const reportRaw =
      row.report ??
      row.Report ??
      row.structuredReport ??
      row.StructuredReport ??
      row.visualQaReport ??
      row.VisualQaReport ??
      row.aiReport ??
      row.AiReport;
    if (reportRaw && typeof reportRaw === 'object') {
      const rr = reportRaw as Record<string, unknown>;
      const fromReport = tryStr(
        rr.answerText ??
          rr.AnswerText ??
          rr.messageText ??
          rr.MessageText ??
          rr.answer ??
          rr.Answer,
      );
      if (fromReport) return fromReport;
    }

    return '';
  }

  function fallbackAssistantSummaryFromStructured(row: Record<string, unknown>): string {
    const findings = Array.isArray(row.findings)
      ? row.findings.map((x) => String(x).trim()).filter(Boolean)
      : Array.isArray(row.keyFindings)
        ? row.keyFindings.map((x) => String(x).trim()).filter(Boolean)
        : [];
    const diff = Array.isArray(row.differentialDiagnoses)
      ? row.differentialDiagnoses.map((x) => String(x).trim()).filter(Boolean)
      : [];
    const diag = String(row.diagnosis ?? row.Diagnosis ?? row.suggestedDiagnosis ?? '').trim();
    const sd = String(row.structuredDiagnosis ?? row.StructuredDiagnosis ?? '').trim();
    const kim = String(row.keyImagingFindings ?? row.KeyImagingFindings ?? '').trim();
    const chunks: string[] = [];
    if (diag) chunks.push(`Diagnosis: ${diag}`);
    if (sd && sd !== diag) chunks.push(sd);
    if (kim) chunks.push(`Key imaging: ${kim}`);
    if (findings.length) chunks.push(`Findings:\n${findings.map((f) => `• ${f}`).join('\n')}`);
    if (diff.length) chunks.push(`Differential:\n${diff.map((d) => `• ${d}`).join('\n')}`);
    return chunks.join('\n\n').trim();
  }

  const normalizeTurn = (row: unknown, idx: number): VisualQaTurn | null => {
    if (!row || typeof row !== 'object') return null;
    const t = row as Record<string, unknown>;
    const q = String(t.questionText ?? t.QuestionText ?? '').trim();
    let a = extractTurnAssistantText(t);
    if (!a) {
      a = fallbackAssistantSummaryFromStructured(t);
    }
    const turnIndexRaw = t.turnIndex ?? t.TurnIndex ?? idx + 1;
    const turnIndex =
      typeof turnIndexRaw === 'number'
        ? turnIndexRaw
        : Number.parseInt(String(turnIndexRaw), 10) || idx + 1;
    const userMsgRaw = t.userMessage ?? t.UserMessage;
    let userMsgCoords: unknown;
    if (userMsgRaw && typeof userMsgRaw === 'object') {
      const um = userMsgRaw as Record<string, unknown>;
      userMsgCoords =
        um.questionCoordinates ??
        um.QuestionCoordinates ??
        um.coordinates ??
        um.Coordinates;
    }
    const pctFromTurn = parsePercentageBoundingBox(
      t.customCoordinates ??
        t.CustomCoordinates ??
        t.annotationCoordinates ??
        t.AnnotationCoordinates,
    );
    const fromPctBox = pctFromTurn ? percentageBoundingBoxToNormalized(pctFromTurn) : null;

    const qcParsed =
      parseNormalizedBoundingBox(t.questionCoordinates ?? t.QuestionCoordinates) ??
      parseNormalizedBoundingBox(userMsgCoords);
    const roiBoundingBox =
      parseNormalizedBoundingBox(t.roiBoundingBox ?? t.RoiBoundingBox) ??
      qcParsed ??
      parseNormalizedBoundingBox(
        t.coordinates ?? t.Coordinates ?? t.customPolygon ?? t.CustomPolygon,
      ) ??
      fromPctBox;

    const questionCoordinates = qcParsed ?? fromPctBox ?? roiBoundingBox ?? undefined;

    return {
      turnId: String(t.turnId ?? t.TurnId ?? '').trim() || null,
      turnIndex,
      questionText: q,
      answerText: a,
      roiBoundingBox,
      ...(questionCoordinates && isValidNormalizedBoundingBox(questionCoordinates)
        ? { questionCoordinates }
        : {}),
      structuredDiagnosis: String(t.structuredDiagnosis ?? t.StructuredDiagnosis ?? '').trim() || null,
      keyImagingFindings: String(t.keyImagingFindings ?? t.KeyImagingFindings ?? '').trim() || null,
      diagnosis: String(
        t.diagnosis ?? t.Diagnosis ?? t.suggestedDiagnosis ?? t.SuggestedDiagnosis ?? '',
      ).trim(),
      findings: Array.isArray(t.findings)
        ? t.findings.map((x) => String(x))
        : Array.isArray(t.keyFindings)
          ? t.keyFindings.map((x) => String(x))
          : [],
      reflectiveQuestions: Array.isArray(t.reflectiveQuestions)
        ? t.reflectiveQuestions.map((x) => String(x))
        : String(t.reflectiveQuestions ?? t.ReflectiveQuestions ?? '')
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
      differentialDiagnoses: Array.isArray(t.differentialDiagnoses)
        ? t.differentialDiagnoses.map((x) => String(x))
        : [],
      citations: Array.isArray(t.citations)
        ? t.citations
            .map((entry) => {
              if (!entry || typeof entry !== 'object') return null;
              const c = entry as Record<string, unknown>;
              return {
                href: String(c.href ?? c.Href ?? c.referenceUrl ?? '').trim() || undefined,
                displayLabel: String(c.displayLabel ?? c.DisplayLabel ?? c.label ?? c.title ?? '').trim() || undefined,
                snippet: String(c.snippet ?? c.Snippet ?? '').trim() || undefined,
                pageLabel: String(c.pageLabel ?? c.PageLabel ?? '').trim() || undefined,
                kind: String(c.kind ?? c.Kind ?? '').trim() || undefined,
              };
            })
            .filter((entry) => entry !== null)
        : [],
      aiConfidenceScore:
        typeof (t.aiConfidenceScore ?? t.AiConfidenceScore) === 'number'
          ? Number(t.aiConfidenceScore ?? t.AiConfidenceScore)
          : undefined,
      createdAt: String(t.createdAt ?? t.CreatedAt ?? '').trim() || null,
      responseKind: String(t.responseKind ?? t.ResponseKind ?? '').trim() || null,
      clientRequestId: String(t.clientRequestId ?? t.ClientRequestId ?? '').trim() || null,
      assistantMessageId: String(t.assistantMessageId ?? t.AssistantMessageId ?? '').trim() || null,
      userMessageId: String(t.userMessageId ?? t.UserMessageId ?? '').trim() || null,
    };
  };

  const turnsRaw =
    (Array.isArray(r.turns) ? r.turns : null) ??
    (Array.isArray(r.Turns) ? r.Turns : null) ??
    ((r.session && typeof r.session === 'object' && Array.isArray((r.session as Record<string, unknown>).turns))
      ? ((r.session as Record<string, unknown>).turns as unknown[])
      : null) ??
    ((r.session && typeof r.session === 'object' && Array.isArray((r.session as Record<string, unknown>).Turns))
      ? ((r.session as Record<string, unknown>).Turns as unknown[])
      : null);
  const turns = Array.isArray(turnsRaw)
    ? turnsRaw.map(normalizeTurn).filter((t): t is VisualQaTurn => t !== null)
    : undefined;

  const caseIdRaw = r.caseId ?? r.CaseId;
  const caseId: string | null =
    caseIdRaw != null && String(caseIdRaw).trim() !== '' ? String(caseIdRaw).trim() : null;
  const nestedCaseTitle =
    caseObj && typeof caseObj === 'object'
      ? String(
          (caseObj as Record<string, unknown>).title ??
            (caseObj as Record<string, unknown>).Title ??
            (caseObj as Record<string, unknown>).name ??
            (caseObj as Record<string, unknown>).Name ??
            '',
        ).trim()
      : '';
  const caseTitle = String(r.caseTitle ?? r.CaseTitle ?? nestedCaseTitle ?? '').trim();
  const tagLabels = parseCaseTagLabels(r);
  const isPersonalUpload = normalizePersonalUploadFlag(r);
  const dicomMetadata = extractDicomMetadata(r);

  return {
    id: questionId,
    answerId,
    caseAnswerId,
    dicomMetadata,
    studentId: String(r.studentId ?? r.StudentId ?? ''),
    studentName: String(r.studentName ?? r.StudentName ?? ''),
    studentEmail: String(r.studentEmail ?? r.StudentEmail ?? ''),
    caseId,
    caseTitle,
    questionText: String(r.questionText ?? r.QuestionText ?? ''),
    language: r.language == null && r.Language == null ? null : String(r.language ?? r.Language ?? ''),
    createdAt: (() => {
      const raw =
        r.createdAt ??
        r.CreatedAt ??
        r.askedAt ??
        r.AskedAt ??
        r.submittedAt ??
        r.SubmittedAt ??
        r.questionCreatedAt ??
        r.QuestionCreatedAt ??
        null;
      const value = raw != null ? String(raw).trim() : '';
      return value || null;
    })(),
    answerText: (r.answerText ?? r.AnswerText ?? null) as string | null,
    answerStatus: (r.answerStatus ?? r.AnswerStatus ?? null) as string | null,
    escalatedById: (r.escalatedById ?? r.EscalatedById ?? null) as string | null,
    escalatedAt: (r.escalatedAt ?? r.EscalatedAt ?? null) as string | null,
    aiConfidenceScore,
    customImageUrl,
    imageUrl: imageUrlExplicit,
    turns,
    requestedReviewMessageId:
      String(r.requestedReviewMessageId ?? r.RequestedReviewMessageId ?? '').trim() || null,
    selectedUserMessageId:
      String(r.selectedUserMessageId ?? r.SelectedUserMessageId ?? '').trim() || null,
    selectedAssistantMessageId:
      String(r.selectedAssistantMessageId ?? r.SelectedAssistantMessageId ?? '').trim() || null,
    customCoordinates: parsePercentageBoundingBox(
      r.customCoordinates ??
        r.CustomCoordinates ??
        r.annotationCoordinates ??
        r.AnnotationCoordinates ??
        r.questionCoordinatesPercent ??
        r.visualQaRoiPercent ??
        r.coordinates ??
        r.Coordinates,
    ),
    citations: Array.isArray(r.citations)
      ? r.citations
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const c = entry as Record<string, unknown>;
            const chunkId = String(c.chunkId ?? c.id ?? c.ChunkId ?? '').trim();
            const sourceText = String(c.sourceText ?? c.text ?? c.SourceText ?? '').trim();
            if (!chunkId || !sourceText) return null;
            return {
              chunkId,
              sourceText,
              referenceUrl: String(c.referenceUrl ?? c.href ?? c.ReferenceUrl ?? '').trim() || undefined,
              pageNumber:
                typeof (c.pageNumber ?? c.PageNumber) === 'number'
                  ? Number(c.pageNumber ?? c.PageNumber)
                  : undefined,
              flagged:
                typeof (c.flagged ?? c.Flagged) === 'boolean'
                  ? Boolean(c.flagged ?? c.Flagged)
                  : undefined,
            };
          })
          .filter((entry) => entry !== null)
      : [],
    questionSource: normalizeQuestionSource(r.questionSource ?? r.QuestionSource),
    caseDescription: String(r.caseDescription ?? r.CaseDescription ?? '').trim() || null,
    caseSuggestedDiagnosis: String(r.caseSuggestedDiagnosis ?? r.CaseSuggestedDiagnosis ?? '').trim() || null,
    caseKeyFindings: String(r.caseKeyFindings ?? r.CaseKeyFindings ?? '').trim() || null,
    isPersonalUpload,
    caseTags: tagLabels.length > 0 ? tagLabels : null,
    reviewFeedback: (() => {
      const raw =
        r.reviewFeedback ??
        r.ReviewFeedback ??
        r.rejectionReason ??
        r.RejectionReason ??
        r.policyReason ??
        r.PolicyReason ??
        null;
      return raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
    })(),
  };
}

/**
 * Get student questions for a class
 */
export async function getStudentQuestions(
  classId: string,
  options?: { caseId?: string; studentId?: string; source?: 'visual-qa' | 'case-qa' | 'all' },
): Promise<LectStudentQuestionDto[]> {
  try {
    const { data } = await http.get<unknown[]>(
      `/api/lecturer/classes/${classId}/questions`,
      {
        params: {
          caseId: options?.caseId,
          studentId: options?.studentId,
          source: options?.source,
        },
      },
    );
    if (!Array.isArray(data)) return [];
    return data
      .map(normalizeLectStudentQuestionDto)
      .filter((row): row is LectStudentQuestionDto => row !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Visual QA triage queue.
 * Pending: GET /api/lecturer/triage/visual-qa
 * History: GET /api/lecturer/triage?status=History
 */
export type TriageQueueStatus = 'Pending' | 'History' | 'Approved' | 'Rejected';

export async function fetchLecturerVisualQaTriageQueue(
  classId: string,
  options?: { status?: TriageQueueStatus },
): Promise<LectStudentQuestionDto[]> {
  const status = options?.status ?? 'Pending';

  if (status === 'History' || status === 'Approved' || status === 'Rejected') {
    try {
      const { data } = await http.get<unknown[]>('/api/lecturer/triage', {
        params: { classId, status },
      });
      if (!Array.isArray(data)) return [];
      return data
        .map(normalizeLectStudentQuestionDto)
        .filter((row): row is LectStudentQuestionDto => row !== null);
    } catch (e) {
      throw new Error(getApiErrorMessage(e));
    }
  }

  try {
    const { data } = await http.get<unknown[]>(`/api/lecturer/triage/visual-qa`, {
      params: { classId },
    });
    if (!Array.isArray(data)) return [];
    return data
      .map(normalizeLectStudentQuestionDto)
      .filter((row): row is LectStudentQuestionDto => row !== null);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return getStudentQuestions(classId, { source: 'visual-qa' });
    }
    throw new Error(getApiErrorMessage(e));
  }
}

export async function rejectTriageAnswer(answerId: string, reason: string): Promise<void> {
  const id = String(answerId ?? '').trim();
  if (!id) throw new Error('Answer id is required to reject.');
  const payload = { reason: String(reason ?? '').trim() };
  try {
    await http.post(`/api/lecturer/triage/${encodeURIComponent(id)}/reject`, payload, {
      clearSessionOn401: false,
    });
    return;
  } catch (e) {
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      await http.put(`/api/lecturer/reviews/${encodeURIComponent(id)}/reject`, payload, {
        clearSessionOn401: false,
      });
      return;
    }
    throw new Error(getApiErrorMessage(e));
  }
}

/** Import students from Excel file */
export async function importStudentsFromExcel(
  classId: string,
  file: File,
): Promise<ImportStudentsSummary> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await http.post<ImportStudentsSummary>(
      `/api/lecturer/classes/${classId}/import-students`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function enrollManyStudents(
  classId: string,
  studentIds: string[],
): Promise<StudentEnrollment[]> {
  try {
    const { data } = await http.post<StudentEnrollment[]>(
      `/api/lecturer/classes/${classId}/enrollmany`,
      { studentIds },
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get a single class by ID
 */
export async function getClassById(classId: string): Promise<ClassItem> {
  try {
    const { data } = await http.get<ClassItem>(`/api/lecturer/classes/${classId}`);
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Update class information
 */
export async function updateClass(
  classId: string,
  body: UpdateClassRequest,
): Promise<ClassItem> {
  try {
    const { data } = await http.put<ClassItem>(`/api/lecturer/classes/${classId}`, body);
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Delete a class
 */
export async function deleteClass(classId: string): Promise<void> {
  try {
    await http.delete(`/api/lecturer/classes/${classId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get learning progress for all students in a class
 */
export async function getClassStudentProgress(
  classId: string,
): Promise<ClassStudentProgress[]> {
  try {
    const { data } = await http.get<ClassStudentProgress[]>(
      `/api/lecturer/classes/${classId}/student-progress`,
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ── API Đánh giá Quiz ────────────────────────────────────────────────────────────

/**
 * Get list of all quiz attempts for all students in the class for a specific quiz.
 */
export async function getClassQuizAttempts(
  classId: string,
  quizId: string,
): Promise<StudentQuizAttemptDto[]> {
  try {
    const { data } = await http.get<StudentQuizAttemptDto[]>(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/attempts`,
    );
    return data ?? [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get the quiz attempt details for one student (questions + answers + score).
 */
export async function getQuizAttemptDetail(
  classId: string,
  quizId: string,
  attemptId: string,
): Promise<QuizAttemptDetailDto> {
  try {
    const { data } = await http.get<QuizAttemptDetailDto>(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/attempts/${attemptId}`,
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Update score / answers for a quiz attempt (lecturer editing).
 */
export async function updateQuizAttempt(
  classId: string,
  quizId: string,
  attemptId: string,
  body: UpdateQuizAttemptRequestDto,
): Promise<QuizAttemptDetailDto> {
  try {
    const { data } = await http.put<QuizAttemptDetailDto>(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/attempts/${attemptId}`,
      body,
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Allow one student to retake a quiz (reset attempt).
 */
export async function allowRetakeForAttempt(
  classId: string,
  quizId: string,
  attemptId: string,
): Promise<void> {
  try {
    await http.post(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/attempts/${attemptId}/retake`,
      {},
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Allow ALL students in the class who have submitted the quiz to retake it.
 */
export async function allowRetakeAll(classId: string, quizId: string): Promise<void> {
  try {
    await http.post(
      `/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/retake-all`,
      {},
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Export quiz results to Excel file.
 * Downloads the file directly to the user's browser.
 */
export async function exportQuizResultsExcel(classId: string, quizId: string): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/lecturer/classes/${classId}/assignments/quizzes/${quizId}/export`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(errorData.message || 'Export failed');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = `QuizResults_${Date.now()}.xlsx`;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        fileName = match[1].replace(/['"]/g, '');
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Export all quiz results for the lecturer into a single Excel file.
 * Downloads the file directly to the user's browser.
 */
export async function exportAllQuizResultsExcel(): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/lecturer/quizzes/export-all`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(errorData.message || 'Export failed');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = `AllQuizResults_${Date.now()}.xlsx`;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        fileName = match[1].replace(/['"]/g, '');
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ========== CRUD API cho Assignment ==========

/** Chuẩn hóa hàng chi tiết assignment từ BE (camelCase hoặc PascalCase). */
function normalizeAssignmentDetail(row: unknown): AssignmentDetail | null {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const id = String(r.id ?? r.Id ?? '').trim();
  if (!id || !GUID_RE.test(id)) return null;
  return {
    id,
    classId: String(r.classId ?? r.ClassId ?? '') || '',
    className: String(r.className ?? r.ClassName ?? '') || '',
    classCode: (r.classCode ?? r.ClassCode ?? null) as string | null,
    type: String(r.type ?? r.Type ?? '') || '',
    title: String(r.title ?? r.Title ?? '') || '',
    description: (r.description ?? r.Description ?? null) as string | null,
    instructions: (r.instructions ?? r.Instructions ?? null) as string | null,
    dueDate: (r.dueDate ?? r.DueDate ?? null) as string | null,
    openDate: (r.openDate ?? r.OpenDate ?? r.openTime ?? r.OpenTime ?? null) as string | null,
    isMandatory: Boolean(r.isMandatory ?? r.IsMandatory ?? false),
    assignedAt: (r.assignedAt ?? r.AssignedAt ?? null) as string | null,
    totalStudents: Number(r.totalStudents ?? r.TotalStudents ?? 0) || 0,
    submittedCount: Number(r.submittedCount ?? r.SubmittedCount ?? 0) || 0,
    gradedCount: Number(r.gradedCount ?? r.GradedCount ?? 0) || 0,
    maxScore: r.maxScore != null ? Number(r.maxScore) : null,
    passingScore: r.passingScore != null ? Number(r.passingScore) : null,
    allowLate: Boolean(r.allowLate ?? r.AllowLate ?? false),
    avgScore: r.avgScore != null ? Number(r.avgScore) : null,
    createdAt: String(r.createdAt ?? r.CreatedAt ?? new Date().toISOString()),
  };
}

/** Normalize submission row from BE (camelCase or PascalCase). */
function normalizeSubmission(row: unknown): AssignmentSubmission | null {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const studentId = String(r.studentId ?? r.StudentId ?? '').trim();
  if (!studentId) return null;
  return {
    studentId,
    studentName: String(r.studentName ?? r.StudentName ?? 'Unknown') || 'Unknown',
    studentCode: (r.studentCode ?? r.StudentCode ?? null) as string | null,
    submittedAt: (r.submittedAt ?? r.SubmittedAt ?? r.submittedAt ?? null) as string | null,
    score: r.score != null ? Number(r.score) : null,
    status: String(r.status ?? r.Status ?? 'not-submitted') as AssignmentSubmission['status'],
  };
}

/**
 * Get details of a specific assignment.
 */
export async function getAssignmentById(assignmentId: string): Promise<AssignmentDetail> {
  const id = assertValidGuid('Assignment', assignmentId);
  try {
    const { data } = await http.get<unknown>(`/api/lecturer/assignments/${encodeURIComponent(id)}`);
    const normalized = normalizeAssignmentDetail(data);
    if (!normalized) throw new Error('Invalid assignment data received.');
    return normalized;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Update assignment information.
 */
export async function updateAssignment(
  assignmentId: string,
  body: UpdateAssignmentRequest,
): Promise<AssignmentDetail> {
  const id = assertValidGuid('Assignment', assignmentId);
  try {
    const { data } = await http.put<unknown>(
      `/api/lecturer/assignments/${encodeURIComponent(id)}`,
      body,
    );
    const normalized = normalizeAssignmentDetail(data);
    if (!normalized) throw new Error('Invalid assignment data received.');
    return normalized;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Delete an assignment.
 */
export async function deleteAssignment(assignmentId: string): Promise<void> {
  const id = assertValidGuid('Assignment', assignmentId);
  try {
    await http.delete(`/api/lecturer/assignments/${encodeURIComponent(id)}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get list of submissions for an assignment.
 */
export async function getAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const id = assertValidGuid('Assignment', assignmentId);
  try {
    const { data } = await http.get<unknown[]>(
      `/api/lecturer/assignments/${encodeURIComponent(id)}/submissions`,
    );
    const list = Array.isArray(data) ? data : [];
    return list.map(normalizeSubmission).filter((s): s is AssignmentSubmission => s !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Get quiz details including question list — used when selecting quiz to create assignment.
 */
export async function getQuizDetailsForAssignment(quizId: string): Promise<QuizWithQuestionsDto> {
  const id = assertValidGuid('Quiz', quizId);
  try {
    const { data } = await http.get<QuizWithQuestionsDto>(
      `/api/lecturer/quizzes/${encodeURIComponent(id)}/details`,
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Update scores for one or multiple submissions.
 */
export async function updateAssignmentSubmissions(
  assignmentId: string,
  body: UpdateAssignmentSubmissionRequest,
): Promise<AssignmentSubmission[]> {
  const id = assertValidGuid('Assignment', assignmentId);
  try {
    const { data } = await http.put<unknown[]>(
      `/api/lecturer/assignments/${encodeURIComponent(id)}/submissions`,
      body,
    );
    const list = Array.isArray(data) ? data : [];
    return list.map(normalizeSubmission).filter((s): s is AssignmentSubmission => s !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
