'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  ZoomIn,
  Upload,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  FileText,
} from 'lucide-react';
import type { CreateQuizQuestionRequest } from '@/lib/api/types';
import type { QuizQuestionDto } from '@/lib/api/expert-quizzes';
import { uploadExpertWorkbenchImage as uploadImage } from '@/lib/supabase/upload-medical-case-image';

interface QuestionEditorDialogProps {
  open: boolean;
  onClose: () => void;
  quizId: string;
  question?: QuizQuestionDto | null;
  onSuccess?: () => void;
  draftMode?: boolean;
  onDraftSave?: (payload: CreateQuizQuestionRequest, questionId?: string) => void;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive */
  quizMode?: number | null;
}

const QUESTION_TYPES = [
  { value: 'MultipleChoice', label: 'Multiple Choice' },
  { value: 'TrueFalse', label: 'True / False' },
  { value: 'MultiSelect', label: 'Multi-Select' },
  { value: 'FillInBlank', label: 'Fill in Blank' },
  { value: 'Essay', label: 'Essay' },
  { value: 'Annotation', label: 'Annotation' },
] as const;

type QuestionType = typeof QUESTION_TYPES[number]['value'];

const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'] as const;
type Difficulty = typeof DIFFICULTY_LEVELS[number];

const TRUE_FALSE_OPTIONS = ['True', 'False'] as const;

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

