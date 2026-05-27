'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  Trash2,
  Upload,
  Loader2,
  Info,
  PlusCircle,
  ChevronDown,
} from 'lucide-react';
import type {
  QuizQuestionDto,
  CreateQuizQuestionRequest,
  UpdateQuizQuestionRequest,
} from '@/lib/api/types';
import { uploadImage } from '@/lib/api/upload';
import { addQuizQuestion, updateQuizQuestion } from '@/lib/api/lecturer-quiz';
import { resolveApiAssetUrl } from '@/lib/api/client';

interface QuestionEditorDialogProps {
  open: boolean;
  onClose: () => void;
  quizId: string;
  question?: QuizQuestionDto | null;
  onSuccess?: () => void;
  draftMode?: boolean;
  onDraftSave?: (payload: CreateQuizQuestionRequest) => void;
  /** Quiz mode: 1=Exam, 2=Practice, 3=Adaptive. Used to show mode info in form. */
  quizMode?: number | null;
}

const TYPE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'MultipleChoice', label: 'Multiple Choice', description: 'Chọn 1 đáp án đúng (A, B, C, D)' },
  { value: 'TrueFalse', label: 'True / False', description: 'Đúng hoặc Sai' },
  { value: 'MultiSelect', label: 'Multi-Select', description: 'Chọn nhiều đáp án đúng' },
  { value: 'FillInBlank', label: 'Fill in Blank', description: 'Điền vào chỗ trống' },
  { value: 'Essay', label: 'Essay', description: 'Tự luận - Giảng viên chấm tay' },
];

