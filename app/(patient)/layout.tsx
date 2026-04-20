"use client";

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { useNotifications } from '@/hooks/useNotifications';
import { PageLoader } from '@/components/ui/page-loader';
import IncomingCallOverlay from '@/components/patient/IncomingCallOverlay';

interface PatientLayoutProps {
  children: ReactNode;
}

export default function PatientLayout({ children }: PatientLayoutProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  useNotifications();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/signin');
  }, [isLoading, user, router]);

  if (isLoading) return <PageLoader />;
  if (!user) return null;

  return (
    <>
      <IncomingCallOverlay />
      {children}
    </>
  );
}
