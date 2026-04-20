"use client";

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/store';
import { useNotifications } from '@/hooks/useNotifications';
import { PageLoader } from '@/components/ui/page-loader';

interface DoctorLayoutProps {
  children: ReactNode;
}

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isProfileCompletion = pathname === '/doctor/profile/complete' || pathname?.startsWith('/doctor/profile/complete/');

  useNotifications();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/signin');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (isLoading || !user) return;
    if (isProfileCompletion) return;

    const needsCompletion = user.role === 'doctor' && user.doctorProfileComplete === false;
    if (needsCompletion) router.replace('/doctor/profile/complete');
  }, [isLoading, user, isProfileCompletion, router]);

  if (isLoading) return <PageLoader />;
  if (!user) return null;

  if (isProfileCompletion) return <>{children}</>;

  return <DashboardLayout>{children}</DashboardLayout>;
}
