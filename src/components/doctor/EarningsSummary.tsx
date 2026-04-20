"use client";

/**
 * EarningsSummary.tsx
 *
 * Reusable earnings summary card for the doctor dashboard and earnings page.
 * Shows: Total Earnings, Commission Deducted, Available for Payout, Paid Out.
 *
 * Commission recap (displayed inline):
 *   Platform takes 15% of every completed online consultation fee.
 *   Doctor receives 85% (doctor_earnings on the Appointment row).
 *   In-clinic = 0% commission.
 */

import { TrendingUp, ArrowDownCircle, Wallet, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EarningsSummary as EarningsSummaryType } from "@/services/doctorService";

interface EarningsSummaryProps {
  data: EarningsSummaryType | null;
  isLoading: boolean;
}

const fmt = (val: string | number | undefined) => {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  tooltip?: string;
  isLoading: boolean;
}

function StatCard({ label, value, icon, colorClass, bgClass, tooltip, isLoading }: StatCardProps) {
  return (
    <Card className={`border-0 shadow-sm ${bgClass}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                {label}
              </p>
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 shrink-0 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-28 mt-1" />
            ) : (
              <p className={`text-2xl font-bold ${colorClass} leading-tight`}>{value}</p>
            )}
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass} bg-current/10`}
            style={{ backgroundColor: "transparent" }}>
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${colorClass.replace("text-", "bg-").replace("-600", "-100").replace("-500", "-100")}`}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EarningsSummary({ data, isLoading }: EarningsSummaryProps) {
  const cards = [
    {
      label: "Total Net Earnings",
      value: fmt(data?.total_earnings),
      icon: <TrendingUp className="h-5 w-5 text-teal-600" />,
      colorClass: "text-teal-600",
      bgClass: "bg-teal-50/60 dark:bg-teal-950/20",
      tooltip: "Your total earnings after 15% platform commission is deducted from all completed online consultations.",
    },
    {
      label: "Commission Deducted",
      value: fmt(data?.total_commission),
      icon: <ArrowDownCircle className="h-5 w-5 text-rose-500" />,
      colorClass: "text-rose-500",
      bgClass: "bg-rose-50/60 dark:bg-rose-950/20",
      tooltip: "15% platform commission deducted from your online consultation fees. In-clinic consultations have 0% commission.",
    },
    {
      label: "Available for Payout",
      value: fmt(data?.available_earnings),
      icon: <Wallet className="h-5 w-5 text-amber-600" />,
      colorClass: "text-amber-600",
      bgClass: "bg-amber-50/60 dark:bg-amber-950/20",
      tooltip: "Earnings ready to be requested for payout. This is your net earnings minus any pending or already-paid payout requests.",
    },
    {
      label: "Total Paid Out",
      value: fmt(data?.paid_out),
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      colorClass: "text-emerald-600",
      bgClass: "bg-emerald-50/60 dark:bg-emerald-950/20",
      tooltip: "Total amount already transferred to your account via approved payout requests.",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} isLoading={isLoading} />
      ))}
    </div>
  );
}
