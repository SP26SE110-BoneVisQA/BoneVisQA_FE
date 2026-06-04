'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DetailPageLayout } from '@/components/layouts';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { appToast } from '@/lib/api/errors/app-toast';
import { deleteAdminCase, fetchAdminCaseDetail, updateAdminCase } from '@/lib/api/admin-cases';
import type { ExpertCase, SaveExpertCaseInput } from '@/lib/api/expert-cases';
import {
  expertCaseToAdminDetailView,
  type CaseDetail,
  type Review,
} from '@/lib/admin/map-expert-case-to-admin-detail';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  EyeOff,
  XCircle,
  Eye,
  BarChart3,
  Calendar,
  User,
  MapPin,
  Crosshair,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Trash2,
  ImageOff,
  X,
  FileImage,
  Info,
  Users,
  MessageSquare,
  Send,
  Star,
  Loader2,
} from 'lucide-react';

type CaseStatus = CaseDetail['status'];
type Difficulty = CaseDetail['difficulty'];

function expertToSaveInput(c: ExpertCase): SaveExpertCaseInput {
  return {
    title: c.title,
    createdByExpertId: c.createdByExpertId,
    description: c.description,
    difficulty: c.difficulty,
    isApproved: c.isApproved,
    isActive: c.isActive,
    categoryId: c.categoryId,
    suggestedDiagnosis: c.suggestedDiagnosis,
    reflectiveQuestions: c.reflectiveQuestions,
    keyFindings: c.keyFindings,
  };
}

