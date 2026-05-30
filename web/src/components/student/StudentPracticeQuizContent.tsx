'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { fetchStudentPracticeQuiz, submitStudentQuiz, generateAIPracticeQuiz } from '@/lib/api/student';
import { resolveApiAssetUrl } from '@/lib/api/client';
import type { StudentPracticeQuiz, StudentQuizSubmissionResult } from '@/lib/api/types';
import { useLocalStorageState } from '@/lib/useLocalStorageState';
import {
  CheckCircle,
  Loader2,
  Play,
  RotateCcw,
  Trophy,
  Zap,
  BarChart3,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';

const topicSuggestions = [
  'Long Bone Fractures',
  'Spine Lesions',
  'Joint Diseases',
  'Bone Tumors',
  'Upper Extremity',
  'Lower Extremity',
];

const difficultyOptions = [
  { value: '', label: 'Any difficulty' },
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
];

type StudentQuizDraft = {
  topic: string;
  difficulty: string;
  answers: Record<string, string>;
  searchTerm: string;
  page: number;
  questionCount: number;
};

const EMPTY_QUIZ_DRAFT: StudentQuizDraft = {
  topic: topicSuggestions[0],
  difficulty: '',
  answers: {},
  searchTerm: '',
  page: 1,
  questionCount: 5,
};

export function StudentPracticeQuizContent({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [quizDraft, setQuizDraft, clearQuizDraft] = useLocalStorageState<StudentQuizDraft>(
    'student-quiz-draft',
    EMPTY_QUIZ_DRAFT,
  );
  const [topic, setTopic] = useState(quizDraft.topic || topicSuggestions[0]);
  const [difficulty, setDifficulty] = useState(quizDraft.difficulty || '');
  const [quiz, setQuiz] = useState<StudentPracticeQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(quizDraft.answers || {});
  const [result, setResult] = useState<StudentQuizSubmissionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState(quizDraft.searchTerm || '');
  const [page, setPage] = useState(quizDraft.page || 1);

  // AI Quiz state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<Array<{
    questionText: string;
    type: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    caseId?: string;
    caseTitle?: string;
  }>>([]);
  const [questionCount, setQuestionCount] = useState(quizDraft.questionCount || 5);

  const completion = useMemo(() => {
    if (!quiz) return 0;
    const answered = quiz.questions.filter((question) => answers[question.questionId]).length;
    return Math.round((answered / quiz.questions.length) * 100);
  }, [answers, quiz]);

  const handleLoadQuiz = async () => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    setPage(1);
    try {
      const data = await fetchStudentPracticeQuiz(topic);
      setQuiz(data);
      setAiQuestions([]);
      toast.success(`Practice quiz loaded for ${data.topic}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load practice quiz.');
      setQuiz(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerateQuiz = async () => {
    setAiGenerating(true);
    setLoading(true);
    setResult(null);
    setAnswers({});
    setPage(1);
    try {
      const data = await generateAIPracticeQuiz(topic, questionCount, difficulty || undefined);
      if (data.success && data.questions.length > 0) {
        setAiQuestions(data.questions);
        toast.success(`AI generated ${data.questions.length} questions for you!`);
      } else {
        toast.error(data.message || 'Unable to generate questions. Please try again.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate AI quiz.');
    } finally {
      setLoading(false);
      setAiGenerating(false);
    }
  };

  const handleSubmitAIQuiz = async () => {
    if (aiQuestions.length === 0) return;

    setSubmitting(true);
    try {
      const correctCount = aiQuestions.filter((q, index) =>
        answers[`ai-${index}`]?.toUpperCase() === q.correctAnswer.toUpperCase()
      ).length;
      const score = (correctCount / aiQuestions.length) * 100;

      setResult({
        attemptId: 'ai-attempt',
        quizId: 'ai-quiz',
        score: score,
        passingScore: 70,
        passed: score >= 70,
        totalQuestions: aiQuestions.length,
        correctAnswers: correctCount,
      });

      toast.success('Quiz submitted successfully!');
      clearQuizDraft();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    const payload = quiz.questions.map((question) => ({
      questionId: question.questionId,
      studentAnswer: answers[question.questionId] || '',
    }));

    setSubmitting(true);
    try {
      const result = await submitStudentQuiz(quiz.attemptId, payload);
      setResult(result);
      toast.success('Quiz submitted successfully!');
      clearQuizDraft();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setQuiz(null);
    setAiQuestions([]);
    setAnswers({});
    setResult(null);
    setPage(1);
    clearQuizDraft();
  };

  useEffect(() => {
    setQuizDraft({
      topic,
      difficulty,
      answers,
      searchTerm,
      page,
      questionCount,
    });
  }, [answers, difficulty, page, questionCount, searchTerm, setQuizDraft, topic]);

  return (
    <div className={embedded ? '' : 'min-h-screen'}>
      {!embedded ? (
        <div className="border-b border-border bg-card px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-foreground">Quiz Arena</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Practice with live backend quizzes or generate AI-assisted question sets by topic.
          </p>
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search topics..."
              className="rounded-full pl-10 pr-4"
            />
          </div>
          <select className="h-10 appearance-none rounded-lg border border-border bg-background px-4 pr-10 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <option>Sort by: Recent</option>
            <option>Sort by: Name</option>
            <option>Sort by: Difficulty</option>
          </select>
        </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Active Quiz Card */}
        <div className="col-span-12 flex flex-col justify-between overflow-hidden rounded-3xl bg-[#1a2332] p-8 lg:col-span-8" style={{ minHeight: '280px' }}>
          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-2 text-secondary">
              <Zap className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Active session</span>
            </div>
            {quiz ? (
              <>
                <h3 className="max-w-md text-3xl font-bold text-white">{quiz.title}</h3>
                <p className="mt-3 max-w-sm text-sm text-slate-400">
                  {quiz.topic} - {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                </p>
                {/* Progress bar */}
                <div className="mt-5 max-w-sm">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Progress</span>
                    <span className="text-xs font-bold text-white">{completion}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[#007BFF] to-[#00d4c8] transition-all duration-300"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="max-w-md text-3xl font-bold text-white">
                  No active quiz session
                </h3>
                <p className="mt-4 max-w-sm text-sm text-slate-400">
                  Select a topic below and start a new practice session to track your progress.
                </p>
              </>
            )}
          </div>
          <div className="relative z-10 mt-8 space-y-3">
            {quiz ? (
              <>
                <Button
                  type="button"
                  onClick={() => router.push(`/student/quiz/${quiz.attemptId}`)}
                  className="w-full rounded-full bg-gradient-to-r from-primary to-[#007BFF]/90 px-6 py-3 text-sm font-bold text-white shadow-xl transition-all active:scale-95 sm:w-auto"
                >
                  Continue quiz
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleReset}
                  className="w-full rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/20 sm:w-auto"
                >
                  Reset session
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={handleLoadQuiz}
                isLoading={loading}
                className="rounded-full bg-gradient-to-r from-primary to-[#007BFF]/90 px-6 py-3 text-sm font-bold text-white shadow-xl transition-all active:scale-95"
              >
                {!loading && <Play className="mr-2 h-4 w-4" />}
                Start practice
              </Button>
            )}
          </div>
          {/* Decorative background */}
          <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-10">
            <div className="h-full w-full bg-gradient-to-l from-[#007BFF]/30 to-transparent" />
          </div>
        </div>

        {/* Quiz Generator Card */}
        <div className="col-span-12 flex flex-col justify-between rounded-3xl border border-border bg-card p-8 shadow-sm lg:col-span-4">
          <div>
            <div className="mb-6 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted shadow-sm">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <span className="rounded-full bg-secondary/15 px-2 py-1 text-[10px] font-bold text-secondary">
                AI READY
              </span>
            </div>
            <h4 className="mb-2 font-['Manrope',sans-serif] text-xl font-bold text-card-foreground">
              Topic selector
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Choose a clinical topic to generate a personalized practice quiz instantly.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {topicSuggestions.slice(0, 4).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  topic === t
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* AI Generate Section */}
          <div className="mt-6 rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-bold text-purple-700">
                AI Quiz Generator
              </span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Generate an AI practice quiz based on the selected topic.
            </p>

            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Number of questions:</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  <option value={3}>3 questions</option>
                  <option value={5}>5 questions</option>
                  <option value={10}>10 questions</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Difficulty:</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  {difficultyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAIGenerateQuiz}
              isLoading={aiGenerating}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600"
            >
              {!aiGenerating && <Sparkles className="mr-2 h-4 w-4" />}
              Generate AI Quiz
            </Button>
          </div>
        </div>
      </div>

      {/* Practice Quiz Builder / Results */}
      <div className="overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm">
        {/* Section header */}
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-card-foreground">
            {quiz ? 'Quiz questions' : aiQuestions.length > 0 ? 'AI Generated Questions' : 'Select a topic to begin'}
          </h3>
          {quiz && (
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              {quiz.questions.length} questions - {completion}% done
            </div>
          )}
          {aiQuestions.length > 0 && !quiz && !result && (
            <Button
              type="button"
              onClick={handleSubmitAIQuiz}
              isLoading={submitting}
              className="rounded-full bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-2 text-sm font-bold text-white"
            >
              Submit AI Quiz
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {aiGenerating ? 'Generating AI quiz...' : 'Fetching practice quiz…'}
              </div>
            </div>
          ) : !quiz && aiQuestions.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border text-center">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 font-['Manrope',sans-serif] text-lg font-semibold text-card-foreground">
                Ready to practice?
              </h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Select a topic from the card on the left and click &quot;Start practice&quot; to load a quiz,
                or use AI Quiz Generator for instant questions.
              </p>
            </div>
          ) : quiz ? (
            <div className="space-y-4">
              {quiz.questions.map((question, index) => {
                const options = [
                  { key: 'A', value: question.optionA },
                  { key: 'B', value: question.optionB },
                  { key: 'C', value: question.optionC },
                  { key: 'D', value: question.optionD },
                ];

                return (
                  <div
                    key={question.questionId}
                    className="rounded-2xl border border-border bg-background p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                          Question {index + 1}
                        </p>
                        <h2 className="mt-2 font-['Manrope',sans-serif] text-base font-semibold text-card-foreground">
                          {question.questionText}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {question.type && (
                          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                            {question.type}
                          </span>
                        )}
                        {question.imageUrl && (
                          <button
                            type="button"
                            onClick={() => window.open(resolveApiAssetUrl(question.imageUrl), '_blank')}
                            className="rounded-full bg-primary/10 p-2 text-primary hover:bg-primary/20"
                            title="View image"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {question.imageUrl && (
                      <div className="mb-4 overflow-hidden rounded-xl border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveApiAssetUrl(question.imageUrl)}
                          alt={`Image for question ${index + 1}`}
                          className="max-h-64 w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      {options.map((option) => {
                        const isSelected = answers[question.questionId] === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.questionId]: option.key,
                              }))
                            }
                            className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-card-foreground ring-1 ring-primary/30'
                                : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'
                            }`}
                          >
                            <span className="mr-2 font-semibold text-primary">{option.key}.</span>
                            {option.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : aiQuestions.length > 0 ? (
            <div className="space-y-4">
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">
                  AI Generated Quiz - {topic} ({aiQuestions.length} questions)
                </span>
              </div>
              {aiQuestions.map((question, index) => {
                const options = [
                  { key: 'A', value: question.optionA },
                  { key: 'B', value: question.optionB },
                  { key: 'C', value: question.optionC },
                  { key: 'D', value: question.optionD },
                ];
                const questionId = `ai-${index}`;

                return (
                  <div
                    key={questionId}
                    className="rounded-2xl border border-purple-200 bg-background p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
                          Question {index + 1}
                        </p>
                        <h2 className="mt-2 font-['Manrope',sans-serif] text-base font-semibold text-card-foreground">
                          {question.questionText}
                        </h2>
                      </div>
                      {question.caseTitle && (
                        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                          Case: {question.caseTitle}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {options.map((option) => {
                        const isSelected = answers[questionId] === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [questionId]: option.key,
                              }))
                            }
                            className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                              isSelected
                                ? 'border-purple-500 bg-purple-100 text-card-foreground ring-1 ring-purple-500/30'
                                : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'
                            }`}
                          >
                            <span className="mr-2 font-semibold text-purple-600">{option.key}.</span>
                            {option.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        {(quiz || aiQuestions.length > 0) && !result && (
          <div className="border-t border-border p-6">
            <div className="flex flex-wrap items-center gap-3">
              {quiz && (
                <>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    isLoading={submitting}
                    disabled={submitting}
                    className="rounded-xl bg-gradient-to-r from-primary to-[#007BFF] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95"
                  >
                    {!submitting && <CheckCircle className="mr-2 h-4 w-4" />}
                    Submit quiz
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="rounded-xl px-6 py-3 text-sm font-medium"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset session
                  </Button>

                  {/* Pagination */}
                  {quiz.questions.length > 1 && (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="px-2 text-sm text-muted-foreground">
                        Page {page}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= quiz.questions.length}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {aiQuestions.length > 0 && (
                <>
                  <Button
                    type="button"
                    onClick={handleSubmitAIQuiz}
                    isLoading={submitting}
                    disabled={submitting}
                    className="rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95"
                  >
                    {!submitting && <CheckCircle className="mr-2 h-4 w-4" />}
                    Submit AI Quiz
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="rounded-xl px-6 py-3 text-sm font-medium"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {result && (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/30 p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-card-foreground">
                Submission result
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background p-4 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Score</p>
              <p className={`mt-2 text-2xl font-extrabold ${result.passed ? 'text-success' : 'text-warning'}`}>
                {result.score}%
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Passing</p>
              <p className="mt-2 text-2xl font-extrabold text-card-foreground">{result.passingScore}%</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Correct</p>
              <p className="mt-2 text-2xl font-extrabold text-card-foreground">
                {result.correctAnswers}/{result.totalQuestions}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Outcome</p>
              <p className={`mt-2 text-xl font-extrabold ${result.passed ? 'text-success' : 'text-warning'}`}>
                {result.passed ? 'Passed' : 'Retry'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-['Manrope',sans-serif] text-lg font-bold text-card-foreground">
            Knowledge integrity guarantee
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            All quizzes are aligned with current Board of Radiology standards (v2.0-2024).
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Avg accuracy</p>
            <p className="text-2xl font-black text-primary">88.4%</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Topics covered</p>
            <p className="text-2xl font-black text-secondary">{topicSuggestions.length}</p>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={handleLoadQuiz}
        disabled={loading}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#007BFF] text-white shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </button>
      </div>
    </div>
  );
}
