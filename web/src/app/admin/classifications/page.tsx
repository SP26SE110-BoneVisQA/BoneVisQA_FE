'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import { useToast } from '@/components/ui/toast';
import boneSpecialtyApi, { type BoneSpecialtyDto } from '@/lib/api/admin-bone-specialty';
import pathologyCategoryApi, { type PathologyCategoryDto } from '@/lib/api/admin-pathology-category';
import ClassificationAnalyticsDashboard from '@/components/admin/classifications/ClassificationAnalyticsDashboard';
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowUp,
  ArrowDown,
  Bone,
  Stethoscope,
  BarChart3,
  ChevronLeft,
  ChevronFirst,
  ChevronLast,
} from 'lucide-react';

const ITEMS_PER_PAGE = 5;

type Tab = 'analytics' | 'bone' | 'pathology';
type ViewMode = 'tree' | 'table';

interface FormState {
  code: string;
  name: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  parentId?: string | null;
  boneSpecialtyId?: string | null;
}

export default function AdminClassificationsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('bone');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [bonePage, setBonePage] = useState(1);
  const [pathologyPage, setPathologyPage] = useState(1);

  // Helper to invalidate and refetch all classification queries
  const invalidateClassificationQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'bone-specialties-tree'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'bone-specialties-flat'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'pathology-categories'] }),
    ]);
  };

  // Force refresh by resetting queries to refetch
  const forceRefresh = async () => {
    // Cancel any outgoing refetches
    await queryClient.cancelQueries();
    // Clear and refetch
    await queryClient.invalidateQueries();
    // Force refetch all active queries
    await queryClient.refetchQueries({ type: 'active' });
  };
  const [form, setForm] = useState<FormState>({
    code: '',
    name: '',
    description: '',
    displayOrder: 0,
    isActive: true,
  });

  const { data: boneSpecialties = [], isPending: loadingBone } = useQuery({
    queryKey: ['admin', 'bone-specialties-tree'],
    queryFn: () => boneSpecialtyApi.getTree(),
  });

  const { data: pathologyCategories = [], isPending: loadingPathology } = useQuery({
    queryKey: ['admin', 'pathology-categories'],
    queryFn: () => pathologyCategoryApi.getAll({}),
  });

  const { data: allBoneSpecialties = [] } = useQuery({
    queryKey: ['admin', 'bone-specialties-flat'],
    queryFn: () => boneSpecialtyApi.getAll({ flat: true }),
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  // Filter bone specialties by status
  const filterBoneSpecialties = (items: BoneSpecialtyDto[]): BoneSpecialtyDto[] => {
    if (statusFilter === 'all') return items;
    
    const filterRecursively = (list: BoneSpecialtyDto[]): BoneSpecialtyDto[] => {
      return list
        .filter(item => {
          if (statusFilter === 'active') return item.isActive;
          if (statusFilter === 'inactive') return !item.isActive;
          return true;
        })
        .map(item => ({
          ...item,
          children: filterRecursively(item.children)
        }))
        .filter(item => item.isActive || item.children.length > 0 || statusFilter === 'inactive');
    };
    
    return filterRecursively(items);
  };

  const filteredBoneSpecialties = filterBoneSpecialties(boneSpecialties);

  // Reset page when filter or tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setBonePage(1);
    setPathologyPage(1);
  };

  const handleStatusFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    setStatusFilter(filter);
    setBonePage(1);
  };

  // Helper to flatten tree for table view
  const flattenBoneTree = (items: BoneSpecialtyDto[], level = 0): BoneSpecialtyDto[] => {
    const result: BoneSpecialtyDto[] = [];
    for (const item of items) {
      result.push({ ...item, level });
      if (item.children.length > 0) {
        result.push(...flattenBoneTree(item.children, level + 1));
      }
    }
    return result;
  };

  const flatBoneSpecialties = flattenBoneTree(boneSpecialties);

  // Filter flat list by status
  const getFilteredFlatList = () => {
    if (statusFilter === 'all') return flatBoneSpecialties;
    return flatBoneSpecialties.filter(item => {
      if (statusFilter === 'active') return item.isActive;
      if (statusFilter === 'inactive') return !item.isActive;
      return true;
    });
  };

  // Pagination for flat bone list (table view)
  const totalBonePages = Math.ceil(getFilteredFlatList().length / ITEMS_PER_PAGE);
  const paginatedBoneItems = getFilteredFlatList().slice(
    (bonePage - 1) * ITEMS_PER_PAGE,
    bonePage * ITEMS_PER_PAGE
  );

  // Pagination for pathology categories
  const totalPathologyPages = Math.ceil(pathologyCategories.length / ITEMS_PER_PAGE);
  const paginatedPathologyItems = pathologyCategories.slice(
    (pathologyPage - 1) * ITEMS_PER_PAGE,
    pathologyPage * ITEMS_PER_PAGE
  );

  const resetForm = () => {
    setForm({
      code: '',
      name: '',
      description: '',
      displayOrder: 0,
      isActive: true,
    });
    setIsCreating(false);
    setEditingId(null);
  };

  // Helper: Calculate next display order for Bone Specialty siblings (same parent)
  const getNextBoneOrder = (parentId: string | null | undefined): number => {
    const siblings = allBoneSpecialties.filter((s) => s.parentId === parentId);
    if (siblings.length === 0) return 1;
    return Math.max(...siblings.map((s) => s.displayOrder)) + 1;
  };

  // Helper: Calculate next display order for Pathology siblings (same bone specialty)
  const getNextPathologyOrder = (boneSpecialtyId: string | null | undefined): number => {
    const siblings = pathologyCategories.filter((p) => p.boneSpecialtyId === boneSpecialtyId);
    if (siblings.length === 0) return 1;
    return Math.max(...siblings.map((p) => p.displayOrder)) + 1;
  };

  const handleCreate = async () => {
    if (!form.code || !form.name) {
      toast.error('Code and Name are required.');
      return;
    }

    // Auto-calculate display order based on siblings
    const calculatedOrder = activeTab === 'bone'
      ? getNextBoneOrder(form.parentId)
      : getNextPathologyOrder(form.boneSpecialtyId);

    try {
      if (activeTab === 'bone') {
        await boneSpecialtyApi.create({
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          displayOrder: calculatedOrder,
          isActive: form.isActive,
          parentId: form.parentId || undefined,
        });
      } else {
        await pathologyCategoryApi.create({
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          displayOrder: calculatedOrder,
          isActive: form.isActive,
          boneSpecialtyId: form.boneSpecialtyId || undefined,
        });
      }
      toast.success(`${activeTab === 'bone' ? 'Bone Specialty' : 'Pathology Category'} created successfully.`);
      resetForm();
      await invalidateClassificationQueries();
      await forceRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create.');
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !form.code || !form.name) {
      toast.error('ID, Code, and Name are required.');
      return;
    }

    try {
      if (activeTab === 'bone') {
        await boneSpecialtyApi.update({
          id: editingId,
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          displayOrder: form.displayOrder,
          isActive: form.isActive,
          parentId: form.parentId || undefined,
        });
      } else {
        await pathologyCategoryApi.update({
          id: editingId,
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          displayOrder: form.displayOrder,
          isActive: form.isActive,
          boneSpecialtyId: form.boneSpecialtyId || undefined,
        });
      }
      toast.success(`${activeTab === 'bone' ? 'Bone Specialty' : 'Pathology Category'} updated successfully.`);
      resetForm();
      await invalidateClassificationQueries();
      await forceRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      if (activeTab === 'bone') {
        await boneSpecialtyApi.delete(id);
      } else {
        await pathologyCategoryApi.delete(id);
      }
      toast.success('Deleted successfully.');
      await invalidateClassificationQueries();
      // Force refresh in background - don't block UI
      forceRefresh().catch(console.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  const handleToggleActive = async (item: BoneSpecialtyDto | PathologyCategoryDto) => {
    try {
      if (activeTab === 'bone') {
        await boneSpecialtyApi.toggleActive(item.id, !item.isActive);
      } else {
        await pathologyCategoryApi.toggleActive(item.id, !item.isActive);
      }
      await invalidateClassificationQueries();
      await forceRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleReorder = async (id: string, moveUp: boolean) => {
    try {
      await boneSpecialtyApi.reorder(id, moveUp);
      toast.success('Reordered successfully.');
      await invalidateClassificationQueries();
      await forceRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder.');
    }
  };

  const startEdit = (item: BoneSpecialtyDto | PathologyCategoryDto) => {
    setEditingId(item.id);
    setIsCreating(false);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description || '',
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      parentId: 'parentId' in item ? item.parentId : null,
      boneSpecialtyId: 'boneSpecialtyId' in item ? item.boneSpecialtyId : null,
    });
  };

  const renderBoneTree = (items: BoneSpecialtyDto[], level = 0) => {
    return items.map((item) => (
      <div key={item.id}>
        <div
          className={`flex items-center gap-4 border-b border-border/60 px-5 py-4 hover:bg-muted/40 transition-all duration-200 rounded-lg mx-3 my-1 ${
            !item.isActive ? 'opacity-65' : ''
          } ${level === 0 ? 'bg-card shadow-sm border-l-4 border-l-primary' : 'bg-surface'}`}
          style={{ marginLeft: level === 0 ? 0 : `${level * 24}px` }}
        >
          {/* Expand/Collapse Button */}
          {item.children.length > 0 && (
            <button
              onClick={() => toggleExpanded(item.id)}
              className="p-2 hover:bg-primary/10 rounded-lg transition-colors flex-shrink-0"
            >
              {expanded.has(item.id) ? (
                <ChevronUp className="w-5 h-5 text-primary font-bold" />
              ) : (
                <ChevronDown className="w-5 h-5 text-primary font-bold" />
              )}
            </button>
          )}
          {item.children.length === 0 && <div className="w-10" />}

          {/* Icon & Main Content */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              level === 0 ? 'bg-primary/15' : 'bg-secondary/30'
            }`}>
              <Bone className={`w-5 h-5 ${level === 0 ? 'text-primary' : 'text-secondary'}`} />
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`font-bold text-base ${level === 0 ? 'text-primary' : 'text-foreground'}`}>
                {item.name}
              </span>
              <span className="text-sm bg-muted px-3 py-1 rounded-lg font-mono font-medium text-muted-foreground border border-border/50">
                {item.code}
              </span>
              {level > 0 && (
                <span className="text-xs bg-secondary/60 px-2.5 py-1 rounded-full font-semibold text-secondary-foreground">
                  Lv.{level}
                </span>
              )}
              {!item.isActive && (
                <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold border border-red-200">
                  Inactive
                </span>
              )}
              {item.children.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                  {item.children.length} child{item.children.length > 1 ? 'ren' : ''}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1.5 truncate max-w-xl">{item.description}</p>
            )}
          </div>

          {/* Order Badge */}
          <div className="flex-shrink-0">
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg font-medium">
              #{item.displayOrder}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleReorder(item.id, true)}
              className="p-2.5 hover:bg-blue-50 rounded-xl transition-colors"
              title="Move Up"
            >
              <ArrowUp className="w-4 h-4 text-blue-600" />
            </button>
            <button
              onClick={() => handleReorder(item.id, false)}
              className="p-2.5 hover:bg-blue-50 rounded-xl transition-colors"
              title="Move Down"
            >
              <ArrowDown className="w-4 h-4 text-blue-600" />
            </button>
            <button
              onClick={() => handleToggleActive(item)}
              className="p-2.5 hover:bg-muted rounded-xl transition-colors"
              title={item.isActive ? 'Deactivate' : 'Activate'}
            >
              {item.isActive ? (
                <ToggleRight className="w-6 h-6 text-green-600" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-400" />
              )}
            </button>
            <button
              onClick={() => startEdit(item)}
              className="p-2.5 hover:bg-amber-50 rounded-xl transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4 text-amber-600" />
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              className="p-2.5 hover:bg-red-50 rounded-xl transition-colors"
              title="Delete"
              disabled={item.children.length > 0}
            >
              <Trash2 className={`w-4 h-4 ${item.children.length > 0 ? 'text-gray-300' : 'text-red-500'}`} />
            </button>
          </div>
        </div>
        {expanded.has(item.id) && item.children.length > 0 && (
          <div className="border-l-2 border-dashed border-primary/30 ml-6 mr-3">
            {renderBoneTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const isLoading = activeTab === 'bone' ? loadingBone : loadingPathology;

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header
        title={t('classifications.title', 'Classification Management')}
        subtitle="Manage bone specialties and pathology categories"
      />

      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        {/* Tabs & View Mode */}
        <div className="flex items-center justify-between border-b border-border bg-card rounded-t-2xl px-2 pt-2">
          <div className="flex gap-1">
            <button
              onClick={() => handleTabChange('analytics')}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all font-semibold ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm">Analytics</span>
            </button>
            <button
              onClick={() => handleTabChange('bone')}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all font-semibold ${
                activeTab === 'bone'
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Bone className="w-5 h-5" />
              <span className="text-sm">Bone Specialties</span>
            </button>
            <button
              onClick={() => handleTabChange('pathology')}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all font-semibold ${
                activeTab === 'pathology'
                  ? 'bg-secondary text-secondary-foreground shadow-lg shadow-secondary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Stethoscope className="w-5 h-5" />
              <span className="text-sm">Pathology Categories</span>
            </button>
          </div>

          {/* View Mode Toggle - chỉ hiện khi ở tab Bone */}
          {activeTab === 'bone' && (
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl mr-2">
              <span className="text-xs text-muted-foreground px-2 font-medium">View:</span>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  viewMode === 'tree'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v18M3 12h18M5 5v14M19 5v14M5 12h14" />
                </svg>
                Tree
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  viewMode === 'table'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                </svg>
                Table
              </button>
            </div>
          )}
        </div>

        {/* Form - Ẩn ban đầu, chỉ hiện khi nhấn Create New hoặc Edit */}
        {(isCreating || editingId) && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-lg font-semibold mb-4">
              {editingId ? 'Edit' : 'Create New'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g., SHOULDER"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g., Shoulder Complex"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Optional description"
                />
              </div>
              {activeTab === 'bone' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Parent Specialty</label>
                  <select
                    value={form.parentId || ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- Root (No Parent) --</option>
                    {allBoneSpecialties
                      .filter((s) => s.id !== editingId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {activeTab === 'pathology' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Bone Specialty</label>
                  <select
                    value={form.boneSpecialtyId || ''}
                    onChange={(e) => setForm({ ...form, boneSpecialtyId: e.target.value || null })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- General (All Specialties) --</option>
                    {allBoneSpecialties.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="flex items-center gap-2 h-10 px-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              {editingId ? (
                <>
                  <button
                    onClick={handleUpdate}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-95"
                  >
                    Update
                  </button>
                  <button
                    onClick={resetForm}
                    className="flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              ) : isCreating ? (
                <>
                  <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-95"
                  >
                    Create New
                  </button>
                  <button
                    onClick={resetForm}
                    className="flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Nút Create New - chỉ hiện khi form đang ẩn */}
        {!isCreating && !editingId && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-95"
          >
            <Plus className="w-4 h-4" />
            Create New
          </button>
        )}

        {/* List */}
        <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/10">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Bone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {activeTab === 'bone' ? (viewMode === 'tree' ? 'Bone Specialties Tree' : 'Bone Specialties List') : 'Pathology Categories'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activeTab === 'bone'
                      ? viewMode === 'table'
                        ? `${flatBoneSpecialties.length} total specialties (${boneSpecialties.length} root categories)`
                        : `${boneSpecialties.length} root categories`
                      : `${pathologyCategories.length} categories`}
                  </p>
                </div>
              </div>
              {activeTab === 'bone' && (
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl">
                  <button
                    onClick={() => handleStatusFilterChange('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === 'all'
                        ? 'bg-card shadow-sm text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => handleStatusFilterChange('active')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === 'active'
                        ? 'bg-green-100 text-green-700 font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => handleStatusFilterChange('inactive')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === 'inactive'
                        ? 'bg-red-100 text-red-700 font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <p className="text-muted-foreground font-medium">Loading data...</p>
            </div>
          ) : activeTab === 'analytics' ? (
            <ClassificationAnalyticsDashboard />
          ) : activeTab === 'bone' ? (
            boneSpecialties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <Bone className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium text-lg">No bone specialties found</p>
                <p className="text-muted-foreground/70 text-sm">Create your first bone specialty using the form above</p>
              </div>
            ) : viewMode === 'table' ? (
              // Table View - shows all bone specialties in a flat table
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary/8 to-secondary/8">
                  <tr>
                    <th className="text-left px-5 py-4 text-sm font-bold text-primary">Code</th>
                    <th className="text-left px-5 py-4 text-sm font-bold text-primary">Name</th>
                    <th className="text-left px-5 py-4 text-sm font-bold text-primary">Parent</th>
                    <th className="text-left px-5 py-4 text-sm font-bold text-primary">Level</th>
                    <th className="text-left px-5 py-4 text-sm font-bold text-primary">Order</th>
                    <th className="text-left px-5 py-4 text-sm font-bold text-primary">Status</th>
                    <th className="text-left px-5 py-4 text-sm font-bold text-primary">Description</th>
                    <th className="text-right px-5 py-4 text-sm font-bold text-primary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBoneItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${!item.isActive ? 'opacity-65' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <span className="text-sm bg-muted px-3 py-1.5 rounded-lg font-mono font-semibold border border-border/50">{item.code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {item.level > 0 && (
                            <span
                              className="inline-flex items-center border-l-2 border-primary/40 pl-3"
                              style={{ marginLeft: `${(item.level - 1) * 20}px` }}
                            >
                              <ChevronRight className="w-4 h-4 text-primary/60" />
                            </span>
                          )}
                          <span className={`font-semibold text-base ${item.level === 0 ? 'text-primary' : 'text-foreground'}`}>
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground font-medium">
                        {item.parentName || '-'}
                      </td>
                      <td className="px-5 py-4">
                        {item.level > 0 && (
                          <span className="bg-secondary/50 px-3 py-1 rounded-lg text-sm font-semibold">
                            Lv.{item.level}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium">#{item.displayOrder}</td>
                      <td className="px-5 py-4">
                        <span className={`text-sm px-3 py-1.5 rounded-lg font-semibold ${item.isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-muted text-muted-foreground border border-border/50'}`}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground max-w-[200px] truncate font-medium">
                        {item.description || '-'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleReorder(item.id, true)}
                            className="p-2.5 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleReorder(item.id, false)}
                            className="p-2.5 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(item)}
                            className="p-2.5 hover:bg-muted rounded-xl transition-colors"
                            title={item.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {item.isActive ? (
                              <ToggleRight className="w-6 h-6 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            className="p-2.5 hover:bg-amber-50 rounded-xl transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-amber-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2.5 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete"
                            disabled={item.children.length > 0}
                          >
                            <Trash2 className={`w-4 h-4 ${item.children.length > 0 ? 'text-gray-300' : 'text-red-500'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totalBonePages > 1 && (
                  <tfoot>
                    <tr>
                      <td colSpan={8} className="px-5 py-4 bg-muted/20 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Showing {(bonePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(bonePage * ITEMS_PER_PAGE, getFilteredFlatList().length)} of {getFilteredFlatList().length} items
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setBonePage(1)}
                              disabled={bonePage === 1}
                              className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title="First page"
                            >
                              <ChevronFirst className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setBonePage(p => Math.max(1, p - 1))}
                              disabled={bonePage === 1}
                              className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title="Previous page"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-1 px-2">
                              {Array.from({ length: totalBonePages }, (_, i) => i + 1).map((pageNum) => (
                                <button
                                  key={pageNum}
                                  onClick={() => setBonePage(pageNum)}
                                  className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                                    bonePage === pageNum
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'hover:bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setBonePage(p => Math.min(totalBonePages, p + 1))}
                              disabled={bonePage === totalBonePages}
                              className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title="Next page"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setBonePage(totalBonePages)}
                              disabled={bonePage === totalBonePages}
                              className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title="Last page"
                            >
                              <ChevronLast className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              // Tree View - existing hierarchical display
              <div>{renderBoneTree(filteredBoneSpecialties)}</div>
            )
          ) : pathologyCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center">
                <Stethoscope className="w-10 h-10 text-secondary" />
              </div>
              <p className="text-muted-foreground font-medium text-lg">No pathology categories found</p>
              <p className="text-muted-foreground/70 text-sm">Create your first pathology category using the form above</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-secondary/10 to-primary/5">
                <tr>
                  <th className="text-left px-5 py-4 text-sm font-bold text-primary">Code</th>
                  <th className="text-left px-5 py-4 text-sm font-bold text-primary">Name</th>
                  <th className="text-left px-5 py-4 text-sm font-bold text-primary">Bone Specialty</th>
                  <th className="text-left px-5 py-4 text-sm font-bold text-primary">Order</th>
                  <th className="text-left px-5 py-4 text-sm font-bold text-primary">Status</th>
                  <th className="text-right px-5 py-4 text-sm font-bold text-primary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPathologyItems.map((item) => (
                  <tr key={item.id} className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${!item.isActive ? 'opacity-65' : ''}`}>
                    <td className="px-5 py-4">
                      <span className="text-sm bg-muted px-3 py-1.5 rounded-lg font-mono font-semibold border border-border/50">{item.code}</span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-base">{item.name}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground font-medium">
                      {item.boneSpecialtyName || '-'}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium">#{item.displayOrder}</td>
                    <td className="px-5 py-4">
                      <span className={`text-sm px-3 py-1.5 rounded-lg font-semibold ${item.isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-muted text-muted-foreground border border-border/50'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className="p-2.5 hover:bg-muted rounded-xl transition-colors"
                          title={item.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {item.isActive ? (
                            <ToggleRight className="w-6 h-6 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2.5 hover:bg-amber-50 rounded-xl transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-amber-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2.5 hover:bg-red-50 rounded-xl transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totalPathologyPages > 1 && (
                <tfoot>
                  <tr>
                    <td colSpan={6} className="px-5 py-4 bg-muted/20 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Showing {(pathologyPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(pathologyPage * ITEMS_PER_PAGE, pathologyCategories.length)} of {pathologyCategories.length} items
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPathologyPage(1)}
                            disabled={pathologyPage === 1}
                            className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="First page"
                          >
                            <ChevronFirst className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPathologyPage(p => Math.max(1, p - 1))}
                            disabled={pathologyPage === 1}
                            className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Previous page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <div className="flex items-center gap-1 px-2">
                            {Array.from({ length: totalPathologyPages }, (_, i) => i + 1).map((pageNum) => (
                              <button
                                key={pageNum}
                                onClick={() => setPathologyPage(pageNum)}
                                className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                                  pathologyPage === pageNum
                                    ? 'bg-secondary text-secondary-foreground shadow-sm'
                                    : 'hover:bg-muted text-muted-foreground'
                                }`}
                              >
                                {pageNum}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setPathologyPage(p => Math.min(totalPathologyPages, p + 1))}
                            disabled={pathologyPage === totalPathologyPages}
                            className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Next page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPathologyPage(totalPathologyPages)}
                            disabled={pathologyPage === totalPathologyPages}
                            className="p-2 hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Last page"
                          >
                            <ChevronLast className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
