"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, subYears } from "date-fns";
import { AlertCircle, CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/api";
import { useAuthStore } from "@/store";
import { cn } from "@/lib/utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatMobile = (raw: string) => {
  let cleaned = raw.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  cleaned = cleaned.slice(0, 10);
  const part1 = cleaned.slice(0, 3);
  const part2 = cleaned.slice(3, 6);
  const part3 = cleaned.slice(6, 10);
  if (cleaned.length <= 3) return part1;
  if (cleaned.length <= 6) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
};

const normalizeMobile = (raw: string) => {
  let cleaned = raw.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  return cleaned.slice(0, 10);
};


export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState<Date | undefined>();
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const isEmailValid = useMemo(() => EMAIL_REGEX.test(email), [email]);
  const mobileDigits = useMemo(() => normalizeMobile(mobile), [mobile]);
  const maxAdultDate = useMemo(() => subYears(new Date(), 18), []);
  const isAdult = birthdate ? birthdate <= maxAdultDate : false;

  // Birthdate select helpers
  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const currentYear = new Date().getFullYear();
  const minYear = 1900;
  const maxYear = maxAdultDate.getFullYear();
  const [bdMonth, setBdMonth] = useState<string>("");
  const [bdDay, setBdDay] = useState<string>("");
  const [bdYear, setBdYear] = useState<string>("");

  const daysInMonth = useMemo(() => {
    if (!bdMonth || !bdYear) return 31;
    return new Date(Number(bdYear), Number(bdMonth), 0).getDate();
  }, [bdMonth, bdYear]);

  // Sync select state → birthdate Date
  useEffect(() => {
    if (bdMonth && bdDay && bdYear) {
      const d = new Date(Number(bdYear), Number(bdMonth) - 1, Number(bdDay));
      setBirthdate(d);
    } else {
      setBirthdate(undefined);
    }
  }, [bdMonth, bdDay, bdYear]);

  useEffect(() => {
    if (!user) return;
    router.replace(user.role === "doctor" ? "/doctor" : "/patient");
  }, [router, user]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleSendOtp = async () => {
    if (!isEmailValid) {
      toast({ title: "Enter a valid email", description: "We will send the OTP to your email address.", variant: "destructive" });
      return;
    }
    if (resendIn > 0) return;
    setIsSendingOtp(true);
    try {
      const res = await authService.sendOtp(email);
      setOtpSent(true);
      setOtpVerified(false);
      setOtpDigits(Array(6).fill(""));
      setResendIn(60);
      toast({ title: "OTP sent", description: "Check your email for the 6-digit code." });
    } catch (err) {
      toast({ title: "Failed to send OTP", description: err instanceof ApiError ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);

    if (digit && index < next.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(6).fill("");
    pasted.split("").forEach((char, idx) => {
      next[idx] = char;
    });
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, 6) - 1;
    otpRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtp = () => {
    const otpValue = otpDigits.join("");
    if (otpValue.length !== 6) {
      toast({
        title: "Enter the 6-digit OTP",
        description: "Check your email and try again.",
        variant: "destructive",
      });
      return;
    }
    // OTP is validated server-side on register; mark as verified locally
    setOtpVerified(true);
    toast({ title: "OTP verified", description: "You can now set your password." });
  };

  const validateForm = () => {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!birthdate) return "Birthdate is required.";
    if (!isAdult) return "You must be at least 18 years old.";
    if (!mobileDigits || mobileDigits.length !== 10 || !mobileDigits.startsWith("9")) {
      return "Enter a valid Philippine mobile number.";
    }
    if (!email.trim() || !isEmailValid) return "Enter a valid email address.";
    if (!otpVerified) return "Please verify your OTP.";
    if (!password) return "Password is required.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      toast({ title: "Check your details", description: error, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const user = await authService.register({
        email,
        password,
        firstName,
        middleName,
        lastName,
        birthdate: `${bdYear}-${String(bdMonth).padStart(2, "0")}-${String(bdDay).padStart(2, "0")}`,
        phone: `+63${mobileDigits}`,
        role: "patient",
        otp: otpDigits.join(""),
      });
      setUser(user);
      toast({ title: "Account created!", description: "Welcome to PulseLink." });
      router.push("/patient/profile/complete");
    } catch (err) {
      toast({
        title: "Registration failed",
        description: err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit =
    otpVerified && password.length > 0 && password === confirmPassword && !isLoading;

  return (
    <div className="min-h-screen bg-background flex">
      {/* LEFT PANEL - Eye-catching Visual */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero flex-col p-12 justify-between relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />

      <div className="space-y-40">
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
          transition={{ duration: 0.6, delay: 0.1 }}
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

        <p className="text-white/40 text-xs">
          © {new Date().getFullYear()} PulseLink. All rights reserved.
        </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="lg:w-1/2 flex-1 flex flex-col items-center justify-start overflow-y-auto py-10 px-5 sm:px-10">
        {/* Mobile logo */}
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
          className="w-full max-w-lg"
        >
          {/* Header */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Already have one?{" "}
              <Link href="/signin" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">

            {/* ── Personal Details Section ── */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Personal Details
              </p>

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-sm">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="first-name"
                      placeholder="Juan"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-9 h-9 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-sm">Last Name</Label>
                  <Input
                    id="last-name"
                    placeholder="Dela Cruz"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-9 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="middle-name" className="text-sm">
                  Middle Name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="middle-name"
                  placeholder="D."
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* Birthdate */}
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Date of Birth
                  <span className="text-muted-foreground font-normal text-xs ml-0.5">· 18+ required</span>
                </Label>

                <div className="grid grid-cols-[1fr_80px_96px] gap-2">
                  {/* Month */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground z-10">
                      Month
                    </span>
                    <select
                      value={bdMonth}
                      aria-label="Birth month"
                      onChange={(e) => { setBdMonth(e.target.value); setBdDay(""); }}
                      className={cn(
                        "w-full appearance-none rounded-md border bg-background pt-5 pb-2 px-3 pr-8 text-sm font-medium transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-ring",
                        "hover:border-ring/60 cursor-pointer",
                        !bdMonth ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      <option value="" disabled />
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>

                  {/* Day */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground z-10">
                      Day
                    </span>
                    <select
                      value={bdDay}
                      aria-label="Birth day"
                      onChange={(e) => setBdDay(e.target.value)}
                      disabled={!bdMonth}
                      className={cn(
                        "w-full appearance-none rounded-md border bg-background pt-5 pb-2 px-3 pr-8 text-sm font-medium transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-ring",
                        "hover:border-ring/60 cursor-pointer",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                        !bdDay ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      <option value="" disabled />
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>

                  {/* Year */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground z-10">
                      Year
                    </span>
                    <select
                      value={bdYear}
                      aria-label="Birth year"
                      onChange={(e) => setBdYear(e.target.value)}
                      className={cn(
                        "w-full appearance-none rounded-md border bg-background pt-5 pb-2 px-3 pr-8 text-sm font-medium transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-ring",
                        "hover:border-ring/60 cursor-pointer",
                        !bdYear ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      <option value="" disabled />
                      {Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i).map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                {/* Status feedback */}
                {birthdate ? (
                  <div className={cn(
                    "flex items-center gap-2 mt-1 px-3 py-2 rounded-md text-xs border transition-all",
                    isAdult
                      ? "bg-green-500/8 border-green-500/30 text-green-700 dark:text-green-400"
                      : "bg-destructive/8 border-destructive/30 text-destructive"
                  )}>
                    {isAdult ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {isAdult
                      ? <><span className="font-medium">{format(birthdate, "MMMM d, yyyy")}</span><span className="opacity-60 ml-1">· Eligible</span></>
                      : "Must be at least 18 years old"
                    }
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <CalendarIcon className="h-3 w-3" />
                    Select your date of birth
                  </p>
                )}
              </div>
            </div>
            {/* ── Contact Details Section ── */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Contact Details
              </p>

              {/* Mobile */}
              <div className="space-y-1.5">
                <Label htmlFor="mobile" className="text-sm">Mobile Number</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-md border bg-muted px-3 h-9 text-sm text-muted-foreground shrink-0 select-none">
                    🇵🇭 +63
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="mobile"
                      type="tel"
                      inputMode="numeric"
                      placeholder="9XX-XXX-XXXX"
                      value={formatMobile(mobile)}
                      onChange={(e) => setMobile(e.target.value)}
                      className="pl-9 h-9 text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setOtpVerified(false);
                      setOtpSent(false);
                      setOtpDigits(Array(6).fill(""));
                      setResendIn(0);
                    }}
                    className="pl-9 h-9 text-sm"
                    required
                  />
                </div>
              </div>

              {/* OTP block */}
              {email.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div
                    className={cn(
                      "rounded-lg border p-4 space-y-4 transition-colors",
                      otpVerified
                        ? "border-green-500/40 bg-green-500/5"
                        : "border-border bg-muted/20"
                    )}
                  >
                    {/* OTP header row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          {otpVerified ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          )}
                          Email Verification
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {otpVerified
                            ? "Your email has been verified."
                            : "We'll send a 6-digit code to your email."}
                        </p>
                      </div>
                      {!otpVerified && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSendOtp}
                          disabled={isSendingOtp || !isEmailValid || resendIn > 0}
                          className="shrink-0 text-xs h-8"
                        >
                          {isSendingOtp ? "Sending…" : otpSent ? "Resend" : "Send Code"}
                        </Button>
                      )}
                    </div>

                    {/* OTP inputs */}
                    {!otpVerified && (
                      <div className="space-y-3">
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
                              disabled={!otpSent}
                              className={cn(
                                "h-11 w-11 text-center text-base font-semibold tracking-widest transition-all",
                                digit && "border-primary ring-1 ring-primary/30"
                              )}
                            />
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {resendIn > 0
                              ? `Resend available in ${resendIn}s`
                              : otpSent
                              ? "Didn't get it? Resend above."
                              : "Waiting for code…"}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleVerifyOtp}
                            disabled={!otpSent || otpVerified || otpDigits.join("").length < 6}
                            className="h-8 text-xs gradient-primary border-0"
                          >
                            Verify
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Password Section ── */}
            {otpVerified && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border bg-card p-5 space-y-4"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Set Password
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-sm">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
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

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-sm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn(
                        "pl-9 pr-10 h-9 text-sm",
                        confirmPassword.length > 0 &&
                          (password === confirmPassword
                            ? "border-green-500 focus-visible:ring-green-500/30"
                            : "border-destructive focus-visible:ring-destructive/30")
                      )}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match.</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Submit ── */}
            <Button
              type="submit"
              className="w-full h-10 gradient-primary border-0 font-semibold text-sm"
              disabled={!canSubmit}
            >
              {isLoading ? (
                "Creating your account…"
              ) : (
                <>
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground pb-2">
              By creating an account you agree to our{" "}
              <span className="text-primary cursor-pointer hover:underline">Terms</span> &amp;{" "}
              <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
