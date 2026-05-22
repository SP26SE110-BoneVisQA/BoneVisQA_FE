'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Star,
  Zap,
  Lightbulb,
  MessageSquare,
  Sparkles,
  BookmarkPlus,
  Bookmark,
  FolderOpen,
  Play,
  Bone,
  Activity,
  Stethoscope,
  AlertTriangle,
  HeartPulse,
  Brain,
} from 'lucide-react';
import {
  generateAndSaveAIPracticeQuiz,
  submitAIPracticeQuiz,
  fetchQuizHint,
  saveQuizToFlashcards,
} from '@/lib/api/student';
import type { StudentGeneratedQuizSession } from '@/lib/api/student';
import { getApiErrorMessage } from '@/lib/api/client';

type QuizCategory = {
  id: string;
  name: string;
  icon: typeof Bone;
  color: string;
  bgColor: string;
  topics: string[];
};

const QUIZ_CATEGORIES: QuizCategory[] = [
  {
    id: 'upper-extremity',
    name: 'Upper Extremity',
    icon: Bone,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 hover:bg-blue-200',
    topics: ['Shoulder & Glenohumeral Joint', 'Elbow & Radioulnar Joint', 'Wrist & Radiocarpal Joint', 'Hand & Carpals', 'Fingers & Phalanges', 'Clavicle & Scapula'],
  },
  {
    id: 'lower-extremity',
    name: 'Lower Extremity',
    icon: Activity,
    color: 'text-green-600',
    bgColor: 'bg-green-100 hover:bg-green-200',
    topics: ['Hip & Acetabulum', 'Knee & Meniscus', 'Ankle & Talocrural Joint', 'Foot & Tarsals', 'Femur & Tibia', 'Fibula & Patella'],
  },
  {
    id: 'spine',
    name: 'Spine & Axial',
    icon: AlertTriangle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 hover:bg-purple-200',
    topics: ['Cervical Spine (C1-C7)', 'Thoracic Spine (T1-T12)', 'Lumbar Spine (L1-L5)', 'Sacrum & Coccyx', 'Pelvis & Sacroiliac', 'Intervertebral Disc'],
  },
  {
    id: 'pathology',
    name: 'Pathology',
    icon: Stethoscope,
    color: 'text-red-600',
    bgColor: 'bg-red-100 hover:bg-red-200',
    topics: ['Bone Tumors (Benign)', 'Bone Tumors (Malignant)', 'Metabolic Bone Disease', 'Infectious Bone Disease', 'Osteoporosis', 'Osteomyelitis'],
  },
  {
    id: 'trauma',
    name: 'Trauma & Fractures',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 hover:bg-orange-200',
    topics: ['Long Bone Fractures', 'Stress Fractures', 'Compression Fractures', 'Pathologic Fractures', 'Dislocations', 'Subluxations'],
  },
  {
    id: 'degenerative',
    name: 'Degenerative',
    icon: HeartPulse,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100 hover:bg-pink-200',
    topics: ['Osteoarthritis', 'Degenerative Disc Disease', 'Spondylosis', 'Spinal Stenosis', 'Avascular Necrosis', 'Chondromalacia'],
  },
  {
    id: 'misc',
    name: 'Other Topics',
    icon: Brain,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 hover:bg-gray-200',
    topics: ['Skull & Facial Bones', 'Ribs & Sternum', 'Pediatric Bones', 'Bone Cysts', 'Congenital Abnormalities', 'Bone Marrow Lesions'],
  },
];

const ALL_TOPICS = QUIZ_CATEGORIES.flatMap(cat => cat.topics);

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

interface AIQuizContentProps {
  className?: string;
  embedded?: boolean;
}

