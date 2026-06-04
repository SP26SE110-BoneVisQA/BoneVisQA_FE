import { z } from 'zod';

export const triageEscalationSchema = z.object({
  specialtyId: z.string().trim().min(1, 'Please select a specialty.'),
});

export const triageRejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(8, 'Please provide a clear rejection reason.'),
});

export type TriageEscalationValues = z.infer<typeof triageEscalationSchema>;
export type TriageRejectValues = z.infer<typeof triageRejectSchema>;
