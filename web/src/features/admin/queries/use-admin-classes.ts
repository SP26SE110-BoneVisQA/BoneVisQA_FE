'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminClass,
  deleteAdminClass,
  fetchAdminClasses,
  updateAdminClass,
  type AdminClassModel,
} from '@/lib/api/admin-classes';
import { queryKeys } from '@/lib/query-keys';

export function useAdminClasses() {
  return useQuery({
    queryKey: queryKeys.admin.classes(),
    queryFn: fetchAdminClasses,
    staleTime: 30_000,
  });
}

export function useCreateAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { className: string; semester: string }) => createAdminClass(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.classes() });
    },
  });
}

export function useUpdateAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      className,
      semester,
    }: {
      id: string;
      className: string;
      semester: string;
    }) => updateAdminClass(id, { className, semester }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.classes() });
    },
  });
}

export function useDeleteAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminClass(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.classes() });
    },
  });
}

export type { AdminClassModel };
