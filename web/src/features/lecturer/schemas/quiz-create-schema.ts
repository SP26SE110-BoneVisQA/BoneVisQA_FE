import { z } from 'zod';

export const quizQuestionDraftSchema = z.object({
  questionText: z.string().trim().min(1, 'Question text is required.'),
  type: z.string().trim().min(1, 'Question type is required.'),
  optionA: z.string().trim(),
  optionB: z.string().trim(),
  optionC: z.string().trim(),
  optionD: z.string().trim(),
  correctAnswer: z.string().trim(),
  essayAnswer: z.string().trim(),
  imageUrl: z.string().trim(),
});

export const lecturerQuizCreateSchema = z.object({
  title: z.string().trim().min(1, 'Quiz title is required.'),
  description: z.string().trim(),
  classId: z.string().trim(),
  topic: z.string().trim(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  openTime: z.string().trim().min(1, 'Open time is required.'),
  closeTime: z.string().trim().min(1, 'Close time is required.'),
  timeLimit: z.coerce.number().min(1, 'Time limit must be at least 1 minute.'),
  passingScore: z.coerce.number().min(0).max(100),
  classification: z.string().trim(),
  questions: z.array(quizQuestionDraftSchema).min(1, 'Add at least one question before publishing.'),
});

export type LecturerQuizCreateFormValues = z.infer<typeof lecturerQuizCreateSchema>;
export type QuizQuestionDraftValues = z.infer<typeof quizQuestionDraftSchema>;