export default function ExpertQuestionEditorDialog({
  open,
  onClose,
  quizId,
  question,
  onSuccess,
  draftMode = false,
  onDraftSave,
  quizMode,
}: QuestionEditorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    questionText: '',
    type: 'MultipleChoice' as QuestionType,
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    correctAnswers: '',
    acceptedAnswers: '',
    essayAnswer: '',
    hint: '',
    explanation: '',
  });

  useEffect(() => {
    if (!open) return;
    if (question) {
      const qType = (question.type || 'MultipleChoice') as QuestionType;
      setFormData({
        questionText: question.questionText,
        type: qType,
        optionA: question.optionA || '',
        optionB: question.optionB || '',
        optionC: question.optionC || '',
        optionD: question.optionD || '',
        correctAnswer: (question.correctAnswer || 'A').toUpperCase().slice(0, 1),
        correctAnswers: (question as unknown as Record<string, string>).correctAnswers || '',
        acceptedAnswers: (question as unknown as Record<string, string>).acceptedAnswers || '',
        essayAnswer: (question as unknown as Record<string, string>).essayAnswer || (question as unknown as Record<string, string>).EssayAnswer || '',
        hint: (question as unknown as Record<string, string>).hint || '',
        explanation: (question as unknown as Record<string, string>).explanation || '',
      });
      const qImg = question.imageUrl || (question as unknown as Record<string, string>).ImageUrl || null;
      setImageUrl(qImg);
    } else {
      setFormData({
        questionText: '',
        type: 'MultipleChoice',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A',
        correctAnswers: '',
        acceptedAnswers: '',
        essayAnswer: '',
        hint: '',
        explanation: '',
      });
      setImageUrl(null);
    }
    setDifficulty('Medium');
    setError(null);
    setShowAdvanced(false);
  }, [question, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isTrueFalse = formData.type === 'TrueFalse';
      const isMultiSelect = formData.type === 'MultiSelect';
      const isFillInBlank = formData.type === 'FillInBlank';

      const parseMultiValue = (value: string | undefined | null): string | undefined => {
        if (!value || !value.trim()) return undefined;
        const arr = value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        return JSON.stringify(arr);
      };

      const payload: CreateQuizQuestionRequest = {
        quizId: quizId === 'temp' ? '' : quizId,
        questionText: formData.questionText,
        type: formData.type,
        optionA: isTrueFalse ? 'True' : formData.optionA,
        optionB: isTrueFalse ? 'False' : formData.optionB,
        optionC: isTrueFalse || isFillInBlank ? undefined : formData.optionC,
        optionD: isTrueFalse || isFillInBlank ? undefined : formData.optionD,
        correctAnswer: formData.type === 'Essay' || isMultiSelect || isFillInBlank ? undefined : formData.correctAnswer,
        correctAnswers: isMultiSelect ? parseMultiValue(formData.correctAnswers) : undefined,
        acceptedAnswers: isFillInBlank ? parseMultiValue(formData.acceptedAnswers) : undefined,
        essayAnswer: formData.type === 'Essay' ? formData.essayAnswer : undefined,
        imageUrl: imageUrl || undefined,
        hint: formData.hint || undefined,
        explanation: formData.explanation || undefined,
      };

      const questionId = question?.id || undefined;
      onDraftSave?.(payload, questionId);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleCorrectAnswer = (key: string) => {
    if (formData.type === 'MultiSelect') {
      const current = formData.correctAnswers ? formData.correctAnswers.split(',').map(s => s.trim()).filter(Boolean) : [];
      const newAnswers = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];
      setFormData({ ...formData, correctAnswers: newAnswers.join(',') });
    } else {
      setFormData({ ...formData, correctAnswer: key.toUpperCase().slice(0, 1) });
    }
  };

  const isCorrectAnswer = (key: string): boolean => {
    if (formData.type === 'MultiSelect') {
      return formData.correctAnswers?.includes(key) || false;
    }
    return formData.correctAnswer === key.toUpperCase().slice(0, 1);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setError('Only image files are supported: JPG, PNG, GIF, WEBP, SVG.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must not exceed 10MB.');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!open) return null;

  const title = question ? 'Edit Assessment Question' : 'Add Assessment Question';
  const { type } = formData;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#f7f9fb]/80 backdrop-blur-md"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-editor-title"
        className="relative flex max-h-[min(900px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2
                  id="question-editor-title"
                  className="text-xl font-bold text-gray-900"
                >
                  {title}
                </h2>
                {quizMode && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    quizMode === 2 ? 'bg-green-100 text-green-700' :
                    quizMode === 3 ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {quizMode === 2 ? 'PRACTICE' : quizMode === 3 ? 'ADAPTIVE' : 'EXAM'}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                Configure question settings and answer options
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-6">
              {/* Left: Image Upload */}
              <div className="w-56 shrink-0">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Diagnostic Image
                </label>
                {imageUrl ? (
                  <div className="group relative aspect-square overflow-hidden rounded-2xl border-2 border-gray-200 bg-gray-900">
                    <img
                      src={imageUrl}
                      alt="Uploaded"
                      className="h-full w-full object-contain"
                      onError={() => setImageUrl(null)}
                    />
                    <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <div className="flex justify-end">
                        <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          Uploaded
                        </span>
                      </div>
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(imageUrl, '_blank')}
                          className="rounded-full bg-white/90 p-2 hover:bg-white transition-colors"
                          aria-label="Zoom"
                        >
                          <ZoomIn className="h-4 w-4 text-gray-700" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageUrl(null)}
                          className="rounded-full bg-white/90 p-2 hover:bg-white transition-colors"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="group flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    {uploadingImage ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="mt-2 text-xs font-medium text-gray-500">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl bg-blue-100 p-3 transition-colors group-hover:bg-blue-200">
                          <Upload className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="mt-2 text-sm font-medium text-gray-600">Upload Image</p>
                        <p className="mt-1 text-[10px] text-gray-400">JPG, PNG - Max 10MB</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Form Fields */}
              <div className="min-w-0 flex-1 space-y-5">
                {/* Question Text */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Question Clinical Prompt
                  </label>
                  <textarea
                    value={formData.questionText}
                    onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                    className="w-full resize-none rounded-xl border-0 bg-gray-100 p-4 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20"
                    rows={3}
                    placeholder="e.g., Identify the primary fracture location in the distal phalanx..."
                    required
                  />
                </div>

                {/* Type & Difficulty Row */}
                <div className="flex gap-4">
                  {/* Question Type */}
                  <div className="flex-1">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Question Type
                    </label>
                    <div className="relative">
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as QuestionType })}
                        className="w-full cursor-pointer appearance-none rounded-xl border-0 bg-gray-100 px-4 py-3 pr-10 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className="flex-1">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Difficulty
                    </label>
                    <div className="flex rounded-xl bg-gray-100 p-1">
                      {DIFFICULTY_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase transition-all ${
                            difficulty === level
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Answer Options - Multiple Choice */}
                {type === 'MultipleChoice' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Answer Options
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {OPTION_KEYS.map((key) => {
                        const field = `option${key}` as keyof typeof formData;
                        const isCorrect = formData.correctAnswer === key;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                              isCorrect
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name="correctMc"
                              checked={isCorrect}
                              onChange={() => toggleCorrectAnswer(key)}
                              className="h-5 w-5 shrink-0 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`shrink-0 rounded-full ${
                              isCorrect ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                            } px-2 py-0.5 text-xs font-bold`}>
                              {key}
                            </span>
                            <input
                              type="text"
                              value={formData[field] as string}
                              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                              placeholder={`Option ${key}`}
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Answer Options - True/False */}
                {type === 'TrueFalse' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Correct Answer
                    </label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => toggleCorrectAnswer('A')}
                        className={`flex flex-1 items-center justify-center gap-3 rounded-xl border-2 py-4 font-bold transition-all ${
                          formData.correctAnswer === 'A'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        True
                        {formData.correctAnswer === 'A' && (
                          <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                            Correct
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCorrectAnswer('B')}
                        className={`flex flex-1 items-center justify-center gap-3 rounded-xl border-2 py-4 font-bold transition-all ${
                          formData.correctAnswer === 'B'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        False
                        {formData.correctAnswer === 'B' && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                            Correct
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Answer Options - Multi-Select */}
                {type === 'MultiSelect' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Answer Options <span className="normal-case font-normal text-blue-600">(select all correct)</span>
                    </label>
                    <div className="space-y-2">
                      {OPTION_KEYS.map((key) => {
                        const field = `option${key}` as keyof typeof formData;
                        const isCorrect = formData.correctAnswers?.includes(key) || false;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                              isCorrect
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isCorrect}
                              onChange={() => toggleCorrectAnswer(key)}
                              className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`shrink-0 rounded-full ${
                              isCorrect ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                            } px-2 py-0.5 text-xs font-bold`}>
                              {key}
                            </span>
                            <input
                              type="text"
                              value={formData[field] as string}
                              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                              placeholder={`Option ${key}`}
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
                            />
                            {isCorrect && (
                              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                                Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Answer Options - Fill in Blank */}
                {type === 'FillInBlank' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Accepted Answers <span className="normal-case font-normal text-gray-400">(case-insensitive, one per line)</span>
                    </label>
                    <textarea
                      value={formData.acceptedAnswers || ''}
                      onChange={(e) => setFormData({ ...formData, acceptedAnswers: e.target.value })}
                      className="w-full resize-none rounded-xl border-0 bg-gray-100 p-4 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20"
                      rows={3}
                      placeholder={'fracture\ngãy xương\nx-quang'}
                    />
                  </div>
                )}

                {/* Answer Options - Essay */}
                {type === 'Essay' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Model Answer / Guidelines
                    </label>
                    <textarea
                      value={formData.essayAnswer || ''}
                      onChange={(e) => setFormData({ ...formData, essayAnswer: e.target.value })}
                      className="w-full resize-none rounded-xl border-0 bg-gray-100 p-4 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20"
                      rows={4}
                      placeholder="Enter a model answer or grading guidelines..."
                    />
                  </div>
                )}

                {/* Answer Options - Annotation */}
                {type === 'Annotation' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Reference Answer
                    </label>
                    <input
                      type="text"
                      value={formData.correctAnswer}
                      onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                      className="w-full rounded-xl border-0 bg-gray-100 px-4 py-3 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Expected identification or label"
                    />
                  </div>
                )}

                {/* Hint & Explanation - Collapsible */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Practice Mode Settings
                      </span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Optional
                      </span>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                  </button>
                  
                  {showAdvanced && (
                    <div className="space-y-4 border-t border-gray-200 bg-white p-4">
                      {/* Hint */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                          Hint
                        </label>
                        <input
                          type="text"
                          value={formData.hint || ''}
                          onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                          className="w-full rounded-lg border-0 bg-gray-50 px-4 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-amber-400/30"
                          placeholder="E.g., Carefully examine the fracture location in the image..."
                        />
                      </div>
                      
                      {/* Explanation */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <FileText className="h-3.5 w-3.5 text-blue-500" />
                          Explanation
                        </label>
                        <textarea
                          value={formData.explanation || ''}
                          onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                          className="w-full resize-none rounded-lg border-0 bg-gray-50 px-4 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400/30"
                          rows={2}
                          placeholder="E.g., The correct answer is A because..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
            <p className="text-xs text-gray-400">
              Question will be saved to draft automatically
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Question
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
