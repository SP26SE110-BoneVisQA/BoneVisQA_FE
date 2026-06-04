import { z } from 'zod';
import {
  EXPERT_ANATOMY_SITES,
  EXPERT_IMAGE_MODALITIES,
  type ExpertAnatomySite,
} from '@/features/expert/lib/expert-ontology';

const anatomySiteEnum = EXPERT_ANATOMY_SITES as unknown as [ExpertAnatomySite, ...ExpertAnatomySite[]];
const modalityEnum = EXPERT_IMAGE_MODALITIES as unknown as [string, ...string[]];

export const expertCaseFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().trim().min(1, 'Clinical description is required.'),
  categoryId: z.string().trim().min(1, 'Pathology group (category) is required.'),
  anatomySite: z.enum(anatomySiteEnum, { message: 'Select an anatomy site.' }),
  modality: z.enum(modalityEnum, { message: 'Select an imaging modality.' }),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'], { message: 'Select a difficulty level.' }),
  suggestedDiagnosis: z.string().trim(),
  keyFindings: z.string().trim(),
  reflectiveQuestions: z.string().trim(),
  tagIds: z.array(z.string()),
});

export type ExpertCaseFormValues = z.infer<typeof expertCaseFormSchema>;

export const expertCaseEditFormSchema = expertCaseFormSchema.extend({
  isActive: z.boolean(),
  isApproved: z.boolean(),
});

export type ExpertCaseEditFormValues = z.infer<typeof expertCaseEditFormSchema>;