const QUIZ_MODE_LABELS: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: 'Exam Mode', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300' },
  2: { label: 'Practice Mode', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-300' },
  3: { label: 'Adaptive Mode', color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-300' },
};

function getQuizModeDisplay(mode: number | null | undefined) {
  if (mode == null) return null;
  return QUIZ_MODE_LABELS[mode] ?? null;
}

type OptionKey = 'A' | 'B' | 'C' | 'D';

export default function QuestionEditorDialog({
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
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [visibleMcCount, setVisibleMcCount] = useState(3);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<{
    questionText: string;
    type: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    essayAnswer?: string;
    hint?: string;
    explanation?: string;
    correctAnswers?: string;
    acceptedAnswers?: string;
  }>({
    questionText: '',
    type: 'MultipleChoice',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    essayAnswer: '',
    hint: '',
    explanation: '',
    correctAnswers: '',
    acceptedAnswers: '',
  });
  const [multiSelectCorrect, setMultiSelectCorrect] = useState<OptionKey[]>([]);

  const [optionPoints, setOptionPoints] = useState<Record<OptionKey, number>>({
    A: 10,
    B: 0,
    C: 0,
    D: 0,
  });

  const syncPointsFromCorrect = useCallback((correct: string) => {
    const c = (correct || 'A').toUpperCase().charAt(0) as OptionKey;
    const keys: OptionKey[] = ['A', 'B', 'C', 'D'];
    setOptionPoints((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = k === c ? 10 : 0;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (question) {
      // Determine correctAnswer based on question type
      let correctAnswerStr = question.correctAnswer || 'A';
      
      // Handle TrueFalse
      if (question.type === 'TrueFalse' || question.type === 'truefalse') {
        correctAnswerStr = correctAnswerStr.toLowerCase() === 'true' || correctAnswerStr === '1' ? 'True' : 'False';
      }
      
      // Handle FillInBlank - keep the full text
      // For other types, take first char for backward compatibility
      
      setFormData({
        questionText: question.questionText,
        type: question.type || 'MultipleChoice',
        optionA: question.optionA || '',
        optionB: question.optionB || '',
        optionC: question.optionC || '',
        optionD: question.optionD || '',
        correctAnswer: correctAnswerStr,
        essayAnswer: (question as any).essayAnswer || (question as any).EssayAnswer || '',
        hint: (question as any).hint || '',
        explanation: (question as any).explanation || '',
        correctAnswers: (question as any).correctAnswers || '',
        acceptedAnswers: (question as any).acceptedAnswers || '',
      });
      const filled = [question.optionA, question.optionB, question.optionC, question.optionD].filter(
        (t) => (t || '').trim().length > 0,
      ).length;
      setVisibleMcCount(Math.min(4, Math.max(3, filled || 3)));
      syncPointsFromCorrect(question.correctAnswer || 'A');

      // Handle MultiSelect correct answers (comma-separated like "A,B")
      if (question.type === 'MultiSelect' || question.type === 'multi-select') {
        const correct = (question.correctAnswer || '').toUpperCase();
        const correctKeys = correct.split(',').map(k => k.trim()).filter(k => ['A', 'B', 'C', 'D'].includes(k)) as OptionKey[];
        setMultiSelectCorrect(correctKeys.length > 0 ? correctKeys : []);
      } else {
        setMultiSelectCorrect([]);
      }
    } else {
      setFormData({
        questionText: '',
        type: 'MultipleChoice',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A',
        essayAnswer: '',
        hint: '',
        explanation: '',
        correctAnswers: '',
        acceptedAnswers: '',
      });
      setVisibleMcCount(3);
      setOptionPoints({ A: 10, B: 0, C: 0, D: 0 });
      setMultiSelectCorrect([]);
    }
    const qImg =
      question?.imageUrl ??
      (question as QuizQuestionDto & { ImageUrl?: string | null })?.ImageUrl ??
      null;
    setImageUrl(qImg);
    setDifficulty('Medium');
    setError(null);
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

      const basePayload: CreateQuizQuestionRequest = {
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

      if (draftMode) {
        onDraftSave?.(basePayload);
        onSuccess?.();
        onClose();
        return;
      }

      if (question) {
        const updatePayload: UpdateQuizQuestionRequest = {
          questionText: formData.questionText,
          type: formData.type,
          correctAnswer: formData.type === 'Essay' || isMultiSelect || isFillInBlank ? undefined : formData.correctAnswer,
          correctAnswers: isMultiSelect ? parseMultiValue(formData.correctAnswers) : undefined,
          acceptedAnswers: isFillInBlank ? parseMultiValue(formData.acceptedAnswers) : undefined,
          optionA: isTrueFalse ? 'True' : formData.optionA,
          optionB: isTrueFalse ? 'False' : formData.optionB,
          optionC: isTrueFalse || isFillInBlank ? undefined : formData.optionC,
          optionD: isTrueFalse || isFillInBlank ? undefined : formData.optionD,
          essayAnswer: formData.type === 'Essay' ? formData.essayAnswer : undefined,
          imageUrl: imageUrl || undefined,
          hint: formData.hint || undefined,
          explanation: formData.explanation || undefined,
        };
        await updateQuizQuestion(question.id, updatePayload);
      } else {
        await addQuizQuestion(basePayload);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isMc = formData.type === 'MultipleChoice';
  const isMultiSelect = formData.type === 'MultiSelect';
  const isTrueFalse = formData.type === 'TrueFalse';
  const isFillInBlank = formData.type === 'FillInBlank';
  const isEssay = formData.type === 'Essay';

  const mcKeys = ['A', 'B', 'C', 'D'].slice(0, visibleMcCount);

  const setCorrect = (key: string) => {
    const k = key.toUpperCase().slice(0, 1);
    setFormData((prev) => ({ ...prev, correctAnswer: k }));
  };

  const toggleMultiSelect = (key: OptionKey) => {
    setMultiSelectCorrect((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const addMcRow = () => {
    if (visibleMcCount >= 4) return;
    setVisibleMcCount((n) => n + 1);
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

  const handleRemoveImage = () => {
    setImageUrl(null);
  };

  if (!open) return null;

  const title = question ? 'Edit Assessment Question' : 'Add Assessment Question';
  const modeDisplay = getQuizModeDisplay(quizMode);

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
        className="relative flex max-h-[min(921px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-[#ffffff] shadow-[0px_12px_32px_rgba(25,28,30,0.06)] ring-1 ring-border/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-10 py-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2
                id="question-editor-title"
                className="font-['Manrope',sans-serif] text-2xl font-extrabold tracking-tight text-[#191c1e]"
              >
                {title}
              </h2>
              {modeDisplay && (
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${modeDisplay.bg} ${modeDisplay.color} ${modeDisplay.border}`}>
                  {modeDisplay.label}
                </span>
              )}
            </div>
            <p className="text-sm text-[#424752]">
              Configure clinical parameters and diagnostic visual aids.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-[#727783] transition-colors hover:bg-[#e6e8ea] hover:text-[#191c1e]"
            aria-label="Close"
          >
            <X className="h-8 w-8" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-10 pb-8">
            {error && (
              <div className="rounded-2xl border border-[#ba1a1a]/30 bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">
                {error}
              </div>
            )}

            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-5 space-y-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#727783]">
                  Diagnostic Image
                </label>
                {imageUrl ? (
                  <div className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 border-[#00478d]/30 bg-[#2d3133]">
                    <img
                      src={resolveApiAssetUrl(imageUrl)}
                      alt="Uploaded diagnostic image"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
                      <div className="flex justify-end">
                        <span className="rounded-full bg-[#006a68] px-3 py-1 text-[10px] font-bold uppercase text-white">
                          Uploaded
                        </span>
                      </div>
                      <div className="flex w-full justify-center">
                        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#c2c6d4]/20 bg-[#eceef0]/90 px-4 py-2 shadow-sm backdrop-blur-md">
                          <button
                            type="button"
                            className="text-[#00478d]"
                            aria-label="Zoom"
                            onClick={() => window.open(resolveApiAssetUrl(imageUrl), '_blank')}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
                          <div className="h-4 w-px bg-[#c2c6d4]/30" />
                          <button
                            type="button"
                            className="text-[#ba1a1a]"
                            aria-label="Remove image"
                            onClick={handleRemoveImage}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#727783]/20 bg-[#2d3133] transition-colors hover:border-[#00478d]/50"
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
                        <Loader2 className="h-10 w-10 animate-spin text-[#94efec]" />
                        <p className="mt-3 text-sm font-bold text-[#94efec]">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <div className="mb-3 rounded-2xl bg-[#00478d]/20 p-4">
                          <Upload className="h-10 w-10 text-[#94efec]" />
                        </div>
                        <p className="font-semibold text-[#eceef0]">Upload Image</p>
                        <p className="mt-1 text-xs text-[#727783]">JPG, PNG, GIF, WEBP, SVG · Max 10MB</p>
                      </>
                    )}
                  </div>
                )}
                <div className="rounded-2xl border border-[#c2c6d4]/10 bg-[#eceef0] p-4">
                  <p className="text-xs leading-relaxed text-[#424752]">
                    <span className="font-bold text-[#00478d]">Tip:</span> Use X-ray or bone scan images to illustrate identification questions.
                  </p>
                </div>
              </div>

              <div className="col-span-7 space-y-8">
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                    Question Clinical Prompt
                  </label>
                  <textarea
                    value={formData.questionText}
                    onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                    className="w-full resize-none rounded-2xl border-0 bg-[#eceef0] p-4 text-sm outline-none ring-0 placeholder:text-[#c2c6d4] focus:ring-2 focus:ring-[#00478d]/20"
                    rows={3}
                    placeholder="e.g., Identify the primary fracture location in the distal phalanx..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                      Question Type
                    </label>
                    <div className="relative">
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full cursor-pointer appearance-none rounded-xl border-0 bg-[#eceef0] px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#00478d]/20"
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label} - {t.description}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#727783]" />
                    </div>
                    <div className={`rounded-xl p-3 text-xs ${
                      isTrueFalse ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                      isMultiSelect ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                      isFillInBlank ? 'bg-green-50 text-green-800 border border-green-200' :
                      'bg-[#eceef0] text-[#727783]'
                    }`}>
                      {isTrueFalse && 'Chọn True hoặc False làm đáp án đúng'}
                      {isMultiSelect && 'Chọn nhiều đáp án đúng (VD: A, C)'}
                      {isFillInBlank && 'Sinh viên nhập text - có nhiều đáp án được chấp nhận'}
                      {isMc && 'Chọn 1 đáp án đúng từ A, B, C, D'}
                      {isEssay && 'Sinh viên viết bài - giảng viên chấm tay'}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                      Difficulty Level
                    </label>
                    <div className="flex gap-2">
                      {(['Easy', 'Medium', 'Hard'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`flex-1 rounded-xl py-3 text-[10px] font-bold uppercase transition-colors ${
                            difficulty === level
                              ? 'bg-[#94efec] text-[#006e6d]'
                              : 'bg-[#eceef0] text-[#424752] hover:bg-[#e6e8ea]'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* TRUE/FALSE Options */}
                {isTrueFalse && (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                      Correct Answer
                    </label>
                    <div className="flex gap-4">
                      <label className={`flex flex-1 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                        formData.correctAnswer === 'A'
                          ? 'border-green-500 bg-green-50 text-green-800'
                          : 'border-[#eceef0] bg-[#eceef0] text-[#424752] hover:border-green-300'
                      }`}>
                        <input
                          type="radio"
                          name="correctTrueFalse"
                          checked={formData.correctAnswer === 'A'}
                          onChange={() => setFormData({ ...formData, correctAnswer: 'A' })}
                          className="hidden"
                        />
                        <span className="text-lg font-bold">True</span>
                        {formData.correctAnswer === 'A' && (
                          <span className="ml-auto rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">Correct</span>
                        )}
                      </label>
                      <label className={`flex flex-1 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                        formData.correctAnswer === 'B'
                          ? 'border-red-500 bg-red-50 text-red-800'
                          : 'border-[#eceef0] bg-[#eceef0] text-[#424752] hover:border-red-300'
                      }`}>
                        <input
                          type="radio"
                          name="correctTrueFalse"
                          checked={formData.correctAnswer === 'B'}
                          onChange={() => setFormData({ ...formData, correctAnswer: 'B' })}
                          className="hidden"
                        />
                        <span className="text-lg font-bold">False</span>
                        {formData.correctAnswer === 'B' && (
                          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">Correct</span>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {/* MULTI-SELECT Options */}
                {isMultiSelect && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                        Answer Options
                      </label>
                      <span className="text-xs text-blue-600">Tick all correct answers below</span>
                    </div>
                    <div className="space-y-3">
                      {(['A', 'B', 'C', 'D'] as const).map((key) => {
                        const isCorrect = formData.correctAnswers?.includes(key) || false;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                              isCorrect
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-[#eceef0] bg-[#eceef0]/50 hover:border-blue-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isCorrect}
                              onChange={(e) => {
                                const current = formData.correctAnswers ? formData.correctAnswers.split(',').map(s => s.trim()).filter(Boolean) : [];
                                const newAnswers = e.target.checked
                                  ? [...current, key]
                                  : current.filter(k => k !== key);
                                setFormData({ ...formData, correctAnswers: newAnswers.join(',') });
                              }}
                              className="h-5 w-5 rounded border-[#c2c6d4] text-blue-600 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              value={formData[`option${key}` as keyof typeof formData] as string || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, [`option${key}` as keyof typeof formData]: e.target.value })
                              }
                              placeholder={`Option ${key}`}
                              className="flex-1 border-0 bg-transparent p-0 text-sm font-medium outline-none focus:ring-0"
                            />
                            {isCorrect && (
                              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">Correct</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[#727783]">
                      Enter each option text, then tick the checkboxes next to correct answers.
                    </p>
                  </div>
                )}

                {/* FILL-IN-BLANK Options */}
                {isFillInBlank && (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                      Accepted Answers <span className="text-green-600 normal-case">(Case-insensitive)</span>
                    </label>
                    <textarea
                      value={formData.acceptedAnswers || ''}
                      onChange={(e) => setFormData({ ...formData, acceptedAnswers: e.target.value })}
                      className="w-full resize-none rounded-xl border-0 bg-[#eceef0] p-4 text-sm outline-none focus:ring-2 focus:ring-[#00478d]/20"
                      rows={3}
                      placeholder={'Enter accepted answers, one per line, or comma-separated:\nVD: gãy xương\nfracture\nx-quang'}
                    />
                    <p className="text-xs text-[#727783]">
                      Each line or comma-separated value is an accepted answer. Comparison is case-insensitive.
                    </p>
                  </div>
                )}

                {/* MULTIPLE CHOICE Options */}
                {isMc && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#727783]">
                        Answer Options
                      </label>
                      {visibleMcCount < 4 && (
                        <button
                          type="button"
                          onClick={addMcRow}
                          className="flex items-center gap-1 text-xs font-bold text-[#00478d] hover:underline"
                        >
                          <PlusCircle className="h-4 w-4" />
                          Add Option
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {mcKeys.map((key) => {
                        const isCorrect = formData.correctAnswer === key;
                        const field = `option${key}` as keyof typeof formData;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 rounded-2xl p-3 transition-colors ${
                              isCorrect
                                ? 'border border-[#00478d]/10 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
                                : 'border border-transparent bg-[#eceef0]/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="correctMc"
                              checked={isCorrect}
                              onChange={() => setCorrect(key)}
                              className="h-5 w-5 shrink-0 border-[#c2c6d4] text-[#00478d] focus:ring-[#00478d]"
                            />
                            <input
                              type="text"
                              value={formData[field] as string}
                              onChange={(e) =>
                                setFormData({ ...formData, [field]: e.target.value })
                              }
                              placeholder={`Option ${key}`}
                              className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium outline-none ring-0 focus:ring-0 ${
                                isCorrect ? 'text-[#191c1e]' : 'text-[#424752]'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TrueFalse Question Type */}
                {isTrueFalse && (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                      Correct Answer
                    </label>
                    <div className="flex gap-4">
                      <label className={`flex flex-1 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                        formData.correctAnswer === 'True'
                          ? 'border-[#00478d] bg-[#00478d]/5 text-[#00478d]'
                          : 'border-[#c2c6d4]/30 bg-[#eceef0]/50 text-[#424752] hover:border-[#00478d]/30'
                      }`}>
                        <input
                          type="radio"
                          name="trueFalse"
                          value="True"
                          checked={formData.correctAnswer === 'True'}
                          onChange={() => setFormData({ ...formData, correctAnswer: 'True' })}
                          className="sr-only"
                        />
                        <span className="text-2xl font-bold">T</span>
                        <span className="font-semibold">True</span>
                      </label>
                      <label className={`flex flex-1 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                        formData.correctAnswer === 'False'
                          ? 'border-[#00478d] bg-[#00478d]/5 text-[#00478d]'
                          : 'border-[#c2c6d4]/30 bg-[#eceef0]/50 text-[#424752] hover:border-[#00478d]/30'
                      }`}>
                        <input
                          type="radio"
                          name="trueFalse"
                          value="False"
                          checked={formData.correctAnswer === 'False'}
                          onChange={() => setFormData({ ...formData, correctAnswer: 'False' })}
                          className="sr-only"
                        />
                        <span className="text-2xl font-bold">F</span>
                        <span className="font-semibold">False</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* FillInBlank Question Type */}
                {isFillInBlank && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                      Correct Answer
                    </label>
                    <input
                      type="text"
                      value={formData.correctAnswer}
                      onChange={(e) =>
                        setFormData({ ...formData, correctAnswer: e.target.value })
                      }
                      className="w-full rounded-xl border-0 bg-[#eceef0] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#00478d]/20"
                      placeholder="Enter the correct answer for the blank"
                    />
                    <p className="text-xs text-[#727783]">
                      Students will see the question with a blank and must type the correct answer.
                    </p>
                  </div>
                )}

                {/* MultiSelect Question Type */}
                {isMultiSelect && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#727783]">
                        Select All Correct Answers
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#00478d]">
                          {multiSelectCorrect.length} selected
                        </span>
                        {visibleMcCount < 4 && (
                          <button
                            type="button"
                            onClick={addMcRow}
                            className="flex items-center gap-1 text-xs font-bold text-[#00478d] hover:underline"
                          >
                            <PlusCircle className="h-4 w-4" />
                            Add Option
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {mcKeys.map((key) => {
                        const isCorrect = multiSelectCorrect.includes(key as OptionKey);
                        const field = `option${key}` as keyof typeof formData;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 rounded-2xl p-3 transition-colors ${
                              isCorrect
                                ? 'border border-[#00478d]/10 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
                                : 'border border-transparent bg-[#eceef0]/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isCorrect}
                              onChange={() => toggleMultiSelect(key as OptionKey)}
                              className="h-5 w-5 shrink-0 rounded border-[#c2c6d4] text-[#00478d] focus:ring-[#00478d]"
                            />
                            <input
                              type="text"
                              value={formData[field] as string}
                              onChange={(e) =>
                                setFormData({ ...formData, [field]: e.target.value })
                              }
                              placeholder={`Option ${key}`}
                              className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium outline-none ring-0 focus:ring-0 ${
                                isCorrect ? 'text-[#191c1e]' : 'text-[#424752]'
                              }`}
                            />
                            {isCorrect && (
                              <span className="shrink-0 rounded-full bg-[#006a68] px-2 py-1 text-[10px] font-bold uppercase text-white">
                                Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[#727783]">
                      Select one or more correct answers. All selected options will be marked as correct.
                    </p>
                  </div>
                )}

                {isEssay && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#727783]">
                      Model Answer / Guidelines
                    </label>
                    <textarea
                      value={formData.essayAnswer || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, essayAnswer: e.target.value })
                      }
                      className="w-full resize-none rounded-xl border-0 bg-[#eceef0] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#00478d]/20"
                      rows={5}
                      placeholder="Enter a model answer or grading guidelines for the essay question..."
                    />
                    <p className="text-xs text-[#727783]">
                      This will be used as a reference for grading the essay response.
                    </p>
                  </div>
                )}

                {/* HINT AND EXPLANATION SECTION - For Practice Mode */}
                <div className="space-y-4 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900">PRACTICE MODE</span>
                    <span className="text-xs text-amber-800">Hint và Explanation chỉ hiện khi quiz ở Practice Mode</span>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#727783]">
                      <span className="rounded bg-amber-200 px-2 py-0.5 text-amber-900">HINT</span>
                      Gợi ý cho sinh viên (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={formData.hint || ''}
                      onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                      className="w-full rounded-xl border-0 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="VD: Xem xét kỹ vị trí gãy trên hình X-ray..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#727783]">
                      <span className="rounded bg-blue-200 px-2 py-0.5 text-blue-900">EXPLANATION</span>
                      Giải thích đáp án đúng (tùy chọn)
                    </label>
                    <textarea
                      value={formData.explanation || ''}
                      onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                      className="w-full resize-none rounded-xl border-0 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                      rows={3}
                      placeholder="VD: Đáp án đúng là A vì xương đùi gãy ở 1/3 giữa là phổ biến nhất do..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#c2c6d4]/50 bg-[#eceef0] px-10 py-6">
            <div className="flex items-center text-[#727783]">
              <Info className="mr-2 h-4 w-4 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Changes autosaved to draft
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-full px-6 py-3 text-sm font-bold text-[#424752] transition-colors hover:bg-[#e6e8ea] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#00478d] to-[#005eb8] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#00478d]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Question
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
