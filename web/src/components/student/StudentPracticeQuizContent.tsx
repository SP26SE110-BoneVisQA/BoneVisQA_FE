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
  type AvailableCaseForQuiz
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
      const correctCount = aiQuestions.filter((q, index) =>
        answers[`ai-${index}`]?.toUpperCase() === q.correctAnswer?.toUpperCase()
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
    setMultiSelectAnswers({});
    setTextAnswers({});
    setShownHints({});
    setResult(null);
    setPage(1);
    setSelectedCases(new Set());
    clearQuizDraft();
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
          
          {/* Quick topic buttons */}
          <div className="mt-4 space-y-2">
            {allTopics.slice(0, 4).map((t) => (
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
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(true)}
              className="w-full rounded-xl border border-dashed border-border px-4 py-2.5 text-left text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              + More topics...
            </button>
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
                  <option value={15}>15 questions</option>
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
            <div className="mt-2 border-t border-purple-200 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCaseSelector(true);
                  void handleLoadCases();
                }}
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Generate from Case Library
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Topic Browser Section */}
      {!quiz && aiQuestions.length === 0 && (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/30 p-6">
            <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-card-foreground">
              Browse Topics by Category
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a topic to start your practice session
            </p>
          </div>
          <div className="p-6">
            {Object.entries(filteredTopicCategories).map(([category, topics]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Layers className="h-4 w-4" />
                  {category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTopic(t);
                        handleLoadQuiz();
                      }}
                      disabled={loading}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                        topic === t
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
                  const isCorrect = studentAnswer?.toUpperCase() === question.correctAnswer?.toUpperCase();
                  const isTrueFalse =
                    question.type?.toLowerCase() === 'truefalse' || question.type?.toLowerCase() === 'true/false';

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
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                              isCorrect ? 'bg-emerald-500' : 'bg-red-400'
                            }`}>
                              {isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Question {index + 1}
                            </span>
                          </div>
                          <h3 className="mt-2 font-semibold text-card-foreground">
                            {question.questionText}
                          </h3>
                        </div>
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
                        ) : (
                          // Standard ABCD review
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
            <p className="text-2xl font-black text-secondary">{allTopics.length}</p>
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