export function AIQuizContent({ className = '', embedded = false }: AIQuizContentProps) {
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
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set());

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

  const toggleBookmark = useCallback((questionId: string) => {
    setBookmarkedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

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
    setBookmarkedQuestions(new Set());
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
    setBookmarkedQuestions(new Set());
  };

  const isConfigState = quizState === 'config' || quizState === 'generating';
  const selectedCategory = QUIZ_CATEGORIES.find(cat => cat.topics.includes(selectedTopic));

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hero Banner - Premium */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-800 p-4 sm:p-5 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-['Manrope',sans-serif] text-base sm:text-lg font-bold text-white">
                AI Quiz Generator
              </h2>
              <p className="text-xs text-white/80 hidden sm:block">
                Generate personalized quizzes with AI hints
              </p>
            </div>
          </div>
          {totalQ > 0 && (
            <div className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur-sm text-center">
              <p className="text-lg font-black">{totalQ}</p>
              <p className="text-[10px] text-white/70">questions</p>
            </div>
          )}
        </div>
      </div>

      {/* Config: Topic & Settings */}
      {isConfigState && (
        <div className="space-y-4">
          {/* Topic Selection by Categories - Premium */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="border-b border-border bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <BookOpen className="h-4 w-4 text-violet-600" />
                Select Bone & Joint Topic
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Choose a category to explore</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Category Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {QUIZ_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isCatSelected = selectedCategory?.id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        if (isCatSelected) {
                          setSelectedTopic('');
                        } else {
                          setSelectedTopic(cat.topics[0]);
                        }
                      }}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all ${
                        isCatSelected
                          ? 'border-violet-400 bg-violet-50 shadow-sm'
                          : 'border-border bg-background hover:border-violet-200 hover:bg-violet-50/50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cat.bgColor}`}>
                        <Icon className={`h-4 w-4 ${cat.color}`} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-semibold text-card-foreground truncate">{cat.name}</p>
                        <p className="text-[10px] text-muted-foreground">{cat.topics.length} topics</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Topics List - Show when category selected */}
              {selectedCategory && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${selectedCategory.bgColor}`}>
                      <selectedCategory.icon className={`h-3.5 w-3.5 ${selectedCategory.color}`} />
                    </div>
                    <p className="text-xs font-semibold text-violet-700">{selectedCategory.name} Topics</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {selectedCategory.topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic)}
                        className={`rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-all ${
                          selectedTopic === topic
                            ? 'border-violet-500 bg-violet-100 text-violet-700 shadow-sm'
                            : 'border-violet-100 bg-white text-muted-foreground hover:border-violet-300 hover:text-violet-600'
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Topic Display */}
              {selectedTopic && (
                <div className="rounded-lg border-2 border-violet-300 bg-gradient-to-r from-violet-100 to-purple-100 p-3 text-center">
                  <p className="text-[10px] text-violet-600 font-medium uppercase tracking-wider">Selected Topic</p>
                  <p className="mt-1 font-bold text-violet-700">{selectedTopic}</p>
                </div>
              )}

              {/* Settings Row */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Questions:</label>
                  <div className="flex gap-1">
                    {[5, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => setQuestionCount(n)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-all ${
                          questionCount === n
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white text-muted-foreground hover:bg-violet-100 border border-border'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Difficulty:</label>
                  <div className="flex gap-1">
                    {['', 'Easy', 'Medium', 'Hard'].map((d) => (
                      <button
                        key={d || 'any'}
                        onClick={() => setDifficulty(d as DifficultyLevel)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-all ${
                          difficulty === d
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white text-muted-foreground hover:bg-violet-100 border border-border'
                        }`}
                      >
                        {d === '' ? 'Any' : d}
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
                <Sparkles className="h-4 w-4" />
                {quizState === 'generating' ? 'Generating...' : 'Generate AI Quiz'}
              </Button>
            </div>
          </div>

          {/* Case Library Card - Premium */}
          <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <FolderOpen className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Generate from Case Library</p>
                  <p className="text-xs text-amber-600">Based on real X-ray images & diagnoses</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="border-amber-300 text-amber-700 hover:bg-amber-100">
                <Link href="/student/quizzes?tab=practice">
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Browse
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
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                  <Star className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
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
            <div className="px-5 py-3">
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
              const isBookmarked = bookmarkedQuestions.has(q.questionId);
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
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-all hover:scale-105 ${pillClass}`}
                >
                  {i + 1}
                  {isBookmarked && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
            {bookmarkedQuestions.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  const firstBookmarked = questions.findIndex((q) => bookmarkedQuestions.has(q.questionId));
                  if (firstBookmarked !== -1) setCurrentIndex(firstBookmarked);
                }}
                className="flex h-9 items-center gap-1.5 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition-all hover:bg-amber-100"
              >
                <Bookmark className="h-3.5 w-3.5" fill="currentColor" />
                {bookmarkedQuestions.size} đánh dấu
              </button>
            )}
          </div>

          {/* Current Question Card */}
          {currentQ && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Câu hỏi {currentIndex + 1}
                  </p>
                  <h3 className="mt-2 font-semibold leading-relaxed text-card-foreground">
                    {currentQ.questionText}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBookmark(currentQ.questionId)}
                  className={`ml-4 shrink-0 rounded-full p-2 transition-all hover:scale-110 ${
                    bookmarkedQuestions.has(currentQ.questionId)
                      ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                  title={bookmarkedQuestions.has(currentQ.questionId) ? 'Bỏ đánh dấu' : 'Đánh dấu câu hỏi'}
                >
                  <Bookmark className="h-5 w-5" fill={bookmarkedQuestions.has(currentQ.questionId) ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="p-5 space-y-3">
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
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm ${badgeBg}`}
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
                      className={`mx-5 mb-5 rounded-2xl border-2 p-4 ${
                        resultDetail.isCorrect
                          ? 'border-green-200/60 bg-green-50'
                          : 'border-amber-200/60 bg-amber-50'
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        {resultDetail.isCorrect ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="font-bold text-green-800">Chính xác!</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-amber-600" />
                            <span className="font-bold text-amber-800">Chưa chính xác</span>
                          </>
                        )}
                      </div>

                      {resultDetail.explanation && (
                        <div className="mb-3 rounded-xl border border-purple-100 bg-white/80 p-3">
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

              {/* Bookmark indicator */}
              {bookmarkedQuestions.has(currentQ.questionId) && (
                <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  <Bookmark className="h-3.5 w-3.5" fill="currentColor" />
                  Câu hỏi này đã được đánh dấu
                </div>
              )}

              {/* AI Hint - shown during active quiz */}
              {quizState === 'active' && (
                <div className="mx-5 mb-5 rounded-xl border-2 border-violet-200/60 bg-violet-50/50 p-4">
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
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-card-foreground shadow-sm transition-all hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Câu trước
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(totalQ - 1, i + 1))}
              disabled={currentIndex >= totalQ - 1}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
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
                className={`overflow-hidden rounded-2xl border-2 p-5 text-center ${
                  quizResult.passed
                    ? 'border-green-400/50 bg-green-50'
                    : 'border-red-400/50 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-center gap-4">
                  {quizResult.passed ? (
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  ) : (
                    <XCircle className="h-10 w-10 text-red-600" />
                  )}
                  <div className="text-left">
                    <p
                      className={`text-3xl font-black ${
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
                <p className="mt-2 text-sm text-muted-foreground">
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
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Nộp Quiz ({answeredCount}/{totalQ})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
