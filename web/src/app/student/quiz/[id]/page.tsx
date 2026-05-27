'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  Minus,
  BookOpen,
  PlayCircle,
  TrendingUp,
  AlertCircle,
  Timer,
  HelpCircle,
  UserRound,
  Contrast,
  Ruler,
  Mail,
  Hand,
  ChevronRight,
  Eye,
  Lightbulb,
  BookmarkPlus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAssignedQuizzes, startQuizSession, submitQuizSession, requestRetake, fetchQuizAttemptReview, saveQuizToFlashcards } from '@/lib/api/student';
import { resolveApiAssetUrl, getApiErrorMessage } from '@/lib/api/client';
import type { StudentQuizResultDto } from '@/lib/api/types';
import type { AssignedQuizItem, QuizSessionDto, StudentSubmitQuestionDto } from '@/lib/api/types';

interface QuizModeQuestion {
  questionId: string;
  questionText: string;
  type: string | null;
  typeLabel: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  caseId?: string | null;
  caseTitle?: string | null;
  imageUrl?: string | null;
  explanation?: string | null;
  correctAnswer?: string | null;
  essayAnswer?: string | null;
  hint?: string | null;
  hintAvailable?: boolean;
  correctAnswers?: string | null;
  acceptedAnswers?: string | null;
}

type AnswerState = 'unanswered' | 'correct' | 'incorrect';

const ZOOM_LEVELS = [1, 1.25, 1.5, 2, 2.5];

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

