import { http, getApiErrorMessage } from './client';

const ADMIN_CLASSES = '/api/admin/classes';
const ADMIN_CLASS_ENROLLMENTS = `${ADMIN_CLASSES}/enrollments`;
const CLASS_DASHBOARD = '/api/admin/class-dashboard';

export type ClassEnrollmentRelation = 'Lecturer' | 'Student' | 'Expert';

export interface AdminClassModel {
  id: string;
  className: string;
  semester: string;
  lecturerId?: string | null;
  expertId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  studentCount?: number;
  lecturerName?: string | null;
  expertName?: string | null;
  lecturerEmail?: string | null;
  expertEmail?: string | null;

  // Classification - Bone Specialty
  classSpecialtyId?: string | null;
  classSpecialtyName?: string | null;
  classSpecialtyCode?: string | null;
  focusLevel?: string | null;
  targetStudentLevel?: string | null;
}

export interface ClassEnrollment {
  id: string;
  /** Khớp với lớp (BE `GetAssignClassDTO.classId`). */
  classId: string;
  className: string;
  semester?: string | null;
  studentId: string | null;
  studentName: string | null;
  lecturerId: string | null;
  lecturerName: string | null;
  expertId: string | null;
  expertName: string | null;
  enrolledAt: string | null;
  /** BE có thể gửi (Student / Lecturer / …) — dùng để nhận diện dòng. */
  role?: string | null;
}

export interface AssignClassDto {
  classId: string;
  studentId: string | null;
  lecturerId: string | null;
  expertId: string | null;
  removeExpert: boolean;
}

// ── normalizers ─────────────────────────────────────────────────────────────

/** Lấy chuỗi khác rỗng từ object, thử nhiều key (camelCase / PascalCase / alias BE). */
function pickNonEmptyString(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (!(k in r)) continue;
    const v = r[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}

function unwrapArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.data)) return o.data;
  if (o.result && typeof o.result === 'object') {
    const r = o.result as Record<string, unknown>;
    if (Array.isArray(r.items)) return r.items;
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(o.result)) return o.result as unknown[];
  }
  return [];
}

/** So khớp GUID từ BE (khác hoa thường / optional braces). */
export function sameClassId(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a ?? '')
    .trim()
    .replace(/[{}]/g, '')
    .toLowerCase();
  const y = String(b ?? '')
    .trim()
    .replace(/[{}]/g, '')
    .toLowerCase();
  if (!x || !y) return false;
  return x.replace(/-/g, '') === y.replace(/-/g, '');
}

export function normalizeAdminClassRow(item: unknown): AdminClassModel | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const id = String(r.id ?? r.Id ?? '').trim();
  if (!id) return null;

  const sc = r.studentCount ?? r.StudentCount;
  const studentCount =
    typeof sc === 'number' && Number.isFinite(sc)
      ? sc
      : typeof sc === 'string' && sc.trim() !== ''
        ? Number(sc)
        : 0;

  return {
    id,
    className: String(r.className ?? r.ClassName ?? r.name ?? '').trim(),
    semester: String(r.semester ?? r.Semester ?? '').trim(),
    createdAt: r.createdAt != null ? String(r.createdAt) : r.CreatedAt != null ? String(r.CreatedAt) : undefined,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : r.UpdatedAt != null ? String(r.UpdatedAt) : undefined,
    lecturerId: r.lecturerId != null && String(r.lecturerId).trim() ? String(r.lecturerId) : r.LecturerId != null && String(r.LecturerId).trim() ? String(r.LecturerId) : null,
    expertId: r.expertId != null && String(r.expertId).trim() ? String(r.expertId) : r.ExpertId != null && String(r.ExpertId).trim() ? String(r.ExpertId) : null,
    lecturerName: r.lecturerName != null ? String(r.lecturerName) : r.LecturerName != null ? String(r.LecturerName) : null,
    expertName: r.expertName != null ? String(r.expertName) : r.ExpertName != null ? String(r.ExpertName) : null,
    lecturerEmail: r.lecturerEmail != null ? String(r.lecturerEmail) : r.LecturerEmail != null ? String(r.LecturerEmail) : null,
    expertEmail: r.expertEmail != null ? String(r.expertEmail) : r.ExpertEmail != null ? String(r.ExpertEmail) : null,
    studentCount: Number.isFinite(studentCount) ? studentCount : 0,

    // Classification - Bone Specialty
    classSpecialtyId: r.classSpecialtyId != null && String(r.classSpecialtyId).trim() ? String(r.classSpecialtyId) : r.ClassSpecialtyId != null && String(r.ClassSpecialtyId).trim() ? String(r.ClassSpecialtyId) : null,
    classSpecialtyName: r.classSpecialtyName != null ? String(r.classSpecialtyName) : r.ClassSpecialtyName != null ? String(r.ClassSpecialtyName) : null,
    classSpecialtyCode: r.classSpecialtyCode != null ? String(r.classSpecialtyCode) : r.ClassSpecialtyCode != null ? String(r.ClassSpecialtyCode) : null,
    focusLevel: r.focusLevel != null ? String(r.focusLevel) : r.FocusLevel != null ? String(r.FocusLevel) : null,
    targetStudentLevel: r.targetStudentLevel != null ? String(r.targetStudentLevel) : r.TargetStudentLevel != null ? String(r.TargetStudentLevel) : null,
  };
}

