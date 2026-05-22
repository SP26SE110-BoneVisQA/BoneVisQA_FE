'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Search,
  Loader2,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  Users,
  FileText,
  RotateCcw,
  AlertTriangle,
  Download,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { getQuiz, releaseQuizAnswers, hideQuizAnswers, getQuizReleaseStatus } from '@/lib/api/lecturer-quiz';
import {
  getClassQuizAttempts,
  getQuizAttemptDetail,
  allowRetakeForAttempt,
  allowRetakeAll,
  updateQuizAttempt,
  exportQuizResultsExcel,
} from '@/lib/api/lecturer';
import { getApiErrorMessage, resolveApiAssetUrl } from '@/lib/api/client';
import type { QuizDto, StudentQuizAttemptDto, QuizAttemptDetailDto, QuestionWithAnswerDto, UpdateAnswerDto } from '@/lib/api/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type SortKey = 'studentName' | 'score' | 'submittedAt';
type SortDir = 'asc' | 'desc';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ScoreBadge({ score, maxScore }: { score: number | null; maxScore: number }) {
  if (score === null) return <span className="text-muted-foreground">Ungraded</span>;
  // New system: score is already 0-100, display as percentage
  const color = score >= 80 ? 'text-success bg-success/10' : score >= 60 ? 'text-warning bg-warning/10' : 'text-destructive bg-destructive/10';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      <Award className="h-3 w-3" />
      {score.toFixed(1)}%
    </span>
  );
}

