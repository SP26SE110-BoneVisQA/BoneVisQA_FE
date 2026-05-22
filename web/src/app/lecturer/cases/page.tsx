'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { LecturerCasesPageSkeleton } from '@/components/shared/DashboardSkeletons';
import AssignCasesDialog from '@/components/lecturer/cases/AssignCasesDialog';
import CasesTable from '@/components/lecturer/cases/CasesTable';
import {
  FolderOpen,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  X,
} from 'lucide-react';
import {
  getLecturerCasesPaged,
  getLecturerClasses,
  PagedCasesResult,
} from '@/lib/api/lecturer';
import { useToast } from '@/components/ui/toast';
import type { CaseDto, ClassItem, ClassCaseAssignmentDto } from '@/lib/api/types';
import { Button } from '@/components/ui/button';

type StatusFilter = 'all' | 'approved' | 'unapproved' | 'active' | 'inactive';

const PAGE_SIZE = 10;

// Filter options
const LOCATION_OPTIONS = ['All', 'Upper Limb', 'Lower Limb', 'Spine', 'Pelvis', 'Shoulder', 'Elbow', 'Wrist', 'Hand', 'Hip', 'Knee', 'Ankle', 'Foot'];
const LESION_TYPE_OPTIONS = ['All', 'Fracture', 'Arthritis', 'Tumor', 'Infection', 'Congenital', 'Trauma', 'Degenerative', 'Other'];
const DIFFICULTY_OPTIONS = ['All', 'Basic', 'Intermediate', 'Advanced'];
const SEVERITY_OPTIONS = ['All', 'Mild', 'Moderate', 'Severe'];
const AGE_GROUP_OPTIONS = ['All', 'Pediatric', 'Adult', 'Geriatric'];
const BONE_SPECIALTY_OPTIONS = [
  { id: 'upper_limb', name: 'Upper Limb' },
  { id: 'lower_limb', name: 'Lower Limb' },
  { id: 'spine', name: 'Spine' },
  { id: 'pelvis', name: 'Pelvis' },
  { id: 'shoulder', name: 'Shoulder' },
  { id: 'elbow', name: 'Elbow' },
  { id: 'wrist', name: 'Wrist' },
  { id: 'hand', name: 'Hand' },
  { id: 'hip', name: 'Hip' },
  { id: 'knee', name: 'Knee' },
  { id: 'ankle', name: 'Ankle' },
  { id: 'foot', name: 'Foot' },
];
const PATHOLOGY_OPTIONS = [
  { id: 'fracture', name: 'Fracture' },
  { id: 'arthritis', name: 'Arthritis' },
  { id: 'tumor', name: 'Tumor' },
  { id: 'infection', name: 'Infection' },
  { id: 'congenital', name: 'Congenital' },
  { id: 'trauma', name: 'Trauma' },
  { id: 'degenerative', name: 'Degenerative' },
  { id: 'other', name: 'Other' },
];

interface LecturerFilterState {
  location: string;
  lesionType: string;
  difficulty: string;
  boneSpecialty: string;
  pathology: string;
  severity: string;
  patientAgeGroup: string;
}

