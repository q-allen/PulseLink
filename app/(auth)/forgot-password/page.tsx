"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/api";
import { cn } from "@/lib/utils";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const startResendTimer = () => {
    setResendIn(60);
    const t = setInterval(() => setResendIn((p) => { if (p <= 1) { clearInterval(t); return 0; } return p - 1; }), 1000);
  };

  const handleSendOtp = async () => {
    setIsLoading(true);
    try {
      const res = await authService.forgotPassword(email);
      toast({ title: "OTP sent", description: "Check your email for the 6-digit code." });
      setStep("otp");
      startResendTimer();
    } catch (err) {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(6).fill("");
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyOtp = () => {
    if (otpDigits.join("").length < 6) {
      toast({ title: "Enter the 6-digit OTP", variant: "destructive" });
      return;
    }
    setStep("password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await authService.resetPassword(email, otpDigits.join(""), newPassword);
      toast({ title: "Password reset!", description: "You can now sign in with your new password." });
      router.push("/signin");
    } catch (err) {
      toast({ title: "Reset failed", description: err instanceof ApiError ? err.message : "Please try again.", variant: "destructive" });
      // If OTP was wrong, go back to OTP step
      if (err instanceof ApiError && err.status === 400) setStep("otp");
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">PulseLink</span>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Reset your password</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Remembered it?{" "}
            <Link href="/signin" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>

        {/* ── STEP 1: Email ── */}
        {step === "email" && (
          <form onSubmit={(e) => { e.preventDefault(); handleSendOtp(); }} className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Enter your email
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fp-email" className="text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    required
                  />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full h-10 gradient-primary border-0 font-semibold text-sm" disabled={isLoading}>
              {isLoading ? "Sending…" : <> Send OTP <ArrowRight className="ml-2 h-4 w-4" /> </>}
            </Button>
          </form>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === "otp" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Verify OTP
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
              </p>
              <div className="flex items-center justify-center gap-2">
                {otpDigits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { otpRefs.current[index] = el; }}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    inputMode="numeric"
                    maxLength={1}
                    className={cn(
                      "h-11 w-11 text-center text-base font-semibold tracking-widest transition-all",
                      digit && "border-primary ring-1 ring-primary/30"
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {resendIn > 0 ? `Resend in ${resendIn}s` : (
                    <button type="button" onClick={handleSendOtp} className="text-primary hover:underline">
                      Resend OTP
                    </button>
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleVerifyOtp}
                  disabled={otpDigits.join("").length < 6}
                  className="h-8 text-xs gradient-primary border-0"
                >
                  Verify
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: New Password ── */}
        {step === "password" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Set new password
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9 pr-10 h-9 text-sm"
                    minLength={8}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password" className="text-sm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      "pl-9 h-9 text-sm",
                      confirmPassword.length > 0 && (
                        newPassword === confirmPassword
                          ? "border-green-500 focus-visible:ring-green-500/30"
                          : "border-destructive focus-visible:ring-destructive/30"
                      )
                    )}
                    required
                  />
                </div>
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-10 gradient-primary border-0 font-semibold text-sm"
              disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 8}
            >
              {isLoading ? "Resetting…" : <> Reset Password <ArrowRight className="ml-2 h-4 w-4" /> </>}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

