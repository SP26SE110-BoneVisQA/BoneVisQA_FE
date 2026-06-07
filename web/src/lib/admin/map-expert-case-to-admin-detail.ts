import type { ExpertCase } from '@/lib/api/expert-cases';

export type AdminCaseDetailStatus = 'approved' | 'pending' | 'hidden' | 'rejected';
export type AdminCaseDetailDifficulty = 'basic' | 'intermediate' | 'advanced';

export interface AdminCaseDetailImage {
  id: string;
  filename: string;
  imageUrl?: string;
  type: string;
  anonymized: boolean;
  issue?: string;
}

export interface AdminCaseDetailReview {
  id: string;
  reviewer: string;
  role: string;
  date: string;
  rating: number;
  comment: string;
  action: 'approved' | 'rejected' | 'requested_changes' | 'comment';
}

/** Minimal shape used by `admin/cases/[id]/page.tsx` UI. */
export interface AdminCaseDetailView {
  id: string;
  title: string;
  description: string;
  boneLocation: string;
  lesionType: string;
  difficulty: AdminCaseDetailDifficulty;
  status: AdminCaseDetailStatus;
  addedBy: string;
  addedDate: string;
  lastModified: string;
  viewCount: number;
  usageCount: number;
  imageAnonymized: boolean;
  flagReason?: string;
  clinicalHistory: string;
  findings: string;
  diagnosis: string;
  images: AdminCaseDetailImage[];
  reviews: AdminCaseDetailReview[];
}

function mapDifficulty(d: ExpertCase['difficulty']): AdminCaseDetailDifficulty {
  if (d === 'Hard') return 'advanced';
  if (d === 'Medium') return 'intermediate';
  return 'basic';
}

function mapStatus(c: ExpertCase): AdminCaseDetailStatus {
  if (c.status === 'rejected') return 'rejected';
  if (c.status === 'approved' && c.isActive) return 'approved';
  if (!c.isActive) return 'hidden';
  return 'pending';
}

/** Aliases for `admin/cases/[id]/page.tsx` legacy type names. */
export type CaseDetail = AdminCaseDetailView;
export type CaseImage = AdminCaseDetailImage;
export type Review = AdminCaseDetailReview;

export function expertCaseToAdminDetailView(c: ExpertCase): AdminCaseDetailView {
  const imgs = (c.medicalImages ?? []).map((img, i) => ({
    id: `img-${i}`,
    filename: img.imageUrl?.split('/').pop() || `image-${i + 1}`,
    imageUrl: img.imageUrl,
    type: img.modality?.trim() || 'Other',
    anonymized: true,
  }));
  return {
    id: c.id,
    title: c.title,
    description: c.description || '—',
    boneLocation: c.boneLocation || '—',
    lesionType: '—',
    difficulty: mapDifficulty(c.difficulty),
    status: mapStatus(c),
    addedBy: c.addedBy || c.expertName || '—',
    addedDate: c.addedDate || '—',
    lastModified: c.addedDate || '—',
    viewCount: 0,
    usageCount: 0,
    imageAnonymized: imgs.length === 0 || imgs.every((x) => x.anonymized),
    clinicalHistory: c.description || '—',
    findings: c.keyFindings || '—',
    diagnosis: c.suggestedDiagnosis || '—',
    images: imgs,
    reviews: [],
  };
}
