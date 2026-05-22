'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { StudentAppChrome } from '@/components/student/StudentAppChrome';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  HelpCircle,
  ChevronDown,
  Star,
  Zap,
  Lightbulb,
  MessageSquare,
  Sparkles,
  BookmarkPlus,
  FolderOpen,
  Play,
} from 'lucide-react';
import {
  generateAndSaveAIPracticeQuiz,
  submitAIPracticeQuiz,
  fetchQuizHint,
  saveQuizToFlashcards,
} from '@/lib/api/student';
import type { StudentGeneratedQuizSession } from '@/lib/api/student';
import { getApiErrorMessage } from '@/lib/api/client';

const QUICK_TOPICS = [
  'Gãy xương dài',
  'Tổn thương cột sống',
  'Bệnh lý khớp',
  'U xương',
  'Chi trên',
  'Chi dưới',
  'Khung chậu và háng',
  'Bàn chân và mắt cá chân',
];

const ALL_TOPICS = [
  ...QUICK_TOPICS,
  'Bệnh xương chuyển hóa',
  'Bệnh xương nhiễm trùng',
  'Sọ và mặt',
  'Ngực và sườn',
  'Gãy xương căng stress',
  'U xương lành tính và ác tính',
  'Bệnh thoái hóa',
  'Rối loạn mạch máu xương',
];

type DifficultyLevel = '' | 'Easy' | 'Medium' | 'Hard';
type QuizState = 'config' | 'generating' | 'active' | 'submitting' | 'result';

interface QuizQuestionResult {
  questionId: string;
  questionText: string;
  type?: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  studentAnswer: string | null;
  isCorrect: boolean;
}

