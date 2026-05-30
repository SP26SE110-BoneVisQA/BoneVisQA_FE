'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  FileText,
  Settings2,
  Eye,
  Save,
  Send,
  Clock,
  CalendarDays,
  BookOpen,
  Users,
  Star,
  Shuffle,
  BarChart2,
  AlertCircle,
  ClipboardList,
  Zap,
  Microscope,
  Stethoscope,
  Loader2,
  RotateCcw,
  Bell,
  BellOff,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useLecturerCasesList } from '@/features/lecturer/queries/use-lecturer-cases';
import {
  useLecturerPortalClasses,
  useLecturerQuizCatalog,
} from '@/features/lecturer/queries/use-lecturer-quizzes';
import { appToast } from '@/lib/api/errors/app-toast';
import {
  assignCasesToClass,
  assignQuizToClass,
  getQuizDetailsForAssignment,
  isValidGuidString,
} from '@/lib/api/lecturer';
import type { ClassItem, QuizWithQuestionsDto, QuizQuestionDto } from '@/lib/api/types';

// ========== HELPERS ==========

function localDatetimeLocalToIso(local: string): string {
  const t = local.trim();
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

type CasePickItem = { id: string; title: string };
type QuizPickItem = {
  quizId: string;
  label: string;
  timeLimit?: number;
  passingScore?: number;
};

function normalizeCaseRow(row: unknown): CasePickItem | null {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const id = String(r.id ?? r.Id ?? '').trim();
  if (!id) return null;
  const title = String(r.title ?? r.Title ?? 'Untitled case').trim() || 'Untitled case';
  return { id, title };
}

const assignmentTypes = [
  {
    value: 'Case Analysis',
    description: 'Students analyze medical cases and submit reports',
    icon: Microscope,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500',
  },
  {
    value: 'Quiz',
    description: 'Multiple choice questions, auto-graded',
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500',
  },
];

  // /** Wizard for assigning existing quiz/case to a class — no question authoring here. */
const steps = [
  { label: 'Basic Info', icon: FileText, description: 'Title, type & classes' },
  { label: 'Configuration', icon: Settings2, description: 'Due date & settings' },
  { label: 'Review', icon: Eye, description: 'Review & publish' },
];

function CreateAssignmentPageContent({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string | string[] }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const resolvedSearchParams = use(searchParams);
  const classIdParam = resolvedSearchParams.classId;
  const preselectedClassId = Array.isArray(classIdParam)
    ? classIdParam[0]
    : classIdParam;

  const [currentStep, setCurrentStep] = useState(0);
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [assignmentCases, setAssignmentCases] = useState<CasePickItem[]>([]);
  const [assignmentQuizzes, setAssignmentQuizzes] = useState<QuizPickItem[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [caseSearch, setCaseSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    selectedClasses: preselectedClassId ? [preselectedClassId] : ([] as string[]),
    description: '',
    selectedCaseIds: [] as string[],
    quizId: '',
    dueDate: '',
    maxScore: 100,
    allowLate: false,
    isMandatory: true,
    instructions: '',
    timeLimitMinutes: 60,
    passingScore: 70,
    shuffleQuestions: false,
    showResults: true,
    allowRetake: false,
  });

  const isQuiz = formData.type === 'Quiz';

  const classesQuery = useLecturerPortalClasses();
  const casesQuery = useLecturerCasesList();
  const quizzesQuery = useLecturerQuizCatalog();

  useEffect(() => {
    if (classesQuery.data) {
      setAvailableClasses(classesQuery.data);
      setFormData((prev) => ({
        ...prev,
        selectedClasses: prev.selectedClasses.filter((id) =>
          classesQuery.data!.some((item) => item.id === id),
        ),
      }));
    }
    if (classesQuery.isError) {
      appToast.error('Failed to load lecturer classes.');
    }
    setLoadingClasses(classesQuery.isPending);
  }, [classesQuery.data, classesQuery.isError, classesQuery.isPending]);

  useEffect(() => {
    if (!casesQuery.data && !quizzesQuery.data) return;
    const casesList = (casesQuery.data ?? [])
      .map((row) => normalizeCaseRow(row))
      .filter((c): c is CasePickItem => Boolean(c))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

    const quizMap = new Map<string, { id: string; label: string; timeLimit?: number; passingScore?: number }>();
    for (const row of quizzesQuery.data ?? []) {
      const qid = String(row.quizId ?? '').trim();
      if (!qid || quizMap.has(qid)) continue;
      const name = [row.quizName, row.topic].filter(Boolean).join(' · ');
      quizMap.set(qid, {
        id: qid,
        label: name || `${qid.slice(0, 8)}…`,
        timeLimit: row.timeLimit != null ? Number(row.timeLimit) : undefined,
        passingScore: row.passingScore != null ? Number(row.passingScore) : undefined,
      });
    }
    const quizList = Array.from(quizMap.entries())
      .map(([quizId, data]) => ({
        quizId,
        label: data.label,
        timeLimit: data.timeLimit,
        passingScore: data.passingScore,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

    setAssignmentCases(casesList);
    setAssignmentQuizzes(quizList);
    setLoadingSources(casesQuery.isPending || quizzesQuery.isPending);
    if (casesQuery.isError || quizzesQuery.isError) {
      appToast.error('Failed to load case/quiz list. Try refreshing or re-logging in.');
    }
  }, [casesQuery.data, casesQuery.isError, casesQuery.isPending, quizzesQuery.data, quizzesQuery.isError, quizzesQuery.isPending]);

  const lastStep = steps.length - 1;
  const currentStepLabel = steps[currentStep]?.label;

  // /** Prevents stale step after Questions step was removed (HMR / stale bundle). */
  useEffect(() => {
    setCurrentStep((s) => Math.min(Math.max(0, s), lastStep));
  }, [lastStep]);

  const toggleClass = (classId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedClasses: prev.selectedClasses.includes(classId)
        ? prev.selectedClasses.filter((id) => id !== classId)
        : [...prev.selectedClasses, classId],
    }));
  };

  const canProceed = () => {
    if (currentStep === 0) {
      const hasSource = isQuiz
        ? isValidGuidString(formData.quizId.trim())
        : formData.selectedCaseIds.length > 0;
      return Boolean(
        formData.title && formData.type && formData.selectedClasses.length > 0 && hasSource,
      );
    }
    if (currentStep === 1) return !!formData.dueDate;
    return true;
  };
  const selectedClassData = useMemo(
    () =>
      formData.selectedClasses
        .map((id) => availableClasses.find((c) => c.id === id))
        .filter((item): item is ClassItem => Boolean(item)),
    [availableClasses, formData.selectedClasses],
  );

  const selectedType = assignmentTypes.find((t) => t.value === formData.type);
  const validCaseGuids = useMemo(() => formData.selectedCaseIds, [formData.selectedCaseIds]);

  const filteredCasesForPicker = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return assignmentCases;
    return assignmentCases.filter(
      (c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [assignmentCases, caseSearch]);

  const selectedQuizLabel = useMemo(() => {
    const id = formData.quizId.trim();
    if (!id) return '';
    return assignmentQuizzes.find((q) => q.quizId === id)?.label ?? id;
  }, [assignmentQuizzes, formData.quizId]);

  const toggleCaseSelected = (caseId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCaseIds: prev.selectedCaseIds.includes(caseId)
        ? prev.selectedCaseIds.filter((x) => x !== caseId)
        : [...prev.selectedCaseIds, caseId],
    }));
  };

  const validateSubmission = () => {
    if (formData.selectedClasses.length === 0) {
      throw new Error('Select at least one class before publishing.');
    }

    if (isQuiz) {
      const q = formData.quizId.trim();
      if (!q) {
        throw new Error('Enter the backend quiz ID before publishing.');
      }
      if (!isValidGuidString(q)) {
        throw new Error(
          'Quiz ID must be a UUID (Guid) from the system, e.g.: a1b2c3d4-e5f6-7890-abcd-ef1234567890. Open the Quizzes page to copy the real ID.'
        );
      }
    } else {
      if (validCaseGuids.length === 0) {
        throw new Error('Select at least one case from the list before publishing.');
      }
    }
  };

  const handlePublish = async () => {
    try {
      validateSubmission();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Assignment validation failed.');
      return;
    }

    setIsSubmitting(true);
    try {
      await Promise.all(
        formData.selectedClasses.map((classId) =>
          isQuiz
            ? assignQuizToClass(classId, {
                quizId: formData.quizId.trim(),
                closeTime: formData.dueDate ? localDatetimeLocalToIso(formData.dueDate) : undefined,
                timeLimitMinutes: formData.timeLimitMinutes || undefined,
                passingScore: formData.passingScore || undefined,
                shuffleQuestions: formData.shuffleQuestions,
                allowRetake: formData.allowRetake,
              })
            : assignCasesToClass(classId, {
                caseIds: validCaseGuids,
                dueDate: formData.dueDate ? localDatetimeLocalToIso(formData.dueDate) : undefined,
                isMandatory: formData.isMandatory,
              }),
        ),
      );

      toast.success(
        isQuiz
          ? 'Quiz assignment published successfully.'
          : 'Case assignment published successfully.',
      );

      const destinationClassId = formData.selectedClasses[0];
      router.push(destinationClassId ? `/lecturer/classes/${destinationClassId}` : '/lecturer/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link href="/lecturer/assignments" className="hover:text-primary transition-colors">
                Assignments
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">Create New</span>
            </div>
            <h1 className="text-lg font-semibold text-card-foreground">Create Assignment</h1>
          </div>

          {/* Step progress in header */}
          <div className="hidden md:flex items-center gap-1">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              return (
                <div key={step.label} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isCompleted
                        ? 'bg-success/15 text-success'
                        : isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5" />
                    )}
                    {step.label}
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight className={`w-3 h-3 ${isCompleted ? 'text-success' : 'text-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto p-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Step 1: Basic Info */}
            {currentStepLabel === 'Basic Info' && (
              <div className="space-y-5">
                {/* Title */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    Assignment Title
                  </h2>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Case Analysis: Complex Tibial Fractures"
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                  {formData.title && (
                    <p className="text-xs text-muted-foreground mt-2">{formData.title.length} characters</p>
                  )}
                </div>

                {/* Assignment Type */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    Assignment Type
                    <span className="text-destructive">*</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {assignmentTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.type === type.value;
                      return (
                        <button
                          key={type.value}
                          onClick={() => setFormData({ ...formData, type: type.value })}
                          className={`relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            isSelected
                              ? `${type.border} ${type.bg}`
                              : 'border-border bg-background hover:bg-muted/50'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className={`w-9 h-9 rounded-lg ${type.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${type.color}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isSelected ? type.color : 'text-card-foreground'}`}>
                              {type.value}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{type.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Classes */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-semibold text-card-foreground mb-1 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    Assign to Classes
                    <span className="text-destructive">*</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4 ml-8">
                    Select one or more classes for this assignment
                  </p>

                  {formData.selectedClasses.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      {formData.selectedClasses.map((classId) => {
                        const cls = availableClasses.find((c) => c.id === classId);
                        if (!cls) return null;
                        return (
                          <span
                            key={classId}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-white rounded-full text-xs font-medium"
                          >
                            {cls.className}
                            <button
                              onClick={() => toggleClass(classId)}
                            className="hover:bg-primary-foreground/20 rounded-full p-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-2">
                    {loadingClasses ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Loading your classes...
                      </div>
                    ) : availableClasses.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                        No lecturer classes are available yet. Create a class first, then return to assign this activity.
                      </div>
                    ) : (
                      availableClasses.map((cls) => {
                      const isSelected = formData.selectedClasses.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          onClick={() => toggleClass(cls.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary/5 border-primary/40'
                              : 'bg-background border-border hover:bg-muted/40'
                          }`}
                          disabled={loadingClasses}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary/15' : 'bg-muted'}`}>
                              <BookOpen className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{cls.className}</p>
                              <p className="text-xs text-muted-foreground">
                                Semester {cls.semester || 'Not specified'}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'bg-primary border-primary' : 'border-border'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      );
                    }))}
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-semibold text-card-foreground mb-1 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">4</span>
                    </div>
                    Assignment Source
                    <span className="text-destructive">*</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3 ml-8">
                    {isQuiz ? (
                      <>
                        This is a <strong className="text-foreground">Quiz</strong> assignment — select a quiz from the
                        list below.
                      </>
                    ) : (
                      <>
                        Current type is <strong className="text-foreground">{formData.type || '…'}</strong> — assigning{' '}
                        <strong className="text-foreground">case(s)</strong> to the class. Quiz list only appears when
                        you select <strong className="text-foreground">Quiz</strong> in{' '}
                        <span className="text-foreground">step 2</span> above.
                      </>
                    )}
                  </p>
                  {!isQuiz && formData.type ? (
                    <div className="mb-3 ml-8 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-card-foreground">
                      <span className="text-muted-foreground">Want to assign a quiz? </span>
                      Scroll up to <strong>step 2 — Assignment Type</strong> and select{' '}
                      <strong>Quiz</strong>, then come back here to pick a quiz from the dropdown.
                    </div>
                  ) : null}

                  {loadingSources ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Loading list…
                    </div>
                  ) : isQuiz ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground">Quiz</label>
                      {assignmentQuizzes.length === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-3">
                          No quizzes available yet. Create one at{' '}
                          <Link href="/lecturer/quizzes/create" className="font-medium text-primary underline">
                            Lecturer → Quizzes
                          </Link>{' '}
                          and come back here.
                        </p>
                      ) : (
                        <select
                          value={formData.quizId}
                          onChange={(e) => {
                            setFormData((prev) => {
                              const selectedQuiz = assignmentQuizzes.find(q => q.quizId === e.target.value);
                              return {
                                ...prev,
                                quizId: e.target.value,
                                // Auto-fill timeLimit and passingScore from quiz
                                timeLimitMinutes: selectedQuiz?.timeLimit ?? prev.timeLimitMinutes,
                                passingScore: selectedQuiz?.passingScore ?? prev.passingScore,
                              };
                            });
                          }}
                          className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all cursor-pointer"
                        >
                          <option value="">Select a quiz…</option>
                          {assignmentQuizzes.map((q) => (
                            <option key={q.quizId} value={q.quizId}>
                              {q.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-muted-foreground">Cases</label>
                      <input
                        type="search"
                        value={caseSearch}
                        onChange={(e) => setCaseSearch(e.target.value)}
                        placeholder="Filter by name or ID…"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                      {assignmentCases.length === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-3">
                          No cases in the system or failed to load. Check the Cases API.
                        </p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background divide-y divide-border">
                          {filteredCasesForPicker.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">No matches for the current filter.</p>
                          ) : (
                            filteredCasesForPicker.map((c) => {
                              const checked = formData.selectedCaseIds.includes(c.id);
                              return (
                                <label
                                  key={c.id}
                                  className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40 ${
                                    checked ? 'bg-primary/5' : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCaseSelected(c.id)}
                                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="font-medium text-card-foreground block">{c.title}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono break-all">{c.id}</span>
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {validCaseGuids.length} case{validCaseGuids.length === 1 ? '' : 's'} selected.
                      </p>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-semibold text-card-foreground mb-1 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">5</span>
                    </div>
                    Description
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3 ml-8">Briefly describe the assignment objectives</p>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the assignment objectives and requirements..."
                    rows={3}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Configuration */}
            {currentStepLabel === 'Configuration' && (
              <div className="space-y-5">
                {/* Due Date & Score */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    Schedule & Scoring
                  </h2>
                  <div className={`grid grid-cols-1 ${isQuiz ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Due Date & Time <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      />
                    </div>

                    {!isQuiz ? (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Score</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.maxScore}
                            onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
                            min={0}
                            className="w-full px-4 py-2.5 pr-12 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">pts</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Time Limit</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.timeLimitMinutes}
                            onChange={(e) => setFormData({ ...formData, timeLimitMinutes: Number(e.target.value) })}
                            min={1}
                            className="w-full px-4 py-2.5 pr-14 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">min</span>
                        </div>
                        {formData.quizId && assignmentQuizzes.find(q => q.quizId === formData.quizId)?.timeLimit && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Suggested: {assignmentQuizzes.find(q => q.quizId === formData.quizId)?.timeLimit} min from quiz
                          </p>
                        )}
                      </div>
                    )}
                    {isQuiz && (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Passing Score</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.passingScore}
                            onChange={(e) => setFormData({ ...formData, passingScore: Number(e.target.value) })}
                            min={0}
                            max={100}
                            className="w-full px-4 py-2.5 pr-12 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">%</span>
                        </div>
                        {formData.quizId && assignmentQuizzes.find(q => q.quizId === formData.quizId)?.passingScore && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Suggested: {assignmentQuizzes.find(q => q.quizId === formData.quizId)?.passingScore}% from quiz
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Toggles */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    Submission Settings
                  </h2>
                  <div className="space-y-3">
                    <ToggleRow
                      title="Allow Late Submission"
                      value={formData.allowLate}
                      onChange={() => setFormData({ ...formData, allowLate: !formData.allowLate })}
                      icon={<AlertCircle className="w-4 h-4 text-warning" />}
                    />
                    {!isQuiz && (
                      <ToggleRow
                        title="Mandatory Assignment"
                        value={formData.isMandatory}
                        onChange={() => setFormData({ ...formData, isMandatory: !formData.isMandatory })}
                        icon={<Check className="w-4 h-4 text-success" />}
                      />
                    )}
                    {isQuiz && (
                      <>
                        <ToggleRow
                          title="Shuffle Questions"
                          value={formData.shuffleQuestions}
                          onChange={() => setFormData({ ...formData, shuffleQuestions: !formData.shuffleQuestions })}
                          icon={<Shuffle className="w-4 h-4 text-accent" />}
                        />
                        <ToggleRow
                          title="Show Results After Submission"
                          value={formData.showResults}
                          onChange={() => setFormData({ ...formData, showResults: !formData.showResults })}
                          icon={<BarChart2 className="w-4 h-4 text-success" />}
                        />
                        <ToggleRow
                          title="Allow Retake"
                          value={formData.allowRetake}
                          onChange={() => setFormData({ ...formData, allowRetake: !formData.allowRetake })}
                          icon={<RotateCcw className="w-4 h-4 text-accent" />}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Instructions (non-quiz) */}
                {!isQuiz && (
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h2 className="text-sm font-semibold text-card-foreground mb-1 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Student Instructions
                      <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mb-3 ml-6">
                      Provide detailed instructions and grading criteria
                    </p>
                    <textarea
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      placeholder="Provide detailed instructions, grading criteria, and any additional notes..."
                      rows={6}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none transition-all"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {currentStepLabel === 'Review' && (
              <div className="space-y-4">
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-border bg-muted/20">
                    <h3 className="text-sm font-semibold text-card-foreground">Assignment Summary</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Review everything before publishing</p>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Title & Type */}
                    <div className="grid grid-cols-2 gap-3">
                      <ReviewItem label="Title" value={formData.title || '—'} />
                      <ReviewItem
                        label="Type"
                        value={formData.type || '—'}
                        badge={selectedType ? { color: selectedType.color, bg: selectedType.bg } : undefined}
                      />
                    </div>

                    {/* Classes */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Assigned Classes</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedClassData.length > 0 ? (
                          selectedClassData.map((cls) => (
                            <div key={cls.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                              <Users className="w-3 h-3" />
                              {cls.className}
                              <span className="text-primary/60">· Semester {cls.semester || 'N/A'}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>

                    <div className={`grid grid-cols-1 ${!isQuiz ? 'md:grid-cols-2' : ''} gap-3`}>
                      <ReviewItem
                        label={isQuiz ? 'Quiz' : 'Cases'}
                        value={
                          isQuiz
                            ? selectedQuizLabel || formData.quizId || '—'
                            : validCaseGuids.length > 0
                              ? validCaseGuids
                                  .map(
                                    (id) =>
                                      assignmentCases.find((c) => c.id === id)?.title ?? id,
                                  )
                                  .join('\n')
                              : '—'
                        }
                        multiline={!isQuiz}
                      />
                      {!isQuiz && (
                        <ReviewItem
                          label="Mandatory"
                          value={formData.isMandatory ? 'Required' : 'Optional'}
                          icon={<Check className="w-3.5 h-3.5" />}
                        />
                      )}
                    </div>

                    {formData.description && (
                      <ReviewItem label="Description" value={formData.description} />
                    )}

                    {/* Config grid */}
                    <div className={`grid grid-cols-2 ${isQuiz ? 'md:grid-cols-3' : 'md:grid-cols-3'} gap-3`}>
                      <ReviewItem
                        label="Due Date"
                        value={formData.dueDate ? new Date(formData.dueDate).toLocaleString() : '—'}
                        icon={<CalendarDays className="w-3.5 h-3.5" />}
                      />
                      <ReviewItem
                        label={isQuiz ? 'Score from quiz' : 'Max Score'}
                        value={
                          isQuiz
                            ? 'Score comes from the saved quiz — do not re-enter here'
                            : String(formData.maxScore)
                        }
                        icon={<Star className="w-3.5 h-3.5" />}
                      />
                      <ReviewItem
                        label="Late Submission"
                        value={formData.allowLate ? 'Allowed' : 'Not allowed'}
                        icon={<AlertCircle className="w-3.5 h-3.5" />}
                      />
                      {isQuiz && (
                        <ReviewItem
                          label="Time Limit"
                          value={`${formData.timeLimitMinutes} min`}
                          icon={<Clock className="w-3.5 h-3.5" />}
                        />
                      )}
                      {isQuiz && (
                        <ReviewItem
                          label="Passing Score"
                          value={`${formData.passingScore}%`}
                          icon={<Star className="w-3.5 h-3.5" />}
                        />
                      )}
                      {isQuiz && (
                        <ReviewItem
                          label="Shuffle Questions"
                          value={formData.shuffleQuestions ? 'Yes' : 'No'}
                          icon={<Shuffle className="w-3.5 h-3.5" />}
                        />
                      )}
                      {isQuiz && (
                        <ReviewItem
                          label="Show Results"
                          value={formData.showResults ? 'Yes' : 'No'}
                          icon={<BarChart2 className="w-3.5 h-3.5" />}
                        />
                      )}
                      {isQuiz && (
                        <ReviewItem
                          label="Allow Retake"
                          value={formData.allowRetake ? 'Yes' : 'No'}
                          icon={<RotateCcw className="w-3.5 h-3.5" />}
                        />
                      )}
                    </div>

                    {isQuiz && (
                      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        <p className="font-medium text-card-foreground">Question Content</p>
                        <p className="mt-1 text-xs leading-relaxed">
                          You have selected <strong className="text-foreground">a quiz</strong> — all questions are in
                          that quiz on the server. Edit questions at{' '}
                          <strong className="text-foreground">Lecturer → Quizzes</strong> before assigning to a class.
                          This page only assigns the existing quiz to the class and sets the deadline.
                        </p>
                      </div>
                    )}

                    {!isQuiz && formData.instructions && (
                      <ReviewItem label="Instructions" value={formData.instructions} multiline />
                    )}
                  </div>
                </div>

                {/* Publish note */}
                <div className="flex items-start gap-3 p-4 bg-success/5 border border-success/30 rounded-xl">
                  <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Ready to publish</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Once published, students in the selected classes will be notified and can start submitting.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
              <div>
                {currentStep > 0 ? (
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <Link
                    href="/lecturer/assignments"
                    className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Cancel
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStep === lastStep && (
                  <button
                    onClick={handlePublish}
                    disabled={isSubmitting}
                    className={`flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg transition-colors text-sm ${
                      isSubmitting ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted cursor-pointer'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    Save Assignment
                  </button>
                )}

                {currentStep < lastStep ? (
                  <button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={!canProceed()}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      canProceed()
                        ? 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={isSubmitting}
                    className={`flex items-center gap-2 px-5 py-2.5 bg-success text-white rounded-lg transition-colors text-sm font-medium shadow-sm shadow-success/20 ${
                      isSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-success/90 cursor-pointer'
                    }`}
                  >
                    <span className={isSubmitting ? 'hidden' : ''}><Send className="w-4 h-4" /></span>
                    <span className={isSubmitting ? '' : 'hidden'}><Loader2 className="w-4 h-4 animate-spin" /></span>
                    <span>{isSubmitting ? 'Publishing…' : 'Publish Assignment'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Preview */}
          <div className="hidden xl:block w-72 flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              {/* Assignment preview card */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
                </div>
                <div className="p-4 space-y-3">
                  {formData.type && selectedType && (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${selectedType.bg} rounded-full`}>
                      {(() => {
                        const Icon = selectedType.icon;
                        return <Icon className={`w-3.5 h-3.5 ${selectedType.color}`} />;
                      })()}
                      <span className={`text-xs font-medium ${selectedType.color}`}>{formData.type}</span>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {formData.title || <span className="text-muted-foreground italic">No title yet</span>}
                    </p>
                    {formData.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{formData.description}</p>
                    )}
                  </div>

                  {formData.selectedClasses.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedClassData.slice(0, 3).map((cls) => (
                        <span key={cls.id} className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                          {cls.className}
                        </span>
                      ))}
                      {selectedClassData.length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                          +{selectedClassData.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1 border-t border-border">
                    {formData.dueDate && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Due {new Date(formData.dueDate).toLocaleDateString()}
                      </div>
                    )}
                    {isQuiz ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Star className="w-3.5 h-3.5" />
                          Quiz questions from selected quiz
                        </div>
                        {formData.allowRetake && (
                          <div className="flex items-center gap-2 text-xs text-accent">
                            <RotateCcw className="w-3.5 h-3.5" />
                            Retakes allowed
                          </div>
                        )}
                        {formData.shuffleQuestions && (
                          <div className="flex items-center gap-2 text-xs text-accent">
                            <Shuffle className="w-3.5 h-3.5" />
                            Questions shuffled
                          </div>
                        )}
                      </>
                    ) : (
                      formData.maxScore > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Star className="w-3.5 h-3.5" />
                          {formData.maxScore} points
                        </div>
                      )
                    )}
                    {formData.selectedClasses.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        {selectedClassData.length} class{selectedClassData.length === 1 ? '' : 'es'} selected
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Completion checklist */}
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Checklist</p>
                <div className="space-y-2">
                  <ChecklistItem done={!!formData.title} label="Assignment title" />
                  <ChecklistItem done={!!formData.type} label="Assignment type" />
                  <ChecklistItem done={formData.selectedClasses.length > 0} label="At least one class" />
                  <ChecklistItem
                    done={
                      isQuiz
                        ? isValidGuidString(formData.quizId.trim())
                        : validCaseGuids.length > 0
                    }
                    label={isQuiz ? 'Quiz selected' : 'At least one case selected'}
                  />
                  <ChecklistItem done={!!formData.dueDate} label="Due date set" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  icon,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div>
          <p className="text-sm font-medium text-card-foreground">{title}</p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <button
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ml-4 ${
          value ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform duration-200 ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function ReviewItem({
  label,
  value,
  icon,
  badge,
  multiline,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  badge?: { color: string; bg: string };
  multiline?: boolean;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
        {icon}
        {label}
      </p>
      {badge ? (
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md ${badge.bg} ${badge.color}`}>
          {value}
        </span>
      ) : (
        <p className={`text-sm font-medium text-card-foreground ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
      )}
    </div>
  );
}

export function LecturerAssignmentCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string | string[] }>;
}) {
  return <CreateAssignmentPageContent searchParams={searchParams} />;
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          done ? 'bg-success border-success' : 'border-border'
        }`}
      >
        {done && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <span className={`text-xs ${done ? 'text-card-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}
