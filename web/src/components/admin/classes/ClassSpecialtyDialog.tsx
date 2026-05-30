'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bone, Stethoscope, Award, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import classificationApi from '@/lib/api/classification';
import pathologyCategoryApi from '@/lib/api/admin-pathology-category';
import { updateClassSpecialty, type AdminClassModel } from '@/lib/api/admin-classes';

interface ClassSpecialtyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: AdminClassModel | null;
}

const FOCUS_LEVELS = ['Basic', 'Intermediate', 'Advanced'];
const STUDENT_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export function ClassSpecialtyDialog({
  open,
  onOpenChange,
  classData,
}: ClassSpecialtyDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null>(null);
  const [selectedPathologyIds, setSelectedPathologyIds] = useState<string[]>([]);
  const [focusLevel, setFocusLevel] = useState('Basic');
  const [studentLevel, setStudentLevel] = useState('Beginner');

  // Fetch bone specialties tree
  const { data: boneSpecialties = [], isLoading: loadingSpecialties } = useQuery({
    queryKey: ['admin', 'bone-specialties-tree'],
    queryFn: () => classificationApi.getBoneSpecialtiesTree(),
    enabled: open,
  });

  // Fetch pathology categories
  const { data: pathologyCategories = [], isLoading: loadingPathology } = useQuery({
    queryKey: ['admin', 'pathology-categories'],
    queryFn: () => pathologyCategoryApi.getAll({}),
    enabled: open && !!selectedSpecialtyId,
  });

  // Initialize form when classData changes
  useEffect(() => {
    if (classData) {
      setSelectedSpecialtyId(classData.classSpecialtyId || null);
      setFocusLevel(classData.focusLevel || 'Basic');
      setStudentLevel(classData.targetStudentLevel || 'Beginner');
      // TODO: Parse targetPathologyCategories from JSON if available
    }
  }, [classData]);

  // Filter pathology categories by selected specialty
  const filteredPathologyCategories = pathologyCategories.filter(
    (pc) => !selectedSpecialtyId || pc.boneSpecialtyId === selectedSpecialtyId || !pc.boneSpecialtyId
  );

  const updateMutation = useMutation({
    mutationFn: updateClassSpecialty,
    onSuccess: () => {
      toast.success('Class specialty updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'class-dashboard'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update class specialty');
    },
  });

  const handleSubmit = () => {
    if (!classData) return;

    updateMutation.mutate({
      classId: classData.id,
      classSpecialtyId: selectedSpecialtyId,
      focusLevel,
      targetStudentLevel: studentLevel,
      targetPathologyCategories: selectedPathologyIds.length > 0 ? selectedPathologyIds : null,
    });
  };

  const togglePathologyCategory = (id: string) => {
    setSelectedPathologyIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  if (!classData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Manage Class Specialty
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Class Info */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="font-semibold">{classData.className}</div>
            <div className="text-sm text-muted-foreground">
              Semester: {classData.semester}
            </div>
          </div>

          {/* Bone Specialty Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Bone className="h-4 w-4 text-primary" />
              Bone Specialty *
            </label>
            {loadingSpecialties ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading specialties...
              </div>
            ) : (
              <select
                value={selectedSpecialtyId || ''}
                onChange={(e) => setSelectedSpecialtyId(e.target.value || null)}
                className="w-full h-10 rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Select Bone Specialty --</option>
                {boneSpecialties.map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.name} ({spec.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Focus Level */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Award className="h-4 w-4 text-secondary" />
              Focus Level
            </label>
            <div className="flex gap-2">
              {FOCUS_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFocusLevel(level)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    focusLevel === level
                      ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Target Student Level */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              Target Student Level
            </label>
            <div className="flex gap-2">
              {STUDENT_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setStudentLevel(level)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    studentLevel === level
                      ? 'bg-green-100 text-green-700 border border-green-200 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Pathology Categories (Optional) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              Target Pathology Categories (Optional)
            </label>
            {loadingPathology ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading categories...
              </div>
            ) : filteredPathologyCategories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {filteredPathologyCategories.map((pc) => (
                  <label
                    key={pc.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPathologyIds.includes(pc.id)}
                      onChange={() => togglePathologyCategory(pc.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{pc.name}</span>
                    <span className="text-xs text-muted-foreground">({pc.code})</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No pathology categories available
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Specialty
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