export default function AIQuizPage() {
  const router = useRouter();
  const toast = useToast();

  const [selectedTopic, setSelectedTopic] = useState('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('');

  const [quizState, setQuizState] = useState<QuizState>('config');
  const [session, setSession] = useState<StudentGeneratedQuizSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    passed: boolean;
    totalQuestions: number;
    correctAnswers: number;
  } | null>(null);
  const [quizResultDetails, setQuizResultDetails] = useState<QuizQuestionResult[]>([]);
  const [showAIReasoning, setShowAIReasoning] = useState(false);

  const [savingFlashcards, setSavingFlashcards] = useState(false);

  const [hintLevel, setHintLevel] = useState(1);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [hintUsedCount, setHintUsedCount] = useState(0);

  const questions = session?.questions ?? [];
  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQ && totalQ > 0;
  const currentAnswer = currentQ ? answers[currentQ.questionId] : null;

  const handleRequestHint = useCallback(async () => {
    if (!currentQ) return;
    setLoadingHint(true);
    try {
      const result = await fetchQuizHint(currentQ.questionId, session?.attemptId, hintLevel);
      if (result.success && result.hint) {
        setCurrentHint(result.hint);
        setHintLevel((prev) => Math.min(prev + 1, 3));
        setHintUsedCount((prev) => prev + 1);
        toast.success('Hint loaded!');
      } else {
        toast.error(result.errorMessage || 'Failed to load hint');
      }
    } catch {
      toast.error('Failed to load hint');
    } finally {
      setLoadingHint(false);
    }
  }, [currentQ, session?.attemptId, hintLevel, toast]);

  const handleSelect = useCallback(
    (option: string) => {
      if (!currentQ || quizState !== 'active') return;
      setAnswers((prev) => ({ ...prev, [currentQ.questionId]: option }));
    },
    [currentQ, quizState],
  );

  const handleGenerate = async () => {
    if (!selectedTopic.trim()) {
      toast.error('Vui lòng chọn một chủ đề.');
      return;
    }
    setQuizState('generating');
    setAnswers({});
    setCurrentIndex(0);
    setQuizResult(null);
    setQuizResultDetails([]);
    setCurrentHint(null);
    setHintLevel(1);
    setHintUsedCount(0);
    try {
      const data = await generateAndSaveAIPracticeQuiz(
        selectedTopic,
        questionCount,
        difficulty || undefined,
      );
      if (!data.attemptId || data.attemptId === '00000000-0000-0000-0000-000000000000') {
        toast.info('AI không thể tạo câu hỏi cho chủ đề này. Vui lòng thử chủ đề khác.');
        setQuizState('config');
        return;
      }
      setSession(data);
      setQuizState('active');
      toast.success(`Quiz "${data.title}" đã được tạo! Bắt đầu luyện tập.`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setQuizState('config');
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([questionId, studentAnswer]) => ({
        questionId,
        studentAnswer,
      }));
      const result = await submitAIPracticeQuiz(session.attemptId, payload);
      setQuizResult(result);

      const details: QuizQuestionResult[] = session.questions.map((q) => {
        const studentAnswer = answers[q.questionId] || null;
        const correctAnswer = q.correctAnswer || null;
        const isCorrect = studentAnswer === correctAnswer;
        return {
          questionId: q.questionId,
          questionText: q.questionText,
          type: q.type,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer,
          explanation: q.explanation,
          studentAnswer,
          isCorrect,
        };
      });
      setQuizResultDetails(details);
      setQuizState('result');
      toast.success('Đã nộp bài thành công!');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveToFlashcards = async () => {
    if (!session) return;
    setSavingFlashcards(true);
    try {
      const result = await saveQuizToFlashcards(session.attemptId, {
        deckName: session.title,
        description: `Bộ flashcard từ quiz AI - ${selectedTopic}`,
      });
      if (result.success) {
        toast.success(
          `Đã lưu ${result.cardCount} flashcards vào bộ "${result.deckName}"!`,
        );
      } else {
        toast.error(result.message || 'Không thể lưu flashcards.');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingFlashcards(false);
    }
  };

  const handleStartNew = () => {
    setQuizState('config');
    setSession(null);
    setAnswers({});
    setCurrentIndex(0);
    setQuizResult(null);
    setQuizResultDetails(null as unknown as QuizQuestionResult[]);
    setCurrentHint(null);
    setHintLevel(1);
    setHintUsedCount(0);
  };

  const isConfigState = quizState === 'config' || quizState === 'generating';

  return (
    <div className="min-h-screen">
      <StudentAppChrome
        breadcrumb="AI Quiz"
        title="AI Quiz Practice"
        subtitle="Tạo bài kiểm tra cá nhân hóa được hỗ trợ bởi AI"
      />

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        {/* Hero Banner */}
        <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="font-['Manrope',sans-serif] text-2xl font-black tracking-tight">
                  AI Quiz Generator
                </h1>
                <p className="mt-1 max-w-lg text-sm text-white/80">
                  Chọn chủ đề y khoa, AI sẽ tạo câu hỏi trắc nghiệm cá nhân hóa kèm gợi ý
                  thông minh và giải thích chi tiết.
                </p>
              </div>
            </div>
            <div className="hidden shrink-0 text-right md:block">
              <div className="rounded-2xl bg-white/15 px-4 py-2 backdrop-blur-sm">
                <p className="text-2xl font-black">{totalQ}</p>
                <p className="text-xs text-white/70">Câu hỏi</p>
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { icon: Zap, label: 'Tạo tức thì' },
              { icon: Lightbulb, label: 'Gợi ý AI' },
              { icon: MessageSquare, label: 'Giải thích chi tiết' },
              { icon: BookmarkPlus, label: 'Lưu Flashcards' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Config: Topic & Settings */}
        {isConfigState && (
          <div className="space-y-6">
            {/* Topic Selection */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-card-foreground">Chọn Chủ đề Y khoa</h2>
                    <p className="text-xs text-muted-foreground">
                      Chọn một chủ đề để AI tạo câu hỏi phù hợp
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Quick Topics */}
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {QUICK_TOPICS.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => setSelectedTopic(topic)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                        selectedTopic === topic
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                {/* Show More Toggle */}
                <button
                  onClick={() => setShowAllTopics(!showAllTopics)}
                  className="mb-4 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAllTopics ? 'rotate-180' : ''}`}
                  />
                  {showAllTopics ? 'Thu gọn' : 'Xem thêm chủ đề'}
                </button>

                {showAllTopics && (
                  <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {ALL_TOPICS.slice(8).map((topic) => (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                          selectedTopic === topic
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Topic Display */}
                {selectedTopic && (
                  <div className="mb-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
                    <p className="text-xs text-muted-foreground">Chủ đề đã chọn</p>
                    <p className="mt-1 font-bold text-primary">{selectedTopic}</p>
                  </div>
                )}

                {/* Question Count & Difficulty */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-muted-foreground">
                      Số câu hỏi
                    </label>
                    <div className="flex gap-2">
                      {[5, 10, 15, 20].map((n) => (
                        <button
                          key={n}
                          onClick={() => setQuestionCount(n)}
                          className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                            questionCount === n
                              ? 'border-primary bg-primary text-white'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-muted-foreground">
                      Độ khó
                    </label>
                    <div className="flex gap-2">
                      {(['', 'Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((d) => (
                        <button
                          key={d || 'any'}
                          onClick={() => setDifficulty(d)}
                          className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all ${
                            difficulty === d
                              ? 'border-primary bg-primary text-white'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {d === '' ? 'Any' : d === 'Easy' ? 'Dễ' : d === 'Medium' ? 'TB' : 'Khó'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={!selectedTopic || quizState === 'generating'}
                  isLoading={quizState === 'generating'}
                  className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg hover:from-violet-700 hover:to-purple-700"
                >
                  {!quizState === 'generating' && <Sparkles className="h-4 w-4" />}
                  {quizState === 'generating' ? 'Đang tạo...' : 'Tạo Quiz AI ngay'}
                </Button>
              </div>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: BookOpen,
                  step: 1,
                  title: 'Chọn chủ đề',
                  desc: 'Chọn một chủ đề y khoa cụ thể',
                },
                {
                  icon: Sparkles,
                  step: 2,
                  title: 'AI tạo câu hỏi',
                  desc: 'Câu hỏi được tạo từ kiến thức y khoa (tiếng Việt)',
                },
                {
                  icon: Lightbulb,
                  step: 3,
                  title: 'Gợi ý & Giải thích',
                  desc: 'Nhận phản hồi ngay với gợi ý AI và giải thích',
                },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div
                  key={step}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        {step}
                      </span>
                      <h3 className="text-sm font-bold text-card-foreground">{title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Generate from Case Library shortcut */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Tạo Quiz từ Case Library
                </h2>
              </div>
              <div className="p-6">
                <p className="mb-3 text-sm text-muted-foreground">
                  Bạn có thể chọn các ca lâm sàng cụ thể từ thư viện case để AI tạo câu hỏi
                  dựa trên hình ảnh và chẩn đoán thực tế.
                </p>
                <Button
                  variant="outline"
                  asChild
                  className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Link href="/student/quizzes?tab=practice">
                    <FolderOpen className="h-4 w-4" />
                    Mở Case Library
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Active / Result Quiz View */}
        {!isConfigState && (
          <div className="space-y-6">
            {/* Progress Header */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-4 border-b border-border bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                    <Star className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                      Chế độ ôn luyện AI
                    </span>
                    <p className="mt-0.5 font-semibold text-card-foreground">{session?.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    <span className="font-bold text-primary">{answeredCount}</span> / {totalQ}{' '}
                    đã trả lời
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartNew}
                    className="gap-1.5 text-xs"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Quiz mới
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-6 py-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">
                    Câu hỏi {currentIndex + 1} / {totalQ}
                  </span>
                  <span>{Math.round(((currentIndex + 1) / totalQ) * 100)}% hoàn thành</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-600 transition-all"
                    style={{ width: `${((currentIndex + 1) / totalQ) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Question Navigation Pills */}
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.questionId];
                const isCurrent = i === currentIndex;
                const resultDetail = quizResultDetails.find((r) => r.questionId === q.questionId);
                const isCorrect = resultDetail?.isCorrect;

                let pillClass =
                  'bg-white text-muted-foreground border-2 border-border hover:border-primary/40';
                if (isCurrent) {
                  pillClass = 'bg-violet-600 text-white border-2 border-violet-600 shadow-md';
                } else if (quizResultDetails.length > 0) {
                  if (isCorrect === true) {
                    pillClass = 'bg-green-100 text-green-700 border-2 border-green-300';
                  } else if (isCorrect === false) {
                    pillClass = 'bg-red-100 text-red-700 border-2 border-red-300';
                  } else if (isAnswered) {
                    pillClass = 'bg-blue-100 text-blue-700 border-2 border-blue-300';
                  }
                } else if (isAnswered) {
                  pillClass = 'bg-green-100 text-green-700 border-2 border-green-300';
                }

                return (
                  <button
                    key={q.questionId}
                    onClick={() => setCurrentIndex(i)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-all hover:scale-105 ${pillClass}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Current Question Card */}
            {currentQ && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border bg-muted/20 px-6 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Câu hỏi {currentIndex + 1}
                  </p>
                  <h2 className="mt-2 font-semibold leading-relaxed text-card-foreground">
                    {currentQ.questionText}
                  </h2>
                </div>

                <div className="p-6 space-y-3">
                  {/* Answer Options */}
                  {(() => {
                    const isTrueFalse =
                      currentQ.type?.toLowerCase() === 'truefalse' || currentQ.type?.toLowerCase() === 'true/false';
                    const resultDetail = quizResultDetails.find(
                      (r) => r.questionId === currentQ.questionId,
                    );
                    const showResult = quizState === 'result' && resultDetail;

                    if (isTrueFalse) {
                      return (
                        <div className="flex gap-4">
                          {(['True', 'False'] as const).map((opt) => {
                            const isSelected = currentAnswer === opt;
                            const isCorrectAnswer = currentQ.correctAnswer?.toLowerCase() === opt.toLowerCase();

                            let bgColor = '';
                            let borderColor = 'border-border';
                            let badgeBg = 'bg-muted text-muted-foreground';

                            if (showResult) {
                              if (isCorrectAnswer) {
                                bgColor = 'bg-green-50';
                                borderColor = 'border-green-400';
                                badgeBg = 'bg-green-500 text-white';
                              } else if (isSelected) {
                                bgColor = 'bg-red-50';
                                borderColor = 'border-red-400';
                                badgeBg = 'bg-red-500 text-white';
                              }
                            } else if (isSelected) {
                              bgColor = 'bg-primary/5';
                              borderColor = 'border-primary';
                              badgeBg = 'bg-primary text-white';
                            }

                            return (
                              <button
                                key={opt}
                                type="button"
                                disabled={quizState !== 'active'}
                                onClick={() => handleSelect(opt)}
                                className={`flex flex-1 items-center justify-center rounded-xl border-2 p-4 transition-all ${bgColor} ${borderColor} ${
                                  !showResult && !isSelected
                                    ? 'hover:border-primary/40 hover:bg-muted/30'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-lg ${badgeBg}`}
                                  >
                                    {opt === 'True' ? 'T' : 'F'}
                                  </span>
                                  <span className="flex-1 text-base font-semibold text-card-foreground">
                                    {opt}
                                  </span>
                                  {isSelected && !showResult && (
                                    <CheckCircle2 className="h-6 w-6 text-primary" />
                                  )}
                                  {showResult && isCorrectAnswer && (
                                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                                  )}
                                  {showResult && isSelected && !isCorrectAnswer && (
                                    <XCircle className="h-6 w-6 text-red-500" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    }

                    // Standard ABCD options
                    return (
                      <>
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
                          const isCorrectAnswer = currentQ.correctAnswer === key;

                          let bgColor = '';
                          let borderColor = 'border-border';
                          let badgeBg = 'bg-muted text-muted-foreground';

                          if (showResult) {
                            if (isCorrectAnswer) {
                              bgColor = 'bg-green-50';
                              borderColor = 'border-green-400';
                              badgeBg = 'bg-green-500 text-white';
                            } else if (isSelected) {
                              bgColor = 'bg-red-50';
                              borderColor = 'border-red-400';
                              badgeBg = 'bg-red-500 text-white';
                            }
                          } else if (isSelected) {
                            bgColor = 'bg-primary/5';
                            borderColor = 'border-primary';
                            badgeBg = 'bg-primary text-white';
                          }

                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={quizState !== 'active'}
                              onClick={() => handleSelect(key)}
                              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${bgColor} ${borderColor} ${
                                !showResult && !isSelected
                                  ? 'hover:border-primary/40 hover:bg-muted/30'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm ${badgeBg}`}
                                >
                                  {key}
                                </span>
                                <span className="flex-1 text-sm font-medium text-card-foreground">
                                  {text}
                                </span>
                                {isSelected && !showResult && (
                                  <CheckCircle2 className="h-5 w-5 text-primary" />
                                )}
                                {showResult && isCorrectAnswer && (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                )}
                                {showResult && isSelected && !isCorrectAnswer && (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>

                {/* Explanation - shown after submission */}
                {quizState === 'result' &&
                  (() => {
                    const resultDetail = quizResultDetails.find(
                      (r) => r.questionId === currentQ.questionId,
                    );
                    if (!resultDetail) return null;
                    return (
                      <div
                        className={`mx-6 mb-6 rounded-2xl border-2 p-5 ${
                          resultDetail.isCorrect
                            ? 'border-green-200/60 bg-green-50'
                            : 'border-amber-200/60 bg-amber-50'
                        }`}
                      >
                        <div className="mb-3 flex items-center gap-3">
                          {resultDetail.isCorrect ? (
                            <>
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                              <span className="font-bold text-green-800">Chính xác!</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-6 w-6 text-amber-600" />
                              <span className="font-bold text-amber-800">Chưa chính xác</span>
                            </>
                          )}
                        </div>

                        {resultDetail.explanation && (
                          <div className="mb-4 rounded-xl border border-purple-100 bg-white/80 p-4">
                            <div className="mb-2 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-purple-600" />
                              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700">
                                Giải thích
                              </h4>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                              {resultDetail.explanation}
                            </p>
                          </div>
                        )}

                        {!resultDetail.isCorrect && resultDetail.correctAnswer && (
                          <p className="text-sm font-semibold text-gray-700">
                            Đáp án đúng:{' '}
                            <span className="font-bold text-green-600">
                              {resultDetail.correctAnswer}.{' '}
                              {
                                currentQ[
                                  `option${resultDetail.correctAnswer}` as keyof typeof currentQ
                                ]
                              }
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  })()}

                {/* AI Hint - shown during active quiz */}
                {quizState === 'active' && (
                  <div className="mx-6 mb-6 rounded-xl border-2 border-violet-200/60 bg-violet-50/50 p-4">
                    <button
                      type="button"
                      onClick={() => setShowAIReasoning(!showAIReasoning)}
                      className="flex w-full items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-violet-600" />
                        <span className="text-sm font-bold text-violet-700">Gợi ý AI</span>
                        {hintUsedCount > 0 && (
                          <span className="text-xs text-violet-500">
                            ({hintUsedCount} đã dùng)
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-violet-500 transition-transform ${showAIReasoning ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {showAIReasoning && (
                      <div className="mt-3 space-y-3">
                        {currentHint ? (
                          <div className="rounded-lg border border-violet-200 bg-white p-3 text-sm text-violet-800">
                            <p className="mb-1 font-medium">
                              Gợi ý cấp độ {hintLevel > 1 ? hintLevel - 1 : hintLevel}:
                            </p>
                            <p>{currentHint}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-violet-600">
                            Nhấn nút bên dưới để nhận gợi ý từ AI!
                          </p>
                        )}

                        {hintLevel <= 3 && (
                          <button
                            type="button"
                            onClick={() => void handleRequestHint()}
                            disabled={loadingHint || !currentQ}
                            className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold transition-all ${
                              loadingHint
                                ? 'bg-violet-300 text-white cursor-wait'
                                : 'bg-violet-600 text-white hover:bg-violet-700'
                            }`}
                          >
                            {loadingHint ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Đang lấy gợi ý...
                              </>
                            ) : (
                              <>
                                <Lightbulb className="h-4 w-4" />
                                {currentHint ? 'Gợi ý cụ thể hơn' : 'Lấy gợi ý AI'}
                              </>
                            )}
                          </button>
                        )}

                        {hintLevel > 3 && (
                          <p className="text-center text-xs text-violet-500">
                            Đã đạt cấp độ gợi ý tối đa. Hãy thử trả lời câu hỏi!
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-card-foreground shadow-sm transition-all hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Câu trước
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(totalQ - 1, i + 1))}
                disabled={currentIndex >= totalQ - 1}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
              >
                Câu tiếp
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Submit / Result Section */}
            {quizState === 'result' && quizResult ? (
              <div className="space-y-4">
                {/*
                <div
                  className={`overflow-hidden rounded-2xl border-2 p-6 text-center ${
                    quizResult.passed
                      ? 'border-green-400/50 bg-green-50'
                      : 'border-red-400/50 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-5">
                    {quizResult.passed ? (
                      <CheckCircle2 className="h-12 w-12 text-green-600" />
                    ) : (
                      <XCircle className="h-12 w-12 text-red-600" />
                    )}
                    <div className="text-left">
                      <p
                        className={`text-4xl font-black ${
                          quizResult.passed ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {Math.round(quizResult.score)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {quizResult.correctAnswers}/{quizResult.totalQuestions} câu đúng
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Xem lại từng câu hỏi bên trên để xem đáp án đúng và giải thích chi tiết.
                  </p>
                </div>
                */}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleStartNew}
                    className="flex-1 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 font-bold"
                  >
                    <Sparkles className="h-4 w-4" />
                    Quiz Mới
                  </Button>
                  <Button variant="outline" asChild className="flex-1 gap-2">
                    <Link href="/student/review">
                      <Play className="h-4 w-4" />
                      Xem Flashcards
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || answeredCount === 0}
                isLoading={submitting}
                className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 py-3.5 text-sm font-bold text-white shadow-lg hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Nộp Quiz ({answeredCount}/{totalQ})
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
