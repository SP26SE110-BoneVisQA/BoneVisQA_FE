'use client';

import { useState } from 'react';
import {
  FileQuestion,
  Pencil,
  Trash2,
  CheckCircle2,
  ZoomIn,
  CircleDot,
  Award,
  ImageOff,
} from 'lucide-react';
import type { QuizQuestionDto } from '@/lib/api/types';
import {
  getLecturerQuestionImageSrc,
  hasQuizQuestionCustomImage,
} from '@/lib/quizDefaultImage';

interface QuestionCardProps {
  question: QuizQuestionDto;
  caseThumbnail?: string;
  onEdit?: (question: QuizQuestionDto) => void;
  onDelete?: (questionId: string, questionText: string) => void;
  points?: number;
  /** Rich layout for quiz detail / Question Manager */
  variant?: 'default' | 'manager' | 'curated';
  /** Topic pill for curated variant (e.g. Trauma, Imaging) */
  topicCategory?: string;
}

function formatDisplayId(id: string): string {
  const hex = id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `CLIN-${hex}`;
}

function getQuestionTypeStyle(type: string | null): {
  label: string;
  badgeClass: string;
} {
  const t = type?.toLowerCase() ?? '';
  if (t === 'truefalse' || t === 'true/false') {
    return {
      label: 'True / False',
      badgeClass: 'bg-[#ffdcc3] text-[#6e3900]',
    };
  }
  if (t === 'annotation' || t === 'draw') {
    return {
      label: 'Annotation',
      badgeClass: 'bg-violet-100 text-violet-900',
    };
  }
  return {
    label: 'Multiple Choice',
    badgeClass: 'bg-[#94efec] text-[#006e6d]',
  };
}

