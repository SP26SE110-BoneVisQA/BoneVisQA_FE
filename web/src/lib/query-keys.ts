/**
 * TanStack Query key factories — keep cache identity stable across the app.
 * @see web/docs/UI_ARCHITECTURE.md
 */

export const queryKeys = {
  student: {
    all: ['student'] as const,
    dashboard: () => [...queryKeys.student.all, 'dashboard'] as const,
    catalog: (filters: {
      location?: string;
      lesionType?: string;
      difficulty?: string;
      boneSpecialtyId?: string;
      pathologyCategoryId?: string;
      severity?: string;
      patientAgeGroup?: string;
      q?: string;
    }) => [...queryKeys.student.all, 'catalog', filters] as const,
    catalogFilters: () => [...queryKeys.student.all, 'catalog-filters'] as const,
    caseDetail: (caseId: string) => [...queryKeys.student.all, 'case', caseId] as const,
    history: () => [...queryKeys.student.all, 'history'] as const,
    profile: () => [...queryKeys.student.all, 'profile'] as const,
    assignedQuizzes: () => [...queryKeys.student.all, 'assigned-quizzes'] as const,
  },
  admin: {
    all: ['admin'] as const,
    dashboardOverview: () => [...queryKeys.admin.all, 'dashboard-overview'] as const,
    recentUsers: (page: number, pageSize: number) =>
      [...queryKeys.admin.all, 'recent-users', page, pageSize] as const,
    users: () => [...queryKeys.admin.all, 'users'] as const,
    documents: (filters?: { search?: string; categoryId?: string; indexingStatus?: string }) =>
      [...queryKeys.admin.all, 'documents', filters ?? {}] as const,
    documentMeta: () => [...queryKeys.admin.all, 'document-meta'] as const,
    documentDetail: (id: string) => [...queryKeys.admin.all, 'document', id] as const,
    cases: (pageIndex: number, pageSize: number) =>
      [...queryKeys.admin.all, 'cases', pageIndex, pageSize] as const,
    caseDetail: (id: string) => [...queryKeys.admin.all, 'case', id] as const,
    verifications: () => [...queryKeys.admin.all, 'verifications', 'pending'] as const,
    profile: () => [...queryKeys.admin.all, 'profile'] as const,
    classes: () => [...queryKeys.admin.all, 'classes'] as const,
  },
  expert: {
    all: ['expert'] as const,
    dashboard: () => [...queryKeys.expert.all, 'dashboard'] as const,
    cases: () => [...queryKeys.expert.all, 'cases', 'library'] as const,
    caseDetail: (id: string) => [...queryKeys.expert.all, 'case', id] as const,
    caseMeta: () => [...queryKeys.expert.all, 'case-meta'] as const,
    reviews: (status?: string) => [...queryKeys.expert.all, 'reviews', 'queue', status ?? 'Pending'] as const,
    reviewDetail: (sessionId: string) => [...queryKeys.expert.all, 'reviews', sessionId] as const,
    quizzes: () => [...queryKeys.expert.all, 'quizzes'] as const,
    profile: () => [...queryKeys.expert.all, 'profile'] as const,
  },
  lecturer: {
    all: ['lecturer'] as const,
    dashboard: () => [...queryKeys.lecturer.all, 'dashboard'] as const,
    triage: (params?: Record<string, unknown>) =>
      [...queryKeys.lecturer.all, 'triage', params ?? {}] as const,
    triageQueue: (classId: string, status?: string) =>
      [...queryKeys.lecturer.all, 'triage-queue', classId, status ?? 'Pending'] as const,
    classes: () => [...queryKeys.lecturer.all, 'classes'] as const,
    classDetail: (classId: string) => [...queryKeys.lecturer.all, 'class', classId] as const,
    classStudents: (classId: string) => [...queryKeys.lecturer.all, 'class-students', classId] as const,
    classAssignedCases: (classId: string) =>
      [...queryKeys.lecturer.all, 'class-assigned-cases', classId] as const,
    classAssignedQuizzes: (classId: string) =>
      [...queryKeys.lecturer.all, 'class-assigned-quizzes', classId] as const,
    classAnnouncements: (classId: string) =>
      [...queryKeys.lecturer.all, 'class-announcements', classId] as const,
    announcements: () => [...queryKeys.lecturer.all, 'announcements'] as const,
    assignments: () => [...queryKeys.lecturer.all, 'assignments'] as const,
    assignmentDetail: (id: string) => [...queryKeys.lecturer.all, 'assignment', id] as const,
    quizzes: () => [...queryKeys.lecturer.all, 'quizzes'] as const,
    myQuizzes: () => [...queryKeys.lecturer.all, 'quizzes', 'mine'] as const,
    assignedQuizzes: () => [...queryKeys.lecturer.all, 'quizzes', 'assigned'] as const,
    quizDetail: (id: string) => [...queryKeys.lecturer.all, 'quiz', id] as const,
    quizQuestions: (id: string) => [...queryKeys.lecturer.all, 'quiz-questions', id] as const,
    quizResults: (id: string) => [...queryKeys.lecturer.all, 'quiz-results', id] as const,
    quizAttempt: (quizId: string, attemptId: string) =>
      [...queryKeys.lecturer.all, 'quiz-attempt', quizId, attemptId] as const,
    caseLibrary: () => [...queryKeys.lecturer.all, 'case-library'] as const,
    quizLibrary: () => [...queryKeys.lecturer.all, 'quiz-library'] as const,
    profile: () => [...queryKeys.lecturer.all, 'profile'] as const,
    analytics: () => [...queryKeys.lecturer.all, 'analytics'] as const,
  },
} as const;
