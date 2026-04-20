"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TermsAndConditionsPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAgree = async () => {
    if (!agreed) return;

    setLoading(true);

    // Simulate brief processing for better UX
    setTimeout(() => {
      router.replace("/doctor/profile/complete");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">PulseLink</span>
        </div>

        <div className="rounded-3xl border-2 bg-card shadow-2xl p-8 md:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-primary/10">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Doctor Agreement</h1>
              <p className="text-muted-foreground text-base mt-1">
                Please read carefully before continuing
              </p>
            </div>
          </div>

          <ScrollArea className="h-[450px] pr-4 rounded-2xl border-2 bg-gradient-to-br from-muted/40 to-muted/20 p-8 text-sm leading-relaxed shadow-inner">
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">PulseLink Doctor Terms and Conditions</h2>

              <div>
                <h3 className="font-semibold mb-2">1. Medical Disclaimer &amp; Limitation of Liability</h3>
                <p className="text-foreground/80">
                  PulseLink is a technology platform only. We do not provide medical services, 
                  diagnosis, treatment, or advice. All medical services are provided solely by 
                  independent licensed doctors. 
                </p>
                <p className="text-foreground/80 mt-3">
                  <strong>The doctor is solely and exclusively responsible</strong> for all 
                  medical decisions, diagnoses, prescriptions, and care given to the patient. 
                  PulseLink is not liable for any error, negligence, malpractice, misdiagnosis, 
                  or any harm resulting from the doctor’s services. 
                </p>
                <p className="text-foreground/80 mt-3 text-red-600 text-xs font-medium">
                  By using this platform, you agree that PulseLink shall not be held liable 
                  for any medical-related issues or claims arising from your consultation with any doctor.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. Professional Responsibility</h3>
                <p className="text-foreground/80">
                  You agree to provide medical services in accordance with Philippine medical 
                  ethics, PRC guidelines, and all applicable laws. You are fully responsible for 
                  your own professional conduct.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Platform Commission</h3>
                <p className="text-foreground/80">
                  PulseLink charges a 15% commission on all successful online and on-demand 
                  consultations. In-clinic consultations are commission-free.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4. Verification &amp; Conduct</h3>
                <p className="text-foreground/80">
                  You confirm that your PRC license is valid. You must maintain accurate 
                  availability and honor confirmed appointments.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5. Account Termination</h3>
                <p className="text-foreground/80">
                  PulseLink reserves the right to suspend or terminate your account for 
                  violations of these terms, unprofessional conduct, or repeated patient complaints.
                </p>
              </div>

              <p className="text-xs text-muted-foreground pt-4 border-t">
                Last updated: April 13, 2026
              </p>
            </div>
          </ScrollArea>

          {/* Agreement Checkbox */}
          <div className="flex items-start gap-3 mt-8 p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border-2 border-primary/30 shadow-sm">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
            />
            <label
              htmlFor="agree"
              className="text-sm leading-tight cursor-pointer text-foreground/90"
            >
              I have read and fully agree to the PulseLink Doctor Terms and Conditions. 
              I understand that I am solely responsible for all medical services I provide 
              and that PulseLink is not liable for any medical outcomes.
            </label>
          </div>

          <Button
            onClick={handleAgree}
            disabled={!agreed || loading}
            size="lg"
            className="w-full mt-8 h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                I Agree
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
