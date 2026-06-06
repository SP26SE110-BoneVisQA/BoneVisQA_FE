'use client';

import { useEffect, useState } from 'react';
import { http } from '@/lib/api/client';

export type BackendRole = 'Student' | 'Lecturer' | 'Expert' | 'Admin' | 'Guest';

export interface AuthUser {
  fullName: string | null;
  email: string | null;
  activeRole: BackendRole | null;
  roles: BackendRole[];
  status: string | null;
  /** Profile image URL (synced with /profile and localStorage after upload). */
  avatarUrl: string | null;
}

type AuthRefreshPatch = Partial<Pick<AuthUser, 'fullName' | 'avatarUrl' | 'status' | 'activeRole' | 'roles'>>;

export function emitAuthRefresh(patch?: AuthRefreshPatch) {
  if (typeof window === 'undefined') return;
  if (patch?.fullName != null) localStorage.setItem('fullName', patch.fullName);
  if (patch?.avatarUrl != null) localStorage.setItem('avatarUrl', patch.avatarUrl);
  if (patch?.status != null) localStorage.setItem('userStatus', patch.status);
  if (patch?.activeRole != null) localStorage.setItem('activeRole', patch.activeRole);
  if (patch?.roles) localStorage.setItem('roles', JSON.stringify(patch.roles));
  window.dispatchEvent(new CustomEvent<AuthRefreshPatch>('bonevis:auth-refresh', { detail: patch }));
}

function normalizeRole(raw: string | null | undefined): BackendRole | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === 'student') return 'Student';
  if (value === 'lecturer') return 'Lecturer';
  if (value === 'expert') return 'Expert';
  if (value === 'admin') return 'Admin';
  if (value === 'guest') return 'Guest';
  return null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  // const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // setIsHydrated(true);
    let cancelled = false;
    let latestSnapshot: AuthUser | null = null;

    const readAuth = () => {
      const token = localStorage.getItem('token');
      const fullName = localStorage.getItem('fullName');
      const email = localStorage.getItem('email');
      const activeRole = normalizeRole(localStorage.getItem('activeRole'));
      const status = localStorage.getItem('userStatus');
      const avatarUrl = localStorage.getItem('avatarUrl');

      let roles: BackendRole[] = [];
      try {
        const rawRoles = JSON.parse(localStorage.getItem('roles') || '[]') as string[];
        roles = rawRoles.map((role) => normalizeRole(role)).filter((role): role is BackendRole => role !== null);
      } catch {
        roles = [];
      }

      const localUser: AuthUser = {
        fullName,
        email,
        activeRole,
        roles,
        status,
        avatarUrl: avatarUrl?.trim() || null,
      };

      if (!cancelled) {
        latestSnapshot = localUser;
        setUser(localUser);
      }

      // Prefer canonical profile from API when a session token exists.
      if (!token) return;

      void http
        .get<Record<string, unknown>>('/api/profile')
        .then((response) => {
          if (cancelled) return;
          const payload = response.data ?? {};
          const normalizedActiveRole =
            normalizeRole(
              (payload.activeRole ?? payload.role ?? payload.ActiveRole ?? payload.Role) as string | null | undefined,
            ) ?? localUser.activeRole;
          const rawRoles = payload.roles ?? payload.Roles;
          const normalizedRoles = Array.isArray(rawRoles)
            ? rawRoles
                .map((role) => normalizeRole(String(role)))
                .filter((role): role is BackendRole => role !== null)
            : localUser.roles;

          const rawAvatar =
            payload.avatarUrl ?? payload.AvatarUrl ?? payload.profileImageUrl ?? payload.ProfileImageUrl;
          const nextAvatar =
            rawAvatar != null && String(rawAvatar).trim() ? String(rawAvatar).trim() : localUser.avatarUrl;
          if (nextAvatar && typeof window !== 'undefined') {
            localStorage.setItem('avatarUrl', nextAvatar);
          }

          setUser({
            fullName: (payload.fullName ?? payload.FullName ?? localUser.fullName) as string | null,
            email: (payload.email ?? payload.Email ?? localUser.email) as string | null,
            activeRole: normalizedActiveRole,
            roles: normalizedRoles,
            status: (payload.status ??
              payload.userStatus ??
              payload.UserStatus ??
              localUser.status) as string | null,
            avatarUrl: nextAvatar,
          });
        })
        .catch(() => {
          // Keep local/session-derived user as fallback when /api/users/me is unavailable.
        });
    };

    readAuth();
    const onStorage = () => readAuth();
    const onAuthRefresh = (event: Event) => {
      const detail = (event as CustomEvent<AuthRefreshPatch>).detail;
      if (detail && latestSnapshot) {
        latestSnapshot = {
          ...latestSnapshot,
          ...detail,
          avatarUrl: detail.avatarUrl ?? latestSnapshot.avatarUrl,
        };
        setUser(latestSnapshot);
      }
      readAuth();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('bonevis:auth-refresh', onAuthRefresh as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bonevis:auth-refresh', onAuthRefresh as EventListener);
    };
  }, []);

  // return { user, isHydrated };
  return { user };
}
