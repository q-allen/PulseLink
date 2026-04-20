"use client";

/**
 * /doctor/earnings/payout-request
 *
 * Payout Request Form — PulseLink
 *
 * Doctor fills in:
 *   - Amount (validated against available earnings)
 *   - Payout method (GCash / Bank Transfer / Maya)
 *   - Account name + number
 *   - Bank name (if bank transfer)
 *
 * On submit → POST /api/payouts/request/
 * Admin reviews and approves/rejects from the Django admin panel.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Wallet, Info, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  doctorService,
  EarningsSummary,
  PayoutMethod,
  PayoutRequestPayload,
} from "@/services/doctorService";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (val: string | number | undefined) => {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PayoutRequestPage() {
  const { toast } = useToast();

  const [summary, setSummary]       = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);

  // Form state
  const [amount, setAmount]               = useState("");
  const [method, setMethod]               = useState<PayoutMethod>("gcash");
  const [accountName, setAccountName]     = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName]           = useState("");
  const [errors, setErrors]               = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const res = await doctorService.getEarningsSummary();
      if (res.success) {
        setSummary(res.data);
        // Pre-fill amount with full available earnings
        const avail = parseFloat(res.data.available_earnings ?? "0");
        if (avail > 0) setAmount(avail.toFixed(2));
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const availableEarnings = parseFloat(summary?.available_earnings ?? "0");
  const hasPendingPayout  = parseFloat(summary?.pending_payout ?? "0") > 0;

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const amt = parseFloat(amount);

    if (!amount || isNaN(amt) || amt <= 0) {
      errs.amount = "Please enter a valid amount.";
    } else if (amt < 1) {
      errs.amount = "Minimum payout amount is ₱1.00.";
    } else if (amt > availableEarnings) {
      errs.amount = `Amount exceeds available earnings of ${fmt(availableEarnings)}.`;
    }

    if (!accountName.trim()) errs.accountName = "Account name is required.";
    if (!accountNumber.trim()) errs.accountNumber = "Account number is required.";
    if (method === "bank_transfer" && !bankName.trim()) {
      errs.bankName = "Bank name is required for bank transfers.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const payload: PayoutRequestPayload = {
      amount: parseFloat(amount).toFixed(2),
      method,
      account_name:   accountName.trim(),
      account_number: accountNumber.trim(),
      bank_name:      method === "bank_transfer" ? bankName.trim() : "",
    };

    const res = await doctorService.requestPayout(payload);
    setIsSubmitting(false);

    if (res.success) {
      setSuccess(true);
      toast({
        title: "Payout request submitted! 🎉",
        description: "Admin will review and process your payout within 1–3 business days.",
      });
    } else {
      toast({
        title: "Request failed",
        description: res.error ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  // ── Success state ─────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4 max-w-sm"
        >
          <div className="h-20 w-20 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Request Submitted!</h2>
          <p className="text-muted-foreground">
            Your payout request of <span className="font-semibold text-teal-600">{fmt(amount)}</span> has
            been submitted. Admin will review and process it within 1–3 business days.
          </p>
          <p className="text-sm text-muted-foreground">
            You'll receive an in-app notification once it's approved.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" asChild>
              <Link href="/doctor/earnings">View Earnings</Link>
            </Button>
            <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white">
              <Link href="/doctor/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Blocked states ────────────────────────────────────────────────────────

  if (!isLoading && availableEarnings < 1) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">No Available Earnings</h2>
          <p className="text-muted-foreground text-sm">
            You don't have any earnings available for payout yet. Complete paid online consultations to earn.
          </p>
          <Button variant="outline" asChild>
            <Link href="/doctor/earnings">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Earnings
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoading && hasPendingPayout) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Payout Already Pending</h2>
          <p className="text-muted-foreground text-sm">
            You already have a pending payout request of{" "}
            <span className="font-semibold">{fmt(summary?.pending_payout)}</span>.
            Please wait for admin review before submitting a new request.
          </p>
          <Button variant="outline" asChild>
            <Link href="/doctor/earnings">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Earnings
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">

      {/* Back link */}
      <Link
        href="/doctor/earnings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Earnings
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wallet className="h-6 w-6 text-teal-600" />
          Request Payout
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Withdraw your available earnings to your preferred account.
        </p>
      </div>

      {/* Available earnings banner */}
      {isLoading ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800"
        >
          <div>
            <p className="text-xs text-teal-700 dark:text-teal-400 font-medium uppercase tracking-wide">
              Available for Payout
            </p>
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-0.5">
              {fmt(summary?.available_earnings)}
            </p>
          </div>
          <div className="text-right text-xs text-teal-600/80 dark:text-teal-400/80">
            <p>{summary?.completed_count ?? 0} completed consults</p>
            <p className="mt-0.5">After 15% commission</p>
          </div>
        </motion.div>
      )}

      {/* Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Payout Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="amount">
                Amount (PHP) <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₱</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  max={availableEarnings}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`pl-7 ${errors.amount ? "border-rose-500" : ""}`}
                  placeholder="0.00"
                />
              </div>
              {errors.amount && <p className="text-xs text-rose-500">{errors.amount}</p>}
              <p className="text-xs text-muted-foreground">
                Max: {fmt(availableEarnings)}
                <button
                  type="button"
                  className="ml-2 text-teal-600 hover:underline"
                  onClick={() => setAmount(availableEarnings.toFixed(2))}
                >
                  Use max
                </button>
              </p>
            </div>

            <Separator />

            {/* Payout method */}
            <div className="space-y-1.5">
              <Label htmlFor="method">
                Payout Method <span className="text-rose-500">*</span>
              </Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PayoutMethod)}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gcash">📱 GCash</SelectItem>
                  <SelectItem value="maya">💳 Maya</SelectItem>
                  <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                  <SelectItem value="other">💰 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Account name */}
            <div className="space-y-1.5">
              <Label htmlFor="accountName">
                Account Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className={errors.accountName ? "border-rose-500" : ""}
                placeholder="Full name on account"
              />
              {errors.accountName && <p className="text-xs text-rose-500">{errors.accountName}</p>}
            </div>

            {/* Account number */}
            <div className="space-y-1.5">
              <Label htmlFor="accountNumber">
                {method === "gcash" ? "GCash Number" : method === "maya" ? "Maya Number" : "Account Number"}
                <span className="text-rose-500"> *</span>
              </Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={errors.accountNumber ? "border-rose-500" : ""}
                placeholder={method === "bank_transfer" ? "Account number" : "09XXXXXXXXX"}
              />
              {errors.accountNumber && <p className="text-xs text-rose-500">{errors.accountNumber}</p>}
            </div>

            {/* Bank name (only for bank transfer) */}
            {method === "bank_transfer" && (
              <div className="space-y-1.5">
                <Label htmlFor="bankName">
                  Bank Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className={errors.bankName ? "border-rose-500" : ""}
                  placeholder="e.g. BDO, BPI, Metrobank"
                />
                {errors.bankName && <p className="text-xs text-rose-500">{errors.bankName}</p>}
              </div>
            )}

            <Separator />

            {/* Info note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>
                Payouts are reviewed by admin and processed within <strong>1–3 business days</strong>.
                You'll receive an in-app notification once approved. GCash transfers are typically instant
                after approval.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white h-11"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                <><Wallet className="h-4 w-4" /> Submit Payout Request</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}