const mockCases: Record<string, CaseDetail> = {
  '1': {
    id: '1',
    title: 'Distal Radius Fracture - Case Study',
    description: 'A 45-year-old female presented to the emergency department after falling onto an outstretched hand. This case demonstrates a classic distal radius fracture with dorsal angulation (Colles fracture).',
    boneLocation: 'Wrist',
    lesionType: 'Fracture',
    difficulty: 'basic',
    status: 'approved',
    addedBy: 'Dr. Nguyen Minh',
    addedDate: '2025-08-15',
    lastModified: '2025-08-20',
    viewCount: 342,
    usageCount: 128,
    imageAnonymized: true,
    clinicalHistory: 'Fall onto outstretched hand (FOOSH). Right wrist pain, swelling, and deformity. No neurovascular deficit.',
    findings: 'AP and lateral radiographs of the right wrist demonstrate a transverse fracture through the distal radius metaphysis with dorsal angulation of approximately 25 degrees. There is associated dorsal displacement. No intra-articular extension is identified. The distal radioulnar joint appears congruent.',
    diagnosis: 'Extra-articular distal radius fracture (Colles fracture) - AO classification 23-A2.2',
    images: [
      { id: 'img1', filename: 'wrist_ap.dcm', type: 'X-Ray AP', anonymized: true },
      { id: 'img2', filename: 'wrist_lateral.dcm', type: 'X-Ray Lateral', anonymized: true },
      { id: 'img3', filename: 'wrist_oblique.dcm', type: 'X-Ray Oblique', anonymized: true },
    ],
    reviews: [
      { id: 'r1', reviewer: 'Dr. Pham Expert', role: 'Expert', date: '2025-08-17', rating: 5, comment: 'Excellent case for teaching basic fracture identification. Images are high quality and the clinical history is well-documented.', action: 'approved' },
      { id: 'r2', reviewer: 'Dr. Hoang Expert', role: 'Expert', date: '2025-08-18', rating: 4, comment: 'Good case. Consider adding post-reduction images for a more complete teaching set.', action: 'approved' },
      { id: 'r3', reviewer: 'Admin', role: 'Admin', date: '2025-08-20', rating: 5, comment: 'Privacy check passed. All DICOM metadata properly anonymized. Approved for student access.', action: 'approved' },
    ],
  },
  '5': {
    id: '5',
    title: 'Lumbar Spine Compression Fracture',
    description: 'A 72-year-old female with known osteoporosis presented with acute lower back pain after bending forward. Imaging reveals a compression fracture of the L1 vertebral body.',
    boneLocation: 'Spine',
    lesionType: 'Fracture',
    difficulty: 'advanced',
    status: 'hidden',
    addedBy: 'Dr. Nguyen Minh',
    addedDate: '2025-09-05',
    lastModified: '2025-09-08',
    viewCount: 56,
    usageCount: 12,
    imageAnonymized: false,
    flagReason: 'Patient name visible in DICOM metadata',
    clinicalHistory: 'Known osteoporosis (T-score -3.2). Acute onset lower back pain after bending. No radiculopathy. No history of malignancy.',
    findings: 'Lateral radiograph of the lumbar spine demonstrates loss of height of the L1 vertebral body, predominantly affecting the anterior cortex with approximately 40% height loss. Mild retropulsion noted. Disc spaces are maintained. No paraspinal soft tissue mass.',
    diagnosis: 'Osteoporotic compression fracture of L1 - Grade 2 (moderate) by Genant classification',
    images: [
      { id: 'img1', filename: 'spine_lateral.dcm', type: 'X-Ray Lateral', anonymized: true },
      { id: 'img2', filename: 'spine_ap.dcm', type: 'X-Ray AP', anonymized: false, issue: 'Patient name visible in DICOM header' },
      { id: 'img3', filename: 'spine_mri_t1.dcm', type: 'MRI T1', anonymized: true },
      { id: 'img4', filename: 'spine_mri_t2.dcm', type: 'MRI T2', anonymized: false, issue: 'Hospital watermark on image' },
    ],
    reviews: [
      { id: 'r1', reviewer: 'Dr. Hoang Expert', role: 'Expert', date: '2025-09-06', rating: 4, comment: 'Clinically accurate case. However, DICOM metadata contains patient identifiable information that must be removed before publishing.', action: 'requested_changes' },
      { id: 'r2', reviewer: 'Admin', role: 'Admin', date: '2025-09-08', rating: 0, comment: 'Hidden due to privacy violation. Patient name found in DICOM header of spine_ap.dcm. Hospital watermark visible on spine_mri_t2.dcm. Please re-anonymize and resubmit.', action: 'rejected' },
    ],
  },
  '10': {
    id: '10',
    title: 'Elbow Dislocation with Radial Head Fracture',
    description: 'A 28-year-old male sustained an injury during a basketball game. The patient fell on an outstretched hand with the elbow in extension. Imaging demonstrates posterior elbow dislocation with an associated radial head fracture.',
    boneLocation: 'Elbow',
    lesionType: 'Dislocation',
    difficulty: 'intermediate',
    status: 'hidden',
    addedBy: 'Dr. Nguyen Minh',
    addedDate: '2025-08-30',
    lastModified: '2025-09-02',
    viewCount: 89,
    usageCount: 34,
    imageAnonymized: false,
    flagReason: 'Hospital watermark not removed from images',
    clinicalHistory: 'Fall during basketball on outstretched hand. Immediate elbow pain, swelling, inability to move. No neurovascular compromise.',
    findings: 'AP and lateral radiographs demonstrate posterior dislocation of the elbow with the olecranon displaced posteriorly. There is an associated comminuted fracture of the radial head (Mason Type III). No coronoid fracture is identified.',
    diagnosis: 'Posterior elbow dislocation with Mason Type III radial head fracture',
    images: [
      { id: 'img1', filename: 'elbow_ap.dcm', type: 'X-Ray AP', anonymized: false, issue: 'Hospital watermark visible' },
      { id: 'img2', filename: 'elbow_lateral.dcm', type: 'X-Ray Lateral', anonymized: false, issue: 'Hospital watermark visible' },
      { id: 'img3', filename: 'elbow_ct.dcm', type: 'CT 3D Recon', anonymized: true },
    ],
    reviews: [
      { id: 'r1', reviewer: 'Dr. Pham Expert', role: 'Expert', date: '2025-09-01', rating: 5, comment: 'Great trauma case with excellent CT reconstruction. Very useful for teaching complex elbow injuries.', action: 'approved' },
      { id: 'r2', reviewer: 'Admin', role: 'Admin', date: '2025-09-02', rating: 0, comment: 'Case hidden - hospital watermarks found on AP and lateral X-ray images. CT images are clean. Please remove watermarks from X-rays and resubmit.', action: 'rejected' },
    ],
  },
};

// Fallback for IDs not in detail map
function getDefaultCase(id: string): CaseDetail {
  return {
    id,
    title: `Case #${id}`,
    description: 'Detailed clinical case for musculoskeletal imaging education.',
    boneLocation: 'Unknown',
    lesionType: 'Unknown',
    difficulty: 'intermediate',
    status: 'pending',
    addedBy: 'Unknown',
    addedDate: '2025-01-01',
    lastModified: '2025-01-01',
    viewCount: 0,
    usageCount: 0,
    imageAnonymized: true,
    clinicalHistory: 'No clinical history available.',
    findings: 'No findings documented.',
    diagnosis: 'Pending review.',
    images: [],
    reviews: [],
  };
}

