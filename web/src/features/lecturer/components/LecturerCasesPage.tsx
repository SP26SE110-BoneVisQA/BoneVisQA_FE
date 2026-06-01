'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListPageLayout } from '@/components/layouts';
import AssignCasesDialog from '@/components/lecturer/cases/AssignCasesDialog';
import CasesTable from '@/components/lecturer/cases/CasesTable';
import {
  FolderOpen,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Plus,
  ImageIcon,
  ImageOff,
} from 'lucide-react';
import { useLecturerClasses } from '@/features/lecturer/queries/use-lecturer-classes';
import { useLecturerCasesList } from '@/features/lecturer/queries/use-lecturer-cases';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import type { CaseDto, ClassCaseAssignmentDto } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type StatusFilter = 'all' | 'approved' | 'unapproved' | 'active' | 'inactive';

export function LecturerCasesPage() {
  const router = useRouter();
  const casesQuery = useLecturerCasesList();
  const classesQuery = useLecturerClasses();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showAssign, setShowAssign] = useState(false);
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [showImages, setShowImages] = useState(true);

  const cases = casesQuery.data ?? [];
  const classes = classesQuery.data ?? [];

  const handleAssignSuccess = (assignments: ClassCaseAssignmentDto[]) => {
    setShowAssign(false);
    setSelectedCases(new Set());
    const newKeys = assignments.map((a) => `${a.classId}_${a.caseId}`);
    sessionStorage.setItem('newAssignmentIds', JSON.stringify(newKeys));
    appToast.success('Cases assigned successfully. Open Assignments to review.');
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
    return cases.filter((c) => {
      const q = search.toLowerCase();
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
      return matchSearch && matchStatus;
    });
  }, [cases, search, statusFilter]);

  const approvedCount = cases.filter((c) => c.isApproved).length;
  const activeCount = cases.filter((c) => c.isActive).length;

  const errorMessage =
    casesQuery.error || classesQuery.error
      ? getQueryErrorMessage(
          casesQuery.error ?? classesQuery.error,
          'Failed to load cases.',
        )
      : null;

  return (
    <ListPageLayout
      title="Cases"
      isLoading={casesQuery.isPending || classesQuery.isPending}
      error={errorMessage}
      maxWidthClass="max-w-[1200px]"
      actions={
        selectedCases.size > 0 ? (
          <Button type="button" onClick={() => setShowAssign(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign ({selectedCases.size})
          </Button>
        ) : null
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatMini icon={FolderOpen} value={cases.length} label="Total cases" />
        <StatMini icon={CheckCircle} value={approvedCount} label="Approved" tone="success" />
        <StatMini icon={XCircle} value={cases.length - approvedCount} label="Pending approval" tone="muted" />
        <StatMini icon={Eye} value={activeCount} label="Active" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, category, difficulty…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showImages ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowImages(!showImages)}
            className="flex items-center gap-2"
          >
            {showImages ? (
              <>
                <ImageOff className="h-4 w-4" />
                Hide Images
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                Show Images
              </>
            )}
          </Button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="unapproved">Unapproved</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 && !casesQuery.isPending ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <FolderOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-1 text-lg font-semibold text-card-foreground">No cases found</h3>
          <p className="text-sm text-muted-foreground">
            {cases.length === 0 ? 'No cases available.' : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <CasesTable
          cases={filtered as CaseDto[]}
          selectedCases={selectedCases}
          onSelectAll={setSelectedCases}
          onSelect={toggleCaseSelection}
          showImages={showImages}
        />
      )}

      {showAssign ? (
        <AssignCasesDialog
          onClose={() => setShowAssign(false)}
          onSuccess={handleAssignSuccess}
          selectedCases={selectedCases}
          classes={classes}
        />
      ) : null}
    </ListPageLayout>
  );
}

function StatMini({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof FolderOpen;
  value: number;
  label: string;
  tone?: 'success' | 'muted';
}) {
  const iconCls =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'muted'
        ? 'bg-muted text-muted-foreground'
        : 'bg-primary/10 text-primary';
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconCls}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-card-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
