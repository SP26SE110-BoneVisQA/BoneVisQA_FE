'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import { SectionCard } from '@/components/shared/SectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { fetchAdminCasesPaged } from '@/lib/api/admin-cases';
import { Filter, AlertCircle, ChevronLeft, ChevronRight, Eye, Loader2, Search, X } from 'lucide-react';

const PAGE_SIZE = 8;

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

function statusClass(statusRaw: string): string {
  const s = statusRaw.trim().toLowerCase();
  if (s === 'approved' || s === 'completed') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (s === 'pending') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (s === 'hidden') return 'border-slate-300 bg-slate-100 text-slate-700';
  if (s === 'rejected' || s === 'failed') return 'border-red-300 bg-red-50 text-red-700';
  return 'border-border bg-muted text-muted-foreground';
}

interface FilterState {
  location: string;
  lesionType: string;
  difficulty: string;
  boneSpecialty: string;
  pathology: string;
  severity: string;
  patientAgeGroup: string;
}

export default function AdminCasesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filters, setFilters] = useState<FilterState>({
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

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPageIndex(1);
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
    setPageIndex(1);
  };

  const { data, error, isLoading, mutate, isValidating } = useSWR(
    ['admin-cases', pageIndex, PAGE_SIZE],
    () => fetchAdminCasesPaged(pageIndex, PAGE_SIZE),
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
      onSuccess: (res) => {
        const tc = res?.totalCount ?? 0;
        const tp = Math.max(1, Math.ceil(tc / PAGE_SIZE));
        setPageIndex((p) => (p > tp ? tp : p));
      },
    },
  );

  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayPage = Math.min(pageIndex, totalPages);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const filteredRows = useMemo(() => {
    let result = rows;

    // Apply search filter
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((row) =>
        row.title.toLowerCase().includes(q) ||
        row.boneLocation.toLowerCase().includes(q) ||
        row.lesionType.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    }

    // Apply location filter
    if (filters.location !== 'All') {
      result = result.filter((row) =>
        row.boneLocation.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    // Apply lesion type filter
    if (filters.lesionType !== 'All') {
      result = result.filter((row) =>
        row.lesionType.toLowerCase().includes(filters.lesionType.toLowerCase())
      );
    }

    // Apply difficulty filter
    if (filters.difficulty !== 'All') {
      result = result.filter((row) =>
        row.difficulty.toLowerCase() === filters.difficulty.toLowerCase()
      );
    }

    return result;
  }, [rows, search, filters]);

  useEffect(() => {
    if (!error) return;
    toast.error(error.message || 'Unable to load medical cases.');
  }, [error, toast]);

  return (
    <div className="min-h-screen">
      <Header
        title="Medical Cases"
        subtitle="Review medical cases, monitor status, and open case management details."
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <SectionCard
          title="Case Management"
          description="View all medical cases and manage moderation status."
          actions={
            <Button type="button" variant="outline" onClick={() => void mutate()}>
              Refresh
            </Button>
          }
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search cases..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="shrink-0"
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
                  className="shrink-0 text-muted-foreground"
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalCount > 0
                ? `Showing page ${displayPage} of ${totalPages} · ${totalCount} case${totalCount === 1 ? '' : 's'} total`
                : null}
              {hasActiveFilters ? ` · ${filteredRows.length} match filters.` : ' · Filters apply to this page.'}
            </p>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
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

          {isLoading && !data ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading medical cases...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                Failed to load medical cases.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No medical cases found for the current filters.
            </div>
          ) : (
            <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-border">
              {isValidating && data ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Refreshing" />
                </div>
              ) : null}
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Case</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Location</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Lesion</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Difficulty</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium text-card-foreground">{row.title}</p>
                        <p className="text-xs text-muted-foreground">{row.id}</p>
                      </td>
                      <td className="px-4 py-3 text-card-foreground">{row.boneLocation}</td>
                      <td className="px-4 py-3 text-card-foreground">{row.lesionType}</td>
                      <td className="px-4 py-3 text-card-foreground">{row.difficulty}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                            row.status,
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/cases/${row.id}`}>
                          <Button type="button" variant="outline" size="sm">
                            <Eye className="h-3.5 w-3.5" />
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={displayPage <= 1 || isValidating}
                onClick={() =>
                  setPageIndex((p) => Math.max(1, Math.min(p, totalPages) - 1))
                }
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
                onClick={() =>
                  setPageIndex((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))
                }
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
