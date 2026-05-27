'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { 
  fetchStudentPracticeQuiz, 
  submitStudentQuiz, 
  generateAIPracticeQuiz,
  fetchBoneSpecialtyOptions,
  fetchPathologyCategoryOptions,
  fetchAvailableCasesForQuiz,
  generateAIPracticeQuizFromCases,
  type BoneSpecialtyOption,
  type PathologyCategoryOption,
  type AvailableCaseForQuiz,
  createFlashcardDeck,
  importFlashcards,
  type ImportFlashcardItem
} from '@/lib/api/student';
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
  ChevronDown,
  X,
  Layers,
  Target,
  BrainCircuit,
  Stethoscope,
  Lightbulb,
  FolderOpen,
  Check,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';

// Organized topic structure with categories
const topicCategories = {
  'Fractures': [
    'Long Bone Fractures',
    'Spine Fractures',
    'Pelvis & Hip Fractures',
    'Hand & Foot Fractures',
    'Stress Fractures',
  ],
  'Lesions & Diseases': [
    'Spine Lesions',
    'Joint Diseases',
    'Bone Tumors',
    'Metabolic Bone Diseases',
    'Infectious Bone Diseases',
  ],
  'Anatomical Regions': [
    'Upper Extremity',
    'Lower Extremity',
    'Skull & Face',
    'Thorax & Ribs',
  ],
  'General Topics': [
    'Pediatric Bone Conditions',
    'Degenerative Conditions',
    'Vascular Bone Disorders',
  ],
};

// Flat list of all topics for backward compatibility
const allTopics = Object.values(topicCategories).flat();

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
  multiSelectAnswers: Record<string, string[]>; // For MultiSelect questions
  textAnswers: Record<string, string>; // For FillInBlank questions
  searchTerm: string;
  page: number;
  questionCount: number;
  boneSpecialtyId: string;
  pathologyCategoryId: string;
};

const EMPTY_QUIZ_DRAFT: StudentQuizDraft = {
  topic: allTopics[0],
  difficulty: '',
  answers: {},
  multiSelectAnswers: {},
  textAnswers: {},
  searchTerm: '',
  page: 1,
  questionCount: 5,
  boneSpecialtyId: '',
  pathologyCategoryId: '',
};

