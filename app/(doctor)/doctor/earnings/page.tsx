"use client";

/**
 * /doctor/earnings
 *
 * Doctor Earnings Dashboard — PulseLink
 *
 * Shows:
 *   - Summary cards: Total Earnings, Commission Deducted, Available for Payout, Paid Out
 *   - Commission explanation banner (15% platform fee)
 *   - This week / today stats
 *   - Per-appointment earnings breakdown table
 *   - Payout history table
 *   - "Request Payout" CTA button
 *
 * Commission recap:
 *   Platform takes 15% of every completed online/on-demand consultation fee.
 *   Doctor receives 85% (doctor_earnings on the Appointment row).
 *   In-clinic = 0% commission (doctor keeps 100%).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp, Wallet, ArrowRight, Info, Calendar,
  CheckCircle2, Clock, XCircle, RefreshCw, DollarSign,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { doctorService, EarningsSummary as EarningsSummaryType, Payout } from "@/services/doctorService";
import { EarningsSummary } from "@/components/doctor/EarningsSummary";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (val: string | number | undefined) => {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const payoutStatusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  className: "bg-amber-100 text-amber-700 border-amber-200",   icon: <Clock className="h-3 w-3" /> },
  approved: { label: "Approved", className: "bg-teal-100 text-teal-700 border-teal-200",      icon: <CheckCircle2 className="h-3 w-3" /> },
  paid:     { label: "Paid",     className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-700 border-rose-200",      icon: <XCircle className="h-3 w-3" /> },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const { toast } = useToast();

  const [summary, setSummary]       = useState<EarningsSummaryType | null>(null);
  const [payouts, setPayouts]       = useState<Payout[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [showAll, setShowAll]       = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [summaryRes, payoutsRes] = await Promise.all([
        doctorService.getEarningsSummary(),
        doctorService.getPayouts(),
      ]);
      if (summaryRes.success) setSummary(summaryRes.data);
      if (payoutsRes.success) setPayouts(payoutsRes.data);
      setIsLoading(false);
    };
    load();
  }, []);

  const hasPendingPayout = payouts.some((p) => p.status === "pending");
  const availableEarnings = parseFloat(summary?.available_earnings ?? "0");
  const canRequestPayout  = availableEarnings >= 1 && !hasPendingPayout;

  const visibleBreakdown = showAll
    ? (summary?.breakdown ?? [])
    : (summary?.breakdown ?? []).slice(0, 5);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-teal-600" />
            Earnings & Payouts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your consultation earnings and request payouts.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          disabled={!canRequestPayout}
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-md"
        >
          <Link href="/doctor/earnings/payout-request">
            <Wallet className="h-4 w-4" />
            Request Payout
            {availableEarnings > 0 && (
              <Badge className="ml-1 bg-white/20 text-white border-0 text-xs">
                {fmt(summary?.available_earnings)}
              </Badge>
            )}
          </Link>
        </Button>
      </motion.div>

      {/* ── Commission explanation banner ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
      >
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <span className="font-semibold">How commissions work: </span>
          PulseLink takes a <span className="font-bold">15% platform fee</span> on every completed
          online consultation. You keep <span className="font-bold">85%</span> of the fee.
          In-clinic consultations have <span className="font-bold">0% commission</span> — you keep 100%.
          Example: ₱800 online consult → ₱120 platform fee → <span className="font-bold">₱680 to you</span>.
        </div>
      </motion.div>

      {/* ── Summary cards ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <EarningsSummary data={summary} isLoading={isLoading} />
      </motion.div>

      {/* ── This week / today mini stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid sm:grid-cols-3 gap-3"
      >
        {[
          { label: "Today's Earnings",    value: summary?.today_earnings,  sub: `${summary?.today_consults ?? 0} consult(s)` },
          { label: "This Week's Earnings", value: summary?.week_earnings,   sub: `${summary?.week_consults ?? 0} consult(s)` },
          { label: "Pending Payout",       value: summary?.pending_payout,  sub: hasPendingPayout ? "Under review" : "None pending" },
        ].map((item) => (
          <Card key={item.label} className="border-border/60">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
              {isLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <p className="text-xl font-bold text-foreground mt-0.5">{fmt(item.value)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* ── Payout history ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-teal-600" />
              Payout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : payouts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No payout requests yet</p>
                <p className="text-sm mt-1">Request your first payout once you have available earnings.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payouts.map((payout) => {
                  const cfg = payoutStatusConfig[payout.status] ?? payoutStatusConfig.pending;
                  return (
                    <div
                      key={payout.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                          <Wallet className="h-4 w-4 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {fmt(payout.amount)}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              via {payout.method === "gcash" ? "GCash" : payout.method === "bank_transfer" ? "Bank Transfer" : payout.method === "maya" ? "Maya" : "Other"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payout.created_at), "MMM d, yyyy")}
                            {payout.payout_reference && (
                              <span className="ml-2 font-mono">Ref: {payout.payout_reference}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {payout.rejection_reason && (
                          <p className="text-xs text-rose-600 max-w-[200px] truncate">
                            {payout.rejection_reason}
                          </p>
                        )}
                        <Badge className={`gap-1 text-xs ${cfg.className}`}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Per-appointment breakdown ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-600" />
              Appointment Earnings Breakdown
              {summary && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {summary.completed_count} completed
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : !summary?.breakdown?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No completed online consultations yet</p>
                <p className="text-sm mt-1">Earnings appear here after you complete paid online appointments.</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-5 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
                  <span>Date</span>
                  <span>Type</span>
                  <span className="text-right">Gross Fee</span>
                  <span className="text-right text-rose-500">Commission (15%)</span>
                  <span className="text-right text-teal-600">Your Earnings</span>
                </div>

                <div className="space-y-1">
                  {visibleBreakdown.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-sm"
                    >
                      <span className="text-muted-foreground">
                        {format(new Date(item.date), "MMM d, yyyy")}
                      </span>
                      <span className="capitalize text-muted-foreground sm:block">
                        {item.type === "on_demand" ? "On-Demand" : item.type}
                      </span>
                      <span className="text-right font-medium">{fmt(item.fee)}</span>
                      <span className="text-right text-rose-500">−{fmt(item.platform_commission)}</span>
                      <span className="text-right font-bold text-teal-600">{fmt(item.doctor_earnings)}</span>
                    </div>
                  ))}
                </div>

                {(summary?.breakdown?.length ?? 0) > 5 && (
                  <>
                    <Separator className="my-3" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-1 text-muted-foreground"
                      onClick={() => setShowAll((v) => !v)}
                    >
                      {showAll ? (
                        <><ChevronUp className="h-4 w-4" /> Show Less</>
                      ) : (
                        <><ChevronDown className="h-4 w-4" /> Show All {summary?.breakdown?.length} Appointments</>
                      )}
                    </Button>
                  </>
                )}

                {/* Totals row */}
                <Separator className="my-3" />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm font-semibold">
                  <span className="col-span-2 sm:col-span-2 text-foreground">Total</span>
                  <span className="text-right">{fmt(summary?.total_gross)}</span>
                  <span className="text-right text-rose-500">−{fmt(summary?.total_commission)}</span>
                  <span className="text-right text-teal-600">{fmt(summary?.total_earnings)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Bottom CTA ── */}
      {canRequestPayout && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800"
        >
          <div>
            <p className="font-semibold text-teal-800 dark:text-teal-300">
              You have {fmt(summary?.available_earnings)} available for payout
            </p>
            <p className="text-sm text-teal-700/80 dark:text-teal-400 mt-0.5">
              Payouts are processed within 1–3 business days after admin approval.
            </p>
          </div>
          <Button asChild className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shrink-0">
            <Link href="/doctor/earnings/payout-request">
              Request Payout <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      )}
    </div>
  );
}

