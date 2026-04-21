"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/store";

function AuthRehydrator() {
  const { user, setUser, setLoading, logout, setFamilyMembers } = useAuthStore();

  useEffect(() => {
    if (user) return;
    setLoading(true);

    async function rehydrate() {
      // Always try refresh first — if the access token is expired the cookie
      // is still httpOnly so we can't inspect it; a refresh attempt is cheap.
      try {
        await authService.refresh();
      } catch {
        // Refresh failed → no valid session
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const result = await authService.getMe();
        if (result) {
          setUser(result.user);
          setFamilyMembers(result.familyMembers);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    rehydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Proactive silent refresh every 13 min (access token lifetime is 15 min)
  useEffect(() => {
    if (!user) return;
    // Refresh every 13 min — access token lifetime is 15 min
    const interval = setInterval(async () => {
      try {
        await authService.refresh();
      } catch {
        logout();
      }
    }, 13 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, logout]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthRehydrator />
          <Toaster />
          <Sonner />
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
