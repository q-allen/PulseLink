"use client";

import Link from 'next/link';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Doctor } from '@/types';

// ── Profile completion heuristic ─────────────────────────────────────────────
// 7 sections × ~14% each = 100%. Each section is binary (done / not done).
const SECTIONS: { label: string; check: (d: Doctor) => boolean }[] = [
  { label: 'Profile photo',  check: (d) => !!d.avatar },
  { label: 'Specialty',      check: (d) => !!d.specialty },
  { label: 'Clinic / hospital', check: (d) => !!d.hospital },
  { label: 'Consultation fee',  check: (d) => (d.consultationFee > 0 || (d.onlineConsultationFee ?? 0) > 0) },
  { label: 'Weekly schedule',   check: (d) => Object.keys(d.weeklySchedule ?? {}).length > 0 },
  { label: 'Services',          check: (d) => (d.services ?? []).length > 0 },
  { label: 'HMO accepted',      check: (d) => (d.hmoAccepted ?? []).length > 0 },
];

export function calcProfileCompletion(doctor: Doctor): number {
  const done = SECTIONS.filter((s) => s.check(doctor)).length;
  return Math.round((done / SECTIONS.length) * 100);
}

export function getMissingFields(doctor: Doctor): string[] {
  return SECTIONS.filter((s) => !s.check(doctor)).map((s) => s.label);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  doctor: Doctor;
  /** Show the profile completion progress bar (default true) */
  showProgress?: boolean;
}

export default function VerificationBanner({ doctor, showProgress = true }: Props) {
  const isVerified = doctor.isVerified;
  const pct = calcProfileCompletion(doctor);
  const missing = getMissingFields(doctor);
  const isProfileComplete = doctor.doctorProfileComplete ?? false;

  if (isVerified) {
    // Verified — show a subtle green confirmation, no progress bar needed
    return (
      <Alert className="border-success/30 bg-success/5">
        <CheckCircle className="h-4 w-4 text-success" />
        <AlertDescription className="text-success text-sm font-medium">
          Your profile is verified. You are visible to patients and can accept appointments.
        </AlertDescription>
      </Alert>
    );
  }

  // Pending verification
  return (
    <div className="space-y-3">
      <Alert className="border-warning/40 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <AlertDescription className="space-y-1">
          <p className="font-semibold text-warning text-sm">
            Your profile is pending verification — usually 24–72 hours.
          </p>
          <p className="text-sm text-muted-foreground">
            Once verified, you&apos;ll appear in patient search and can accept appointments.
          </p>
          {!isProfileComplete && (
            <p className="text-sm text-muted-foreground">
              Complete your profile to speed up review.{' '}
              <Link href="/doctor/profile/complete" className="underline text-primary font-medium">
                Finish setup →
              </Link>
            </p>
          )}
        </AlertDescription>
      </Alert>

      {showProgress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Profile completion</span>
            <Badge
              variant="secondary"
              className={pct === 100 ? 'bg-success/10 text-success border-success/20' : ''}
            >
              {pct}% complete
            </Badge>
          </div>
          <Progress value={pct} className="h-2" />
          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Missing:{' '}
              <span className="text-foreground">{missing.join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