export default function LecturerCasesPage() {
  const router = useRouter();
  const toast = useToast();
  const [pagedResult, setPagedResult] = useState<PagedCasesResult | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pageIndex, setPageIndex] = useState(1);
  const [isValidating, setIsValidating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Advanced filter states
  const [filters, setFilters] = useState<LecturerFilterState>({
    location: 'All',
    lesionType: 'All',
    difficulty: 'All',
    boneSpecialty: '',
    pathology: '',
    severity: 'All',
    patientAgeGroup: 'All',
  });

  const hasActiveFilters = filters.location !== 'All' || filters.lesionType !== 'All' || filters.difficulty !== 'All' ||
    filters.boneSpecialty !== '' || filters.pathology !== '' || filters.severity !== 'All' || filters.patientAgeGroup !== 'All';

  const updateFilter = (key: keyof LecturerFilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      location: 'All',
      lesionType: 'All',
      difficulty: 'All',
      boneSpecialty: '',
      pathology: '',
      severity: 'All',
      patientAgeGroup: 'All',
    });
  };

  // Assign dialog
  const [showAssign, setShowAssign] = useState(false);
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());

  const totalCount = pagedResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayPage = Math.min(pageIndex, totalPages);
  const rows = pagedResult?.items ?? [];

  useEffect(() => {
    async function fetchData() {
      try {
        const userId = localStorage.getItem('userId') || '';
        const classesData = await getLecturerClasses(userId);
        setClasses(classesData);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchCases() {
      setIsValidating(true);
      try {
        const result = await getLecturerCasesPaged(pageIndex, PAGE_SIZE);
        setPagedResult(result);
        // Adjust page if out of bounds
        if (result.totalPages > 0 && pageIndex > result.totalPages) {
          setPageIndex(result.totalPages);
        }
      } catch {
        // silently fail
      } finally {
        setIsValidating(false);
      }
    }
    fetchCases();
  }, [pageIndex]);

  const handleAssignSuccess = (assignments: ClassCaseAssignmentDto[]) => {
    setShowAssign(false);
    setSelectedCases(new Set());

    // Save composite keys (classId_caseId) for highlight on Assignments page
    const newKeys = assignments.map(a => `${a.classId}_${a.caseId}`);
    sessionStorage.setItem('newAssignmentIds', JSON.stringify(newKeys));

    toast.success('Cases assigned successfully!', {
      action: {
        label: 'View',
        onClick: () => router.push(`/lecturer/assignments?new=${newKeys.join(',')}`)
      }
    });
  };

  const toggleCaseSelection = (id: string) => {
    setSelectedCases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((c) => {
      const matchSearch =
        (c.title?.toLowerCase().includes(q) ?? false) ||
        (c.categoryName?.toLowerCase().includes(q) ?? false) ||
        (c.difficulty?.toLowerCase().includes(q) ?? false);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'approved' && c.isApproved) ||
        (statusFilter === 'unapproved' && !c.isApproved) ||
        (statusFilter === 'active' && c.isActive) ||
        (statusFilter === 'inactive' && !c.isActive);

      // Apply advanced filters
      const matchLocation = filters.location === 'All' ||
        (c.categoryName?.toLowerCase().includes(filters.location.toLowerCase()) ?? false);
      const matchLesionType = filters.lesionType === 'All' ||
        (c.categoryName?.toLowerCase().includes(filters.lesionType.toLowerCase()) ?? false);
      const matchDifficulty = filters.difficulty === 'All' ||
        (c.difficulty?.toLowerCase() === filters.difficulty.toLowerCase() || false);

      return matchSearch && matchStatus && matchLocation && matchLesionType && matchDifficulty;
    });
  }, [rows, search, statusFilter, filters]);

  const approvedCount = rows.filter((c) => c.isApproved).length;
  const activeCount = rows.filter((c) => c.isActive).length;

  return (
    <div className="min-h-screen">
      <Header title="Cases" subtitle={`${totalCount} cases total`} />

      <div className="mx-auto max-w-[1200px] p-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{totalCount}</p>
              <p className="text-sm text-muted-foreground">Total Cases</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{rows.length - approvedCount}</p>
              <p className="text-sm text-muted-foreground">Unapproved</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Eye className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/40 p-1">
            {(['all', 'approved', 'unapproved', 'active', 'inactive'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors cursor-pointer ${
                  statusFilter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search cases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <Button
              type="button"
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-1 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                  {[
                    filters.location !== 'All',
                    filters.lesionType !== 'All',
                    filters.difficulty !== 'All',
                    filters.boneSpecialty !== '',
                    filters.pathology !== '',
                    filters.severity !== 'All',
                    filters.patientAgeGroup !== 'All',
                  ].filter(Boolean).length}
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
            {selectedCases.size > 0 && (
              <button
                onClick={() => setShowAssign(true)}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Assign to Class ({selectedCases.size})
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="mb-6 rounded-xl border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Advanced Filters</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => updateFilter('location', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {LOCATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Lesion Type</label>
                <select
                  value={filters.lesionType}
                  onChange={(e) => updateFilter('lesionType', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {LESION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Difficulty</label>
                <select
                  value={filters.difficulty}
                  onChange={(e) => updateFilter('difficulty', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Bone Specialty</label>
                <select
                  value={filters.boneSpecialty}
                  onChange={(e) => updateFilter('boneSpecialty', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">All</option>
                  {BONE_SPECIALTY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Pathology</label>
                <select
                  value={filters.pathology}
                  onChange={(e) => updateFilter('pathology', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">All</option>
                  {PATHOLOGY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Severity</label>
                <select
                  value={filters.severity}
                  onChange={(e) => updateFilter('severity', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Age Group</label>
                <select
                  value={filters.patientAgeGroup}
                  onChange={(e) => updateFilter('patientAgeGroup', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {AGE_GROUP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Pagination info */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {totalCount > 0
              ? `Showing page ${displayPage} of ${totalPages} · ${totalCount} case${totalCount === 1 ? '' : 's'} total`
              : null}
            {hasActiveFilters ? ` · ${filtered.length} match filters.` : ' · Filters apply to this page.'}
          </p>
        </div>

        {/* Content */}
        {loading && !pagedResult ? (
          <LecturerCasesPageSkeleton />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-card-foreground mb-1">No cases found</h3>
            <p className="text-sm text-muted-foreground">
              {totalCount === 0 ? 'No cases available.' : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-border">
              {isValidating && pagedResult ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Refreshing" />
                </div>
              ) : null}
              <CasesTable
                cases={filtered}
                selectedCases={selectedCases}
                onSelectAll={setSelectedCases}
                onSelect={toggleCaseSelection}
              />
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={displayPage <= 1 || isValidating}
                onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {displayPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={displayPage >= totalPages || isValidating}
                onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Assign to Class Dialog */}
      {showAssign && (
        <AssignCasesDialog
          onClose={() => setShowAssign(false)}
          onSuccess={handleAssignSuccess}
          selectedCases={selectedCases}
          classes={classes}
        />
      )}
    </div>
  );
}
