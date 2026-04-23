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
    <div className="w-full bg-background rounded-lg p-3">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ScanFace className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Face Liveness Check</p>
            <p className="text-xs text-muted-foreground leading-tight">
              Center your face, follow prompts, ensure good lighting.
            </p>
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={submitting}
              className="ml-auto shrink-0 h-7 px-2 text-xs"
            >
              Cancel
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-hidden rounded-xl border bg-black/5">
          <ThemeProvider>
            {loadingSession || !session || !credentialProvider ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2">
                <Loader />
                <p className="text-xs text-muted-foreground">Preparing session...</p>
              </div>
            ) : (
              <div className="relative">
                {submitting && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                    <Loader />
                    <p className="text-xs text-muted-foreground">Confirming result...</p>
                  </div>
                )}
                <FaceLivenessDetectorCore
                  key={detectorKey}
                  sessionId={session.session_id}
                  region={session.region}
                  onAnalysisComplete={handleAnalysisComplete}
                  onError={(livenessError) => {
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={createSession}
          disabled={loadingSession || submitting}
          className="w-full h-8 text-xs"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Restart Check
        </Button>
      </div>
    </div>
  );
}
