"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader, ThemeProvider } from "@aws-amplify/ui-react";
import {
  AwsCredentialProvider,
  FaceLivenessDetectorCore,
} from "@aws-amplify/ui-react-liveness";
import { AlertCircle, RefreshCw, ScanFace } from "lucide-react";

import { doctorService, DoctorLivenessCompleteResponse, DoctorLivenessSessionResponse } from "@/services/doctorService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AwsFaceLivenessVerificationProps {
  onVerified: (result: DoctorLivenessCompleteResponse) => void;
  onCancel?: () => void;
}

function formatLivenessErrorMessage(message?: string): string {
  if (!message) {
    return "The liveness check ran into a problem. Please try again.";
  }

  if (message.includes("StartFaceLivenessSession")) {
    return (
      "AWS denied the browser liveness stream. Add " +
      "rekognition:StartFaceLivenessSession to LivenessFrontendRole."
    );
  }

  if (message.includes("Deserialization error") || message.includes("undefined")) {
    return (
      "AWS denied the liveness stream (permission error). " +
      "Ensure rekognition:StartFaceLivenessSession is attached to LivenessFrontendRole."
    );
  }

  return message;
}

export default function AwsFaceLivenessVerification({
  onVerified,
  onCancel,
}: AwsFaceLivenessVerificationProps) {
  const [session, setSession] = useState<DoctorLivenessSessionResponse | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [detectorKey, setDetectorKey] = useState(0);
  const mountedRef = useRef(true);

  const createSession = useCallback(async () => {
    if (!mountedRef.current) return;

    // Tear down any active detector first by clearing session + bumping key,
    // then wait for the stream to fully close before opening a new one.
    setLoadingSession(true);
    setError("");
    setSession(null);
    setDetectorKey(prev => prev + 1);

    // Give the old FaceLivenessDetectorCore time to release its ReadableStream
    await new Promise<void>(resolve => setTimeout(resolve, 600));

    if (!mountedRef.current) return;

    const res = await doctorService.createDoctorLivenessSession();

    if (!mountedRef.current) return;

    if (!res.success) {
      setError(formatLivenessErrorMessage(res.error ?? "Failed to start face liveness verification."));
      setLoadingSession(false);
      return;
    }

    setSession(res.data);
    setLoadingSession(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void createSession();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const credentialProvider = useMemo<AwsCredentialProvider | undefined>(() => {
    if (!session) return undefined;

    return async () => ({
      accessKeyId: session.credentials.accessKeyId,
      secretAccessKey: session.credentials.secretAccessKey,
      sessionToken: session.credentials.sessionToken,
      expiration: new Date(session.credentials.expiration),
    });
  }, [session]);

  const handleAnalysisComplete = useCallback(async () => {
    if (!session || !mountedRef.current) return;

    setSubmitting(true);
    setError("");
    const res = await doctorService.completeDoctorLivenessSession(session.session_id);

    if (!mountedRef.current) return;

    setSubmitting(false);

    if (!res.success) {
      setError(formatLivenessErrorMessage(res.error ?? "Failed to confirm face liveness."));
      return;
    }

    if (!res.data.is_face_verified) {
      setError(
        res.data.face_verification_error ||
          "We could not confirm liveness. Please try again in better lighting."
      );
      return;
    }

    onVerified(res.data);
  }, [onVerified, session]);

  return (
    <Card className="w-full max-w-3xl mx-auto p-4 sm:p-5 bg-background shadow-2xl">
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ScanFace className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">AWS Face Liveness Check</h2>
          <p className="text-sm text-muted-foreground">
            Keep your face centered, follow the on-screen movement prompts, and stay in good lighting.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="min-h-[420px] overflow-hidden rounded-2xl border bg-black/5">
          <ThemeProvider>
            {loadingSession || !session || !credentialProvider ? (
              <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-center">
                <Loader />
                <p className="text-sm text-muted-foreground">
                  Preparing your secure liveness session...
                </p>
              </div>
            ) : (
              <div className="relative">
                {submitting && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                    <Loader />
                    <p className="text-sm text-muted-foreground">
                      Confirming your liveness result...
                    </p>
                  </div>
                )}

                <FaceLivenessDetectorCore
                  key={detectorKey}
                  sessionId={session.session_id}
                  region={session.region}
                  onAnalysisComplete={handleAnalysisComplete}
                  onError={(livenessError) => {
                    // Clear session first so the detector unmounts and releases
                    // its ReadableStream before the user can restart.
                    setSession(null);
                    setLoadingSession(false);
                    const raw = livenessError as unknown as Record<string, unknown>;
                    const detail =
                      (raw?.error as Error)?.message ||
                      (raw?.message as string) ||
                      livenessError?.state ||
                      String(livenessError);
                    setError(formatLivenessErrorMessage(detail));
                  }}
                  config={{ credentialProvider }}
                />
              </div>
            )}
          </ThemeProvider>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={createSession}
            disabled={loadingSession || submitting}
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart Check
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