export function StudentPracticeQuizContent({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [quizDraft, setQuizDraft, clearQuizDraft] = useLocalStorageState<StudentQuizDraft>(
    'student-quiz-draft',
    EMPTY_QUIZ_DRAFT,
  );
  
  // Basic filters
  const [topic, setTopic] = useState(quizDraft.topic || allTopics[0]);
  const [difficulty, setDifficulty] = useState(quizDraft.difficulty || '');
  const [searchTerm, setSearchTerm] = useState(quizDraft.searchTerm || '');
  const [page, setPage] = useState(quizDraft.page || 1);
  const [questionCount, setQuestionCount] = useState(quizDraft.questionCount || 5);
  
  // Deep classification filters
  const [boneSpecialties, setBoneSpecialties] = useState<BoneSpecialtyOption[]>([]);
  const [pathologyCategories, setPathologyCategories] = useState<PathologyCategoryOption[]>([]);
  const [selectedBoneSpecialty, setSelectedBoneSpecialty] = useState(quizDraft.boneSpecialtyId || '');
  const [selectedPathologyCategory, setSelectedPathologyCategory] = useState(quizDraft.pathologyCategoryId || '');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  
  // Quiz state
  const [quiz, setQuiz] = useState<StudentPracticeQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(quizDraft.answers || {});
  const [multiSelectAnswers, setMultiSelectAnswers] = useState<Record<string, string[]>>(quizDraft.multiSelectAnswers || {});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>(quizDraft.textAnswers || {});
  const [shownHints, setShownHints] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<StudentQuizSubmissionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
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
    explanation?: string;
    caseId?: string;
    caseTitle?: string;
  }>>([]);

  // Case Selection state
  const [showCaseSelector, setShowCaseSelector] = useState(false);
  const [availableCases, setAvailableCases] = useState<AvailableCaseForQuiz[]>([]);
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [loadingCases, setLoadingCases] = useState(false);
  const [caseSearchTerm, setCaseSearchTerm] = useState('');
  const [generatingFromCases, setGeneratingFromCases] = useState(false);

  // Bookmark state for AI questions
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savingToFlashcard, setSavingToFlashcard] = useState(false);

  // Load classification options
  useEffect(() => {
    const loadFilters = async () => {
      setLoadingFilters(true);
      try {
        const [specialties, pathologies] = await Promise.all([
          fetchBoneSpecialtyOptions(),
          fetchPathologyCategoryOptions(),
        ]);
        setBoneSpecialties(specialties);
        setPathologyCategories(pathologies);
      } catch (error) {
        console.error('Error loading classification filters:', error);
        // Use empty arrays - filters will just show "All" option
      } finally {
        setLoadingFilters(false);
      }
    };
    loadFilters();
  }, []);

  // Filter topics based on search
  const filteredTopics = useMemo(() => {
    if (!searchTerm.trim()) return allTopics;
    const search = searchTerm.toLowerCase();
    
    const matchingTopics = allTopics.filter(t => 
      t.toLowerCase().includes(search)
    );
    
    // Also search in category names
    const matchingCategories = Object.entries(topicCategories)
      .filter(([cat]) => cat.toLowerCase().includes(search))
      .flatMap(([, topics]) => topics);
    
    // Combine and dedupe
    const combined = [...matchingTopics, ...matchingCategories];
    return [...new Set(combined)];
  }, [searchTerm]);

  // Group filtered topics by category
  const filteredTopicCategories = useMemo(() => {
    if (searchTerm.trim()) {
      // When searching, show flat list grouped by search results
      return { 'Search Results': filteredTopics };
    }
    
    // Filter categories based on selected classifications
    let result: Record<string, string[]> = {};
    
    for (const [category, topics] of Object.entries(topicCategories)) {
      if (selectedBoneSpecialty || selectedPathologyCategory) {
        // Filter topics based on bone specialty or pathology category
        const matchingTopics = topics.filter(t => {
          // Check if topic matches selected bone specialty
          if (selectedBoneSpecialty) {
            const specialty = boneSpecialties.find(s => s.id === selectedBoneSpecialty);
            if (specialty && t.toLowerCase().includes(specialty.name.toLowerCase())) {
              return true;
            }
          }
          // Check if topic matches selected pathology category
          if (selectedPathologyCategory) {
            const pathology = pathologyCategories.find(p => p.id === selectedPathologyCategory);
            if (pathology && t.toLowerCase().includes(pathology.name.toLowerCase())) {
              return true;
            }
          }
          return false;
        });
        if (matchingTopics.length > 0 || !selectedBoneSpecialty && !selectedPathologyCategory) {
          result[category] = !selectedBoneSpecialty && !selectedPathologyCategory ? topics : matchingTopics;
        }
      } else {
        result[category] = topics;
      }
    }
    
    return result;
  }, [searchTerm, filteredTopics, selectedBoneSpecialty, selectedPathologyCategory, boneSpecialties, pathologyCategories]);

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
      const correctCount = aiQuestions.filter((q, index) => {
        const studentAnswer = answers[`ai-${index}`] || '';
        const correct = q.correctAnswer || '';
        // MultiSelect: sort both before comparing
        if (q.type?.toLowerCase() === 'multiselect' || q.type?.toLowerCase() === 'multi-select') {
          return (
            studentAnswer.split(',').map(k => k.trim()).filter(Boolean).sort().join(',') ===
            correct.split(',').map(k => k.trim()).filter(Boolean).sort().join(',')
          );
        }
        return studentAnswer.toUpperCase() === correct.toUpperCase();
      }).length;
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
    setMultiSelectAnswers({});
    setTextAnswers({});
    setShownHints({});
    setResult(null);
    setPage(1);
    setSelectedCases(new Set());
    setBookmarkedQuestions(new Set());
    clearQuizDraft();
  };

  // Toggle bookmark for a question
  const toggleBookmark = (questionId: string) => {
    setBookmarkedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // Toggle MultiSelect option
  const handleMultiSelectToggle = (questionId: string, key: string) => {
    setMultiSelectAnswers(prev => {
      const prevKeys = prev[questionId] ?? [];
      const next = prevKeys.includes(key)
        ? prevKeys.filter(k => k !== key)
        : [...prevKeys, key];
      setAnswers(a => {
        const updated = { ...a };
        updated[questionId] = next.join(',');
        return updated;
      });
      return { ...prev, [questionId]: next };
    });
  };

  // Save bookmarked questions to flashcards
  const handleSaveBookmarkedToFlashcards = async () => {
    if (bookmarkedQuestions.size === 0) {
      toast.error('Please bookmark at least one question first.');
      return;
    }

    setSavingToFlashcard(true);
    try {
      // Create a new deck for bookmarked questions
      const deck = await createFlashcardDeck(
        `Practice Quiz - ${topic}`,
        `Bookmarked questions from AI Practice Quiz: ${topic}`
      );

      // Prepare cards for import
      const cards: ImportFlashcardItem[] = [];
      for (const qId of bookmarkedQuestions) {
        const index = parseInt(qId.replace('ai-', ''));
        const question = aiQuestions[index];
        if (question) {
          cards.push({
            frontContent: question.questionText,
            backContent: `${question.correctAnswer}. ${question[`option${question.correctAnswer}` as keyof typeof question] || ''}`
          });
        }
      }

      // Import all cards at once
      await importFlashcards(deck.id, cards);

      toast.success(`Đã lưu ${cards.length} câu hỏi vào bộ "${deck.deckName}"!`);
      setBookmarkedQuestions(new Set());
      setShowSaveDialog(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save flashcards.');
    } finally {
      setSavingToFlashcard(false);
    }
  };

  // Save all AI questions to flashcards
  const handleSaveAllToFlashcards = async () => {
    if (aiQuestions.length === 0) {
      toast.error('No questions to save.');
      return;
    }

    setSavingToFlashcard(true);
    try {
      // Create a new deck
      const deck = await createFlashcardDeck(
        `Practice Quiz - ${topic}`,
        `All questions from AI Practice Quiz: ${topic}`
      );

      // Prepare cards for import
      const cards: ImportFlashcardItem[] = aiQuestions.map(question => ({
        frontContent: question.questionText,
        backContent: `${question.correctAnswer}. ${question[`option${question.correctAnswer}` as keyof typeof question] || ''}`
      }));

      // Import all cards at once
      await importFlashcards(deck.id, cards);

      toast.success(`Đã lưu ${aiQuestions.length} câu hỏi vào bộ "${deck.deckName}"!`);
      setShowSaveDialog(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save flashcards.');
    } finally {
      setSavingToFlashcard(false);
    }
  };

  // Load available cases for quiz generation
  const handleLoadCases = async (search?: string) => {
    setLoadingCases(true);
    try {
      const cases = await fetchAvailableCasesForQuiz(search || caseSearchTerm, 50);
      setAvailableCases(cases);
    } catch (error) {
      console.error('Error loading cases:', error);
      toast.error('Failed to load available cases.');
    } finally {
      setLoadingCases(false);
    }
  };

  // Toggle case selection
  const toggleCaseSelection = (caseId: string) => {
    setSelectedCases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  // Generate AI quiz from selected cases
  const handleGenerateQuizFromCases = async () => {
    if (selectedCases.size === 0) {
      toast.error('Please select at least 1 case.');
      return;
    }

    setGeneratingFromCases(true);
    setLoading(true);
    setResult(null);
    setAnswers({});
    setPage(1);

    try {
      const selectedCasesData = availableCases
        .filter((c) => selectedCases.has(c.caseId))
        .map((c) => ({
          caseId: c.caseId,
          caseTitle: c.caseTitle,
          caseDescription: c.caseDescription ?? undefined,
          keyFindings: c.keyFindings ?? undefined,
          suggestedDiagnosis: c.suggestedDiagnosis ?? undefined,
          difficulty: c.difficulty ?? undefined,
          imageUrl: c.imageUrl ?? undefined,
          modality: c.modality ?? undefined,
        }));

      const data = await generateAIPracticeQuizFromCases(
        selectedCasesData,
        questionCount,
        difficulty || undefined
      );

      if (data.questions.length > 0) {
        // Convert to AI questions format and navigate to quiz session
        const quizData = await generateAIPracticeQuiz(
          data.topic || 'Case-based Quiz',
          questionCount,
          difficulty || undefined
        );
        
        if (quizData.success && quizData.questions.length > 0) {
          setAiQuestions(quizData.questions);
          toast.success(`AI generated ${quizData.questions.length} questions from ${selectedCases.size} case(s)!`);
          setShowCaseSelector(false);
        } else {
          // Use the session directly if available
          if (data.quizId) {
            router.push(`/student/quiz/${data.attemptId}`);
            toast.success('Quiz generated! Redirecting to quiz session...');
          } else {
            toast.error(data.message || 'Failed to generate quiz from cases.');
          }
        }
      } else {
        toast.error(data.message || 'Failed to generate quiz from cases.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz from cases.');
    } finally {
      setGeneratingFromCases(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    setQuizDraft({
      topic,
      difficulty,
      answers,
      multiSelectAnswers,
      textAnswers,
      searchTerm,
      page,
      questionCount,
      boneSpecialtyId: selectedBoneSpecialty,
      pathologyCategoryId: selectedPathologyCategory,
    });
  }, [answers, multiSelectAnswers, textAnswers, difficulty, page, questionCount, searchTerm, setQuizDraft, topic, selectedBoneSpecialty, selectedPathologyCategory]);

  return (
    <div className={embedded ? '' : 'min-h-screen'}>
      {!embedded ? (
        <Header
          title="Quiz Arena"
          subtitle="Practice with live backend quizzes or generate AI-assisted question sets by topic."
        />
      ) : null}
      <div className={embedded ? 'space-y-4' : 'mx-auto max-w-7xl space-y-8 px-4 pb-16 pt-6 sm:px-6'}>
        {/* Embedded compact bar: topic selector + AI config in one row */}
        {embedded && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 backdrop-blur-sm">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm font-medium text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {allTopics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {[3, 5, 10, 15].map((n) => (
                <option key={n} value={n}>{n} Qs</option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {difficultyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={handleAIGenerateQuiz}
              isLoading={aiGenerating}
              className="gap-1.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Quiz
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCaseSelector(true);
                void handleLoadCases();
              }}
              className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              From Cases
            </Button>
            <div className="ml-auto">
              <Button
                type="button"
                size="sm"
                onClick={handleLoadQuiz}
                isLoading={loading}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                Practice
              </Button>
            </div>
          </div>
        )}

        {/* Non-embedded search + filter bar */}
        {!embedded && (
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
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                showAdvancedFilters || selectedBoneSpecialty || selectedPathologyCategory
                  ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
              }`}
            >
              <Layers className="h-4 w-4" />
              Deep Classification
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
            <select className="h-10 appearance-none rounded-lg border border-border bg-background px-4 pr-10 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <option>Sort by: Recent</option>
              <option>Sort by: Name</option>
              <option>Sort by: Difficulty</option>
            </select>
          </div>
        )}

        {/* Advanced Classification Filters */}
        {showAdvancedFilters && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-card-foreground">Deep Classification Filters</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBoneSpecialty('');
                  setSelectedPathologyCategory('');
                  setShowAdvancedFilters(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
            
            {loadingFilters ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading classification options...
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Bone Specialty Filter */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">
                    <Stethoscope className="mr-2 inline h-4 w-4" />
                    Bone Specialty
                  </label>
                  <select
                    value={selectedBoneSpecialty}
                    onChange={(e) => setSelectedBoneSpecialty(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">All Bone Specialties</option>
                    {boneSpecialties.map((specialty) => (
                      <option key={specialty.id} value={specialty.id}>
                        {specialty.name} {specialty.parentName ? `(${specialty.parentName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Pathology Category Filter */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">
                    <BrainCircuit className="mr-2 inline h-4 w-4" />
                    Pathology Category
                  </label>
                  <select
                    value={selectedPathologyCategory}
                    onChange={(e) => setSelectedPathologyCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">All Pathology Categories</option>
                    {pathologyCategories.map((pathology) => (
                      <option key={pathology.id} value={pathology.id}>
                        {pathology.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            {/* Active filters display */}
            {(selectedBoneSpecialty || selectedPathologyCategory) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedBoneSpecialty && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary">
                    {boneSpecialties.find(s => s.id === selectedBoneSpecialty)?.name}
                    <button
                      type="button"
                      onClick={() => setSelectedBoneSpecialty('')}
                      className="ml-1 hover:text-primary/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedPathologyCategory && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-secondary px-3 py-1 text-xs font-medium text-secondary">
                    {pathologyCategories.find(p => p.id === selectedPathologyCategory)?.name}
                    <button
                      type="button"
                      onClick={() => setSelectedPathologyCategory('')}
                      className="ml-1 hover:text-secondary/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Case Selector Modal */}
        {showCaseSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-card-foreground">Select Cases for AI Quiz</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose 1 or more cases to generate a personalized practice quiz
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCaseSelector(false)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="border-b border-border p-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={caseSearchTerm}
                    onChange={(e) => setCaseSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleLoadCases();
                      }
                    }}
                    placeholder="Search cases by title, diagnosis, or findings..."
                    className="rounded-lg pl-10"
                  />
                </div>
              </div>

              {/* Case List */}
              <div className="max-h-[50vh] overflow-y-auto p-4">
                {loadingCases ? (
                  <div className="flex min-h-[200px] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading cases...</span>
                  </div>
                ) : availableCases.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                    <FolderOpen className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      No cases found. Try a different search term.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleLoadCases()}
                      className="mt-3"
                    >
                      Load all cases
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableCases.map((caseItem) => {
                      const isSelected = selectedCases.has(caseItem.caseId);
                      return (
                        <button
                          key={caseItem.caseId}
                          type="button"
                          onClick={() => toggleCaseSelection(caseItem.caseId)}
                          className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary text-white'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-card-foreground truncate">
                                  {caseItem.caseTitle}
                                </h4>
                                {caseItem.suggestedDiagnosis && (
                                  <p className="mt-1 text-xs text-primary">
                                    Diagnosis: {caseItem.suggestedDiagnosis}
                                  </p>
                                )}
                              </div>
                              {caseItem.difficulty && (
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  {caseItem.difficulty}
                                </span>
                              )}
                            </div>
                            {caseItem.keyFindings && (
                              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                Findings: {caseItem.keyFindings}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                              {caseItem.modality && (
                                <span className="rounded bg-muted px-1.5 py-0.5">
                                  {caseItem.modality}
                                </span>
                              )}
                              {caseItem.imageUrl && (
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  Has image
                                </span>
                              )}
                            </div>
                          </div>
                          {caseItem.imageUrl && (
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolveApiAssetUrl(caseItem.imageUrl)}
                                alt={caseItem.caseTitle}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border p-6">
                <div className="text-sm text-muted-foreground">
                  {selectedCases.size > 0 ? (
                    <span>
                      <span className="font-semibold text-primary">{selectedCases.size}</span> case(s) selected
                    </span>
                  ) : (
                    <span>Select at least 1 case</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCaseSelector(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleGenerateQuizFromCases()}
                    disabled={selectedCases.size === 0 || generatingFromCases}
                    isLoading={generatingFromCases}
                    className="bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Quiz from Cases
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ─── MAIN PRACTICE SECTION ─── */}
      {/* When a quiz or AI questions are loaded → show the Practice Quiz Builder */}
      {(quiz || aiQuestions.length > 0) ? (
        <div className="overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm">
          {/* Section header */}
          <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${aiQuestions.length > 0 ? 'bg-purple-100' : 'bg-primary/10'}`}>
                {aiQuestions.length > 0 ? <Sparkles className="h-5 w-5 text-purple-600" /> : <BarChart3 className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-card-foreground">
                  {quiz ? 'Practice Quiz' : `AI Quiz — ${topic}`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {quiz ? `${quiz.questions.length} questions · ${quiz.topic}` : `${aiQuestions.length} AI-generated questions`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {quiz && (
                <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />{quiz.questions.length} questions — {completion}% done
                </div>
              )}
              {aiQuestions.length > 0 && !quiz && !result && (
                <Button type="button" onClick={handleSubmitAIQuiz} isLoading={submitting}
                  className="rounded-full bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-2 text-sm font-bold text-white">
                  Submit AI Quiz
                </Button>
              )}
            </div>
          </div>

          {/* Quiz content */}
          <div className="p-6">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  {aiGenerating ? 'Generating AI quiz…' : 'Fetching practice quiz…'}
                </div>
              </div>
            ) : quiz ? (
              <div className="space-y-4">
                {quiz.questions.map((question, index) => {
                  const isTrueFalse = question.type?.toLowerCase() === 'truefalse' || question.type?.toLowerCase() === 'true/false';
                  const isMultiSelect = question.type?.toLowerCase() === 'multiselect' || question.type?.toLowerCase() === 'multi-select';
                  const quizMultiSelectedKeys = multiSelectAnswers[question.questionId];
                  return (
                    <div key={question.questionId} className="rounded-2xl border border-border bg-background p-6 shadow-sm">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Question</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {question.type && <span className="rounded-full border border-secondary px-3 py-1 text-xs font-medium text-secondary">{question.type}</span>}
                          {question.imageUrl && (
                            <button type="button" onClick={() => window.open(resolveApiAssetUrl(question.imageUrl), '_blank')}
                              className="rounded-full bg-primary/10 p-2 text-primary hover:bg-primary/20" title="View image">
                              <ImageIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h2 className="mb-4 font-['Manrope',sans-serif] text-base font-semibold text-card-foreground">{question.questionText}</h2>
                      {question.imageUrl && (
                        <div className="mb-4 overflow-hidden rounded-xl border border-border">
                          <img src={resolveApiAssetUrl(question.imageUrl)} alt={`Q${index + 1}`} className="max-h-64 w-full object-contain" />
                        </div>
                      )}
                      {isTrueFalse ? (
                        <div className="grid grid-cols-2 gap-3">
                          {(['True', 'False'] as const).map((opt) => {
                            const isSelected = answers[question.questionId] === opt;
                            return (
                              <button key={opt} type="button" onClick={() => setAnswers(prev => ({ ...prev, [question.questionId]: opt }))}
                                className={`rounded-xl border px-4 py-4 text-center text-base font-semibold transition-all ${isSelected ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' : 'border-border bg-background/70 text-muted-foreground hover:bg-muted'}`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : isMultiSelect ? (
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">Chọn tất cả đáp án đúng (có thể chọn nhiều hơn 1)</p>
                          {(['A', 'B', 'C', 'D'] as const).map((key) => {
                            const text = question[`option${key}` as keyof typeof question];
                            if (!text) return null;
                            const isSelected = quizMultiSelectedKeys?.includes(key) ?? false;
                            return (
                              <button key={key} type="button"
                                onClick={() => handleMultiSelectToggle(question.questionId, key)}
                                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${isSelected ? 'border-primary bg-primary/10 text-card-foreground ring-1 ring-primary/30' : 'border-border bg-background/70 text-muted-foreground hover:bg-muted'}`}>
                                <span className={`mr-2 font-bold ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>{key}.</span>{text}
                              </button>
                            );
                          })}
                          {quizMultiSelectedKeys && quizMultiSelectedKeys.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Đã chọn: {Array.from(quizMultiSelectedKeys).sort().join(', ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {[{ key: 'A', value: question.optionA }, { key: 'B', value: question.optionB }, { key: 'C', value: question.optionC }, { key: 'D', value: question.optionD }].map((option) => {
                            const isSelected = answers[question.questionId] === option.key;
                            return (
                              <button key={option.key} type="button" onClick={() => setAnswers(prev => ({ ...prev, [question.questionId]: option.key }))}
                                className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${isSelected ? 'border-primary bg-primary/10 text-card-foreground ring-1 ring-primary/30' : 'border-border bg-background/70 text-muted-foreground hover:bg-muted'}`}>
                                <span className="mr-2 font-bold text-primary">{option.key}.</span>{option.value}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : aiQuestions.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-700">AI Generated — {topic}</span>
                  <span className="ml-auto rounded-full bg-purple-200 px-2 py-0.5 text-xs font-bold text-purple-800">{aiQuestions.length} Qs</span>
                </div>
                {aiQuestions.map((question, index) => {
                  const isTrueFalse = question.type?.toLowerCase() === 'truefalse' || question.type?.toLowerCase() === 'true/false';
                  const isMultiSelect = question.type?.toLowerCase() === 'multiselect' || question.type?.toLowerCase() === 'multi-select';
                  const questionId = `ai-${index}`;
                  const aiMultiSelectedKeys = multiSelectAnswers[questionId];
                  return (
                    <div key={questionId} className="rounded-2xl border border-purple-200 bg-background p-6 shadow-sm">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-600">{index + 1}</span>
                          <span className="text-xs font-semibold uppercase tracking-widest text-purple-600">Question</span>
                        </div>
                        {question.caseTitle && <span className="rounded-full border border-secondary px-3 py-1 text-xs font-medium text-secondary">Case: {question.caseTitle}</span>}
                      </div>
                      <h2 className="mb-4 font-['Manrope',sans-serif] text-base font-semibold text-card-foreground">{question.questionText}</h2>
                      {isTrueFalse ? (
                        <div className="grid grid-cols-2 gap-3">
                          {(['True', 'False'] as const).map((opt) => {
                            const isSelected = answers[questionId] === opt;
                            return (
                              <button key={opt} type="button" onClick={() => setAnswers(prev => ({ ...prev, [questionId]: opt }))}
                                className={`rounded-xl border px-4 py-4 text-center text-base font-semibold transition-all ${isSelected ? 'border-purple-500 bg-purple-100 text-purple-700 ring-1 ring-purple-500/30' : 'border-border bg-background/70 text-muted-foreground hover:bg-muted'}`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : isMultiSelect ? (
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">Chọn tất cả đáp án đúng (có thể chọn nhiều hơn 1)</p>
                          {(['A', 'B', 'C', 'D'] as const).map((key) => {
                            const text = question[`option${key}` as keyof typeof question];
                            if (!text) return null;
                            const isSelected = aiMultiSelectedKeys?.includes(key) ?? false;
                            return (
                              <button key={key} type="button"
                                onClick={() => handleMultiSelectToggle(questionId, key)}
                                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${isSelected ? 'border-purple-500 bg-purple-100 text-purple-700 ring-1 ring-purple-500/30' : 'border-border bg-background/70 text-muted-foreground hover:bg-muted'}`}>
                                <span className={`mr-2 font-bold ${isSelected ? 'text-purple-600' : 'text-muted-foreground'}`}>{key}.</span>{text}
                              </button>
                            );
                          })}
                          {aiMultiSelectedKeys && aiMultiSelectedKeys.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Đã chọn: {Array.from(aiMultiSelectedKeys).sort().join(', ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {[{ key: 'A', value: question.optionA }, { key: 'B', value: question.optionB }, { key: 'C', value: question.optionC }, { key: 'D', value: question.optionD }].map((option) => {
                            const isSelected = answers[questionId] === option.key;
                            return (
                              <button key={option.key} type="button" onClick={() => setAnswers(prev => ({ ...prev, [questionId]: option.key }))}
                                className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${isSelected ? 'border-purple-500 bg-purple-100 text-purple-700 ring-1 ring-purple-500/30' : 'border-border bg-background/70 text-muted-foreground hover:bg-muted'}`}>
                                <span className="mr-2 font-bold text-purple-600">{option.key}.</span>{option.value}
                              </button>
                            );
                          })}
                        </div>
                      )}
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
                    <Button type="button" onClick={handleSubmit} isLoading={submitting} disabled={submitting}
                      className="rounded-xl bg-gradient-to-r from-primary to-[#007BFF] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95">
                      {!submitting && <CheckCircle className="mr-2 h-4 w-4" />}Submit quiz
                    </Button>
                    <Button type="button" variant="outline" onClick={handleReset} className="rounded-xl px-6 py-3 text-sm font-medium">
                      <RotateCcw className="mr-2 h-4 w-4" />Reset
                    </Button>
                  </>
                )}
                {aiQuestions.length > 0 && (
                  <>
                    <Button type="button" onClick={handleSubmitAIQuiz} isLoading={submitting} disabled={submitting}
                      className="rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95">
                      {!submitting && <CheckCircle className="mr-2 h-4 w-4" />}Submit AI Quiz
                    </Button>
                    <Button type="button" variant="outline" onClick={handleReset} className="rounded-xl px-6 py-3 text-sm font-medium">
                      <RotateCcw className="mr-2 h-4 w-4" />Reset
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── IDLE STATE: Topic selection + Hero + Topics Grid ─── */
        <div className="space-y-6">
          {/* Hero Action Card - Light theme */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-white via-blue-50/50 to-purple-50/30 p-8 shadow-lg">
            {/* Background decorations */}
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-8 -left-8 h-48 w-48 rounded-full bg-purple-200/30 blur-3xl" />

            <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
              {/* Left: Info */}
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                  <Zap className="h-3.5 w-3.5" />Practice Mode
                </div>
                <h2 className="font-['Manrope',sans-serif] text-3xl font-black text-gray-900">
                  Master Radiology,<br />
                  <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">One Question at a Time</span>
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-500">
                  Select a topic and dive into curated quizzes or let AI generate personalized question sets tailored to your level.
                </p>

                {/* Quick stats */}
                <div className="mt-6 flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-black text-primary">{allTopics.length}</p>
                    <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Topics</p>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="text-center">
                    <p className="text-2xl font-black text-gray-700">{Object.keys(topicCategories).length}</p>
                    <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Categories</p>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="text-center">
                    <p className="text-2xl font-black bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">AI</p>
                    <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Powered</p>
                  </div>
                </div>
              </div>

              {/* Right: Quick config */}
              <div className="rounded-2xl border border-primary/15 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">Quick Setup</span>
                </div>

                <div className="space-y-3">
                  {/* Topic */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Topic</label>
                    <select value={topic} onChange={(e) => setTopic(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      {allTopics.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Row: Qs + Difficulty */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Questions</label>
                      <select value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {[3, 5, 10, 15].map((n) => <option key={n} value={n}>{n} questions</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Difficulty</label>
                      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {difficultyOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button type="button" onClick={handleLoadQuiz} isLoading={loading}
                      className="rounded-xl bg-gradient-to-r from-primary to-[#007BFF] py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95 hover:shadow-lg">
                      {!loading && <Play className="mr-1.5 inline h-3.5 w-3.5" />}Practice
                    </Button>
                    <Button type="button" onClick={handleAIGenerateQuiz} isLoading={aiGenerating}
                      className="rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95 hover:shadow-lg">
                      <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />AI Quiz
                    </Button>
                  </div>
                  <Button type="button" variant="outline" onClick={() => { setShowCaseSelector(true); void handleLoadCases(); }}
                    className="w-full rounded-xl border-purple-300 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50">
                    <FolderOpen className="mr-1.5 inline h-3.5 w-3.5" />Generate from Case Library
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Topics Browser */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-card-foreground">Browse Topics</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Click any topic to start practicing immediately</p>
                </div>
                {/* Difficulty filter chips */}
                <div className="hidden flex-wrap gap-2 sm:flex">
                  {difficultyOptions.slice(1).map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setDifficulty(difficulty === opt.value ? '' : opt.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${difficulty === opt.value ? 'bg-primary text-white' : 'border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6">
              {Object.entries(topicCategories).map(([category, topics]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${category === 'Fractures' ? 'bg-red-400' : category === 'Lesions & Diseases' ? 'bg-amber-400' : category === 'Anatomical Regions' ? 'bg-blue-400' : 'bg-green-400'}`} />
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{category}</h4>
                    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{topics.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <button key={t} type="button"
                        onClick={() => { setTopic(t); handleLoadQuiz(); }}
                        disabled={loading}
                        className={`group relative rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:shadow-md ${
                          topic === t
                            ? 'border-primary bg-primary text-white shadow-md'
                            : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary hover:shadow-sm'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                Select a topic from the card on the left or browse the categories below, then click &quot;Start practice&quot; to load a quiz,
                or use AI Quiz Generator for instant questions.
              </p>
            </div>
          ) : quiz ? (
            <div className="space-y-4">
              {quiz.questions.map((question, index) => {
                const questionType = question.type?.toLowerCase() || '';
                const isTrueFalse = questionType === 'truefalse' || questionType === 'true/false';
                const isMultiSelect = questionType === 'multiselect' || questionType === 'multi-select';
                const isFillInBlank = questionType === 'fillinblank' || questionType === 'fill-in-blank';
                const isEssay = questionType === 'essay';
                const showHint = question.hintAvailable && question.hint && !shownHints[question.questionId];

                const isOptionSelected = (key: string) => multiSelectAnswers[question.questionId]?.includes(key) || false;

                return (
                  <div
                    key={question.questionId}
                    className="rounded-2xl border border-border bg-background p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                          Question {index + 1}
                          {isTrueFalse && <span className="ml-2 rounded bg-orange-100 px-2 py-0.5 text-orange-700">True/False</span>}
                          {isMultiSelect && <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-blue-700">Multi-Select</span>}
                          {isFillInBlank && <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-green-700">Fill in Blank</span>}
                          {isEssay && <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-purple-700">Essay</span>}
                        </p>
                        <h2 className="mt-2 font-['Manrope',sans-serif] text-base font-semibold text-card-foreground">
                          {question.questionText}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {question.type && (
                          <span className="rounded-full border border-secondary px-3 py-1 text-xs font-medium text-secondary">
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
                    {/* TRUE/FALSE Questions */}
                    {isTrueFalse && (
                      <div className="flex gap-4">
                        {(['True', 'False'] as const).map((opt) => {
                          const isSelected = answers[question.questionId] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [question.questionId]: opt,
                                }))
                              }
                              className={`flex flex-1 items-center justify-center rounded-xl border px-6 py-4 text-base font-semibold transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                                  : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* MULTI-SELECT Questions */}
                    {isMultiSelect && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">Select all that apply:</p>
                        {(['A', 'B', 'C', 'D'] as const).map((key) => {
                          const optionValue = question[`option${key}` as keyof typeof question];
                          if (!optionValue) return null;
                          const isSelected = isOptionSelected(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setMultiSelectAnswers((prev) => {
                                  const current = prev[question.questionId] || [];
                                  const newAnswers = isSelected
                                    ? current.filter((k) => k !== key)
                                    : [...current, key];
                                  return { ...prev, [question.questionId]: newAnswers };
                                })
                              }
                              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-card-foreground ring-2 ring-primary/30'
                                  : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'
                              }`}
                            >
                              <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                                isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && (
                                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className="font-semibold text-primary">{key}.</span>
                              <span>{optionValue}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* FILL-IN-BLANK Questions */}
                    {isFillInBlank && (
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Type your answer:</label>
                        <Input
                          type="text"
                          value={textAnswers[question.questionId] || ''}
                          onChange={(e) =>
                            setTextAnswers((prev) => ({
                              ...prev,
                              [question.questionId]: e.target.value,
                            }))
                          }
                          placeholder="Enter your answer..."
                          className="rounded-xl border-border bg-background/70 px-4 py-3"
                        />
                      </div>
                    )}

                    {/* ESSAY Questions */}
                    {isEssay && (
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Your answer:</label>
                        <textarea
                          value={textAnswers[question.questionId] || ''}
                          onChange={(e) =>
                            setTextAnswers((prev) => ({
                              ...prev,
                              [question.questionId]: e.target.value,
                            }))
                          }
                          placeholder="Type your essay answer..."
                          className="min-h-[150px] w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-sm"
                        />
                      </div>
                    )}

                    {/* MULTIPLE CHOICE (default) */}
                    {!isTrueFalse && !isMultiSelect && !isFillInBlank && !isEssay && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {(['A', 'B', 'C', 'D'] as const).map((key) => {
                          const optionValue = question[`option${key}` as keyof typeof question];
                          if (!optionValue) return null;
                          const isSelected = answers[question.questionId] === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [question.questionId]: key,
                                }))
                              }
                              className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-card-foreground ring-1 ring-primary/30'
                                  : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'
                              }`}
                            >
                              <span className="mr-2 font-semibold text-primary">{key}.</span>
                              {optionValue}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                const isTrueFalse =
                  question.type?.toLowerCase() === 'truefalse' || question.type?.toLowerCase() === 'true/false';
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
                        <span className="rounded-full border border-secondary px-3 py-1 text-xs font-medium text-secondary">
                          Case: {question.caseTitle}
                        </span>
                      )}
                    </div>
                    {isTrueFalse ? (
                      // True/False options for AI quiz
                      <div className="grid grid-cols-2 gap-3">
                        {(['True', 'False'] as const).map((opt) => {
                          const isSelected = answers[questionId] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [questionId]: opt,
                                }))
                              }
                              className={`rounded-xl border px-4 py-4 text-center text-base transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-100 text-card-foreground ring-1 ring-purple-500/30 font-semibold'
                                  : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'
                              }`}
                            >
                              <span className={`mr-2 font-bold ${isSelected ? 'text-purple-600' : ''}`}>
                                {opt === 'True' ? 'T' : 'F'}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      // Standard ABCD options for AI quiz
                      <div className="grid gap-3 md:grid-cols-2">
                        {[
                          { key: 'A', value: question.optionA },
                          { key: 'B', value: question.optionB },
                          { key: 'C', value: question.optionC },
                          { key: 'D', value: question.optionD },
                        ].map((option) => {
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
                    )}
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

      {/* Results Section - AI Quiz with Answer Review */}
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

          {/* Correct Answers Summary */}
          <div className="p-6">
            <div className="rounded-2xl border border-border bg-background p-6 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Correct Answers</p>
              <p className="mt-2 text-4xl font-extrabold text-success">
                {result.correctAnswers} <span className="text-2xl text-muted-foreground">/ {result.totalQuestions}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.correctAnswers === result.totalQuestions
                  ? "Perfect score! Great job!"
                  : `Keep practicing to improve!`}
              </p>
            </div>
          </div>

          {/* Question Navigation Bookmark - Always visible */}
          {aiQuestions.length > 0 && (
            <div className="border-t border-border bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-purple-700">Jump to question:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {aiQuestions.map((q, i) => {
                    const studentAnswer = answers[`ai-${i}`]?.toUpperCase();
                    const isCorrect = studentAnswer === q.correctAnswer?.toUpperCase();
                    return (
                      <button
                        key={`ai-${i}`}
                        type="button"
                        onClick={() => {
                          document.getElementById(`ai-review-q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all shadow-sm hover:scale-110 hover:shadow-md ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-red-400 bg-red-400 text-white'
                        }`}
                        title={`Question ${i + 1}: ${isCorrect ? 'Correct' : 'Incorrect'}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="hidden items-center gap-3 text-xs sm:flex">
                  <span className="flex items-center gap-1 font-medium text-emerald-600">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" /> Correct
                  </span>
                  <span className="flex items-center gap-1 font-medium text-red-500">
                    <span className="h-3 w-3 rounded-full bg-red-400" /> Incorrect
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Answer Review with Bookmark Navigation */}
          {aiQuestions.length > 0 && (
            <div className="border-t border-border">
              {/* Question-by-Question Review */}
              <div className="space-y-4 p-6">
                <h4 className="font-semibold text-card-foreground">Answer Review</h4>
                {aiQuestions.map((question, index) => {
                  const questionId = `ai-${index}`;
                  const studentAnswer = answers[questionId];
                  const isCorrect =
                    question.type?.toLowerCase() === 'multiselect' || question.type?.toLowerCase() === 'multi-select'
                      ? (studentAnswer || '').split(',').map((k) => k.trim()).filter(Boolean).sort().join(',') ===
                        (question.correctAnswer || '').split(',').map((k) => k.trim()).filter(Boolean).sort().join(',')
                      : (studentAnswer || '').toUpperCase() === (question.correctAnswer || '').toUpperCase();
                  const isTrueFalse =
                    question.type?.toLowerCase() === 'truefalse' || question.type?.toLowerCase() === 'true/false';
                  const isMultiSelect =
                    question.type?.toLowerCase() === 'multiselect' || question.type?.toLowerCase() === 'multi-select';

                  return (
                    <div
                      key={questionId}
                      id={`ai-review-q-${index}`}
                      className={`rounded-2xl border-2 p-6 ${
                        isCorrect ? 'border-emerald-400/40 bg-emerald-50' : 'border-red-300/40 bg-red-50'
                      }`}
                    >
                      {/* Question header */}
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                              isCorrect ? 'bg-emerald-500' : 'bg-red-400'
                            }`}>
                              {isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Question {index + 1}
                            </span>
                            {/* Bookmark indicator for review section */}
                            {(() => {
                              const reviewQuestionId = `ai-${index}`;
                              const isBookmarked = bookmarkedQuestions.has(reviewQuestionId);
                              return isBookmarked ? (
                                <BookmarkCheck className="h-4 w-4 text-amber-500" />
                              ) : null;
                            })()}
                          </div>
                          <h3 className="mt-2 font-semibold text-card-foreground">
                            {question.questionText}
                          </h3>
                        </div>
                        {/* Bookmark button for review section */}
                        <button
                          type="button"
                          onClick={() => toggleBookmark(`ai-${index}`)}
                          className={`rounded-full p-2 transition-all ${
                            bookmarkedQuestions.has(`ai-${index}`)
                              ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                              : 'bg-red-50 text-red-400 hover:bg-red-100'
                          }`}
                          title={bookmarkedQuestions.has(`ai-${index}`) ? 'Remove bookmark' : 'Bookmark this question'}
                        >
                          {bookmarkedQuestions.has(`ai-${index}`) ? (
                            <BookmarkCheck className="h-4 w-4" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Options */}
                      <div className="grid gap-2">
                        {isTrueFalse ? (
                          // True/False review
                          <div className="grid grid-cols-2 gap-3">
                            {(['True', 'False'] as const).map((opt) => {
                              const isSelected = studentAnswer === opt;
                              const isCorrectOption = opt.toLowerCase() === question.correctAnswer?.toLowerCase();

                              let optionClass = 'border-border bg-white/70 text-muted-foreground';
                              if (isCorrectOption) {
                                optionClass = 'border-emerald-500 bg-emerald-100 text-emerald-800 font-semibold';
                              } else if (isSelected && !isCorrectOption) {
                                optionClass = 'border-red-400 bg-red-100 text-red-700';
                              }

                              return (
                                <div
                                  key={opt}
                                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 ${optionClass}`}
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-bold text-sm">
                                    {opt === 'True' ? 'T' : 'F'}
                                  </span>
                                  <span className="flex-1 text-center font-semibold">{opt}</span>
                                  {isCorrectOption && (
                                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                                  )}
                                  {isSelected && !isCorrectOption && (
                                    <X className="h-5 w-5 shrink-0 text-red-500" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : isMultiSelect ? (
                          // MultiSelect review
                          <div className="space-y-2">
                            {(['A', 'B', 'C', 'D'] as const).map((key) => {
                              const text = question[`option${key}` as keyof typeof question];
                              if (!text) return null;
                              const isStudentSelected = (studentAnswer || '')
                                .split(',')
                                .map((k) => k.trim().toUpperCase())
                                .includes(key);
                              const isCorrectOption = (question.correctAnswer || '')
                                .split(',')
                                .map((k) => k.trim().toUpperCase())
                                .includes(key);

                              let optionClass = 'border-border bg-white/70 text-muted-foreground';
                              if (isCorrectOption) {
                                optionClass = 'border-emerald-500 bg-emerald-100 text-emerald-800 font-semibold';
                              } else if (isStudentSelected && !isCorrectOption) {
                                optionClass = 'border-red-400 bg-red-100 text-red-700';
                              }

                              return (
                                <div
                                  key={key}
                                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${optionClass}`}
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-bold text-sm">
                                    {key}
                                  </span>
                                  <span className="flex-1">{text}</span>
                                  {isCorrectOption && (
                                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                                  )}
                                  {isStudentSelected && !isCorrectOption && (
                                    <X className="h-5 w-5 shrink-0 text-red-500" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            {[
                              { key: 'A', value: question.optionA },
                              { key: 'B', value: question.optionB },
                              { key: 'C', value: question.optionC },
                              { key: 'D', value: question.optionD },
                            ].map((option) => {
                              const isSelected = studentAnswer === option.key;
                              const isCorrectOption = option.key.toUpperCase() === question.correctAnswer?.toUpperCase();

                              let optionClass = 'border-border bg-white/70 text-muted-foreground';
                              if (isCorrectOption) {
                                optionClass = 'border-emerald-500 bg-emerald-100 text-emerald-800 font-semibold';
                              } else if (isSelected && !isCorrectOption) {
                                optionClass = 'border-red-400 bg-red-100 text-red-700';
                              }

                              return (
                                <div
                                  key={option.key}
                                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${optionClass}`}
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-bold text-sm">
                                    {option.key}
                                  </span>
                                  <span className="flex-1">{option.value}</span>
                                  {isCorrectOption && (
                                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                                  )}
                                  {isSelected && !isCorrectOption && (
                                    <X className="h-5 w-5 shrink-0 text-red-500" />
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {/* Your answer vs Correct answer */}
                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <span className="rounded-full bg-white/80 px-3 py-1">
                          <span className="font-medium text-muted-foreground">Your answer: </span>
                          <span className={`font-bold ${isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
                            {studentAnswer || 'Not answered'}
                          </span>
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1">
                          <span className="font-medium text-emerald-700">Correct: </span>
                          <span className="font-bold text-emerald-800">
                            {isTrueFalse
                              ? question.correctAnswer
                              : isMultiSelect
                              ? question.correctAnswer
                              : `${question.correctAnswer}. ${question[`option${question.correctAnswer}` as keyof typeof question] || ''}`}
                          </span>
                        </span>
                      </div>

                      {/* Explanation */}
                      {question.explanation && (
                        <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                            <span className="text-xs font-bold uppercase tracking-widest text-purple-700">Explanation</span>
                          </div>
                          <p className="text-sm leading-relaxed text-purple-900 whitespace-pre-wrap">
                            {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons after submission */}
          <div className="border-t border-border p-6">
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => {
                  setResult(null);
                  handleReset();
                }}
                className="rounded-xl bg-gradient-to-r from-primary to-[#007BFF] px-6 py-2 text-sm font-medium text-white"
              >
                Practice More
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSaveDialog(true)}
                className="rounded-xl border-emerald-300 bg-emerald-50 px-6 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Layers className="mr-2 h-4 w-4" />
                Lưu vào Flashcard
              </Button>
              <Button
                type="button"
                variant="outline"
                asChild
                className="rounded-xl px-6 py-2 text-sm font-medium"
              >
                <a href="/student/review">Review Flashcards</a>
              </Button>
              <Button
                type="button"
                variant="outline"
                asChild
                className="rounded-xl px-6 py-2 text-sm font-medium"
              >
                <a href="/student/quiz/history">View History</a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save to Flashcards Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <Layers className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-card-foreground">Lưu vào Flashcard</h3>
                  <p className="text-sm text-muted-foreground">Tạo bộ thẻ học từ câu hỏi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !savingToFlashcard && setShowSaveDialog(false)}
                disabled={savingToFlashcard}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-4">
              {/* Save All option */}
              <button
                type="button"
                onClick={() => !savingToFlashcard && handleSaveAllToFlashcards()}
                disabled={savingToFlashcard || aiQuestions.length === 0}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-200">
                  <Layers className="h-6 w-6 text-emerald-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">Lưu tất cả ({aiQuestions.length} câu)</p>
                  <p className="text-sm text-muted-foreground">Tạo bộ flashcard từ tất cả câu hỏi</p>
                </div>
                <ChevronRight className="h-5 w-5 text-emerald-500" />
              </button>

              {/* Save Bookmarked option */}
              {bookmarkedQuestions.size > 0 && (
                <button
                  type="button"
                  onClick={() => !savingToFlashcard && handleSaveBookmarkedToFlashcards()}
                  disabled={savingToFlashcard || bookmarkedQuestions.size === 0}
                  className="flex w-full items-center gap-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-left transition-all hover:border-amber-300 hover:bg-amber-100 disabled:opacity-50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-200">
                    <BookmarkCheck className="h-6 w-6 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-card-foreground">Lưu đã bookmark ({bookmarkedQuestions.size} câu)</p>
                    <p className="text-sm text-muted-foreground">Chỉ lưu các câu đã đánh dấu</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-500" />
                </button>
              )}

              {savingToFlashcard && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Đang lưu...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => !savingToFlashcard && setShowSaveDialog(false)}
              disabled={savingToFlashcard}
              className="w-full rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Stats Footer - only show in standalone mode */}
      {!embedded && (
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
              <p className="text-2xl font-black text-secondary">{allTopics.length}</p>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