function getImageStyle(enhancement: ImageEnhancement, highContrast: boolean): React.CSSProperties {
  const filters = [
    `brightness(${enhancement.brightness})`,
    `contrast(${enhancement.contrast * (highContrast ? 1.25 : 1)})`,
    enhancement.invert ? 'invert(1)' : '',
    enhancement.grayscale ? 'grayscale(1)' : '',
  ].filter(Boolean);
  return { filter: filters.join(' ') };
}

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuizSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: quizId } = use(params);
  const toast = useToast();
  const searchParams = useSearchParams();
  const isRetakeRequested = searchParams.get('retake') === 'true';

  const [quizInfo, setQuizInfo] = useState<AssignedQuizItem | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [session, setSession] = useState<QuizSessionDto | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiSelectAnswers, setMultiSelectAnswers] = useState<Record<string, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [shownHints, setShownHints] = useState<Record<string, boolean>>({});
  const [answerStates, setAnswerStates] = useState<Record<string, AnswerState>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<StudentQuizResultDto | null>(null);
  const [hoveredQuestionIndex, setHoveredQuestionIndex] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState<{ correctAnswer: string }[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const [requestingRetake, setRequestingRetake] = useState(false);
  const [retakeSent, setRetakeSent] = useState(false);

  // Save to flashcards modal state
  const [showSaveFlashcardModal, setShowSaveFlashcardModal] = useState(false);
  const [savingToFlashcards, setSavingToFlashcards] = useState(false);
  const [savedFlashcardInfo, setSavedFlashcardInfo] = useState<{ deckId: string; deckName: string; cardCount: number } | null>(null);
  const [customDeckName, setCustomDeckName] = useState('');

  // Review pagination (5 questions per page)
  const [reviewPage, setReviewPage] = useState(1);
  const REVIEW_PAGE_SIZE = 5;

  // Helper function to get essay model answer from reviewData
  const getEssayModelAnswer = useCallback((questionId: string): string | null => {
    if (!reviewData || reviewData.length === 0) return null;
    const question = reviewData.find((q) => (q as unknown as { questionId: string }).questionId === questionId);
    return question?.correctAnswer ?? null;
  }, [reviewData]);

  const [zoomIndex, setZoomIndex] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [highContrastImg, setHighContrastImg] = useState(false);
  const [straightenActive, setStraightenActive] = useState(false);
  const [enhancement, setEnhancement] = useState<ImageEnhancement>(DEFAULT_ENHANCEMENT);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const timeUpAutoSubmitTriggered = useRef(false);
  const retakeRequestedRef = useRef(false);

  // Tải lại thông tin quiz từ server để lấy trạng thái cập nhật (isCompleted, score)
  const reloadQuizInfo = useCallback(async () => {
    try {
      const list = await getAssignedQuizzes();
      const found = list.find((q) => q.quizId === quizId);
      setQuizInfo(found ?? null);
    } catch {
      setQuizInfo(null);
    }
  }, [quizId]);

  useEffect(() => {
    (async () => {
      setLoadingInfo(true);
      try {
        const list = await getAssignedQuizzes();
        const found = list.find((q) => q.quizId === quizId);
        setQuizInfo(found ?? null);
      } catch {
        setQuizInfo(null);
      } finally {
        setLoadingInfo(false);
      }
    })();
  }, [quizId]);

  // Tải lại thông tin quiz sau khi nộp để cập nhật trạng thái isCompleted/score
  useEffect(() => {
    if (submitted) {
      void reloadQuizInfo();
    }
  }, [submitted, reloadQuizInfo]);

  // Auto-reveal feedback after submit: populate answerStates and show feedback
  useEffect(() => {
    if (!submitted || !session) return;
    // Build answer states based on session's correctAnswer (Practice Mode)
    const newStates: Record<string, AnswerState> = {};
    session.questions.forEach((q) => {
      const correctAnswer = q.correctAnswer;
      const selected = answers[q.questionId];
      if (correctAnswer) {
        newStates[q.questionId] = selected === correctAnswer ? 'correct' : 'incorrect';
      }
    });
    setAnswerStates(newStates);
    setShowFeedback(true);
    setReviewPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  // Xử lý yêu cầu làm lại quiz từ tham số URL
  useEffect(() => {
    if (isRetakeRequested && quizInfo?.isCompleted && !retakeRequestedRef.current) {
      retakeRequestedRef.current = true;
      void handleRetakeAndStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRetakeRequested, quizInfo]);

  const questions: QuizModeQuestion[] = (session?.questions ?? []).map(q => {
    const typeLower = (q.type ?? '').toLowerCase();
    const typeLabel =
      typeLower.includes('multiple')
        ? 'Multiple choice'
        : typeLower === 'truefalse' || typeLower === 'true/false'
          ? 'True / False'
          : typeLower === 'multiselect' || typeLower === 'multi-select'
            ? 'Multi-Select'
            : typeLower === 'fillinblank' || typeLower === 'fill-in-blank'
              ? 'Fill in Blank'
              : typeLower === 'essay'
                ? 'Essay'
                : (q.type ?? 'Diagnostic analysis');
    return {
      questionId: q.questionId,
      questionText: q.questionText,
      type: q.type ?? null,
      typeLabel,
      optionA: q.optionA ?? null,
      optionB: q.optionB ?? null,
      optionC: q.optionC ?? null,
      optionD: q.optionD ?? null,
      caseId: q.caseId ?? null,
      caseTitle: q.caseTitle ?? null,
      imageUrl: q.imageUrl ?? null,
      explanation: (q as any).explanation ?? null,
      correctAnswer: q.correctAnswer ?? null,
      essayAnswer: q.essayAnswer ?? null,
      hint: (q as any).hint ?? null,
      hintAvailable: (q as any).hintAvailable ?? false,
      correctAnswers: (q as any).correctAnswers ?? null,
      acceptedAnswers: (q as any).acceptedAnswers ?? null,
    };
  });
  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  // ================================================================
  // ĐẾM SỐ CÂU HỎI ĐÃ TRẢ LỜI
  // ================================================================
  // Logic đếm khác nhau theo loại câu hỏi:
  // - Multi-select: đếm nếu có ít nhất 1 đáp án được chọn
  // - Essay: KHÔNG đếm trong answeredCount (cần lecturer chấm)
  // - Các loại khác (MCQ, True/False, Fill-in-blank): đếm nếu có đáp án
  //
  // LƯU Ý: answeredCount dùng để:
  // 1. Hiển thị tiến độ "X/Y answered"
  // 2. Kiểm tra canSubmit (phải trả lời ít nhất 1 câu)
  // 3. KHÔNG ảnh hưởng đến tính điểm (điểm do backend tính)
  // ================================================================
  const answeredCount = (() => {
    let count = 0;
    for (const q of session?.questions ?? []) {
      const qType = q.type?.toLowerCase();
      if (qType === 'multiselect' || qType === 'multi-select') {
        // Multi-select: count question as answered if at least 1 option selected
        const selected = multiSelectAnswers[q.questionId];
        if (selected && selected.length > 0) count++;
      } else if (qType !== 'essay') {
        // Other types: count if answer exists
        if (answers[q.questionId]) count++;
      }
    }
    return count;
  })();
  const positionPct = totalQ > 0 ? Math.round(((currentIndex + 1) / totalQ) * 100) : 0;
  const moduleLabel = session?.topic ?? quizInfo?.className ?? 'Clinical module';

  const rawTimeLimit = session?.timeLimit ?? quizInfo?.timeLimit;
  const timeLimitMinutes =
    rawTimeLimit != null && Number(rawTimeLimit) > 0 ? Math.round(Number(rawTimeLimit)) : null;

  // Thời gian đóng (ms) - null nếu không có thời gian đóng
  const sessionCloseTimeMs = session?.closeTime ? new Date(session.closeTime).getTime() : null;

  // Đếm ngược: luôn đếm từ timeLimit; được giới hạn bởi closeTime nên không bao giờ vượt quá thời gian còn lại trước khi quiz đóng
  const getSecondsRemaining = (): number | null => {
    if (submitted || timeLimitMinutes == null) return null;
    const timeLimitSeconds = timeLimitMinutes * 60;
    if (sessionCloseTimeMs != null) {
      const now = Date.now();
      const closeTimeSeconds = Math.max(0, Math.floor((sessionCloseTimeMs - now) / 1000));
      // Clamp: cannot exceed timeLimit, cannot go below 0
      return Math.min(timeLimitSeconds, closeTimeSeconds);
    }
    return timeLimitSeconds;
  };

  const timerDisplaySeconds =
    !submitted && timeLimitMinutes != null ? (secondsLeft ?? getSecondsRemaining()) : null;

  useEffect(() => {
    if (!session || submitted) {
      setSecondsLeft(null);
      return;
    }
    if (timeLimitMinutes == null) {
      setSecondsLeft(null);
      return;
    }
    const initialSeconds = getSecondsRemaining() ?? timeLimitMinutes * 60;
    setSecondsLeft(initialSeconds);
    timeUpAutoSubmitTriggered.current = false;
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s != null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
    // Chủ ý theo dõi session?.closeTime — closeTime có thể vắng mặt ở đầu nhưng xuất hiện giữa phiên
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.attemptId, timeLimitMinutes, submitted, session?.closeTime]);

  // Tự động nộp khi hết giờ: chạy khi timeLimit hoặc closeTime hết hạn
  useEffect(() => {
    if (secondsLeft !== 0) return;
    if (submitted || submitting || timeLimitMinutes == null || !session) return;
    if (timeUpAutoSubmitTriggered.current) return;
    timeUpAutoSubmitTriggered.current = true;
    void handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted, submitting, session?.closeTime]);

  // Reset pan/zoom khi chuyển câu hỏi
  useEffect(() => {
    setZoomIndex(0);
    setPanOffset({ x: 0, y: 0 });
    setStraightenActive(false);
    setHighContrastImg(false);
    setIsPanning(false);
  }, [currentIndex]);

  // ================================================================
  // HÀM SUBMIT QUIZ - XỬ LÝ NỘP BÀI VÀ NHẬN KẾT QUẢ
  // ================================================================
  // 1. Build payload: chuẩn bị data từng câu hỏi và đáp án student
  // 2. Gọi API submitQuizSession()
  // 3. Nhận về quizResult chứa:
  //    - score: điểm phần trăm (0-100)
  //    - passed: true/false
  //    - correctAnswers: số câu đúng
  //    - totalQuestions: tổng câu hỏi
  //    - passingScore: ngưỡng pass
  //    - ungradedEssayCount: số essay chưa chấm
  // ================================================================
  const handleSubmit = useCallback(async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      // Build payload with proper essayAnswer field for Essay-type questions
      const payload: StudentSubmitQuestionDto[] = session.questions.map((q) => {
        const answer = answers[q.questionId] || '';
        const isEssay = q.type?.toLowerCase() === 'essay';
        const isMultiSelect = q.type?.toLowerCase() === 'multiselect' || q.type?.toLowerCase() === 'multi-select';
        return {
          questionId: q.questionId,
          studentAnswer: isEssay ? '' : answer,
          essayAnswer: isEssay ? answer : undefined,
          selectedAnswers: isMultiSelect ? JSON.stringify(multiSelectAnswers[q.questionId] || []) : undefined,
        };
      });
      const result = await submitQuizSession(session.attemptId, payload);
      setQuizResult(result);
      setSubmitted(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to submit: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [session, answers, multiSelectAnswers, toast]);

  const handleStart = async () => {
    setLoadingSession(true);
    setStartError(null);
    try {
      const data = await startQuizSession(quizId);
      setSession(data);
      if (!data.questions || data.questions.length === 0) {
        toast.error('This quiz has no questions. Please contact your lecturer.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('already submitted') ||
        msg.includes('cannot retake') ||
        msg.includes('submitted') ||
        msg.includes('retake denied') ||
        msg.includes('retake') ||
        msg.includes('not open') ||
        msg.includes('open time') ||
        msg.includes('closed')
      ) {
        setStartError(msg);
      } else {
        toast.error(`Cannot start quiz: ${msg}`);
      }
    } finally {
      setLoadingSession(false);
    }
  };

  const handleRetakeAndStart = async () => {
    setRequestingRetake(true);
    try {
      await requestRetake(quizId);
      setRetakeSent(true);
      toast.success('Retake request sent! Starting quiz...');
      await new Promise(resolve => setTimeout(resolve, 500));
      await handleStart();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setRequestingRetake(false);
    }
  };

  const handleSelect = (option: string) => {
    if (submitted || showFeedback) return;
    setAnswers((prev) => ({ ...prev, [currentQ.questionId]: option }));
  };

  const handleNext = () => {
    if (currentIndex < totalQ - 1) {
      setCurrentIndex((i) => i + 1);
      setShowFeedback(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setShowFeedback(false);
    }
  };

  const handleReveal = () => {
    if (!currentQ.correctAnswer) return;
    const selected = answers[currentQ.questionId];
    setAnswerStates((prev) => ({
      ...prev,
      [currentQ.questionId]:
        selected === currentQ.correctAnswer ? 'correct' : 'incorrect',
    }));
    setShowFeedback(true);
  };

  const currentAnswer = currentQ ? answers[currentQ.questionId] : null;
  const currentState = currentQ ? (answerStates[currentQ.questionId] ?? 'unanswered') : 'unanswered';
  const allAnswered = answeredCount === totalQ;

  const canSubmit = !submitting && !submitted;

  if (loadingInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quizInfo && !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Quiz not found</h1>
        <p className="text-muted-foreground">This quiz may no longer be available.</p>
        <Link href="/student/quizzes">
          <Button>Back to quizzes</Button>
        </Link>
      </div>
    );
  }

  // Màn hình trước khi bắt đầu
  if (!session) {
    if (startError) {
      const retakeHint =
        /retake|submitted|submission/i.test(startError) ||
        startError.toLowerCase().includes('lecturer');
      const notOpenHint = startError.includes('not open') || startError.includes('open time');
      const closedHint = startError.includes('closed');
      return (
        <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-destructive/30 bg-surface-container-low p-8 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="font-headline text-lg font-bold text-on-surface">
                {notOpenHint ? 'Quiz not yet open' : closedHint ? 'Quiz closed' : retakeHint ? 'Quiz already submitted' : 'Cannot start quiz'}
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                {notOpenHint ? 'Quiz will open automatically at the scheduled time.' : closedHint ? 'Quiz time has expired.' : retakeHint ? 'Retake has not been enabled yet' : 'Unable to open this quiz'}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3 text-left">
              <p className="text-sm leading-relaxed text-on-surface break-words">{startError}</p>
            </div>
            {(notOpenHint || closedHint) && (
              <Link href="/student/quizzes" className="w-full">
                <Button variant="outline" className="w-full mt-2 h-11 rounded-xl font-bold">
                  Back to quiz list
                </Button>
              </Link>
            )}
            {retakeHint ? (
              <>
                {retakeSent ? (
                  <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-success">Request sent!</p>
                      <p className="text-xs text-on-surface-variant">
                        Your lecturer has been notified. You can retake the quiz once retake is enabled.
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (retakeRequestedRef.current) return;
                      retakeRequestedRef.current = true;
                      setRequestingRetake(true);
                      try {
                        await requestRetake(quizId);
                        setRetakeSent(true);
                        toast.success('Retake request sent to your lecturer.');
                      } catch (e) {
                        toast.error(getApiErrorMessage(e));
                        retakeRequestedRef.current = false;
                      } finally {
                        setRequestingRetake(false);
                      }
                    }}
                    disabled={requestingRetake}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {requestingRetake ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {requestingRetake ? 'Sending…' : 'Request retake'}
                  </button>
                )}
              </>
            ) : null}
            <Link href="/student/quizzes">
              <Button variant="outline" className="h-11 w-full rounded-xl font-bold">
                Back to quiz list
              </Button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-10 text-center shadow-lg shadow-primary/5">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container text-white shadow-md shadow-primary/25">
            <PlayCircle className="h-8 w-8" />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Assigned assessment</p>
            <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
              {quizInfo?.quizName ?? 'Clinical Quiz'}
            </h1>
            {quizInfo?.className && (
              <p className="mt-2 text-sm text-on-surface-variant">{quizInfo.className}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-lowest/80 p-4">
            <div className="text-center">
              <p className="text-2xl font-black text-on-surface">{quizInfo?.totalQuestions ?? '���'}</p>
              <p className="text-xs font-medium text-on-surface-variant">Questions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-on-surface">
                {quizInfo?.timeLimit != null ? `${quizInfo.timeLimit} min` : '—'}
              </p>
              <p className="text-xs font-medium text-on-surface-variant">Time limit</p>
            </div>
          </div>

          {/* ================================================================
              MÀN HÌNH PRE-START: HIỂN THỊ ĐIỂM SỐ CỦA QUIZ ĐÃ HOÀN THÀNH
              ================================================================
              Khi quiz đã được nộp (isCompleted = true):
              - Lấy điểm từ quizInfo.score (đã được tính ở backend)
              - Format: hiển thị dạng phần trăm với 1 chữ số thập phân
              - Nếu score = null (chưa có điểm): hiển thị '—'
              
              LƯU Ý QUAN TRỌNG VỀ CÁCH TÍNH ĐIỂM:
              - Backend tính điểm: total quiz score = 100
              - Chia đều cho tất cả câu hỏi
              - Ví dụ: 4 câu hỏi, mỗi câu = 25 điểm
              - Điểm hiển thị ở đây là PERCENTAGE (0-100%)
              ================================================================ */}
          {quizInfo?.isCompleted ? (
            <div className="space-y-4">
              {/* Score Badge - Hiển thị điểm phần trăm */}
              <div className="flex items-center justify-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-6 py-4">
                <div className="text-center">
                  {/* 
                    quizInfo.score: số thập phân từ 0-100
                    Ví dụ: 85.5 nghĩa là 85.5%
                    toFixed(1): làm tròn 1 chữ số thập phân
                  */}
                  <p className="text-4xl font-black text-primary">
                    {quizInfo.score != null ? quizInfo.score.toFixed(1) : '—'}%
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">Your Score</p>
                </div>
              </div>
              {/* Nếu đáp án đã được công bố - cho phép xem lại đáp án */}
              {/* Action Buttons Row - Chỉ hiện khi lecturer đã release đáp án */}
              {quizInfo?.answersReleased && (
                <div className="space-y-2">
                  {/* Link đến trang review chi tiết */}
                  <Link
                    href={`/student/quiz/${quizId}/review`}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#007BFF] hover:opacity-95 text-white px-4 py-3 text-sm font-bold transition-colors shadow-lg shadow-primary/20"
                  >
                    <Sparkles className="h-4 w-4" />
                    View Detailed Review
                  </Link>
                  {/* Nút Reveal Answers - Chuyển đến trang review */}
                  <Link
                    href={`/student/quiz/${quizId}/review`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 text-sm font-semibold transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    Reveal Answers
                  </Link>
                </div>
              )}

              {/* Request Retake */}
              {retakeSent ? (
                <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  <p className="text-sm font-semibold text-success">Retake request sent!</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (retakeRequestedRef.current) return;
                    retakeRequestedRef.current = true;
                    setRequestingRetake(true);
                    try {
                      await requestRetake(quizId);
                      setRetakeSent(true);
                      toast.success('Retake request sent to your lecturer.');
                    } catch (e) {
                      toast.error(getApiErrorMessage(e));
                      retakeRequestedRef.current = false;
                      setRequestingRetake(false);
                    }
                  }}
                  disabled={requestingRetake}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 text-sm font-medium text-on-surface-variant transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {requestingRetake ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {requestingRetake ? 'Sending…' : 'Request Retake'}
                </button>
              )}

              <Link href="/student/quizzes">
                <Button variant="outline" className="h-10 w-full rounded-xl font-medium">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Quizzes
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                The live session timer starts when you begin. Use a stable connection and a quiet space.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => void handleStart()}
                  disabled={loadingSession}
                  className="h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container text-base font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loadingSession ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Preparing…
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-5 w-5" />
                      Begin assessment
                    </>
                  )}
                </Button>
                <Link href="/student/quizzes">
                  <Button variant="outline" className="h-12 w-full rounded-xl border-outline-variant/30 font-bold">
                    <ArrowLeft className="h-4 w-4" />
                    Back to quizzes
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Chế độ Quiz: không có câu hỏi
  if (!currentQ || totalQ === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-on-surface-variant">This quiz has no questions.</p>
        <Link href="/student/quizzes">
          <Button variant="outline">Back to quizzes</Button>
        </Link>
      </div>
    );
  }

  const isTrueFalse =
    currentQ.type?.toLowerCase() === 'truefalse' || currentQ.type?.toLowerCase() === 'true/false';

  const questionTag =
    currentQ.type && currentQ.type.toLowerCase().includes('multiple')
      ? 'Multiple choice'
      : currentQ.type || 'Diagnostic analysis';

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/20 bg-slate-50/95 px-4 py-4 backdrop-blur-md sm:px-8 sm:py-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-headline text-lg font-extrabold tracking-tight text-primary sm:text-xl">
                BoneVisQA
              </h1>
              <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container sm:text-xs">
                AI PRACTICE
              </span>
            </div>
            <p className="truncate text-xs font-medium text-on-surface-variant sm:text-sm">
              {quizInfo?.quizName ?? session.title}
            </p>
          </div>
          {!submitted && (
            <div className="hidden items-center rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 sm:flex">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-primary">Live session</span>
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          {!submitted && (
            <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">quiz</span>
                <span className="text-sm font-bold text-on-surface">
                  {currentIndex + 1} <span className="text-on-surface-variant">/</span> {totalQ}
                </span>
              </div>
              <div className="h-6 w-px bg-outline-variant/30" />
              <span className="text-xs text-on-surface-variant">
                {answeredCount} <span className="font-semibold text-primary">answered</span>
              </span>
            </div>
          )}
          {!submitted && timeLimitMinutes != null ? (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-headline text-sm font-bold tabular-nums sm:px-4 ${
                timerDisplaySeconds === 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-primary'
              }`}
              title="Time remaining"
            >
              <Timer className="h-4 w-4 shrink-0" />
              {formatMmSs(timerDisplaySeconds ?? 0)}
            </div>
          ) : !submitted ? (
            <div
              className="flex max-w-[9rem] items-center gap-1.5 rounded-lg border border-outline-variant/25 bg-surface-container-low px-2 py-1.5 text-[10px] font-semibold leading-tight text-on-surface-variant sm:max-w-none sm:gap-2 sm:px-3 sm:text-xs"
              title="Quiz has no time limit"
            >
              <Timer className="h-3.5 w-3.5 shrink-0 opacity-70 sm:h-4 sm:w-4" />
              No time limit
            </div>
          ) : null}
          <button
            type="button"
            className="hidden rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high sm:block"
            title="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <div
            className="hidden h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-primary-container/15 sm:flex"
            title="Profile"
          >
            <UserRound className="h-5 w-5 text-primary" />
          </div>
          <Link
            href="/student/quizzes"
            className="flex items-center gap-2 rounded-xl border border-outline-variant/30 px-3 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-8 lg:mb-10">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="mb-1 text-sm font-semibold text-on-surface-variant">Module: {moduleLabel}</p>
              <h2 className="font-headline text-xl font-extrabold text-on-surface sm:text-2xl">
                Question {currentIndex + 1} of {totalQ}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-primary">{positionPct}%</span>
              <span className="ml-1 text-xs font-medium text-on-surface-variant">Complete</span>
              <p className="text-[11px] text-on-surface-variant">{answeredCount}/{totalQ} answered</p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-300"
              style={{ width: `${positionPct}%` }}
            />
          </div>
        </div>

        {!submitted && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-primary px-2.5 py-1 font-headline text-sm font-extrabold text-white">
                Q{currentIndex + 1} / {totalQ}
              </span>
              <span className="hidden text-sm text-on-surface-variant sm:inline">
                Question {currentIndex + 1} of {totalQ}
              </span>
            </div>
            {timeLimitMinutes != null ? (
              <div
                className={`flex items-center gap-2 font-headline text-base font-bold tabular-nums sm:text-lg ${
                  timerDisplaySeconds === 0 ? 'text-destructive' : 'text-primary'
                }`}
              >
                <Timer className="h-5 w-5 shrink-0" />
                {formatMmSs(timerDisplaySeconds ?? 0)}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                <Timer className="h-4 w-4 shrink-0" />
                No time limit
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="lg:sticky lg:top-28 space-y-6">
              <div className="group relative w-full min-h-[52vh] overflow-visible rounded-2xl bg-inverse-surface shadow-lg md:min-h-[58vh] lg:min-h-[60vh]">
                {/* Image wrapper with transform capabilities */}
                <div
                  className="relative flex h-full w-full items-center justify-center overflow-auto p-2 sm:p-4"
                  style={{
                    maxHeight: 'calc(100vh - 16rem)',
                  }}
                >
                  {/* Transform container - transform applied here to allow zoom without cropping */}
                  <div
                    className={`relative transition-transform duration-300 ease-out ${isPanning && zoomIndex > 0 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${ZOOM_LEVELS[zoomIndex]}) ${straightenActive ? 'rotate(-1deg)' : ''}`,
                      transformOrigin: 'center center',
                      cursor: isPanning && zoomIndex > 0 ? 'grab' : 'default',
                    }}
                    onMouseDown={(e) => {
                      if (!isPanning || zoomIndex === 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                      dragStart.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };
                    }}
                    onMouseMove={(e) => {
                      if (!isDragging || zoomIndex === 0) return;
                      setPanOffset({
                        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
                        y: dragStart.current.panY + (e.clientY - dragStart.current.y),
                      });
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                  >
                    {currentQ.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveApiAssetUrl(currentQ.imageUrl)}
                        alt={currentQ.caseTitle ?? 'Case image'}
                        className="max-h-[70vh] w-full max-w-full object-contain opacity-95 transition-all duration-300 group-hover:opacity-100"
                        style={{ maxHeight: '70vh', ...getImageStyle(enhancement, highContrastImg) }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-6">
                        <div className="text-center">
                          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                            <BookOpen className="h-8 w-8 text-white/60" />
                          </div>
                          <p className="font-medium text-white/60">No image attached</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-surface-container-lowest/80 p-2 shadow-2xl backdrop-blur-xl z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="rounded-full p-2 text-on-surface transition-colors hover:bg-surface-container-high"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newIndex = Math.max(zoomIndex - 1, 0);
                      setZoomIndex(newIndex);
                      if (newIndex === 0) setPanOffset({ x: 0, y: 0 });
                    }}
                    className="rounded-full p-2 text-on-surface transition-colors hover:bg-surface-container-high"
                    title="Zoom out"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <div className="mx-1 h-6 w-px bg-outline-variant/30" />
                  <button
                    type="button"
                    onClick={() => setIsPanning((v) => !v)}
                    className={`rounded-full p-2 transition-colors hover:bg-surface-container-high ${
                      isPanning ? 'bg-secondary/20 text-secondary' : 'text-on-surface'
                    }`}
                    title="Pan / Move image"
                  >
                    <Hand className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHighContrastImg((v) => !v)}
                    className={`rounded-full p-2 transition-colors hover:bg-surface-container-high ${
                      highContrastImg ? 'bg-secondary/20 text-secondary' : 'text-on-surface'
                    }`}
                    title="High Contrast"
                  >
                    <Contrast className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnhancement(prev => ({ ...prev, invert: !prev.invert }))}
                    className={`rounded-full p-2 transition-colors hover:bg-surface-container-high ${
                      enhancement.invert ? 'bg-secondary/20 text-secondary' : 'text-on-surface'
                    }`}
                    title="Invert Colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" stroke="none">
                      <circle cx="12" cy="12" r="10" fill="currentColor" />
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="rgba(0,0,0,0.6)" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnhancement({ brightness: 1.5, contrast: 2, invert: true, grayscale: false })}
                    className="rounded-full px-2 py-1 text-xs font-bold text-on-surface bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                    title="X-ray Mode: Light background with dark bones"
                  >
                    X
                  </button>
                  <button
                    type="button"
                    onClick={() => setStraightenActive((v) => !v)}
                    className={`rounded-full p-2 font-bold transition-colors hover:bg-surface-container-high ${
                      straightenActive ? 'bg-secondary/20 text-secondary' : 'text-on-surface'
                    }`}
                    title="Straighten / align"
                  >
                    <Ruler className="h-5 w-5" />
                  </button>
                  <div className="mx-1 h-6 w-px bg-outline-variant/30" />
                  <button
                    type="button"
                    onClick={() => {
                      setZoomIndex(0);
                      setPanOffset({ x: 0, y: 0 });
                      setStraightenActive(false);
                      setEnhancement(DEFAULT_ENHANCEMENT);
                      setHighContrastImg(false);
                    }}
                    className="rounded-full px-2 py-1.5 font-headline text-xs font-bold text-on-surface hover:bg-surface-container-high"
                    title="Reset view"
                  >
                    {ZOOM_LEVELS[zoomIndex]}x
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentQ.caseId && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant">
                    <span className="font-bold text-on-surface">ID:</span> {currentQ.caseId.slice(0, 8)}
                  </span>
                )}
                {currentQ.caseTitle && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant">
                    <BookOpen className="h-4 w-4 shrink-0" />
                    {currentQ.caseTitle}
                  </span>
                )}
                {currentQ.type && (
                  <span className="inline-flex items-center rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900">
                    {currentQ.type}
                  </span>
                )}
                {currentQ.type?.toLowerCase() === 'truefalse' && (
                  <span className="inline-flex items-center rounded-xl bg-orange-100 px-4 py-2 text-xs font-bold text-orange-900">
                    True/False
                  </span>
                )}
                {currentQ.type?.toLowerCase() === 'multiselect' && (
                  <span className="inline-flex items-center rounded-xl bg-blue-100 px-4 py-2 text-xs font-bold text-blue-900">
                    Multi-Select
                  </span>
                )}
                {currentQ.type?.toLowerCase() === 'fillinblank' && (
                  <span className="inline-flex items-center rounded-xl bg-green-100 px-4 py-2 text-xs font-bold text-green-900">
                    Fill in Blank
                  </span>
                )}
              </div>

              {/* Hint Button */}
              {!submitted && currentQ.hintAvailable && currentQ.hint && !shownHints[currentQ.questionId] && (
                <button
                  type="button"
                  onClick={() => setShownHints(prev => ({ ...prev, [currentQ.questionId]: true }))}
                  className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100"
                >
                  <Lightbulb className="h-5 w-5" />
                  Show Hint
                </button>
              )}

              {/* Hint Display */}
              {!submitted && currentQ.hintAvailable && currentQ.hint && shownHints[currentQ.questionId] && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <span className="mb-1 block font-bold">Hint:</span>
                    {currentQ.hint}
                  </div>
                </div>
              )}

             
            </div>
          </div>

          <div className="flex flex-col gap-8 lg:col-span-5 lg:sticky lg:top-28 lg:h-fit">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-6 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-lg bg-primary px-2.5 py-1 font-headline text-xs font-extrabold text-white sm:text-sm">
                  Q{(hoveredQuestionIndex ?? currentIndex) + 1} / {totalQ}
                </span>
                {!(
                  (hoveredQuestionIndex !== null ? questions[hoveredQuestionIndex]?.type : currentQ.type)?.toLowerCase() === 'truefalse' ||
                  (hoveredQuestionIndex !== null ? questions[hoveredQuestionIndex]?.type : currentQ.type)?.toLowerCase() === 'true/false'
                ) && (
                  <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                    {hoveredQuestionIndex !== null ? questions[hoveredQuestionIndex]?.typeLabel : questionTag}
                  </span>
                )}
              </div>
              <p className="font-headline text-lg font-bold leading-snug text-on-surface sm:text-xl">
                {hoveredQuestionIndex !== null ? questions[hoveredQuestionIndex]?.questionText : currentQ.questionText}
              </p>
            </div>

            {/* True/False Options */}
            {(currentQ.type?.toLowerCase() === 'truefalse' || currentQ.type?.toLowerCase() === 'true/false') && (
              <div className="mt-6 flex gap-4">
                {(['True', 'False'] as const).map((opt) => {
                  const isSelected = currentAnswer === opt;
                  const isCorrect = currentQ.correctAnswer?.toLowerCase() === opt.toLowerCase();
                  let row = 'border-outline-variant/15 bg-surface-container-lowest hover:border-primary/30 hover:bg-primary/5';
                  if (currentState !== 'unanswered' && isCorrect) {
                    row = 'border-2 border-success/50 bg-success/10';
                  } else if (currentState === 'incorrect' && isSelected) {
                    row = 'border-2 border-destructive/50 bg-destructive/10';
                  } else if (isSelected && currentState === 'unanswered') {
                    row = 'border-2 border-primary bg-primary/10';
                  }
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelect(opt)}
                      className={`flex flex-1 items-center justify-center rounded-xl border-2 p-6 text-base font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${row}`}
                    >
                      {opt}
                      {currentState !== 'unanswered' && isCorrect && (
                        <CheckCircle2 className="ml-2 h-6 w-6 text-success" />
                      )}
                      {currentState === 'incorrect' && isSelected && (
                        <XCircle className="ml-2 h-6 w-6 text-destructive" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Multi-Select Options */}
            {(currentQ.type?.toLowerCase() === 'multiselect' || currentQ.type?.toLowerCase() === 'multi-select') && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-on-surface-variant">Select all that apply:</p>
                {(['A', 'B', 'C', 'D'] as const).map((key) => {
                  const optionValue = currentQ[`option${key}` as keyof typeof currentQ] as string | null;
                  if (!optionValue) return null;
                  const selectedAnswers = multiSelectAnswers[currentQ.questionId] || [];
                  const isSelected = selectedAnswers.includes(key);
                  // Parse correctAnswers from JSON string (stored as ["A","C"])
                  const correctAnswersArray: string[] = currentQ.correctAnswers ? JSON.parse(currentQ.correctAnswers) : [];
                  let row = 'border-outline-variant/15 bg-surface-container-lowest hover:border-primary/30 hover:bg-primary/5';
                  if (currentState !== 'unanswered' && correctAnswersArray.includes(key)) {
                    row = 'border-2 border-success/50 bg-success/10';
                  } else if (currentState !== 'unanswered' && isSelected && !correctAnswersArray.includes(key)) {
                    row = 'border-2 border-destructive/50 bg-destructive/10';
                  } else if (isSelected && currentState === 'unanswered') {
                    row = 'border-2 border-primary bg-primary/10';
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={submitted}
                      onClick={() => {
                        setMultiSelectAnswers(prev => {
                          const current = prev[currentQ.questionId] || [];
                          const newAnswers = isSelected
                            ? current.filter(k => k !== key)
                            : [...current, key];
                          return { ...prev, [currentQ.questionId]: newAnswers };
                        });
                        // Also update answers for counting
                        setAnswers(prev => ({ ...prev, [currentQ.questionId]: isSelected ? '' : key }));
                      }}
                      className={`group flex w-full items-center gap-3 rounded-xl border-2 p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${row}`}
                    >
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                        isSelected ? 'border-primary bg-primary' : 'border-outline-variant/30'
                      }`}>
                        {isSelected && (
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-sm font-bold text-on-surface-variant group-hover:bg-primary group-hover:text-white">
                        {key}
                      </span>
                      <span className="flex-1 font-semibold text-on-surface">{optionValue}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Fill-in-Blank Input */}
            {(currentQ.type?.toLowerCase() === 'fillinblank' || currentQ.type?.toLowerCase() === 'fill-in-blank') && (
              <div className="mt-6 space-y-3">
                <label className="block text-sm font-semibold text-on-surface">Type your answer:</label>
                <input
                  type="text"
                  value={textAnswers[currentQ.questionId] || ''}
                  onChange={(e) => {
                    setTextAnswers(prev => ({ ...prev, [currentQ.questionId]: e.target.value }));
                    setAnswers(prev => ({ ...prev, [currentQ.questionId]: e.target.value }));
                  }}
                  disabled={submitted}
                  className="w-full rounded-xl border-2 border-outline-variant/20 bg-surface-container-lowest px-4 py-4 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Enter your answer..."
                />
                {currentState !== 'unanswered' && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-on-surface">Accepted answers:</p>
                    <p className="text-sm text-on-surface-variant">
                      {currentQ.acceptedAnswers ? JSON.parse(currentQ.acceptedAnswers).join(', ') : 'N/A'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Default Multiple Choice Options */}
            {!['truefalse', 'true/false', 'multiselect', 'multi-select', 'fillinblank', 'fill-in-blank', 'essay'].includes(currentQ.type?.toLowerCase() || '') && (
              <div className="mt-6 space-y-4">
                {(
                  [
                    { key: 'A' as const, text: currentQ.optionA },
                    { key: 'B' as const, text: currentQ.optionB },
                    { key: 'C' as const, text: currentQ.optionC },
                    { key: 'D' as const, text: currentQ.optionD },
                  ] as const
                ).map(({ key, text }) => {
                  if (!text) return null;

                  const isSelected = currentAnswer === key;
                  const isCorrect = currentQ.correctAnswer === key;

                  let row = 'border-outline-variant/15 bg-surface-container-lowest hover:border-primary/30 hover:bg-primary/5';
                  let letter = 'bg-surface-container text-on-surface-variant group-hover:bg-primary group-hover:text-white';

                  if (currentState !== 'unanswered' && isCorrect) {
                    row = 'border-2 border-success/50 bg-success/10';
                    letter = 'bg-success text-white';
                  } else if (currentState === 'incorrect' && isSelected) {
                    row = 'border-2 border-destructive/50 bg-destructive/10';
                    letter = 'bg-destructive text-white';
                  } else if (isSelected && currentState === 'unanswered') {
                    row = 'border-2 border-primary bg-primary/10';
                    letter = 'bg-primary text-white';
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelect(key)}
                      className={`group flex w-full items-center rounded-xl border-2 p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${row}`}
                    >
                      <span
                        className={`mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${letter}`}
                      >
                        {key}
                      </span>
                      <span className="flex-1 font-semibold text-on-surface">
                        {text}
                      </span>
                      {currentState === 'unanswered' && isSelected && (
                        <CheckCircle2 className="ml-2 h-6 w-6 shrink-0 text-primary" />
                      )}
                      {currentState !== 'unanswered' && isCorrect && (
                        <CheckCircle2 className="ml-2 h-6 w-6 shrink-0 text-success" />
                      )}
                      {currentState === 'incorrect' && isSelected && !isCorrect && (
                        <XCircle className="ml-2 h-6 w-6 shrink-0 text-destructive" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Essay Answer Textarea - shown only for Essay type questions */}
            {currentQ.type?.toLowerCase() === 'essay' && (
              <div className="mt-6 space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-6">
                <label className="block text-xs font-bold uppercase tracking-widest text-primary">
                  Your Essay Response
                </label>
                <textarea
                  value={answers[currentQ.questionId] || ''}
                  onChange={(e) => handleSelect(e.target.value)}
                  disabled={submitted}
                  className="w-full resize-none rounded-xl border-2 border-outline-variant/20 bg-surface-container-lowest p-4 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  rows={8}
                  placeholder="Type your essay answer here... Be thorough and provide a comprehensive response."
                />
                <p className="text-xs text-on-surface-variant">
                  Your response will be submitted for evaluation.
                </p>
              </div>
            )}

            {!submitted && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-high py-4 font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={currentIndex >= totalQ - 1}
                    className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
                  >
                    Next
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (answeredCount === 0) {
                      toast.error('Please answer at least one question before submitting.');
                      return;
                    }
                    void handleSubmit();
                  }}
                  disabled={!canSubmit}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 py-4 font-bold shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
                    answeredCount > 0
                      ? 'border-primary/40 bg-gradient-to-br from-primary to-primary-container text-white shadow-primary/25'
                      : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Submitting…
                    </>
                  ) : answeredCount === totalQ ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Submit Quiz ({answeredCount}/{totalQ})
                    </>
                  ) : (
                    <>
                      <span className="h-5 w-5 rounded-full border-2 border-current text-xs font-bold">!</span>
                      Submit ({answeredCount}/{totalQ})
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ================================================================
                KẾT QUẢ SAU KHI SUBMIT - ĐÃ ẨN KHÔNG CHO STUDENT XEM ĐIỂM
                ================================================================
                YÊU CẦU: Không hiển thị điểm cho student sau khi submit
                
                TRẠNG THÁI HIỆN TẠI: ĐÃ ẨN (COMMENTED OUT)
                - Ẩn toàn bộ phần hiển thị score
                - Ẩn phần PASSED/FAILED
                - Ẩn phần thống kê đúng/sai
                
                NẾU CẦN BẬT LẠI: Bỏ comment block này
                ================================================================
            
            {submitted && quizResult && (
              <div className="space-y-6 rounded-2xl border border-primary/25 bg-primary/5 p-8">
                {/* ⚠️ Warning nếu có essay chưa chấm */}
                {(quizResult?.ungradedEssayCount ?? 0) > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-bold">Essay awaiting instructor grading</p>
                        <p className="mt-1 text-sm">
                          Your submission has {quizResult?.ungradedEssayCount} essay question(s) not yet graded.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hiển thị điểm - thang điểm 100 */}
                {/*
                <div className="flex flex-col items-center justify-center rounded-xl bg-surface p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Your Score</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className={`text-5xl font-black ${quizResult.passed ? 'text-success' : 'text-destructive'}`}>
                      {quizResult.score != null ? quizResult.score.toFixed(1) : '—'}
                    </span>
                    <span className="text-2xl font-bold text-on-surface-variant">/100</span>
                  </div>
                  <p className={`mt-2 rounded-full px-4 py-1 text-sm font-bold ${quizResult.passed ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {quizResult.passed ? '✓ PASSED' : '✗ NEEDS IMPROVEMENT'}
                  </p>
                  {quizResult.passingScore != null && (
                    <p className="mt-2 text-sm text-on-surface-variant">Passing: {quizResult.passingScore}%</p>
                  )}
                </div>
                */}

                {/* Success Message */}
                {/* <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 p-8 text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                  <h3 className="mb-2 font-headline text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    Quiz submitted successfully!
                  </h3>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/70">
                    Your quiz has been sent successfully. Score will be updated after the instructor grades.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {quizInfo?.answersReleased && !showFeedback && (
                    <Button
                      onClick={async () => {
                        if (quizInfo?.attemptId) {
                          try {
                            const review = await fetchQuizAttemptReview(quizInfo.attemptId);
                            review.questions.forEach((q) => {
                              const selected = answers[q.questionId];
                              setAnswerStates((prev) => ({
                                ...prev,
                                [q.questionId]: selected === q.correctAnswer ? 'correct' : 'incorrect',
                              }));
                              setSession((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  questions: prev.questions.map((sq) =>
                                    sq.questionId === q.questionId
                                      ? { ...sq, correctAnswer: q.correctAnswer ?? undefined }
                                      : sq
                                  ),
                                };
                              });
                            });
                            setShowFeedback(true);
                          } catch (err) {
                            toast.error('Failed to load answers. Please try again.');
                          }
                        }
                      }}
                      className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Reveal Answers
                    </Button>
                  )}

                  {/* <Link href="/student/quizzes">
                    <Button variant="outline" className="rounded-xl font-bold">Back to quizzes</Button>
                  </Link> */}
                </div>
              </div>
            </div>

            {/* ================================================================
                THÔNG BÁO SAU KHI SUBMIT - KHÔNG HIỂN THỊ ĐIỂM
                ================================================================
                Hiển thị thông báo thành công và nút Back cho student
                KHÔNG hiển thị điểm số theo yêu cầu
                ================================================================ */}
            {submitted && (
              <div className="space-y-4">
                {/* Thông báo thành công */}
                <div className="flex flex-col items-center justify-center rounded-2xl border border-success/30 bg-success/10 p-8 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="font-headline text-xl font-bold text-success">Quiz Submitted Successfully!</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Your answers have been recorded.
                  </p>
                  <p className="mt-2 text-xs text-emerald-600/70 dark:text-emerald-400/60">
                    {answeredCount}/{totalQ} questions answered
                  </p>
                  {quizResult?.ungradedEssayCount != null && quizResult.ungradedEssayCount > 0 && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      <span>{quizResult.ungradedEssayCount} essay(s) pending instructor grading</span>
                    </div>
                  )}
                </div>

                {/* Nút Back to Quizzes */}
                <Link href="/student/quizzes">
                  <Button variant="outline" className="h-12 w-full rounded-xl font-bold">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Quizzes
                  </Button>
                </Link>
              </div>
            )}

        {/* Question Navigation with Pagination */}
        <div className="mt-16 border-t border-outline-variant/10 pt-10">
        <h4 className="mb-4 flex items-center gap-2 font-headline text-base font-bold text-on-surface">
          <span className="h-1 w-6 rounded-full bg-primary" />
          Question Navigation
          {totalQ > REVIEW_PAGE_SIZE && (
            <span className="ml-2 text-xs font-normal text-on-surface-variant">
              Page {reviewPage} of {Math.ceil(totalQ / REVIEW_PAGE_SIZE)}
            </span>
          )}
        </h4>

        {totalQ > REVIEW_PAGE_SIZE ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {questions
                .slice((reviewPage - 1) * REVIEW_PAGE_SIZE, reviewPage * REVIEW_PAGE_SIZE)
                .map((q, i) => {
                  const globalIndex = (reviewPage - 1) * REVIEW_PAGE_SIZE + i;
                  const state = answerStates[q.questionId];
                  const isCurrent = globalIndex === currentIndex;

                  let cls = 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant';
                  if (state === 'correct') {
                    cls = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600';
                  } else if (state === 'incorrect') {
                    cls = 'border-destructive/40 bg-destructive/10 text-destructive';
                  } else if (answers[q.questionId]) {
                    cls = 'border-primary/40 bg-primary/10 text-primary';
                  }

                  if (isCurrent) {
                    cls += ' ring-2 ring-primary ring-offset-2 ring-offset-background';
                  }

                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(globalIndex);
                        setShowFeedback(false);
                      }}
                      onMouseEnter={() => setHoveredQuestionIndex(globalIndex)}
                      onMouseLeave={() => setHoveredQuestionIndex(null)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all ${cls}`}
                    >
                      {globalIndex + 1}
                    </button>
                  );
                })}
            </div>
            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                disabled={reviewPage === 1}
                className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>
              <div className="flex gap-2">
                {Array.from({ length: Math.ceil(totalQ / REVIEW_PAGE_SIZE) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setReviewPage(page)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      page === reviewPage
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setReviewPage(p => Math.min(Math.ceil(totalQ / REVIEW_PAGE_SIZE), p + 1))}
                disabled={reviewPage === Math.ceil(totalQ / REVIEW_PAGE_SIZE)}
                className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {questions.map((q, i) => {
              const state = answerStates[q.questionId];
              const isCurrent = i === currentIndex;

              let cls = 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant';

              if (state === 'correct') {
                cls = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600';
              } else if (state === 'incorrect') {
                cls = 'border-destructive/40 bg-destructive/10 text-destructive';
              } else if (answers[q.questionId]) {
                cls = 'border-primary/40 bg-primary/10 text-primary';
              }

              if (isCurrent) {
                cls += ' ring-2 ring-primary ring-offset-2 ring-offset-background';
              }

              return (
                <button
                  key={q.questionId}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(i);
                    setShowFeedback(false);
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all ${cls}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}

        </div>
         <div>
                <h4 className="mb-4 flex items-center gap-2 font-headline text-base font-bold text-on-surface">
                  <span className="h-1 w-6 rounded-full bg-primary" />
                  Reference material
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 transition-transform hover:-translate-y-0.5">
                    <BookOpen className="mb-3 h-7 w-7 text-primary" />
                    <p className="text-sm font-bold text-on-surface">Classification atlas</p>
                    <p className="mt-1 text-xs text-on-surface-variant">AO/OTA fracture classification systems</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 transition-transform hover:-translate-y-0.5">
                    <PlayCircle className="mb-3 h-7 w-7 text-primary" />
                    <p className="text-sm font-bold text-on-surface">Diagnostic video</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Clinical signs in emergency radiography</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 transition-transform hover:-translate-y-0.5">
                    <TrendingUp className="mb-3 h-7 w-7 text-primary" />
                    <p className="text-sm font-bold text-on-surface">Success rate</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Track your progress after each attempt</p>
                  </div>
                </div>
              </div>
      </div>

      {/* Save to Flashcards Modal */}
      {showSaveFlashcardModal && session?.attemptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-violet-200 dark:border-violet-800 bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  Save Quiz to Flashcards
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Create flashcards from this quiz to study later
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">
                  Deck Name (optional)
                </label>
                <input
                  type="text"
                  value={customDeckName}
                  onChange={(e) => setCustomDeckName(e.target.value)}
                  placeholder={`Quiz: ${quizInfo?.quizName ?? session.title}`}
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  Leave empty to use the default deck name based on quiz title.
                </p>
              </div>

              <div className="rounded-xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 p-4">
                <h4 className="font-semibold text-sm text-on-surface mb-2">What will be saved:</h4>
                <ul className="text-xs text-on-surface-variant space-y-1.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    <span>{session.questions.length} flashcards from quiz questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    <span>Each card includes correct answer + explanation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    <span>Spaced repetition enabled for efficient learning</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveFlashcardModal(false);
                    setCustomDeckName('');
                  }}
                  disabled={savingToFlashcards}
                  className="flex-1 rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!session?.attemptId) return;
                    setSavingToFlashcards(true);
                    try {
                      const result = await saveQuizToFlashcards(session.attemptId, {
                        deckName: customDeckName || undefined,
                      });
                      if (result.success) {
                        setSavedFlashcardInfo({
                          deckId: result.deckId,
                          deckName: result.deckName,
                          cardCount: result.cardCount,
                        });
                        toast.success(result.message || 'Quiz saved to flashcards!');
                        setShowSaveFlashcardModal(false);
                        setCustomDeckName('');
                      } else {
                        toast.error(result.message || 'Failed to save quiz to flashcards.');
                      }
                    } catch (e) {
                      toast.error(getApiErrorMessage(e));
                    } finally {
                      setSavingToFlashcards(false);
                    }
                  }}
                  isLoading={savingToFlashcards}
                  className="flex-1 rounded-xl font-bold bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/25"
                >
                  {!savingToFlashcards && <BookmarkPlus className="h-4 w-4 mr-2" />}
                  Save Deck
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto border-t border-outline-variant/10 px-6 py-8 text-center">
        <p className="mx-auto max-w-2xl text-xs font-medium text-on-surface-variant">
          BoneVisQA uses high-fidelity educational imaging models. Terminology aligns with common orthopedic teaching
          standards; not a substitute for clinical supervision.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-6">
          <Link href="/student/quizzes" className="text-xs font-bold text-on-surface-variant hover:text-primary">
            Back to quizzes
          </Link>
          <Link href="/student/quizzes?tab=history" className="text-xs font-bold text-on-surface-variant hover:text-primary">
            Quiz history
          </Link>
          <Link href="/student/flashcards" className="text-xs font-bold text-on-surface-variant hover:text-primary">
            My Flashcards
          </Link>
        </div>
      </footer>

    </div>
  );
}