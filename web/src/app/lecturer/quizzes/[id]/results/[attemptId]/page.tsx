'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  FileText,
  Eye,
  Edit,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Sun,
  Contrast,
  Droplet,
} from 'lucide-react';
import { getQuizAttemptDetail, updateQuizAttempt } from '@/lib/api/lecturer';
import { getQuiz } from '@/lib/api/lecturer-quiz';
import { getApiErrorMessage, resolveApiAssetUrl } from '@/lib/api/client';
import type { QuizAttemptDetailDto, QuestionWithAnswerDto, UpdateAnswerDto } from '@/lib/api/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2];

// Image enhancement state
interface ImageEnhancement {
  brightness: number;
  contrast: number;
  invert: boolean;
  grayscale: boolean;
}

const DEFAULT_ENHANCEMENT: ImageEnhancement = {
  brightness: 1,
  contrast: 1,
  invert: false,
  grayscale: false,
};

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

function getImageStyle(enhancement: ImageEnhancement): React.CSSProperties {
  const filters = [
    `brightness(${enhancement.brightness})`,
    `contrast(${enhancement.contrast})`,
    enhancement.invert ? 'invert(1)' : '',
    enhancement.grayscale ? 'grayscale(1)' : '',
  ].filter(Boolean);
  return { filter: filters.join(' ') };
}

function resetEnhancement() {
  return DEFAULT_ENHANCEMENT;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">Ungraded</span>;
  const pct = score;
  const color = pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive';
  return (
    <span className={`text-2xl font-black ${color}`}>
      {score.toFixed(1)}%
    </span>
  );
}