function ImageWithFallback({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div className={`flex items-center justify-center bg-slate-900 ${className}`}>
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">No image</span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

export default function QuestionCard({
  question,
  caseThumbnail,
  onEdit,
  onDelete,
  points = 10,
  variant = 'default',
  topicCategory = 'Trauma',
}: QuestionCardProps) {
  const typeStyle = getQuestionTypeStyle(question.type);
  const isTrueFalse =
    question.type?.toLowerCase() === 'truefalse' || question.type?.toLowerCase() === 'true/false';

  if (variant === 'curated') {
    const topic = topicCategory;
    const topicClass =
      topic === 'Imaging'
        ? 'bg-orange-100 text-orange-950'
        : topic === 'Joints'
          ? 'bg-teal-100 text-teal-950'
          : 'bg-emerald-100 text-emerald-950';
    const subtitle =
      question.caseTitle ||
      [question.optionA, question.optionB].filter(Boolean).join(' · ') ||
      'Clinical imaging assessment item.';

    const thumbSrc = getLecturerQuestionImageSrc(question, caseThumbnail);
    const hasRealImage = hasQuizQuestionCustomImage(question, caseThumbnail);

    return (
      <div className="group flex gap-8 rounded-3xl bg-card p-8 shadow-lg shadow-black/5 transition-all hover:bg-muted/20 hover:shadow-xl hover:shadow-black/10 border border-border/30">
        <div className="relative h-44 w-72 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
          <ImageWithFallback
            src={thumbSrc}
            alt={hasRealImage ? '' : 'Placeholder — lecturer can add diagnostic image'}
            className={`h-full w-full object-cover ${hasRealImage ? 'opacity-80' : 'opacity-95'}`}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-4 py-1.5 text-xs font-extrabold uppercase ${topicClass}`}
                >
                  {topic}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${typeStyle.badgeClass}`}>
                  {typeStyle.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(question)}
                    className="rounded-xl p-2.5 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                    aria-label="Edit question"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(question.id, question.questionText)}
                    className="rounded-xl p-2.5 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            <h4 className="mt-3 line-clamp-3 text-lg font-bold text-foreground leading-relaxed">{question.questionText}</h4>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
              <CircleDot className="h-4 w-4" />
              {typeStyle.label}
            </span>
            <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
              <Award className="h-4 w-4" />
              {points} Points
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'manager') {
    return (
      <div className="group rounded-[1.75rem] border border-transparent bg-card p-8 shadow-sm transition-all hover:border-[#00478d]/15 hover:shadow-xl hover:shadow-[#00478d]/5">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-tight ${typeStyle.badgeClass}`}
            >
              {typeStyle.label}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              ID: {formatDisplayId(question.id)}
            </span>
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(question)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Edit"
              >
                <Pencil className="h-5 w-5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(question.id, question.questionText)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <h4 className="mb-6 font-['Manrope',sans-serif] text-xl font-bold leading-tight text-card-foreground">
          {question.questionText}
        </h4>

        {isTrueFalse ? (
          <div className="flex gap-4">
            {(['True', 'False'] as const).map((opt) => {
              const isCorrect = question.correctAnswer?.toLowerCase() === opt.toLowerCase();
              return (
                <div
                  key={opt}
                  className={`flex flex-1 items-center justify-between rounded-2xl border p-5 ${
                    isCorrect
                      ? 'border-[#94efec]/30 bg-[#94efec]/15'
                      : 'border-transparent bg-muted/40'
                  }`}
                >
                  <span
                    className={
                      isCorrect ? 'font-bold text-[#006a68]' : 'font-semibold text-card-foreground'
                    }
                  >
                    {opt}
                  </span>
                  {isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-[#006a68]" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-border" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            {(() => {
              const src = getLecturerQuestionImageSrc(question, caseThumbnail);
              const custom = hasQuizQuestionCustomImage(question, caseThumbnail);
              return (
                <>
                  <ImageWithFallback
                    src={src}
                    alt={custom ? '' : 'Placeholder diagnostic image'}
                    className={`h-full w-full object-cover ${custom ? 'opacity-85' : 'opacity-95'}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-4 left-4 text-[10px] font-bold uppercase tracking-widest text-white/80">
                    {question.caseTitle
                      ? `Case · ${question.caseTitle.slice(0, 32)}`
                      : custom
                        ? 'Radiographic reference'
                        : 'No image yet · edit to upload'}
                  </span>
                </>
              );
            })()}
          </div>
          <div className="space-y-3">
              {(
                [
                  { key: 'A', text: question.optionA },
                  { key: 'B', text: question.optionB },
                  { key: 'C', text: question.optionC },
                  { key: 'D', text: question.optionD },
                ] as const
              ).map(({ key, text }) => {
                if (!text) return null;
                const isCorrect = question.correctAnswer === key;
                return (
                  <div
                    key={key}
                    className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${
                      isCorrect
                        ? 'border-[#94efec]/30 bg-[#94efec]/15 shadow-sm'
                        : 'border-transparent bg-muted/40 hover:bg-muted/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={
                          isCorrect
                            ? 'text-sm font-bold text-[#006a68]'
                            : 'text-sm font-semibold text-card-foreground'
                        }
                      >
                        {text}
                      </span>
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#006a68]" />
                      ) : null}
                    </div>
                    {isCorrect ? (
                      <div className="absolute right-0 top-0 rounded-bl-lg bg-[#006a68] px-3 py-1 text-[8px] font-black uppercase tracking-tighter text-white">
                        Correct Answer
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>{points} pts</span>
          {question.caseTitle && <span>· {question.caseTitle}</span>}
        </div>
      </div>
    );
  }

  /* —— default (compact) layout —— */
  const defaultThumb = getLecturerQuestionImageSrc(question, caseThumbnail);
  const defaultHasCustom = hasQuizQuestionCustomImage(question, caseThumbnail);

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-5 transition-colors hover:bg-accent/5 group">
      <div className="flex gap-5">
        <div className="relative h-32 w-44 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
          <ImageWithFallback
            src={defaultThumb}
            alt={question.caseTitle || (defaultHasCustom ? 'Case thumbnail' : 'Default placeholder image')}
            className={`h-full w-full object-cover ${defaultHasCustom ? 'opacity-80' : 'opacity-95'}`}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <FileQuestion className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="mb-2 flex items-start justify-between">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${typeStyle.badgeClass}`}
              >
                {typeStyle.label}
              </span>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(question)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                    aria-label="Edit question"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(question.id, question.questionText)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <h4 className="line-clamp-2 font-bold text-card-foreground">{question.questionText}</h4>

            {question.caseTitle && (
              <p className="mt-1 text-xs text-muted-foreground">Case: {question.caseTitle}</p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4">
            <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              {points} Points
            </span>
            {question.correctAnswer && (
              <span className="rounded bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">
                Answer: {question.correctAnswer}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
