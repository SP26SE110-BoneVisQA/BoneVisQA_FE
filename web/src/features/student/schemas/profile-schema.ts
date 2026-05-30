import { z } from 'zod';

export const studentProfileFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  schoolCohort: z.string().trim().min(1, 'Cohort or program is required.'),
  avatarUrl: z.string(),
  classCode: z.string(),
  dateOfBirth: z.string(),
  phoneNumber: z.string(),
  gender: z.string(),
  studentSchoolId: z.string(),
  address: z.string(),
  bio: z.string(),
});

export type StudentProfileFormValues = z.infer<typeof studentProfileFormSchema>;