export default function QuizAttemptReviewPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id: quizId, attemptId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<QuizAttemptDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Current question index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Image zoom state
  const [zoomIndex, setZoomIndex] = useState(1);
  const [imgFullscreen, setImgFullscreen] = useState(false);

  // Image enhancement state
  const [enhancement, setEnhancement] = useState<ImageEnhancement>(DEFAULT_ENHANCEMENT);
  const [showEnhancePanel, setShowEnhancePanel] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editAnswers, setEditAnswers] = useState<UpdateAnswerDto[]>([]);
  const [editScore, setEditScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [classId, setClassId] = useState<string>('');

  // Computed points per question (new scoring system: 100 / total questions)
  const totalQuestions = detail?.questions?.length ?? 0;
  const pointsPerQuestion = totalQuestions > 0 ? 100 / totalQuestions : 1;

  // Load quiz to get classId first
  useEffect(() => {
    async function loadQuiz() {
      try {
        const quiz = await getQuiz(quizId);
        setClassId(quiz.classId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load quiz metadata.');
      }
    }
    void loadQuiz();
  }, [quizId]);

  // Load attempt detail
  useEffect(() => {
    if (!classId) return;
    async function loadDetail() {
      setLoading(true);
      setError(null);
      try {
        const data = await getQuizAttemptDetail(classId, quizId, attemptId);
        setDetail(data);
        setEditScore(data.score);
        setEditAnswers(data.questions.map(q => ({
          answerId: q.answerId,
          studentAnswer: q.type?.toLowerCase() === 'essay' ? null : q.studentAnswer,
          essayAnswer: q.type?.toLowerCase() === 'essay' ? q.essayAnswer : null,
          isCorrect: q.isCorrect,
          scoreAwarded: q.scoreAwarded ?? null,
          lecturerFeedback: q.lecturerFeedback ?? null,
          isGraded: q.isGraded,
        })));
      } catch (e) {
        const msg = getApiErrorMessage(e);
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    void loadDetail();
  }, [classId, quizId, attemptId, toast]);

  const currentQ = detail?.questions[currentIndex];
  const totalQ = detail?.questions.length ?? 0;
  const isEssay = currentQ?.type?.toLowerCase() === 'essay';

  // Recalculate score in edit mode (new system: total always 100, each question worth 100/totalQuestions)
  useEffect(() => {
    if (!editMode || !detail) return;
    const totalQuestions = detail.questions.length;
    const pointsPerQ = totalQuestions > 0 ? 100 / totalQuestions : 1;
    const totalEarned = editAnswers.reduce((sum, a) => {
      // MC/TF: full points if correct, 0 if wrong
      // Essay: use scoreAwarded directly
      if (a.isCorrect === true) {
        return sum + pointsPerQ;
      } else if (a.isCorrect === false) {
        return sum; // 0 for wrong MC
      } else {
        // Essay or not graded
        return sum + (a.scoreAwarded ?? 0);
      }
    }, 0);
    setEditScore(totalEarned);
  }, [editAnswers, detail, editMode]);

  const updateAnswer = useCallback((idx: number, updates: Partial<UpdateAnswerDto>) => {
    setEditAnswers(prev => prev.map((a, i) => i === idx ? { ...a, ...updates } : a));
  }, []);

  const handleSave = async () => {
    if (!detail || !classId) return;
    setSaving(true);
    try {
      await updateQuizAttempt(classId, quizId, attemptId, {
        score: editScore,
        answers: editAnswers,
      });
      toast.success('Score updated successfully!');
      setEditMode(false);
      // Reload data
      const data = await getQuizAttemptDetail(classId, quizId, attemptId);
      setDetail(data);
      setEditScore(data.score);
      setEditAnswers(data.questions.map(q => ({
        answerId: q.answerId,
        studentAnswer: q.type?.toLowerCase() === 'essay' ? null : q.studentAnswer,
        essayAnswer: q.type?.toLowerCase() === 'essay' ? q.essayAnswer : null,
        isCorrect: q.isCorrect,
        scoreAwarded: q.scoreAwarded ?? null,
        lecturerFeedback: q.lecturerFeedback ?? null,
        isGraded: q.isGraded,
      })));
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Error loading quiz attempt</h1>
        <p className="text-muted-foreground">{error || 'Quiz attempt not found'}</p>
        <Link href={`/lecturer/quizzes/${quizId}/results`}>
          <Button variant="outline">Back to results</Button>
        </Link>
      </div>
    );
  }

  const currentAnswer = currentQ ? editAnswers[currentIndex] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/lecturer/quizzes/${quizId}/results`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Results
            </Link>
            <span className="text-muted-foreground">|</span>
            <div>
              <h1 className="font-semibold">{detail.studentName}</h1>
              <p className="text-xs text-muted-foreground">{detail.quizTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ScoreBadge score={detail.score} />
            {!editMode ? (
              <Button onClick={() => setEditMode(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit Score
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Image + Question Info */}
          <div className="lg:col-span-7 space-y-3">
            {/* Question Navigation */}
            <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
              <button
                type="button"
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  Q{currentIndex + 1}/{totalQ}
                </span>
                {isEssay && (
                  <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 font-semibold">
                    Essay
                  </span>
                )}
                {currentAnswer?.isCorrect === true && <CheckCircle className="h-4 w-4 text-success" />}
                {currentAnswer?.isCorrect === false && <XCircle className="h-4 w-4 text-destructive" />}
                {currentAnswer?.isCorrect === null && <Clock className="h-4 w-4 text-muted-foreground" />}
              </div>
              <button
                type="button"
                onClick={() => setCurrentIndex(i => Math.min(totalQ - 1, i + 1))}
                disabled={currentIndex === totalQ - 1}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {/* Question Text */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-1">Question {currentIndex + 1}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{currentQ?.questionText}</p>
            </div>

            {/* Image Viewer */}
            {currentQ?.imageUrl ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground">Case Image</span>
                    <button
                      type="button"
                      onClick={() => setShowEnhancePanel(!showEnhancePanel)}
                      className={`p-1 rounded transition-colors ${showEnhancePanel ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                      title="Image Enhancement"
                    >
                      <Droplet className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setZoomIndex(i => Math.max(0, i - 1))}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Zoom out"
                    >
                      <ZoomOut className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] w-10 text-center">{ZOOM_LEVELS[zoomIndex]}x</span>
                    <button
                      type="button"
                      onClick={() => setZoomIndex(i => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Zoom in"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImgFullscreen(true)}
                      className="p-1 rounded hover:bg-muted transition-colors ml-1"
                      title="Fullscreen"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Image Enhancement Panel */}
                {showEnhancePanel && (
                  <div className="px-3 py-2 bg-muted/30 border-b border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground">Image Enhancement</span>
                      <button
                        type="button"
                        onClick={() => setEnhancement(DEFAULT_ENHANCEMENT)}
                        className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Reset"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Brightness */}
                      <div className="flex items-center gap-1.5">
                        <Sun className="h-3 w-3 text-muted-foreground shrink-0" />
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={enhancement.brightness}
                          onChange={(e) => setEnhancement(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                          className="flex-1 h-1 accent-primary"
                        />
                        <span className="text-[9px] text-muted-foreground w-6 text-right">{enhancement.brightness.toFixed(1)}</span>
                      </div>
                      {/* Contrast */}
                      <div className="flex items-center gap-1.5">
                        <Contrast className="h-3 w-3 text-muted-foreground shrink-0" />
                        <input
                          type="range"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={enhancement.contrast}
                          onChange={(e) => setEnhancement(prev => ({ ...prev, contrast: Number(e.target.value) }))}
                          className="flex-1 h-1 accent-primary"
                        />
                        <span className="text-[9px] text-muted-foreground w-6 text-right">{enhancement.contrast.toFixed(1)}</span>
                      </div>
                    </div>
                    {/* Toggle buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEnhancement(prev => ({ ...prev, invert: !prev.invert }))}
                        className={`flex-1 py-1 px-2 rounded text-[10px] font-medium transition-colors ${
                          enhancement.invert
                            ? 'bg-primary text-white'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        Invert
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnhancement(prev => ({ ...prev, grayscale: !prev.grayscale }))}
                        className={`flex-1 py-1 px-2 rounded text-[10px] font-medium transition-colors ${
                          enhancement.grayscale
                            ? 'bg-primary text-white'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        Gray
                      </button>
                      {/* Quick presets for X-ray */}
                      <button
                        type="button"
                        onClick={() => setEnhancement({ brightness: 1.5, contrast: 2, invert: true, grayscale: false })}
                        className="flex-1 py-1 px-2 rounded text-[10px] font-medium bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 transition-colors"
                        title="Best for X-ray: Light background, dark bones"
                      >
                        X-ray
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveApiAssetUrl(currentQ.imageUrl)}
                    alt={`Question ${currentIndex + 1}`}
                    className="w-full h-auto max-h-[400px] object-contain mx-auto transition-all"
                    style={{ ...getImageStyle(enhancement), transform: `scale(${ZOOM_LEVELS[zoomIndex]})` }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">No image for this question</p>
              </div>
            )}

            {/* MCQ Options */}
            {!isEssay && currentQ && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="text-xs font-semibold mb-3">Answer Options</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'A', value: currentQ.optionA },
                    { key: 'B', value: currentQ.optionB },
                    { key: 'C', value: currentQ.optionC },
                    { key: 'D', value: currentQ.optionD },
                  ].map(opt => {
                    const isCorrect = opt.key === currentQ.correctAnswer;
                    const isStudent = opt.key === currentAnswer?.studentAnswer;
                    let cls = 'flex items-center gap-2 p-3 rounded-lg border-2 text-xs transition-all';
                    if (isCorrect && isStudent) {
                      cls += ' border-success bg-success/10 font-medium';
                    } else if (isCorrect) {
                      cls += ' border-success/50 bg-success/5';
                    } else if (isStudent) {
                      cls += ' border-destructive bg-destructive/10';
                    } else {
                      cls += ' border-border bg-muted/30';
                    }
                    return (
                      <div key={opt.key} className={cls}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-bold ${
                          isCorrect ? 'bg-success text-white' : isStudent ? 'bg-destructive text-white' : 'bg-muted'
                        }`}>
                          {opt.key}
                        </span>
                        <span className="flex-1">{opt.value ?? '—'}</span>
                        {isCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                        {isStudent && !isCorrect && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Student Answer + Grading */}
          <div className="lg:col-span-5 space-y-3">
            {/* Student Answer Card */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="font-medium flex items-center gap-2 text-sm">
                  <Eye className="h-3.5 w-3.5" />
                  Student's Answer
                </h3>
              </div>
              <div className="p-3">
                {isEssay ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 mb-1">
                        Essay Response
                      </h5>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed">
                        {currentAnswer?.essayAnswer || '(No answer submitted)'}
                      </p>
                    </div>
                    {currentQ?.referenceAnswer && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                          Reference / Model Answer
                        </h5>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {currentQ.referenceAnswer}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                      currentAnswer?.isCorrect === true ? 'bg-success/10' :
                      currentAnswer?.isCorrect === false ? 'bg-destructive/10' : 'bg-muted'
                    }`}>
                      {currentAnswer?.isCorrect === true ? (
                        <CheckCircle2 className="h-6 w-6 text-success" />
                      ) : currentAnswer?.isCorrect === false ? (
                        <XCircle className="h-6 w-6 text-destructive" />
                      ) : (
                        <Clock className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm">
                      {currentAnswer?.studentAnswer ? (
                        <>Answer: <span className="font-bold">{currentAnswer.studentAnswer}</span></>
                      ) : (
                        '(No answer)'
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {currentAnswer?.isCorrect === true ? 'Correct!' :
                       currentAnswer?.isCorrect === false ? 'Incorrect' : 'Not graded'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Grading Card */}
            {editMode && currentAnswer && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-primary">
                    <Award className="h-3.5 w-3.5" />
                    Grading (Q{currentIndex + 1})
                  </h3>
                </div>
                <div className="p-3 space-y-3">
                  {/* Correctness Toggle */}
                  {!isEssay && (
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1.5">Mark as:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateAnswer(currentIndex, { isCorrect: true, scoreAwarded: pointsPerQuestion, isGraded: true });
                          }}
                          className={`flex-1 py-2 rounded-md border-2 font-medium text-xs transition-all ${
                            currentAnswer.isCorrect === true
                              ? 'border-success bg-success/10 text-success'
                              : 'border-border hover:border-success/50'
                          }`}
                        >
                          Correct
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAnswer(currentIndex, { isCorrect: false, scoreAwarded: 0, isGraded: true })}
                          className={`flex-1 py-2 rounded-md border-2 font-medium text-xs transition-all ${
                            currentAnswer.isCorrect === false
                              ? 'border-destructive bg-destructive/10 text-destructive'
                              : 'border-border hover:border-destructive/50'
                          }`}
                        >
                          Incorrect
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual Score Input */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                      Points (max: {pointsPerQuestion.toFixed(1)})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={pointsPerQuestion}
                      value={currentAnswer.scoreAwarded ?? ''}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        let val = rawVal ? Number(rawVal) : null;
                        // Clamp to valid range
                        if (val !== null) {
                          val = Math.max(0, Math.min(val, pointsPerQuestion));
                        }
                        updateAnswer(currentIndex, { 
                          scoreAwarded: val,
                          isGraded: val !== null
                        });
                      }}
                      className="w-full h-9 rounded-md border border-border px-3 text-center font-medium text-sm"
                    />
                  </div>

                  {/* Feedback */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Feedback (optional)</label>
                    <textarea
                      value={currentAnswer.lecturerFeedback ?? ''}
                      onChange={(e) => updateAnswer(currentIndex, { lecturerFeedback: e.target.value || null })}
                      placeholder="Add feedback..."
                      className="w-full rounded-md border border-border px-2.5 py-1.5 text-xs resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Quick Grade Buttons for Essay */}
                  {isEssay && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-2">Quick grade:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateAnswer(currentIndex, { scoreAwarded: pointsPerQuestion, isGraded: true })}
                          className="flex-1 py-2 rounded-lg border border-success/50 bg-success/5 text-success text-sm font-medium hover:bg-success/10 transition-colors"
                        >
                          Full marks
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAnswer(currentIndex, { scoreAwarded: Math.floor(pointsPerQuestion / 2), isGraded: true })}
                          className="flex-1 py-2 rounded-lg border border-warning/50 bg-warning/5 text-warning text-sm font-medium hover:bg-warning/10 transition-colors"
                        >
                          Half
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAnswer(currentIndex, { scoreAwarded: 0, isGraded: true })}
                          className="flex-1 py-2 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
                        >
                          Zero
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Question Navigation - Compact horizontal bar */}
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  All Questions ({totalQ})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <span className="text-success">{editAnswers.filter(a => a.isCorrect === true).length}</span> ·{' '}
                  <span className="text-destructive">{editAnswers.filter(a => a.isCorrect === false).length}</span> ·{' '}
                  <span className="text-amber-500">{editAnswers.filter(a => a.isCorrect === null).length}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {detail.questions.map((q, i) => {
                  const ans = editAnswers[i];
                  const isEssayQ = q.type?.toLowerCase() === 'essay';
                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => setCurrentIndex(i)}
                      className={`relative flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold transition-all ${
                        i === currentIndex 
                          ? 'border-2 border-primary bg-primary/15 text-primary' 
                          : editAnswers[i]?.isCorrect === true
                            ? 'bg-success/15 text-success border border-success/30'
                            : editAnswers[i]?.isCorrect === false
                              ? 'bg-destructive/15 text-destructive border border-destructive/30'
                              : editAnswers[i]?.isCorrect === null
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                                : 'bg-muted/50 text-muted-foreground border border-border hover:border-primary/30'
                      }`}
                    >
                      {i + 1}
                      {isEssayQ && (
                        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p className="font-medium">{formatDate(detail.startedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium">{formatDate(detail.completedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Passing Score</p>
                  <p className="font-medium">{detail.passingScore ?? 0}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className={`font-medium ${detail.score !== null && detail.score >= (detail.passingScore ?? 0) ? 'text-success' : 'text-warning'}`}>
                    {detail.score !== null && detail.score >= (detail.passingScore ?? 0) ? 'Passed' : 'Not Passed'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {imgFullscreen && currentQ?.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setImgFullscreen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors z-10"
            onClick={() => setImgFullscreen(false)}
          >
            <XCircle className="h-8 w-8" />
          </button>
          {/* Quick enhancement controls in fullscreen */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            <button
              type="button"
              onClick={() => setEnhancement(prev => ({ ...prev, invert: !prev.invert }))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                enhancement.invert ? 'bg-primary text-white' : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              Invert
            </button>
            <button
              type="button"
              onClick={() => setEnhancement({ brightness: 1.5, contrast: 2, invert: true, grayscale: false })}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/30 hover:bg-blue-500/50 text-white transition-colors"
            >
              X-ray Mode
            </button>
            <button
              type="button"
              onClick={() => setEnhancement(DEFAULT_ENHANCEMENT)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              Reset
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveApiAssetUrl(currentQ.imageUrl)}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            style={getImageStyle(enhancement)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