// ── READ CLASSES ────────────────────────────────────────────────────────────

export async function fetchAdminClasses(): Promise<AdminClassModel[]> {
  try {
    const { data } = await http.get<unknown>(ADMIN_CLASSES);
    const list = unwrapArray(data);
    return list
      .map((item) => normalizeAdminClassRow(item))
      .filter((c): c is AdminClassModel => c !== null);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchAdminClassById(id: string): Promise<AdminClassModel> {
  try {
    const { data } = await http.get<unknown>(`${ADMIN_CLASSES}/${encodeURIComponent(id)}`);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from class detail API.');
    }
    const body = data as Record<string, unknown>;
    const raw = body.result ?? body.data ?? body;
    const row = normalizeAdminClassRow(raw);
    if (!row) throw new Error('Invalid class payload.');
    return row;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createAdminClass(payload: { 
  className: string; 
  semester: string;
  classSpecialtyId?: string | null;
  focusLevel?: string | null;
  targetStudentLevel?: string | null;
}): Promise<AdminClassModel> {
  try {
    const { data } = await http.post<{ result?: unknown } | unknown>(ADMIN_CLASSES, {
      className: payload.className,
      semester: payload.semester,
      classSpecialtyId: payload.classSpecialtyId || null,
      focusLevel: payload.focusLevel || 'Basic',
      targetStudentLevel: payload.targetStudentLevel || 'Beginner',
    });
    const resultObj = typeof data === 'object' && data !== null && 'result' in data ? data.result : data;
    const normalized = normalizeAdminClassRow(resultObj);
    if (normalized) return normalized;
    return {
      id: '',
      className: payload.className,
      semester: payload.semester,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateAdminClass(id: string, payload: { 
  className: string; 
  semester: string;
  classSpecialtyId?: string | null;
  focusLevel?: string | null;
  targetStudentLevel?: string | null;
}): Promise<void> {
  try {
    await http.put(ADMIN_CLASSES, {
      id,
      className: payload.className,
      semester: payload.semester,
      classSpecialtyId: payload.classSpecialtyId || null,
      focusLevel: payload.focusLevel || null,
      targetStudentLevel: payload.targetStudentLevel || null,
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteAdminClass(id: string): Promise<void> {
  try {
    await http.delete(`${ADMIN_CLASSES}/${encodeURIComponent(id)}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ── ENROLLMENTS ─────────────────────────────────────────────────────────────

export type FetchClassEnrollmentsParams = {
  /** Khi có — BE lọc theo lớp (`GET ...?classId=...&pageIndex=&pageSize=`). */
  classId?: string;
  pageIndex?: number;
  pageSize?: number;
};

/**
 * Không `classId`: giữ hành vi cũ (toàn bộ enrollment, không query phân trang).
 * Có `classId`: bắt buộc gửi `pageIndex` + `pageSize` theo contract BE.
 */
export async function fetchClassEnrollments(params?: FetchClassEnrollmentsParams): Promise<ClassEnrollment[]> {
  try {
    const trimmed = params?.classId?.trim();
    const config =
      trimmed != null && trimmed !== ''
        ? {
            params: {
              pageIndex: params?.pageIndex ?? 1,
              pageSize: params?.pageSize ?? 100,
              classId: trimmed,
            },
          }
        : undefined;
    const { data } = await http.get<unknown>(ADMIN_CLASS_ENROLLMENTS, config);
    const list = unwrapArray(data);
    return list.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const r = item as Record<string, unknown>;
      const id = String(r.id ?? r.Id ?? '').trim();
      if (!id) return [];

      let studentId = pickNonEmptyString(
        r,
        'studentId',
        'StudentId',
        'userId',
        'UserId',
        'studentUserId',
        'StudentUserId',
        'memberId',
        'MemberId',
        'appUserId',
        'AppUserId',
      );
      const studentName = pickNonEmptyString(
        r,
        'studentName',
        'StudentName',
        'userName',
        'UserName',
        'fullName',
        'FullName',
        'displayName',
        'DisplayName',
      );
      const roleRaw = pickNonEmptyString(r, 'role', 'Role', 'enrollmentType', 'EnrollmentType', 'memberRole', 'MemberRole');
      const roleLower = roleRaw?.toLowerCase() ?? '';
      if (!studentId && studentName && /student|learner/i.test(roleLower)) {
        studentId = pickNonEmptyString(r, 'userId', 'UserId', 'memberId', 'MemberId');
      }

      const row: ClassEnrollment = {
        id,
        classId: String(r.classId ?? r.ClassId ?? '').trim(),
        className: String(r.className ?? r.ClassName ?? '').trim(),
        semester:
          r.semester != null
            ? String(r.semester)
            : r.Semester != null
              ? String(r.Semester)
              : null,
        studentId,
        studentName,
        lecturerId: pickNonEmptyString(r, 'lecturerId', 'LecturerId'),
        lecturerName: pickNonEmptyString(r, 'lecturerName', 'LecturerName'),
        expertId: pickNonEmptyString(r, 'expertId', 'ExpertId'),
        expertName: pickNonEmptyString(r, 'expertName', 'ExpertName'),
        enrolledAt: pickNonEmptyString(r, 'enrolledAt', 'EnrolledAt'),
        role: roleRaw,
      };
      return [row];
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function assignClassUser(payload: AssignClassDto): Promise<void> {
  try {
    await http.post(ADMIN_CLASS_ENROLLMENTS, {
      classId: payload.classId,
      studentId: payload.studentId,
      lecturerId: payload.lecturerId,
      expertId: payload.expertId,
      removeExpert: payload.removeExpert ?? false,
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function unenrollClassUser(enrollmentId: string): Promise<void> {
  try {
    await http.delete(`${ADMIN_CLASS_ENROLLMENTS}/${encodeURIComponent(enrollmentId)}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function removeExpertFromClass(classId: string): Promise<void> {
  try {
    await http.post(`${CLASS_DASHBOARD}/${encodeURIComponent(classId)}/remove-expert`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function removeLecturerFromClass(classId: string): Promise<void> {
  try {
    await http.post(`${CLASS_DASHBOARD}/${encodeURIComponent(classId)}/remove-lecturer`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ── CLASS SPECIALTY UPDATE ─────────────────────────────────────────────────────

export interface UpdateClassSpecialtyPayload {
  classId: string;
  classSpecialtyId?: string | null;
  focusLevel?: string | null;
  targetStudentLevel?: string | null;
  targetPathologyCategories?: string[] | null;
}

export async function updateClassSpecialty(payload: UpdateClassSpecialtyPayload): Promise<void> {
  try {
    await http.put(`${CLASS_DASHBOARD}/${encodeURIComponent(payload.classId)}/specialty`, {
      classId: payload.classId,
      classSpecialtyId: payload.classSpecialtyId || null,
      focusLevel: payload.focusLevel || null,
      targetStudentLevel: payload.targetStudentLevel || null,
      targetPathologyCategories: payload.targetPathologyCategories || null,
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