function CompactQuestionNav({
  questions,
  currentIndex,
  onSelect,
}: {
  questions: QuestionWithAnswerDto[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q, i) => {
        const isCurrent = i === currentIndex;
        const isCorrect = q.isCorrect === true;
        const isIncorrect = q.isCorrect === false;
        const isEssay = q.type?.toLowerCase() === 'essay';

        let cls = 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant';
        if (isCorrect) {
          cls = 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600';
        } else if (isIncorrect) {
          cls = 'border-destructive/50 bg-destructive/10 text-destructive';
        } else if (q.isCorrect === null) {
          cls = 'border-amber-500/50 bg-amber-500/10 text-amber-600';
        }

        if (isCurrent) {
          cls += ' ring-2 ring-primary ring-offset-2 ring-offset-background';
        }

        return (
          <button
            key={q.questionId}
            type="button"
            onClick={() => onSelect(i)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all ${cls}`}
          >
            {i + 1}
            {isEssay && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function QuestionReviewContent({
  q,
  index,
}: {
  q: QuestionWithAnswerDto;
  index: number;
}) {
  const [imgFullscreen, setImgFullscreen] = useState(false);
  const [enhancement, setEnhancement] = useState({ brightness: 1, contrast: 1, invert: false, grayscale: false });
  const isEssay = q.type?.toLowerCase() === 'essay';
  const options = [
    { key: 'A', value: q.optionA },
    { key: 'B', value: q.optionB },
    { key: 'C', value: q.optionC },
    { key: 'D', value: q.optionD },
  ];

  const getImageStyle = (enh: typeof enhancement): React.CSSProperties => {
    const filters = [
      `brightness(${enh.brightness})`,
      `contrast(${enh.contrast})`,
      enh.invert ? 'invert(1)' : '',
      enh.grayscale ? 'grayscale(1)' : '',
    ].filter(Boolean);
    return { filter: filters.join(' ') };
  };

  return (
    <>
      <div className="space-y-4">
        {/* Question image */}
        {q.imageUrl && (
          <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
            <img
              src={resolveApiAssetUrl(q.imageUrl)}
              alt={`Question ${index + 1} image`}
              className="w-full h-auto max-h-56 object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setImgFullscreen(true)}
            />
          </div>
        )}

        {/* Question text */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            {index + 1}
          </span>
          <span className="flex-1 text-sm font-medium">{q.questionText}</span>
          {isEssay && (
            <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 font-semibold">
              Essay
            </span>
          )}
          {q.isCorrect === true && <CheckCircle className="h-5 w-5 text-success shrink-0" />}
          {q.isCorrect === false && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
          {q.isCorrect === null && <Clock className="h-5 w-5 text-muted-foreground shrink-0" />}
        </div>

        {/* Answer section */}
        {isEssay ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-900/20 dark:border-amber-800">
              <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 mb-2">
                Student&apos;s Answer
              </h5>
              <p className="whitespace-pre-wrap text-sm text-card-foreground leading-relaxed">
                {q.essayAnswer || '(No answer submitted)'}
              </p>
            </div>
            {q.referenceAnswer && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Reference / Model Answer
                </h5>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                  {q.referenceAnswer}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {options.map((opt) => {
              const isCorrect = opt.key === q.correctAnswer;
              const isStudent = opt.key === q.studentAnswer;
              let cls = 'flex items-center gap-2 p-3 rounded-lg border text-sm';
              if (isCorrect) cls += ' border-success bg-success/10 text-success font-medium';
              else if (isStudent && !isCorrect) cls += ' border-destructive bg-destructive/10 text-destructive';
              else cls += ' border-border bg-muted/50 text-muted-foreground';
              return (
                <div key={opt.key} className={cls}>
                  <span className="font-bold">{opt.key}.</span>
                  <span className="flex-1">{opt.value ?? '—'}</span>
                  {isCorrect && <CheckCircle className="h-4 w-4 shrink-0" />}
                  {isStudent && !isCorrect && <XCircle className="h-4 w-4 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Status summary */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {q.type !== 'essay' && q.type !== 'Essay' && (
            <span>
              <strong>Correct:</strong> {q.correctAnswer ?? '—'}
            </span>
          )}
          <span>
            <strong>Status:</strong>{' '}
            {q.isCorrect === true ? (
              <span className="text-success font-medium">Correct</span>
            ) : q.isCorrect === false ? (
              <span className="text-destructive font-medium">Incorrect</span>
            ) : (
              <span className="text-muted-foreground">Not graded</span>
            )}
          </span>
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {imgFullscreen && q.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImgFullscreen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors z-10"
            onClick={() => setImgFullscreen(false)}
          >
            <XCircle className="h-8 w-8" />
          </button>
          {/* Enhancement controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEnhancement(prev => ({ ...prev, invert: !prev.invert })); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                enhancement.invert ? 'bg-primary text-white' : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              Invert
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEnhancement({ brightness: 1.5, contrast: 2, invert: true, grayscale: false }); }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/30 hover:bg-blue-500/50 text-white transition-colors"
            >
              X-ray Mode
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEnhancement({ brightness: 1, contrast: 1, invert: false, grayscale: false }); }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              Reset
            </button>
          </div>
          <img
            src={resolveApiAssetUrl(q.imageUrl)}
            alt={`Question ${index + 1} full size`}
            className="max-w-full max-h-full object-contain"
            style={getImageStyle(enhancement)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function AttemptDetailModal({
  detail,
  onClose,
}: {
  detail: QuizAttemptDetailDto | null;
  onClose: () => void;
}) {
  const [currentQIndex, setCurrentQIndex] = useState(0);

  if (!detail) return null;
  const maxScore = 100;
  const currentQ = detail.questions[currentQIndex];

  return (
    <Modal open={!!detail} onClose={onClose} title={`Quiz Review: ${detail.studentName}`} size="xl">
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex flex-wrap gap-4 text-sm p-3 rounded-lg border border-border bg-muted/30">
          <div>
            <span className="text-muted-foreground">Quiz:</span>{' '}
            <span className="font-medium">{detail.quizTitle}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Started:</span>{' '}
            <span>{formatDate(detail.startedAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Submitted:</span>{' '}
            <span>{formatDate(detail.completedAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Score:</span>{' '}
            <ScoreBadge score={detail.score} maxScore={maxScore} />
          </div>
        </div>

        {/* Question Navigation - Compact horizontal bar */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Questions ({detail.questions.length})
            </h4>
            <span className="text-xs text-muted-foreground">
              {detail.questions.filter(q => q.isCorrect === true).length} correct ·{' '}
              {detail.questions.filter(q => q.isCorrect === false).length} incorrect ·{' '}
              {detail.questions.filter(q => q.isCorrect === null).length} pending
            </span>
          </div>
          <CompactQuestionNav
            questions={detail.questions}
            currentIndex={currentQIndex}
            onSelect={setCurrentQIndex}
          />
        </div>

        {/* Current Question Content */}
        {currentQ && (
          <div className="border-t border-border pt-4">
            <QuestionReviewContent q={currentQ} index={currentQIndex} />
          </div>
        )}

        {/* Navigation arrows */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setCurrentQIndex(Math.max(0, currentQIndex - 1))}
            disabled={currentQIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Question {currentQIndex + 1} of {detail.questions.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentQIndex(Math.min(detail.questions.length - 1, currentQIndex + 1))}
            disabled={currentQIndex === detail.questions.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditScoreModal({
  detail,
  onClose,
  onSave,
  saving,
}: {
  detail: QuizAttemptDetailDto | null;
  onClose: () => void;
  onSave: (data: { score: number | null; answers: UpdateAnswerDto[] }) => Promise<void>;
  saving: boolean;
}) {
  if (!detail) return null;

  const [localScore, setLocalScore] = useState<number | null>(detail.score);
  const [answers, setAnswers] = useState<UpdateAnswerDto[]>(
    detail.questions.map((q) => ({
      answerId: q.answerId,
      studentAnswer: q.type?.toLowerCase() === 'essay' ? null : q.studentAnswer,
      essayAnswer: q.type?.toLowerCase() === 'essay' ? q.essayAnswer : null,
      isCorrect: q.isCorrect,
      scoreAwarded: q.scoreAwarded ?? null,
      lecturerFeedback: q.lecturerFeedback ?? null,
      isGraded: q.isGraded,
    })),
  );
  // Track which questions have been manually edited by the user
  const [manuallyEditedQuestions, setManuallyEditedQuestions] = useState<Set<number>>(new Set());

  // Reset manuallyEditedQuestions when detail changes (modal opens for different student)
  useEffect(() => {
    setManuallyEditedQuestions(new Set());
  }, [detail?.attemptId]);

    // Recalculate when individual scores change (only for non-manually-edited questions)
  useEffect(() => {
    if (detail.questions.length === 0) return;
    // Total quiz score always = 100, divided equally among all questions
    const totalQuestions = detail.questions.length;
    const pointsPerQuestion = 100 / totalQuestions;
    
    const totalEarned = answers.reduce((sum, a, idx) => {
      // Only auto-calculate for questions not manually edited
      if (manuallyEditedQuestions.has(idx)) {
        // For manually edited: use scoreAwarded directly
        return sum + (a.scoreAwarded ?? 0);
      }
      // MC/TF/etc: full points if correct, 0 if wrong
      if (a.isCorrect) {
        return sum + pointsPerQuestion;
      }
      return sum + (a.scoreAwarded ?? 0); // Essay: use scoreAwarded if graded
    }, 0);
    
    // totalEarned is already the score (0-100), no need to convert
    setLocalScore(Math.max(0, Math.min(100, totalEarned)));
  }, [answers, detail.questions, manuallyEditedQuestions]);

  function updateAnswer(idx: number, updates: Partial<UpdateAnswerDto>) {
    setAnswers((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...updates } : a)),
    );
    // Mark this question as manually edited by the user
    setManuallyEditedQuestions((prev) => new Set(prev).add(idx));
  }

  const isValid = localScore !== null && localScore >= 0 && localScore <= 100;

  return (
    <Modal
      open={!!detail}
      onClose={saving ? () => {} : onClose}
      title={`Edit Score: ${detail.studentName}`}
      size="xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => !saving && onClose()} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isValid || saving}
            onClick={() => { onSave({ score: localScore, answers }); }}
            className="bg-primary font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Overall score */}
        <div className="flex flex-wrap gap-4 text-sm p-3 rounded-lg border border-border bg-muted/30">
          <div>
            <span className="text-muted-foreground">Quiz:</span>{' '}
            <span className="font-medium">{detail.quizTitle}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Student:</span>{' '}
            <span className="font-medium">{detail.studentName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total score:</span>
            <span className="font-bold text-lg text-primary">{localScore ?? 0}%</span>
            <span className="text-xs text-muted-foreground">(auto)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Manual score:</span>
            <input
              type="number"
              min={0}
              max={100}
              value={localScore ?? ''}
              onChange={(e) => {
                const rawVal = e.target.value;
                const val = rawVal ? Number(rawVal) : null;
                // Clamp to valid range (0-100)
                const clampedVal = val !== null ? Math.max(0, Math.min(val, 100)) : null;
                setLocalScore(clampedVal);
              }}
              className="w-20 h-8 rounded border border-border px-2 text-sm text-center"
              disabled={saving}
            />
            <span className="text-muted-foreground">%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Grading progress</span>
            <span>{Math.round(localScore ?? 0)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${localScore ?? 0}%` }}
            />
          </div>
        </div>

        {/* Per-question editing */}
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Edit Question Scores ({detail.questions.length})
          </h4>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {detail.questions.map((q, i) => {
              const ans = answers[i];
              const totalQ = detail.questions.length;
              const pointsPerQ = totalQ > 0 ? 100 / totalQ : 1;
              const suggestedScore = ans.isCorrect ? pointsPerQ : 0;
              const isEssay = q.type?.toLowerCase() === 'essay';

              return (
                <div
                  key={q.questionId}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium line-clamp-2">
                      {q.questionText}
                    </span>
                    {isEssay && (
                      <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 font-semibold shrink-0">
                        Essay
                      </span>
                    )}
                  </div>

                  {/* Edit controls */}
                  <div className="px-4 py-3 space-y-3">
                    {/* Image display for the question */}
                    {q.imageUrl && (
                      <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
                        <img
                          src={resolveApiAssetUrl(q.imageUrl)}
                          alt={`Question ${i + 1} image`}
                          className="w-full h-auto max-h-40 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(resolveApiAssetUrl(q.imageUrl) + '?enhance=true', '_blank')}
                        />
                        <p className="text-xs text-center text-muted-foreground py-1 px-2 bg-muted/50">
                          Click for full size with enhancement options
                        </p>
                      </div>
                    )}

                    {/* Essay question: show student's answer */}
                    {isEssay && (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-900/20 dark:border-amber-800">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 mb-1">
                            Student's Essay Answer
                          </h5>
                          <p className="whitespace-pre-wrap text-sm text-card-foreground leading-relaxed">
                            {q.essayAnswer || '(No answer submitted)'}
                          </p>
                        </div>
                        {q.referenceAnswer && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                              Reference / Model Answer
                            </h5>
                            <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
                              {q.referenceAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Correctness toggle (for MCQ only) */}
                    {!isEssay && q.type === 'multiple_choice' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Correct:</label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => updateAnswer(i, { isCorrect: true, scoreAwarded: pointsPerQ, isGraded: true })}
                            className={`px-2 py-0.5 text-xs rounded border transition-colors cursor-pointer ${
                              ans.isCorrect === true
                                ? 'bg-success/10 border-success text-success'
                                : 'border-border hover:border-success/50'
                            }`}
                            disabled={saving}
                          >
                            Correct
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAnswer(i, { isCorrect: false, scoreAwarded: 0, isGraded: true })}
                            className={`px-2 py-0.5 text-xs rounded border transition-colors cursor-pointer ${
                              ans.isCorrect === false
                                ? 'bg-destructive/10 border-destructive text-destructive'
                                : 'border-border hover:border-destructive/50'
                            }`}
                            disabled={saving}
                          >
                            Incorrect
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Manual score entry (for essay questions or override) */}
                    <div className="flex items-center gap-2 bg-muted/30 p-2 rounded">
                    <span className="text-xs text-muted-foreground">
                      Q{i + 1} score:
                    </span>
                      <input
                        type="number"
                        min={0}
                        max={pointsPerQ}
                        value={
                          manuallyEditedQuestions.has(i)
                            ? (ans.scoreAwarded !== null ? ans.scoreAwarded : '')
                            : (ans.scoreAwarded !== null ? ans.scoreAwarded : (ans.isCorrect ? pointsPerQ : 0))
                        }
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          const val = rawVal ? Number(rawVal) : null;
                          // Clamp to valid range (0 to pointsPerQ)
                          const clampedVal = val !== null ? Math.max(0, Math.min(val, pointsPerQ)) : null;
                          updateAnswer(i, {
                            scoreAwarded: clampedVal,
                            isGraded: true,
                          });
                        }}
                        className="w-16 h-8 rounded border border-primary/50 px-2 text-sm text-center font-medium"
                        disabled={saving}
                      />
                      <span className="text-xs text-muted-foreground">/ {pointsPerQ.toFixed(1)}</span>
                    </div>

                    {/* Feedback */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Lecturer Feedback:
                      </label>
                      <textarea
                        value={ans.lecturerFeedback ?? ''}
                        onChange={(e) => updateAnswer(i, { lecturerFeedback: e.target.value || null })}
                        placeholder="Add feedback for this question..."
                        rows={2}
                        className="w-full rounded border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                        disabled={saving}
                      />
                    </div>

                    {/* Graded status */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`graded-${i}`}
                        checked={ans.isGraded}
                        onChange={(e) => updateAnswer(i, { isGraded: e.target.checked })}
                        className="rounded border-border"
                        disabled={saving}
                      />
                      <label
                        htmlFor={`graded-${i}`}
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        Mark as graded
                      </label>
                    </div>

                    {/* Show correct answer for reference (MCQ only) */}
                    {!isEssay && q.correctAnswer && q.type === 'multiple_choice' && (
                      <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                        <strong>Correct Answer:</strong> {q.correctAnswer}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function QuizResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: quizId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [quizLoading, setQuizLoading] = useState(true);

  const [attempts, setAttempts] = useState<StudentQuizAttemptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selectedAttempt, setSelectedAttempt] = useState<StudentQuizAttemptDto | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<QuizAttemptDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAttempt, setEditingAttempt] = useState<StudentQuizAttemptDto | null>(null);
  const [editingDetail, setEditingDetail] = useState<QuizAttemptDetailDto | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [retakingId, setRetakingId] = useState<string | null>(null);
  const [retakingAll, setRetakingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** In-app confirmation instead of window.confirm */
  const [retakeDialog, setRetakeDialog] = useState<
    null | { kind: 'single'; attempt: StudentQuizAttemptDto } | { kind: 'all'; count: number }
  >(null);

  // Release answers state
  const [isReleased, setIsReleased] = useState(false);
  const [releasedAt, setReleasedAt] = useState<string | null>(null);
  const [isQuizClosed, setIsQuizClosed] = useState(false);
  const [releasing, setReleasing] = useState(false);

  // Release dialog state
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

  const classId = quiz?.classId ?? '';

  // Load release status when quiz loads
  useEffect(() => {
    if (!classId || !quizId) return;
    async function loadReleaseStatus() {
      try {
        const status = await getQuizReleaseStatus(classId, quizId);
        setIsReleased(status.isReleased);
        setReleasedAt(status.releasedAt);
        setIsQuizClosed(status.isQuizClosed);
      } catch {
        // Silently fail - release status is not critical
      }
    }
    loadReleaseStatus();
  }, [classId, quizId]);

  async function handleReleaseAnswers() {
    if (!classId || !quizId) return;
    setReleasing(true);
    try {
      await releaseQuizAnswers(classId, quizId);
      setIsReleased(true);
      setReleasedAt(new Date().toISOString());
      toast.success('Đáp án đã được công bố cho tất cả sinh viên.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setReleasing(false);
      setReleaseDialogOpen(false);
    }
  }

  async function handleHideAnswers() {
    if (!classId || !quizId) return;
    setReleasing(true);
    try {
      await hideQuizAnswers(classId, quizId);
      setIsReleased(false);
      setReleasedAt(null);
      toast.success('Đáp án đã được ẩn khỏi sinh viên.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setReleasing(false);
    }
  }

  const handleExportExcel = async () => {
    if (!classId || !quizId) return;
    setExporting(true);
    try {
      await exportQuizResultsExcel(classId, quizId);
      toast.success('Quiz results exported successfully!');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  function openRetakeSingleDialog(attempt: StudentQuizAttemptDto) {
    setRetakeDialog({ kind: 'single', attempt });
  }

  function openRetakeAllDialog() {
    const count = attempts.filter((a) => a.completedAt).length;
    if (count === 0) return;
    setRetakeDialog({ kind: 'all', count });
  }

  async function confirmRetakeDialog() {
    if (!classId || !retakeDialog || !quizId) return;
    if (retakeDialog.kind === 'single') {
      const attempt = retakeDialog.attempt;
      setRetakingId(attempt.attemptId);
      try {
        await allowRetakeForAttempt(classId, quizId, attempt.attemptId);
        toast.success(`Retake enabled for ${attempt.studentName}.`);
        const data = await getClassQuizAttempts(classId, quizId);
        setAttempts(data);
        setRetakeDialog(null);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setRetakingId(null);
      }
      return;
    }
    setRetakingAll(true);
    try {
      await allowRetakeAll(classId, quizId);
      toast.success('Retake enabled for all submitted students.');
      const data = await getClassQuizAttempts(classId, quizId);
      setAttempts(data);
      setRetakeDialog(null);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setRetakingAll(false);
    }
  }

  async function handleSaveEdit(data: { score: number | null; answers: UpdateAnswerDto[] }) {
    if (!editingAttempt || !classId || !quizId) {
      toast.error('Missing required data');
      return;
    }
    if (data.score === null || data.score === undefined) {
      toast.error('Invalid score value');
      return;
    }
    if (!data.answers || !Array.isArray(data.answers)) {
      toast.error('Invalid answers data');
      return;
    }
    setSavingId(editingAttempt.attemptId);
    try {
      await updateQuizAttempt(classId, quizId, editingAttempt.attemptId, {
        score: data.score,
        answers: data.answers,
      });
      setEditModalOpen(false);
      setEditingAttempt(null);
      setEditingDetail(null);
      toast.success('Score updated successfully!');
      const attemptsData = await getClassQuizAttempts(classId, quizId);
      setAttempts(attemptsData);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    async function load() {
      if (!quizId) {
        setQuizLoading(false);
        setError('Quiz ID is missing');
        return;
      }
      setQuizLoading(true);
      try {
        const q = await getQuiz(quizId);
        setQuiz(q);
      } catch {
        setError('Failed to load quiz info.');
      } finally {
        setQuizLoading(false);
      }
    }
    load();
  }, [quizId]);

  useEffect(() => {
    if (!classId || !quizId) return;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getClassQuizAttempts(classId, quizId);
        setAttempts(data);
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classId, quizId]);

  async function openAttemptDetail(attempt: StudentQuizAttemptDto) {
    if (!classId || !quizId) return;
    setSelectedAttempt(attempt);
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const detail = await getQuizAttemptDetail(classId, quizId, attempt.attemptId);
      setAttemptDetail(detail);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function openEditScore(attempt: StudentQuizAttemptDto) {
    if (!classId || !quizId) return;
    setEditingAttempt(attempt);
    setEditLoading(true);
    setEditModalOpen(true);
    try {
      const detail = await getQuizAttemptDetail(classId, quizId, attempt.attemptId);
      setEditingDetail(detail);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setEditModalOpen(false);
    } finally {
      setEditLoading(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = attempts
    .filter((a) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        a.studentName.toLowerCase().includes(s) ||
        a.studentEmail.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'studentName') cmp = a.studentName.localeCompare(b.studentName);
      else if (sortKey === 'score') cmp = (a.score ?? 0) - (b.score ?? 0);
      else if (sortKey === 'submittedAt') {
        const ta = a.completedAt ?? a.startedAt ?? '';
        const tb = b.completedAt ?? b.startedAt ?? '';
        cmp = ta.localeCompare(tb);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const avgScore = attempts.length > 0
    ? attempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / attempts.filter(a => a.score !== null).length
    : 0;
  const passCount = attempts.filter((a) => a.score !== null && a.score >= (quiz?.passingScore ?? 0)).length;

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-muted-foreground/30 ml-1">⇅</span>;
    return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-muted-foreground">/</span>
        <Link href="/lecturer/quizzes" className="text-sm text-muted-foreground hover:text-foreground">
          Quizzes
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{quiz?.title ?? quizId}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-primary">Results</span>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quiz Results</h1>
            {quiz && (
              <p className="text-muted-foreground text-sm mt-1">
                {quiz.title}
                {quiz.topic ? ` · ${quiz.topic}` : ''}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportExcel}
            disabled={exporting || attempts.length === 0}
            className="shrink-0 border-success/30 bg-success/5 font-semibold text-success hover:bg-success/10"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Users className="h-4 w-4" />
            Total Attempts
          </div>
          <p className="text-2xl font-bold">{attempts.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Award className="h-4 w-4" />
            Average Score
          </div>
          <p className="text-2xl font-bold">
            {isNaN(avgScore) ? '—' : avgScore.toFixed(1)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <CheckCircle className="h-4 w-4" />
            Passed
          </div>
          <p className="text-2xl font-bold">
            {passCount}{quiz?.passingScore !== undefined && ` / ${attempts.filter(a => a.score !== null).length}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <FileText className="h-4 w-4" />
            Questions
          </div>
          <p className="text-2xl font-bold">{quiz?.questionCount ?? '—'}</p>
        </div>
      </div>

      {/* Actions Bar - Comprehensive */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        {/* Release Answers */}
        <div className="flex flex-1 items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isReleased ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            {isReleased ? <CheckCircle2 className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-card-foreground">Release Answers</p>
            <p className="text-xs text-muted-foreground truncate">
              {isReleased
                ? `Published ${releasedAt ? new Date(releasedAt).toLocaleDateString('vi-VN') : ''}`
                : isQuizClosed
                  ? 'Quiz closed — ready to publish'
                  : 'Not published yet'}
            </p>
          </div>
          {isReleased ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleHideAnswers}
              disabled={releasing}
              className="shrink-0 text-destructive hover:bg-destructive/10"
            >
              {releasing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hide'}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setReleaseDialogOpen(true)}
              disabled={releasing}
              className="shrink-0 bg-success text-white hover:bg-success/90"
            >
              {releasing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border hidden sm:block" />

        {/* Retake Management */}
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-card-foreground">Allow Retake</p>
            <p className="text-xs text-muted-foreground truncate">
              {attempts.filter((a) => a.completedAt).length > 0
                ? `${attempts.filter((a) => a.completedAt).length} submission(s)`
                : 'No submissions yet'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openRetakeAllDialog}
            disabled={retakingAll || attempts.filter((a) => a.completedAt).length === 0}
            className="shrink-0 text-primary hover:bg-primary/10"
          >
            {retakingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset All'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name or email…"
          className="h-10 w-full rounded-full border border-border bg-muted pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">Student</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('score')}
                >
                  Score <SortIcon k="score" />
                </th>
                <th className="px-4 py-3 font-medium text-center">Correct</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('submittedAt')}
                >
                  Submitted <SortIcon k="submittedAt" />
                </th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading attempts…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-destructive">
                    {error}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {search ? 'No students match your search.' : 'No attempts yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.attemptId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{a.studentName}</p>
                        <p className="text-xs text-muted-foreground">{a.studentEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={a.score} maxScore={100} />
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {a.totalQuestions > 0
                        ? `${a.correctCount} / ${a.totalQuestions}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.isGraded ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          <CheckCircle className="h-3 w-3" />
                          Graded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(a.completedAt ?? a.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.completedAt && (
                          <button
                            type="button"
                            onClick={() => openRetakeSingleDialog(a)}
                            disabled={retakingId === a.attemptId}
                            title="Allow retake"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md border-2 border-blue-400 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-500 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {retakingId === a.attemptId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <Link
                          href={`/lecturer/quizzes/${quizId}/results/${a.attemptId}`}
                          title="View details"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-muted transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditScore(a)}
                          title="Edit score"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attempt Detail Modal */}
      {detailModalOpen && (
        <AttemptDetailModal
          detail={detailLoading ? null : attemptDetail}
          onClose={() => {
            setDetailModalOpen(false);
            setAttemptDetail(null);
            setSelectedAttempt(null);
          }}
        />
      )}

      {/* Edit Score Modal */}
      {editModalOpen && editingDetail && (
        <EditScoreModal
          detail={editingDetail}
          onClose={() => {
            setEditModalOpen(false);
            setEditingDetail(null);
            setEditingAttempt(null);
          }}
          onSave={handleSaveEdit}
          saving={savingId === editingAttempt?.attemptId}
        />
      )}

      <Modal
        open={retakeDialog !== null}
        onClose={() => {
          if (retakingId || retakingAll) return;
          setRetakeDialog(null);
        }}
        title={
          retakeDialog?.kind === 'all'
            ? 'Allow retake for everyone?'
            : retakeDialog?.kind === 'single'
              ? 'Allow student to retake?'
              : ''
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={!!retakingId || retakingAll}
              onClick={() => setRetakeDialog(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!!retakingId || retakingAll}
              onClick={() => void confirmRetakeDialog()}
              className="bg-primary font-semibold"
            >
              {retakingId || retakingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying…
                </>
              ) : retakeDialog?.kind === 'all' ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Allow all retakes
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Allow retake
                </>
              )}
            </Button>
          </div>
        }
      >
        {retakeDialog?.kind === 'single' ? (
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-card-foreground">{retakeDialog.attempt.studentName}</span> will be
                able to start this quiz again. Their current submitted attempt will be reset for retake purposes.
              </p>
              <p className="text-xs">Use this when a student needs another attempt after technical issues or as decided by your course policy.</p>
            </div>
          </div>
        ) : retakeDialog?.kind === 'all' ? (
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
              <p>
                Allow all{' '}
                <span className="font-semibold text-card-foreground">{retakeDialog.count}</span> student
                {retakeDialog.count === 1 ? '' : 's'} who submitted to retake this quiz?
              </p>
              <p className="text-xs">
                Each will receive a fresh attempt. This applies to everyone who has already completed a submission for this quiz in this class.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Release Answers Confirm Dialog */}
      <Modal
        open={releaseDialogOpen}
        onClose={() => !releasing && setReleaseDialogOpen(false)}
        title="Release answers?"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReleaseDialogOpen(false)}
              disabled={releasing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleReleaseAnswers()}
              disabled={releasing}
              className="bg-success font-semibold text-white hover:bg-success/90"
            >
              {releasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Releasing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Release Answers
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
            <p>
              All students in the class will be able to view the{" "}
              <span className="font-semibold text-card-foreground">correct answers</span> and{" "}
              <span className="font-semibold text-card-foreground">explanations</span> after the
              release.
            </p>
            <p className="text-xs">
              This action cannot be easily undone. Students will see the correct answers for all
              multiple-choice questions.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
