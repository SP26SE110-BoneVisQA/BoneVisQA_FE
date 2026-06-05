'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

export default function ProfileRedirectPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const role = user?.activeRole?.toLowerCase() ?? '';
    if (role === 'admin') {
      router.replace('/admin/profile');
    } else if (role === 'expert') {
      router.replace('/expert/profile');
    } else if (role === 'lecturer') {
      router.replace('/lecturer/profile');
    } else {
      router.replace('/student/profile');
    }
  }, [user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
