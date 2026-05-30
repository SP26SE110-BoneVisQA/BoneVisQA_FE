'use client';

import type { ReactNode } from 'react';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  assignExpertQuiz as assignQuiz,
  fetchExpertQuizzesPaged,
  fetchExpertClassesPaged,
  fetchExpertUsersPaged,
  fetchAttemptsByQuizId,
  fetchAssignedQuizzes,
  type QuizAttempt,
  type AssignedQuizRecord,
} from '@/lib/api/expert-quizzes';
import {
  Clock, Calendar, ClipboardList, BadgeCheck,
  BookOpen, Search, Loader2, CheckCircle2, XCircle, AlertCircle,
  Check, X,
} from 'lucide-react';

function isoToLocalInputValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputValueToIso(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

type TabKey = 'score' | 'assigned' | 'assign';

export default function QuizAssignScorePanel() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('score');

  // ─── shared data ───────────────────────────────────────────────────────────
  const [quizzesList, setQuizzesList] = useState<{ id: string; title: string }[]>([]);
  const [classesList, setClassesList] = useState<{ id: string; className: string }[]>([]);
  const [expertsList, setExpertsList] = useState<{ id: string; fullName: string }[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);

  const loadShared = useCallback(async () => {
    if (quizzesList.length > 0) return; // already loaded
    setSharedLoading(true);
    try {
      const [qRes, cRes, eRes] = await Promise.all([
        fetchExpertQuizzesPaged(1, 1000),
        fetchExpertClassesPaged(1, 1000),
        fetchExpertUsersPaged(1, 1000),
      ]);
      setQuizzesList(qRes.items.map((q) => ({ id: q.id, title: q.title })));
      setClassesList(cRes);
      setExpertsList(eRes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load assignment lists.');
    } finally {
      setSharedLoading(false);
    }
  }, [quizzesList.length]);

  useEffect(() => {
    loadShared();
  }, [loadShared]);

  // ─── Tab: Score Lookup ─────────────────────────────────────────────────────
  const [scoreQuizId, setScoreQuizId] = useState('');
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const loadAttempts = async (qId: string) => {
    if (!qId) { setAttempts([]); setSelectedStudentId(''); return; }
    setAttemptsLoading(true);
    setAttempts([]);
    setSelectedStudentId('');
    try {
      const list = await fetchAttemptsByQuizId(qId);
      setAttempts(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load attempts.';
      toast.error(msg);
    } finally {
      setAttemptsLoading(false);
    }
  };

  const selectedAttempt = useMemo(
    () => attempts.find((a) => a.studentId === selectedStudentId) ?? null,
    [attempts, selectedStudentId],
  );

  // ─── Tab: Assigned Quizzes ───────────────────────────────────────────────
  const [assignedList, setAssignedList] = useState<AssignedQuizRecord[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedLoaded, setAssignedLoaded] = useState(false);
  const [assignedSearch, setAssignedSearch] = useState('');
  const [assignedPage, setAssignedPage] = useState(1);
  const ASSIGNED_PAGE_SIZE = 5;

  const loadAssigned = useCallback(async () => {
    if (assignedLoaded) return;
    setAssignedLoading(true);
    try {
      const list = await fetchAssignedQuizzes(1, 100);
      setAssignedList(list);
      setAssignedLoaded(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load assigned quizzes.';
      toast.error(msg);
    } finally {
      setAssignedLoading(false);
    }
  }, [assignedLoaded]);

  useEffect(() => {
    if (activeTab === 'assigned') loadAssigned();
  }, [activeTab, loadAssigned]);

  const filteredAssigned = useMemo(() => {
    const s = assignedSearch.trim().toLowerCase();
    if (!s) return assignedList;
    return assignedList.filter(
      (r) =>
        r.quizName.toLowerCase().includes(s) ||
        r.className.toLowerCase().includes(s),
    );
  }, [assignedList, assignedSearch]);

  // reset page when search changes
  useEffect(() => { setAssignedPage(1); }, [assignedSearch]);

  const assignedTotalPages = Math.max(1, Math.ceil(filteredAssigned.length / ASSIGNED_PAGE_SIZE));
  const pagedAssigned = useMemo(() => {
    const start = (assignedPage - 1) * ASSIGNED_PAGE_SIZE;
    return filteredAssigned.slice(start, start + ASSIGNED_PAGE_SIZE);
  }, [filteredAssigned, assignedPage]);

  // ─── Tab: Assign Quiz (form modal) ────────────────────────────────────────
  const [assignOpen, setAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [quizId, setQuizId] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [assignedExpertId, setAssignedExpertId] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [passingScore, setPassingScore] = useState<number | ''>('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | ''>('');

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const removeClass = (classId: string) => {
    setSelectedClassIds((prev) => prev.filter((id) => id !== classId));
  };

  const canAssign = Boolean(quizId.trim()) && selectedClassIds.length > 0;

  const openAssignModal = () => {
    setQuizId('');
    setSelectedClassIds([]);
    setAssignedExpertId('');
    setOpenTime('');
    setCloseTime('');
    setPassingScore('');
    setTimeLimitMinutes('');
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    const openIso = openTime ? localInputValueToIso(openTime) : null;
    const closeIso = closeTime ? localInputValueToIso(closeTime) : null;
    if (openIso && closeIso && Date.parse(openIso) > Date.parse(closeIso)) {
      return toast.error('Open time must be before or equal to close time.');
    }
    if (!canAssign) return toast.error('Quiz and Class are required.');
    const selectedClassNames = selectedClassIds
      .map((id) => classesList.find((c) => c.id === id)?.className)
      .filter(Boolean)
      .join(', ');
    try {
      setIsAssigning(true);
      
      // Assign quiz to each selected class
      await Promise.all(
        selectedClassIds.map((cid) =>
          assignQuiz({
            classId: cid.trim(),
            quizId: quizId.trim(),
            assignedExpertId: assignedExpertId.trim() || null,
            openTime: openIso,
            closeTime: closeIso,
            passingScore: passingScore === '' ? null : Number(passingScore),
            timeLimitMinutes: timeLimitMinutes === '' ? null : Number(timeLimitMinutes),
          })
        )
      );
      
      toast.success(
        selectedClassIds.length === 1
          ? 'Quiz assigned successfully.'
          : `Quiz assigned to ${selectedClassIds.length} classes (${selectedClassNames}).`
      );
      setAssignOpen(false);
      // refresh assigned list
      setAssignedLoaded(false);
      setAssignedList([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Assign failed.';
      toast.error(msg);
    } finally {
      setIsAssigning(false);
    }
  };

  // ─── Tab configuration ─────────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: typeof Search }[] = [
    { key: 'score', label: 'Score Lookup', icon: BadgeCheck },
    { key: 'assigned', label: 'Assigned Quizzes', icon: BookOpen },
  ];

  return (
    <div className="w-full overflow-hidden rounded-xl border-0 bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="text-sm font-semibold text-card-foreground">Assign Quiz &amp; Score</div>
        <button
          onClick={openAssignModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 cursor-pointer transition-colors"
        >
          <ClipboardList className="w-3.5 h-3.5" /> Assign Quiz
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 cursor-pointer ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-card-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Score Lookup ─────────────────────────────────────────────────── */}
      {activeTab === 'score' && (
        <div className="p-4 space-y-4">
          {/* Step 1 – pick Quiz */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              1. Select Quiz
            </label>
            {sharedLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading quizzes...
              </div>
            ) : (
              <select
                value={scoreQuizId}
                onChange={(e) => {
                  setScoreQuizId(e.target.value);
                  loadAttempts(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                <option value="">— Select Quiz —</option>
                {quizzesList.map((q) => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2 – pick Student */}
          {scoreQuizId && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                2. Select Student
              </label>
              {attemptsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading attempts...
                </div>
              ) : attempts.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                  <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                  No students have attempted this quiz yet.
                </div>
              ) : (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                >
                  <option value="">— Select Student —</option>
                  {attempts.map((a) => (
                    <option key={a.studentId} value={a.studentId}>
                      {a.studentName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Step 3 – result */}
          {selectedStudentId && selectedAttempt && (
            <div className="rounded-lg border border-border bg-input/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {selectedAttempt.completedAt ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold text-card-foreground">
                  {selectedAttempt.studentName}
                </span>
                <span className="text-xs text-muted-foreground">· {selectedAttempt.quizTitle}</span>
              </div>

              {selectedAttempt.completedAt ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-card border border-border text-center">
                    <p className="text-muted-foreground mb-0.5">Score</p>
                    <p className="text-lg font-bold text-primary">
                      {selectedAttempt.score ?? '—'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border text-center">
                    <p className="text-muted-foreground mb-0.5">Completed</p>
                    <p className="font-medium text-card-foreground text-[11px]">
                      {fmtDate(selectedAttempt.completedAt)}
                    </p>
                  </div>
                  <div className="col-span-2 p-2.5 rounded-lg bg-card border border-border">
                    <p className="text-muted-foreground mb-0.5">Started</p>
                    <p className="font-medium text-card-foreground">{fmtDate(selectedAttempt.startedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Student <strong className="mx-1">{selectedAttempt.studentName}</strong> has not completed this quiz yet.
                </div>
              )}
            </div>
          )}

          {/* No attempt at all for selected student */}
          {selectedStudentId && !selectedAttempt && !attemptsLoading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No attempt found for this student.
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Assigned Quizzes ─────────────────────────────────────────────── */}
      {activeTab === 'assigned' && (
        <div className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by quiz or class..."
              value={assignedSearch}
              onChange={(e) => setAssignedSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {assignedLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredAssigned.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {assignedSearch ? 'No results found.' : 'No assigned quizzes yet.'}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pagedAssigned.map((r, i) => (
                  <div
                    key={`${r.quizId}-${r.classId}-${i}`}
                    className="p-3 rounded-lg border border-border bg-input/10 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{r.quizName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.className}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {r.timeLimitMinutes} min
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Open: <span className="text-card-foreground">{fmtDate(r.openTime)}</span></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Close: <span className="text-card-foreground">{fmtDate(r.closeTime)}</span></span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3 text-success" />
                        <span>Passing score: <span className="text-card-foreground font-medium">{r.passingScore}</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {assignedTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <button
                    disabled={assignedPage <= 1}
                    onClick={() => setAssignedPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground hover:bg-input disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Page <span className="text-card-foreground font-semibold">{assignedPage}</span> / {assignedTotalPages}
                    <span className="ml-2 text-[10px]">({filteredAssigned.length} total)</span>
                  </span>
                  <button
                    disabled={assignedPage >= assignedTotalPages}
                    onClick={() => setAssignedPage((p) => Math.min(assignedTotalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground hover:bg-input disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Assign Modal ─────────────────────────────────────────────────────── */}
      {assignOpen && (
        <ModalShell title="Assign Expert Quiz" onClose={() => !isAssigning && setAssignOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-card-foreground mb-1.5">Quiz Name</label>
              <select
                value={quizId}
                onChange={(e) => setQuizId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                <option value="">Select Quiz...</option>
                {quizzesList.map((q) => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1.5">Class Name</label>
              
              {/* Selected classes tags */}
                  {selectedClassIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                      {selectedClassIds.map((cid) => {
                        const cls = classesList.find((c) => c.id === cid);
                        if (!cls) return null;
                        return (
                          <span
                            key={cid}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-white rounded-full text-xs font-medium"
                          >
                            {cls.className}
                            <button
                              onClick={() => removeClass(cid)}
                              className="hover:bg-primary-foreground/20 rounded-full p-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

              {/* Dropdown for class selection */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowClassDropdown(!showClassDropdown)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring text-left cursor-pointer flex items-center justify-between"
                >
                  <span className={selectedClassIds.length > 0 ? 'text-card-foreground' : 'text-muted-foreground'}>
                    {selectedClassIds.length === 0
                      ? 'Select Classes...'
                      : `${selectedClassIds.length} class(es) selected`}
                  </span>
                  <span className="text-muted-foreground">▼</span>
                </button>

                {showClassDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {classesList.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No classes available</p>
                    ) : (
                      classesList.map((cls) => {
                        const isSelected = selectedClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleClass(cls.id);
                            }}
                            className={`w-full px-3 py-2 text-sm text-left cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-primary/5 text-primary'
                                : 'hover:bg-muted/50 text-card-foreground'
                            }`}
                          >
                            <span>{cls.className}</span>
                            {isSelected && <Check className="w-4 h-4 text-primary" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1.5">Expert Name</label>
              <select
                value={assignedExpertId}
                onChange={(e) => setAssignedExpertId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                <option value="">Select Expert (optional)...</option>
                {expertsList.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1.5">Open Time</label>
              <input
                type="datetime-local"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1.5">Close Time</label>
              <input
                type="datetime-local"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1.5">Passing Score</label>
              <input
                type="number"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Default if empty"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1.5">Time Limit (minutes)</label>
              <input
                type="number"
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Default if empty"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              disabled={isAssigning}
              onClick={() => setAssignOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-card-foreground hover:bg-input disabled:opacity-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isAssigning || !canAssign}
              onClick={handleAssign}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isAssigning 
                ? 'Assigning...' 
                : `Assign to ${selectedClassIds.length} Class${selectedClassIds.length > 1 ? 'es' : ''}`}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
