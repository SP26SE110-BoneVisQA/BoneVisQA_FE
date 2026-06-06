'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bone, Stethoscope, Award, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import classificationApi from '@/lib/api/classification';
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

  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null | undefined>(undefined);
  const [focusLevel, setFocusLevel] = useState<string | undefined>(undefined);
  const [studentLevel, setStudentLevel] = useState<string | undefined>(undefined);

  // Fetch bone specialties tree
  const { data: boneSpecialties = [], isLoading: loadingSpecialties } = useQuery({
    queryKey: ['admin', 'bone-specialties-tree'],
    queryFn: () => classificationApi.getBoneSpecialtiesTree(),
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: updateClassSpecialty,
    onSuccess: () => {
      toast.success('Class specialty updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'class-dashboard'] });
      handleOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update class specialty');
    },
  });

  const handleSubmit = () => {
    if (!classData) return;
    const effectiveSpecialtyId = selectedSpecialtyId !== undefined ? selectedSpecialtyId : classData.classSpecialtyId || null;
    const effectiveFocusLevel = focusLevel ?? classData.focusLevel ?? 'Basic';
    const effectiveStudentLevel = studentLevel ?? classData.targetStudentLevel ?? 'Beginner';

    updateMutation.mutate({
      classId: classData.id,
      classSpecialtyId: effectiveSpecialtyId,
      focusLevel: effectiveFocusLevel,
      targetStudentLevel: effectiveStudentLevel,
      targetPathologyCategories: null,
    });
  };

  if (!classData) return null;
  const effectiveSpecialtyId = selectedSpecialtyId !== undefined ? selectedSpecialtyId : classData.classSpecialtyId || null;
  const effectiveFocusLevel = focusLevel ?? classData.focusLevel ?? 'Basic';
  const effectiveStudentLevel = studentLevel ?? classData.targetStudentLevel ?? 'Beginner';

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedSpecialtyId(undefined);
      setFocusLevel(undefined);
      setStudentLevel(undefined);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                value={effectiveSpecialtyId || ''}
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
                    effectiveFocusLevel === level
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
                    effectiveStudentLevel === level
                      ? 'bg-green-100 text-green-700 border border-green-200 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
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
