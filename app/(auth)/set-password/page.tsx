"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/store";
import { ApiError } from "@/services/api";
import { cn } from "@/lib/utils";

function ActivateAccountForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { toast }    = useToast();
  const { setUser }  = useAuthStore();

  const uid   = searchParams.get("uid")   ?? "";
  const token = searchParams.get("token") ?? "";

  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [done,            setDone]            = useState(false);

  // If the link is missing uid/token, show an error immediately
  const linkInvalid = !uid || !token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Minimum 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const user = await authService.activateDoctor(uid, token, password, confirmPassword);
      setUser(user);
      setDone(true);
      toast({ title: "Account activated!", description: "Welcome to PulseLink." });
      // Auto-login: cookies are already set by the backend response
      // Redirect to Terms and Conditions first
      setTimeout(() => router.push("/terms-and-conditions"), 1800);
    } catch (err) {
      toast({
        title: "Activation failed",
        description: err instanceof ApiError ? err.message : "Invalid or expired link.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">PulseLink</span>
        </div>

        {/* Invalid link */}
        {linkInvalid && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-7 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Invalid activation link</h2>
            <p className="text-sm text-muted-foreground">
              This link is missing required parameters. Please use the link from your welcome email.
            </p>
          </div>
        )}

        {/* Success state */}
        {!linkInvalid && done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border bg-card p-8 text-center space-y-3"
          >
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">Account activated!</h2>
            <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
          </motion.div>
        )}

        {/* Form */}
        {!linkInvalid && !done && (
          <div className="rounded-xl border bg-card p-7 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Activate your account</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a password to complete your PulseLink doctor account setup.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 h-9 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      "pl-9 pr-10 h-9 text-sm",
                      confirmPassword.length > 0 &&
                        (password === confirmPassword
                          ? "border-emerald-500 focus-visible:ring-emerald-500/30"
                          : "border-destructive focus-visible:ring-destructive/30")
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary border-0 font-semibold mt-2"
                disabled={isLoading}
              >
                {isLoading ? "Activating…" : (
                  <>Activate Account <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <ActivateAccountForm />
    </Suspense>
  );
}

