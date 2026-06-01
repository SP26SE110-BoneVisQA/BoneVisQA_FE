'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Sparkles,
  Tag,
  CheckCircle2,
  XCircle,
  ExternalLink,
  BrainCircuit,
  Lightbulb,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { quizExtensionsApi, type DetailedReview, type RelatedCase } from '@/lib/api/quiz-extensions';
import { getAssignedQuizzes } from '@/lib/api/student';
import { resolveApiAssetUrl } from '@/lib/api/client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuizDetailedReviewPage({ params }: PageProps) {
  const { id: quizId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [quizInfo, setQuizInfo] = useState<{
    quizName?: string;
    attemptId?: string;
    score?: number | null;
    answersReleased?: boolean;
  } | null>(null);
  const [reviewData, setReviewData] = useState<DetailedReview | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);

  // Auto-refresh mechanism: detect when score changes (e.g., after lecturer edits)
  const lastScoreRef = useRef<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll for score updates every 5 seconds when on review page
  useEffect(() => {
    if (!quizInfo?.attemptId || loading) return;

    const pollInterval = setInterval(async () => {
      try {
        setIsRefreshing(true);
        const quizzes = await getAssignedQuizzes();
        const quiz = quizzes.find((q) => q.quizId === quizId);
        
        if (quiz?.attemptId && quiz.score !== lastScoreRef.current) {
          // Score has been updated! Refresh the detailed review data
          lastScoreRef.current = quiz.score ?? null;
          setQuizInfo(prev => prev ? { ...prev, score: quiz.score } : null);
          
          const detailed = await quizExtensionsApi.getDetailedReview(quiz.attemptId);
          setReviewData(detailed);
          
          // Show notification about the score change
          toast.success('Score has been updated! Review has been refreshed.');
        }
      } catch (error) {
        console.error('Auto-refresh error:', error);
      } finally {
        setIsRefreshing(false);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [quizId, quizInfo?.attemptId, loading]);

  useEffect(() => {
    fetchData();
  }, [quizId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const quizzes = await getAssignedQuizzes();
      const quiz = quizzes.find((q) => q.quizId === quizId);

      if (!quiz) {
        toast.error('Quiz not found');
        router.push('/student/quizzes');
        return;
      }

      if (!quiz.answersReleased) {
        toast.error('Answers have not been released by your lecturer yet');
        router.push(`/student/quiz/${quizId}`);
        return;
      }

      setQuizInfo({
        quizName: quiz.quizName,
        attemptId: quiz.attemptId ?? undefined,
        score: quiz.score,
        answersReleased: quiz.answersReleased,
      });

      if (quiz.attemptId) {
        const detailed = await quizExtensionsApi.getDetailedReview(quiz.attemptId);
        setReviewData(detailed);
      }
    } catch (error) {
      console.error('Error fetching review:', error);
      toast.error('Failed to load review data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateExplanations = async () => {
    if (!quizInfo?.attemptId) {
      toast.error('No attempt ID found. Please try refreshing the page.');
      return;
    }
    setGenerating(true);
    try {
      await quizExtensionsApi.generateReviewItems(quizInfo.attemptId);
      toast.success('AI explanations are being generated. Refreshing...');
      setTimeout(async () => {
        await fetchData();
      }, 2000);
    } catch (error) {
      console.error('Error generating explanations:', error);
      const { getApiErrorMessage } = await import('@/lib/api/client');
      const message = getApiErrorMessage(error);
      toast.error(`Failed to generate explanations: ${message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">No review data available</h2>
          <p className="text-muted-foreground mb-6">
            Detailed review will be available after your lecturer releases the answers.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href={`/student/quiz/${quizId}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quiz
              </Button>
            </Link>
            <Link href="/student/quizzes">
              <Button>View All Quizzes</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = reviewData.questions[currentIndex];
  const totalQuestions = reviewData.questions.length;
  const correctCount = reviewData.questions.filter((q) => q.isCorrect === true).length;
  const incorrectCount = reviewData.questions.filter((q) => q.isCorrect === false).length;
  const unansweredCount = reviewData.questions.filter((q) => !q.isCorrect && q.isCorrect !== false).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/student/quiz/${quizId}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Quiz
            </Link>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="font-headline text-lg font-bold">{reviewData.quizTitle}</h1>
              <p className="text-sm text-muted-foreground">
                Detailed Review - {reviewData.totalQuestions} questions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {quizInfo?.score != null && (
              <div className="text-right">
                <p className="text-2xl font-black text-primary">{quizInfo.score.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Your Score</p>
              </div>
            )}
            {isRefreshing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Checking for updates...</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">{reviewData.totalQuestions}</p>
              <p className="text-sm text-muted-foreground">Total Questions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-success">{correctCount}</p>
              <p className="text-sm text-muted-foreground">Correct</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-destructive">{incorrectCount}</p>
              <p className="text-sm text-muted-foreground">Incorrect</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-warning">{unansweredCount}</p>
              <p className="text-sm text-muted-foreground">Unanswered</p>
            </CardContent>
          </Card>
        </div>

        {/* Generate AI Explanations Button */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">AI-Powered Explanations</p>
                  <p className="text-sm text-muted-foreground">
                    Get detailed explanations for each question to understand your mistakes
                  </p>
                </div>
              </div>
              <Button
                onClick={handleGenerateExplanations}
                disabled={generating}
                className="bg-gradient-to-r from-primary to-[#007BFF] min-w-[160px]"
              >
                <Loader2 className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : 'hidden'}`} />
                <BrainCircuit className={`h-4 w-4 mr-2 ${generating ? 'hidden' : ''}`} />
                <span>{generating ? 'Generating...' : 'Generate with AI'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Question Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {reviewData.questions.map((q, idx) => {
            let tabClass = 'bg-muted text-muted-foreground border border-border hover:bg-muted/80';
            if (idx === currentIndex) {
              tabClass = 'bg-primary text-white ring-2 ring-primary ring-offset-2';
            } else if (q.isCorrect === true) {
              tabClass = 'bg-success/10 text-success border border-success/30 hover:bg-success/20';
            } else if (q.isCorrect === false) {
              tabClass = 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20';
            }
            return (
              <button
                key={q.questionId}
                onClick={() => setCurrentIndex(idx)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-all ${tabClass}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Current Question Detail */}
        {currentQuestion && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">
                    {currentIndex + 1}
                  </span>
                  Question {currentIndex + 1} of {totalQuestions}
                </CardTitle>
                {currentQuestion.isCorrect === true && (
                  <Badge className="bg-success/10 text-success border border-success/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Correct
                  </Badge>
                )}
                {currentQuestion.isCorrect === false && (
                  <Badge className="bg-destructive/10 text-destructive border border-destructive/30">
                    <XCircle className="h-3 w-3 mr-1" />
                    Incorrect
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Question Image - Hiển thị X-ray image nếu có */}
              {currentQuestion.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-border bg-black/5">
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {currentQuestion.caseTitle || 'Case Image'}
                    </span>
                  </div>
                  <div className="p-4 flex justify-center">
                    <img
                      src={resolveApiAssetUrl(currentQuestion.imageUrl)}
                      alt={currentQuestion.caseTitle || 'Case X-ray'}
                      className="max-h-[400px] w-auto object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Question Text */}
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-lg font-medium">{currentQuestion.questionText}</p>
              </div>

              {/* Answer Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-lg ${
                    currentQuestion.isCorrect
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-destructive/10 border border-destructive/20'
                  }`}
                >
                  <p className="text-sm font-semibold mb-2 text-muted-foreground">Your Answer</p>
                  <p className="font-medium">{currentQuestion.studentAnswer || 'No answer'}</p>
                </div>
                {!currentQuestion.isCorrect && currentQuestion.correctAnswer && (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm font-semibold mb-2 text-muted-foreground">Correct Answer</p>
                    <p className="font-medium text-success">{currentQuestion.correctAnswer}</p>
                  </div>
                )}
              </div>

              {/* AI Explanation */}
              <div className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold text-primary">AI Explanation</h4>
                </div>
                {currentQuestion.aiExplanation ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{currentQuestion.aiExplanation}</p>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lightbulb className="h-4 w-4" />
                    <span>Explanation not yet generated. Click &quot;Generate with AI&quot; above to create explanations.</span>
                  </div>
                )}
              </div>

              {/* Lecturer Feedback - Hiển thị feedback từ lecturer */}
              {currentQuestion.lecturerFeedback && (
                <div className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-transparent p-5 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-transparent">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400">L</span>
                    </div>
                    <h4 className="font-semibold text-amber-700 dark:text-amber-400">Lecturer Feedback</h4>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-amber-900 dark:text-amber-200">
                    {currentQuestion.lecturerFeedback}
                  </p>
                </div>
              )}

              {/* Reference Answer - Hiển thị đáp án mẫu từ lecturer/expert */}
              {currentQuestion.referenceAnswer && (
                <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-transparent p-5 dark:border-blue-800/50 dark:from-blue-950/30 dark:to-transparent">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">R</span>
                    </div>
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400">Reference Answer</h4>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-blue-900 dark:text-blue-200">
                    {currentQuestion.referenceAnswer}
                  </p>
                </div>
              )}

              {/* Topic Tags */}
              {currentQuestion.topicTags && currentQuestion.topicTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm text-muted-foreground">Topic Tags</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentQuestion.topicTags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Cases */}
              {currentQuestion.relatedCases && currentQuestion.relatedCases.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm text-muted-foreground">Related Cases for Further Study</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentQuestion.relatedCases.map((relatedCase: RelatedCase) => (
                      <Link
                        key={relatedCase.caseId}
                        href={`/student/cases/${relatedCase.caseId}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{relatedCase.caseTitle}</p>
                          {relatedCase.boneSpecialty && (
                            <p className="text-xs text-muted-foreground">{relatedCase.boneSpecialty}</p>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))}
            disabled={currentIndex === totalQuestions - 1}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Quick Links */}
        <div className="mt-8 pt-8 border-t">
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/student/quizzes">
              <Button variant="outline">View All Quizzes</Button>
            </Link>
            <Link href="/student/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <Button variant="outline" onClick={() => router.refresh()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
