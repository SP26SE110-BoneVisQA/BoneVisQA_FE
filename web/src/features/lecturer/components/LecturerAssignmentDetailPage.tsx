'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DetailPageLayout } from '@/components/layouts';
import StatCard from '@/components/StatCard';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import {
  useDeleteLecturerAssignment,
  useLecturerAssignmentDetail,
  useLecturerAssignmentSubmissions,
  useUpdateAssignmentSubmissions,
  useUpdateLecturerAssignment,
} from '@/features/lecturer/queries/use-lecturer-assignments';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import {
  Users,
  CheckCircle,
  Clock,
  Award,
  ChevronRight,
  ArrowLeft,
  Settings,
  Trash2,
  AlertCircle,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import type {
  AssignmentSubmission,
  UpdateAssignmentRequest,
} from '@/lib/api/types';

const statusConfig = {
  active: { color: 'bg-primary/10 text-primary border-primary/20', label: 'Active' },
  overdue: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Overdue' },
  completed: { color: 'bg-success/10 text-success border-success/20', label: 'Completed' },
};

const submissionStatusConfig = {
  graded: { color: 'text-success', bgColor: 'bg-success/10', label: 'Graded' },
  pending: { color: 'text-warning', bgColor: 'bg-warning/10', label: 'Pending' },
  'not-submitted': { color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Not Submitted' },
};

const tabs = ['Submissions', 'Settings'] as const;

function computeAssignmentStatus(
  dueDate: string | null | undefined,
  submitted: number,
  total: number,
): 'active' | 'overdue' | 'completed' {
  if (submitted > 0 && submitted >= total && total > 0) return 'completed';
  if (dueDate && new Date(dueDate) < new Date()) return 'overdue';
  return 'active';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LecturerAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: assignmentId } = use(params);

  const [activeTab, setActiveTab] = useState<string>('Submissions');

  const assignmentQuery = useLecturerAssignmentDetail(assignmentId);
  const submissionsQuery = useLecturerAssignmentSubmissions(assignmentId);
  const updateAssignmentMutation = useUpdateLecturerAssignment();
  const updateSubmissionsMutation = useUpdateAssignmentSubmissions();
  const deleteMutation = useDeleteLecturerAssignment();

  const assignment = assignmentQuery.data ?? null;
  const loadingAssignment = assignmentQuery.isPending;
  const loadError = assignmentQuery.error
    ? getQueryErrorMessage(assignmentQuery.error, 'Failed to load assignment.')
    : null;

  const submissions = submissionsQuery.data ?? [];
  const loadingSubmissions = submissionsQuery.isPending;

  // Edit mode
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [editForm, setEditForm] = useState<UpdateAssignmentRequest>({});
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Grading
  const [gradingMode, setGradingMode] = useState(false);
  const [gradeScores, setGradeScores] = useState<Record<string, number | null>>({});
  const [savingGrades, setSavingGrades] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!submissions.length) return;
    const initialScores: Record<string, number | null> = {};
    submissions.forEach((s) => {
      initialScores[s.studentId] = s.score;
    });
    setGradeScores(initialScores);
  }, [submissions]);

  const status = assignment
    ? computeAssignmentStatus(assignment.dueDate, assignment.submittedCount, assignment.totalStudents)
    : 'active';
  const config = statusConfig[status];

  const submissionRate =
    assignment && assignment.totalStudents > 0
      ? Math.round((assignment.submittedCount / assignment.totalStudents) * 100)
      : 0;
  const gradingProgress =
    assignment && assignment.submittedCount > 0
      ? Math.round((assignment.gradedCount / assignment.submittedCount) * 100)
      : 0;

  const stats = assignment
    ? [
        {
          title: 'Total Students',
          value: String(assignment.totalStudents),
          change: `${assignment.totalStudents - assignment.submittedCount} not submitted`,
          changeType: 'neutral' as const,
          icon: Users,
          iconColor: 'bg-primary/10 text-primary',
        },
        {
          title: 'Submitted',
          value: `${assignment.submittedCount}/${assignment.totalStudents}`,
          change: `${submissionRate}% submission rate`,
          changeType: submissionRate >= 80 ? 'positive' as const : 'negative' as const,
          icon: CheckCircle,
          iconColor: 'bg-success/10 text-success',
        },
        {
          title: 'Graded',
          value: `${assignment.gradedCount}/${assignment.submittedCount}`,
          change: `${gradingProgress}% complete`,
          changeType: gradingProgress >= 80 ? 'positive' as const : 'neutral' as const,
          icon: Clock,
          iconColor: 'bg-warning/10 text-warning',
        },
        {
          title: 'Avg. Score',
          value: assignment.gradedCount > 0 && assignment.avgScore != null
            ? `${Math.round(assignment.avgScore)}/${assignment.maxScore ?? 100}`
            : '—',
          change: assignment.gradedCount > 0 && assignment.avgScore != null
            ? `Passing: ${assignment.passingScore != null ? `${assignment.passingScore}%` : '—'}`
            : 'No grades yet',
          changeType: 'neutral' as const,
          icon: Award,
          iconColor: 'bg-accent/10 text-accent',
        },
      ]
    : [];

  const handleSaveAssignment = async () => {
    setSavingAssignment(true);
    try {
      await updateAssignmentMutation.mutateAsync({ id: assignmentId, body: editForm });
      setEditingAssignment(false);
      appToast.success('Assignment updated successfully.');
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Failed to update assignment.');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleSaveGrades = async () => {
    setSavingGrades(true);
    try {
      const submissionsPayload = Object.entries(gradeScores).map(([studentId, score]) => ({
        studentId,
        score,
      }));
      await updateSubmissionsMutation.mutateAsync({
        assignmentId,
        body: { submissions: submissionsPayload },
      });
      setGradingMode(false);
      appToast.success('Grades saved successfully.');
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Failed to save grades.');
    } finally {
      setSavingGrades(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(assignmentId);
      appToast.success('Assignment deleted successfully.');
      router.push('/lecturer/assignments');
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Failed to delete assignment.');
      setDeleting(false);
    }
  };

  if (loadingAssignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !assignment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold text-card-foreground">Assignment not found</h1>
        <p className="text-muted-foreground">{loadError ?? 'This assignment may no longer be available.'}</p>
        <Link href="/lecturer/assignments">
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm">
            Back to assignments
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="h-auto bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/lecturer/assignments" className="hover:text-primary transition-colors">
            Assignments
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-card-foreground font-medium">{assignment.title}</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-card-foreground">{assignment.title}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {assignment.classCode && <span>{assignment.classCode} - </span>}
              <span>{assignment.className}</span>
              <span>•</span>
              <span>{assignment.type === 'case' ? 'Case Analysis' : 'Quiz'}</span>
              <span>•</span>
              <span>Due: {formatDate(assignment.dueDate)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/lecturer/assignments"
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors duration-150 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <button
              onClick={() => {
                setEditForm({
                  title: assignment.title,
                  description: assignment.description,
                  instructions: assignment.instructions,
                  dueDate: assignment.dueDate ?? undefined,
                  isMandatory: assignment.isMandatory,
                  maxScore: assignment.maxScore,
                  passingScore: assignment.passingScore,
                  allowLate: assignment.allowLate,
                });
                setEditingAssignment(true);
                setActiveTab('Settings');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors duration-150 text-sm cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Edit
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors duration-150 text-sm cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors duration-150 text-sm cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors duration-150 text-sm cursor-pointer disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loadingAssignment
            ? stats.map((s) => (
                <div
                  key={s.title}
                  className="bg-card rounded-xl border border-border p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-8 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))
            : stats.map((s) => <StatCard key={s.title} {...s} />)}
        </div>

        {/* Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-card-foreground">Submission Rate</span>
              <span className="text-sm font-semibold text-card-foreground">{submissionRate}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${submissionRate}%` }} />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-card-foreground">Grading Progress</span>
              <span className="text-sm font-semibold text-card-foreground">{gradingProgress}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success transition-all duration-300" style={{ width: `${gradingProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 cursor-pointer ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Submissions Tab */}
        {activeTab === 'Submissions' && (
          <>
            {/* Grading mode banner */}
            {gradingMode && (
              <div className="flex items-center justify-between mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium text-primary">
                    Grading mode — enter scores and click Save to confirm
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setGradingMode(false);
                      // Reset scores to current submission values
                      const reset: Record<string, number | null> = {};
                      submissions.forEach((s) => { reset[s.studentId] = s.score; });
                      setGradeScores(reset);
                    }}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveGrades}
                    disabled={savingGrades}
                    className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 transition-colors text-sm font-medium cursor-pointer disabled:opacity-60"
                  >
                    {savingGrades ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                      <><Save className="w-4 h-4" /> Save Grades</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Enter grading mode button — shown when not in grading mode and there are pending submissions */}
            {!gradingMode && submissions.some((s) => s.status === 'pending') && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setGradingMode(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium cursor-pointer"
                >
                  Enter Grading Mode
                </button>
              </div>
            )}

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Student</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">ID</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Submitted</th>
                    <th className="text-center text-xs font-medium text-muted-foreground px-5 py-3">Score</th>
                    <th className="text-center text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSubmissions ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      </td>
                    </tr>
                  ) : submissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                        No submissions found for this assignment.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => {
                      const sConfig = submissionStatusConfig[sub.status];
                      const maxScore = assignment.maxScore ?? 100;
                      return (
                        <tr key={sub.studentId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                {sub.studentName.split(' ').map((n) => n[0]).join('')}
                              </div>
                              <span className="font-medium text-sm text-card-foreground">{sub.studentName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">
                            {sub.studentCode ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">
                            {sub.submittedAt ? formatDate(sub.submittedAt) : '—'}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {gradingMode && sub.status !== 'not-submitted' ? (
                              <input
                                type="number"
                                min={0}
                                max={maxScore}
                                value={gradeScores[sub.studentId] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGradeScores((prev) => ({
                                    ...prev,
                                    [sub.studentId]: val === '' ? null : Number(val),
                                  }));
                                }}
                                className="w-20 px-2 py-1.5 border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white dark:bg-muted"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-card-foreground">
                                {sub.score !== null ? `${sub.score}/${maxScore}` : '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sConfig.bgColor} ${sConfig.color}`}>
                              {sConfig.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Settings Tab */}
        {activeTab === 'Settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assignment Details / Edit Form */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-card-foreground">Assignment Details</h3>
                {!editingAssignment ? (
                  <button
                    onClick={() => {
                      setEditForm({
                        title: assignment.title,
                        description: assignment.description,
                        instructions: assignment.instructions,
                        dueDate: assignment.dueDate ?? undefined,
                        isMandatory: assignment.isMandatory,
                        maxScore: assignment.maxScore,
                        passingScore: assignment.passingScore,
                        allowLate: assignment.allowLate,
                      });
                      setEditingAssignment(true);
                    }}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingAssignment(false)}
                      className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAssignment}
                      disabled={savingAssignment}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {savingAssignment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {savingAssignment ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {editingAssignment ? (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Title</label>
                      <input
                        type="text"
                        value={editForm.title ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Description</label>
                      <textarea
                        value={editForm.description ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Instructions</label>
                      <textarea
                        value={editForm.instructions ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, instructions: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Due Date</label>
                      <input
                        type="datetime-local"
                        value={editForm.dueDate ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Max Score</label>
                        <input
                          type="number"
                          value={editForm.maxScore ?? ''}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, maxScore: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Passing Score %</label>
                        <input
                          type="number"
                          value={editForm.passingScore ?? ''}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, passingScore: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="editMandatory"
                        checked={editForm.isMandatory ?? false}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, isMandatory: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <label htmlFor="editMandatory" className="text-sm text-card-foreground">Mandatory Assignment</label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="editAllowLate"
                        checked={editForm.allowLate ?? false}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, allowLate: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <label htmlFor="editAllowLate" className="text-sm text-card-foreground">Allow Late Submission</label>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-sm text-muted-foreground">Description</label>
                      <p className="text-sm text-card-foreground mt-1">
                        {assignment.description || '—'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-muted-foreground">Type</label>
                        <p className="text-sm font-medium text-card-foreground mt-1">
                          {assignment.type === 'case' ? 'Case Analysis' : 'Quiz'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Created</label>
                        <p className="text-sm font-medium text-card-foreground mt-1">
                          {formatDate(assignment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Instructions</label>
                      <p className="text-sm text-card-foreground mt-1 whitespace-pre-wrap">
                        {assignment.instructions || '—'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Configuration</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="text-sm font-medium text-card-foreground">{formatDate(assignment.dueDate)}</p>
                  </div>
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                {assignment.maxScore != null && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Max Score</p>
                      <p className="text-sm font-medium text-card-foreground">{assignment.maxScore} points</p>
                    </div>
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                )}
                {assignment.passingScore != null && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Passing Score</p>
                      <p className="text-sm font-medium text-card-foreground">{assignment.passingScore}%</p>
                    </div>
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Late Submission</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {assignment.allowLate ? 'Allowed' : 'Not allowed'}
                    </p>
                  </div>
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Mandatory</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {assignment.isMandatory ? 'Required' : 'Optional'}
                    </p>
                  </div>
                  {assignment.isMandatory ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <X className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Instructions (display only) */}
            {!editingAssignment && assignment.instructions && (
              <div className="bg-card rounded-xl border border-border p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Instructions</h3>
                <p className="text-sm text-card-foreground whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
