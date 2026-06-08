import type { MedicalCaseDifficultyTier } from '@/lib/medical-case-difficulty';
import {
  medicalCaseDifficultyBadgeClass,
  medicalCaseDifficultyLabel,
} from '@/lib/medical-case-difficulty';

export type QuizStatus = 'completed' | 'not_started';
export type Difficulty = MedicalCaseDifficultyTier;
export type TabKey = 'all' | 'not_started' | 'completed';

export interface Quiz {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  totalQuestions: number;
  duration: string;
  status: QuizStatus;
  score?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  completedAt?: string;
}

export const difficultyConfig: Record<Difficulty, { color: string; label: string }> = {
  easy: { color: medicalCaseDifficultyBadgeClass('easy'), label: medicalCaseDifficultyLabel('easy') },
  medium: { color: medicalCaseDifficultyBadgeClass('medium'), label: medicalCaseDifficultyLabel('medium') },
  hard: { color: medicalCaseDifficultyBadgeClass('hard'), label: medicalCaseDifficultyLabel('hard') },
};

export function getScoreColor(score: number) {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}

export function getScoreBg(score: number) {
  if (score >= 80) return 'bg-success/10 border-success/20';
  if (score >= 60) return 'bg-warning/10 border-warning/20';
  return 'bg-destructive/10 border-destructive/20';
}
