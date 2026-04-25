"use client";

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { useNotifications } from '@/hooks/useNotifications';
import { PageLoader } from '@/components/ui/page-loader';
import IncomingCallOverlay from '@/components/patient/IncomingCallOverlay';


interface PatientLayoutProps {
  children: ReactNode;
}

export default function PatientLayout({ children }: PatientLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  useNotifications();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/signin');
    if (!isLoading && user && !user.isProfileComplete && pathname !== '/patient/profile/complete') {
      router.replace('/patient/profile/complete');
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading) return <PageLoader />;
  if (!user) return null;

  return (
    <>
      <IncomingCallOverlay />
      {children}
    </>
  );
}
