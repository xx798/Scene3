'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/components/auth-provider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PUBLIC_PATHS = ['/login'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!isLoading && !user && !isPublicPath) {
      router.replace('/login');
    }
  }, [isLoading, user, isPublicPath, router]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Sidebar />
      <main className="pl-60">
        <div className="min-h-screen p-6">
          {children}
        </div>
      </main>
    </>
  );
}
