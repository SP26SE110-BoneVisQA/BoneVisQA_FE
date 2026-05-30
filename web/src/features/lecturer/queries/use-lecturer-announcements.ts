'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnnouncement,
  deleteAnnouncement,
  getClassAnnouncements,
  getLecturerClasses,
  isValidGuidString,
  moveAnnouncement,
  updateAnnouncement,
} from '@/lib/api/lecturer';
import type { Announcement } from '@/lib/api/types';
import { getStoredUserId } from '@/lib/getStoredUserId';
import { queryKeys } from '@/lib/query-keys';

async function fetchAllLecturerAnnouncements(): Promise<Announcement[]> {
  const userId = getStoredUserId();
  const classList = await getLecturerClasses(userId);
  const allAnnouncements = await Promise.all(
    classList.map((c) => getClassAnnouncements(c.id).catch(() => [] as Announcement[])),
  );
  const flat = allAnnouncements.flat().filter(
    (a) => isValidGuidString(a.id) && isValidGuidString(a.classId),
  );
  const unique = Array.from(new Map(flat.map((a) => [a.id, a])).values());
  unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return unique;
}

export function useLecturerAnnouncementsFeed() {
  return useQuery({
    queryKey: queryKeys.lecturer.announcements(),
    queryFn: fetchAllLecturerAnnouncements,
    staleTime: 30_000,
  });
}

export function useCreateLecturerAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      classId,
      body,
    }: {
      classId: string;
      body: Parameters<typeof createAnnouncement>[1];
    }) => createAnnouncement(classId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.announcements() });
    },
  });
}

export function useUpdateLecturerAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      classId,
      announcementId,
      body,
    }: {
      classId: string;
      announcementId: string;
      body: Parameters<typeof updateAnnouncement>[2];
    }) => updateAnnouncement(classId, announcementId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.announcements() });
    },
  });
}

export function useDeleteLecturerAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      classId,
      announcementId,
    }: {
      classId: string;
      announcementId: string;
    }) => deleteAnnouncement(classId, announcementId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.announcements() });
    },
  });
}

export function useMoveLecturerAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      announcementId,
      targetClassId,
    }: {
      announcementId: string;
      targetClassId: string;
    }) => moveAnnouncement(announcementId, targetClassId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.announcements() });
    },
  });
}
