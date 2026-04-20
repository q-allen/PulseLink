"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/api";
import { useAuthStore } from "@/store";

export default function SignInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser, setFamilyMembers } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isAuthLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (!user) return;
    router.replace(user.role === "doctor" ? "/doctor" : "/patient");
  }, [router, user]);

  if (isAuthLoading) return null;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const user = await authService.login({ email, password });
      setUser(user);
      // Fetch full profile (including family members) after login
      authService.getMe().then((result) => {
        if (result) { setUser(result.user); setFamilyMembers(result.familyMembers); }
      });
      toast({ title: "Welcome back!", description: `Logged in as ${user.name}` });
      router.push(user.role === "doctor" ? "/doctor" : "/patient");
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof ApiError ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* LEFT PANEL - Eye-catching Visual */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero flex-col p-12 justify-between relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-white/10 blur-2xl" />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">PulseLink</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <h1 className="text-5xl font-bold text-white leading-tight">
            Talk to a doctor.<br />
            <span className="text-white/90">Right from home.</span>
          </h1>
          <p className="text-white/70 text-lg max-w-xs">
            Secure video consultations, real-time queue updates, and digital prescriptions — all in one place.
          </p>
        </motion.div>

        <div className="text-white/40 text-xs">
          © {new Date().getFullYear()} PulseLink. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="lg:w-1/2 flex-1 flex flex-col items-center justify-center overflow-y-auto py-10 px-5 sm:px-10">

        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">PulseLink</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Sign In
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="signin-email" className="text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password" className="text-sm">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 h-9 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 gradient-primary border-0 font-semibold text-sm"
              disabled={isLoading}
            >
              {isLoading ? "Signing in…" : (
                <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground pb-2">
              By signing in you agree to our{" "}
              <span className="text-primary cursor-pointer hover:underline">Terms</span> &amp;{" "}
              <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