const statusConfig: Record<CaseStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  approved: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: 'Approved' },
  pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10', label: 'Pending' },
  hidden: { icon: EyeOff, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Hidden' },
  rejected: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Rejected' },
};

const difficultyConfig: Record<Difficulty, { color: string; label: string }> = {
  basic: { color: 'bg-success/10 text-success', label: 'Basic' },
  intermediate: { color: 'bg-warning/10 text-warning', label: 'Intermediate' },
  advanced: { color: 'bg-destructive/10 text-destructive', label: 'Advanced' },
};

export function AdminCaseDetailPage({ caseId }: { caseId: string }) {
  const id = caseId;
  const router = useRouter();

  const initial = mockCases[id] || getDefaultCase(id);
  const [caseData, setCaseData] = useState<CaseDetail>(initial);
  const [sourceCase, setSourceCase] = useState<ExpertCase | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'approve' | 'hide' | 'delete' | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewAction, setReviewAction] = useState<Review['action']>('comment');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setApiLoading(true);
      setApiError(null);
      try {
        const c = await fetchAdminCaseDetail(id);
        if (cancelled) return;
        setSourceCase(c);
        setCaseData(expertCaseToAdminDetailView(c));
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Unable to load case.';
        setApiError(msg);
        setSourceCase(null);
        if (mockCases[id]) {
          setCaseData(mockCases[id]);
        } else {
          setCaseData(getDefaultCase(id));
        }
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmitReview = () => {
    if (!reviewComment.trim()) return;
    const newReview: Review = {
      id: `r-${Date.now()}`,
      reviewer: 'Admin',
      role: 'Admin',
      date: new Date().toISOString().split('T')[0],
      rating: reviewRating,
      comment: reviewComment.trim(),
      action: reviewAction,
    };
    setCaseData((prev) => ({ ...prev, reviews: [newReview, ...prev.reviews] }));
    setReviewComment('');
    setReviewRating(0);
    setReviewAction('comment');
  };

  const stConfig = statusConfig[caseData.status];
  const StIcon = stConfig.icon;
  const dConfig = difficultyConfig[caseData.difficulty];
  const privacyIssueImages = caseData.images.filter((img) => !img.anonymized);

  const handleConfirm = async () => {
    const d = dialog;
    if (!d) return;

    if (d === 'delete') {
      if (sourceCase) {
        try {
          await deleteAdminCase(id);
          appToast.success('Case deleted.');
          router.push('/admin/cases');
        } catch (e) {
          appToast.error(e instanceof Error ? e.message : 'Delete failed.');
        }
        return;
      }
      router.push('/admin/cases');
      return;
    }

    if (sourceCase && (d === 'approve' || d === 'hide')) {
      try {
        const base = expertToSaveInput(sourceCase);
        const body =
          d === 'approve'
            ? { ...base, isApproved: true, isActive: true }
            : { ...base, isActive: false };
        await updateAdminCase(id, body);
        const refreshed = await fetchAdminCaseDetail(id);
        setSourceCase(refreshed);
        setCaseData(expertCaseToAdminDetailView(refreshed));
        appToast.success(d === 'approve' ? 'Case approved.' : 'Case deactivated (hidden).');
      } catch (e) {
        appToast.error(e instanceof Error ? e.message : 'Update failed.');
      }
      return;
    }

    if (d === 'approve') {
      setCaseData((prev) => ({ ...prev, status: 'approved' }));
    } else if (d === 'hide') {
      setCaseData((prev) => ({ ...prev, status: 'hidden' }));
    }
    setDialog(null);
  };

  const dialogCopy =
    dialog === 'approve'
      ? {
          title: 'Approve case',
          description: `Approve "${caseData.title}"? Students will be able to view this case.`,
          confirmLabel: 'Approve',
          destructive: false,
        }
      : dialog === 'hide'
        ? {
            title: 'Hide case',
            description: `Hide "${caseData.title}" from students? It will remain in the system but won't be visible.`,
            confirmLabel: 'Hide case',
            destructive: false,
          }
        : dialog === 'delete'
          ? {
              title: 'Delete case',
              description: `Permanently delete "${caseData.title}"? This cannot be undone.`,
              confirmLabel: 'Delete',
              destructive: true,
            }
          : null;

  return (
    <>
      <DetailPageLayout
        title="Case detail"
        maxWidthClass="max-w-[1600px]"
        showBack
      >
        {apiLoading ? (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading case from API…
          </div>
        ) : null}
        {apiError && !sourceCase ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="font-medium">API: </span>
            {apiError}
            <span className="block mt-1 text-xs opacity-90">
              Showing mock or placeholder data for this id when available.
            </span>
          </div>
        ) : null}
        {/* Back + Actions */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/admin/cases"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-card-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Cases
          </Link>

          <div className="flex items-center gap-2">
            {caseData.status !== 'approved' && (
              <button
                onClick={() => setDialog('approve')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 cursor-pointer transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
            )}
            {(caseData.status === 'approved' || caseData.status === 'pending') && (
              <button
                onClick={() => setDialog('hide')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-card-foreground hover:bg-input cursor-pointer transition-colors"
              >
                <EyeOff className="w-4 h-4" />
                Hide
              </button>
            )}
            <button
              onClick={() => setDialog('delete')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/50 text-sm font-medium text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Status */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${stConfig.bg} ${stConfig.color}`}>
                  <StIcon className="w-3.5 h-3.5" />
                  {stConfig.label}
                </span>
                <span className={`px-2.5 py-1 rounded text-xs font-medium ${dConfig.color}`}>
                  {dConfig.label}
                </span>
                <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded font-medium">{caseData.boneLocation}</span>
                <span className="px-2.5 py-1 bg-accent/10 text-accent text-xs rounded font-medium">{caseData.lesionType}</span>
              </div>
              <h2 className="text-xl font-bold text-card-foreground mb-3">{caseData.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{caseData.description}</p>
            </div>

            {/* Clinical History */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Clinical History
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{caseData.clinicalHistory}</p>
            </div>

            {/* Findings */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-primary" />
                Imaging Findings
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{caseData.findings}</p>
            </div>

            {/* Diagnosis */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                Diagnosis
              </h3>
              <p className="text-sm font-medium text-card-foreground">{caseData.diagnosis}</p>
            </div>

            {/* Reviews */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Reviews ({caseData.reviews.length})
              </h3>

              {/* Add Review Form */}
              <div className="border border-border rounded-lg p-4 mb-5">
                <p className="text-sm font-medium text-card-foreground mb-3">Add Review</p>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Rating:</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star === reviewRating ? 0 : star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="cursor-pointer p-0.5"
                      >
                        <Star
                          className={`w-4 h-4 transition-colors ${
                            star <= (hoverRating || reviewRating)
                              ? 'text-warning fill-warning'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {reviewRating > 0 && (
                    <span className="text-xs text-muted-foreground">{reviewRating}/5</span>
                  )}
                </div>

                {/* Action */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {(
                    [
                      { value: 'comment', label: 'Comment', color: 'bg-primary/10 text-primary border-primary/30' },
                      { value: 'approved', label: 'Approve', color: 'bg-success/10 text-success border-success/30' },
                      { value: 'requested_changes', label: 'Request Changes', color: 'bg-warning/10 text-warning border-warning/30' },
                      { value: 'rejected', label: 'Reject', color: 'bg-destructive/10 text-destructive border-destructive/30' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReviewAction(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
                        reviewAction === opt.value
                          ? `${opt.color} ring-1 ring-current`
                          : 'border-border text-muted-foreground hover:bg-input'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Comment */}
                <div className="flex gap-2">
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Write your review comment..."
                    rows={3}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleSubmitReview}
                    disabled={!reviewComment.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Submit Review
                  </button>
                </div>
              </div>

              {/* Review History */}
              {caseData.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No reviews yet.</p>
              ) : (
                <div className="space-y-4">
                  {caseData.reviews.map((review) => {
                    const actionConfig = {
                      approved: { color: 'text-success', bg: 'bg-success/10', label: 'Approved' },
                      rejected: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Rejected' },
                      requested_changes: { color: 'text-warning', bg: 'bg-warning/10', label: 'Requested Changes' },
                      comment: { color: 'text-primary', bg: 'bg-primary/10', label: 'Comment' },
                    }[review.action];

                    return (
                      <div key={review.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {review.reviewer.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{review.reviewer}</p>
                              <p className="text-xs text-muted-foreground">{review.role} &middot; {review.date}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionConfig.bg} ${actionConfig.color}`}>
                            {actionConfig.label}
                          </span>
                        </div>

                        {/* Stars */}
                        {review.rating > 0 && (
                          <div className="flex items-center gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= review.rating
                                    ? 'text-warning fill-warning'
                                    : 'text-muted-foreground/20'
                                }`}
                              />
                            ))}
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Images */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <FileImage className="w-5 h-5 text-primary" />
                Images ({caseData.images.length})
              </h3>

              {caseData.images.length === 0 ? (
                <p className="text-sm text-muted-foreground">No images attached to this case.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {caseData.images.map((img) => (
                    <div
                      key={img.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        img.anonymized ? 'border-border' : 'border-destructive/30 bg-destructive/5'
                      }`}
                    >
                      {/* Placeholder */}
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center shrink-0 ${
                        img.anonymized ? 'bg-muted' : 'bg-destructive/10'
                      }`}>
                        {img.anonymized ? (
                          <FileImage className="w-6 h-6 text-muted-foreground" />
                        ) : (
                          <ImageOff className="w-6 h-6 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{img.filename}</p>
                        <p className="text-xs text-muted-foreground">{img.type}</p>
                        {img.anonymized ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success mt-1">
                            <ShieldCheck className="w-3 h-3" />
                            Anonymized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive mt-1">
                            <ShieldAlert className="w-3 h-3" />
                            {img.issue}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Privacy Alert */}
            {!caseData.imageAnonymized && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-5 h-5 text-destructive" />
                  <h3 className="font-semibold text-destructive">Privacy Issue</h3>
                </div>
                <p className="text-sm text-destructive/80 mb-3">{caseData.flagReason}</p>
                <div className="space-y-1.5">
                  {privacyIssueImages.map((img) => (
                    <div key={img.id} className="flex items-center gap-2 text-xs text-destructive">
                      <ImageOff className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{img.filename}: {img.issue}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-destructive/70 mt-3">
                  This case must be hidden from students until all privacy issues are resolved.
                </p>
              </div>
            )}

            {/* Case Info */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-card-foreground mb-4">Case Information</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Added by</p>
                    <p className="text-sm font-medium text-card-foreground">{caseData.addedBy}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Added date</p>
                    <p className="text-sm font-medium text-card-foreground">{caseData.addedDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last modified</p>
                    <p className="text-sm font-medium text-card-foreground">{caseData.lastModified}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium text-card-foreground">{caseData.boneLocation}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-card-foreground mb-4">Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-input/50 text-center">
                  <Eye className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-card-foreground">{caseData.viewCount}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
                <div className="p-3 rounded-lg bg-input/50 text-center">
                  <BarChart3 className="w-5 h-5 text-accent mx-auto mb-1" />
                  <p className="text-xl font-bold text-card-foreground">{caseData.usageCount}</p>
                  <p className="text-xs text-muted-foreground">Uses</p>
                </div>
                <div className="p-3 rounded-lg bg-input/50 text-center">
                  <FileImage className="w-5 h-5 text-warning mx-auto mb-1" />
                  <p className="text-xl font-bold text-card-foreground">{caseData.images.length}</p>
                  <p className="text-xs text-muted-foreground">Images</p>
                </div>
                <div className="p-3 rounded-lg bg-input/50 text-center">
                  <Users className="w-5 h-5 text-success mx-auto mb-1" />
                  <p className="text-xl font-bold text-card-foreground">{caseData.usageCount > 0 ? Math.round(caseData.usageCount * 0.7) : 0}</p>
                  <p className="text-xs text-muted-foreground">Students</p>
                </div>
              </div>
            </div>

            {/* Privacy Status */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-card-foreground mb-4">Privacy Compliance</h3>
              <div className="space-y-3">
                {caseData.images.map((img) => (
                  <div key={img.id} className="flex items-center justify-between">
                    <span className="text-sm text-card-foreground truncate mr-3">{img.filename}</span>
                    {img.anonymized ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive shrink-0">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Issue
                      </span>
                    )}
                  </div>
                ))}
                {caseData.images.length === 0 && (
                  <p className="text-sm text-muted-foreground">No images to check.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DetailPageLayout>

      {dialogCopy ? (
        <DestructiveConfirmDialog
          open={Boolean(dialog)}
          onOpenChange={(open) => !open && setDialog(null)}
          title={dialogCopy.title}
          confirmLabel={dialogCopy.confirmLabel}
          destructive={dialogCopy.destructive}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
}
