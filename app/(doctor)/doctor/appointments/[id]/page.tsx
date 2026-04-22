"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Video, PhoneOff, ArrowLeft, Loader2, AlertCircle, XCircle, RefreshCw,
  Radio, FileText, BadgeCheck, CreditCard, User, Mail, Phone, Calendar,
  Clock, MessageCircle, Stethoscope, FileDown, CheckCircle2, FlaskConical,
  ExternalLink, Copy, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store";
import { appointmentService } from "@/services/appointmentService";
import { Appointment, Prescription, LabResult, MedicalCertificate } from "@/types";
import { getBaseUrl } from "@/services/api";
import { chatService } from "@/services/chatService";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import LabRequestForm from "@/components/records/LabRequestForm";

/**
 * Enhanced Doctor Appointment Detail Page
 * 
 * UX Improvements:
 * - Prominent patient information card at the top (avatar, name, age, sex, contact)\n * - Clear reason for consultation display\n * - Visual status timeline\n * - Payment status with clear badges\n * - Video consultation controls with live indicators\n * - Document sharing section\n * - Consultation notes editor\n * - Quick action buttons (Message, Mark No-Show, Refund)\n */
function getJitsiUrl(videoRoomUrl: string, displayName: string): string {
  const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";
  const roomName = videoRoomUrl.split("#")[0].split("/").pop() ?? videoRoomUrl;
  const encodedName = encodeURIComponent(displayName);
  return (
    `https://${domain}/${roomName}` +
    `#userInfo.displayName="${encodedName}"` +
    `&config.prejoinPageEnabled=false` +
    `&config.startWithAudioMuted=false` +
    `&config.startWithVideoMuted=false` +
    `&config.disableDeepLinking=true`
  );
}

export default function DoctorAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [roomLive, setRoomLive] = useState(false);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | null>(null);
  const startedAt = useRef<Date | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  // "idle" | "confirming" | "processing" | "success" | "manual_required"
  type RefundStep = "idle" | "confirming" | "processing" | "success" | "manual_required";
  const [refundStep, setRefundStep] = useState<RefundStep>("idle");
  const [refundNote, setRefundNote] = useState("");
  const [consultNotes, setConsultNotes] = useState("");
  const [consultSummary, setConsultSummary] = useState("");
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [medHistoryOpen, setMedHistoryOpen] = useState(false);
  const [medHistory, setMedHistory] = useState<{ prescriptions: Prescription[]; labResults: LabResult[]; certificates: MedicalCertificate[] } | null>(null);
  const [medHistoryLoading, setMedHistoryLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    appointmentService.getAppointmentById(id).then((res) => {
      if (res.success) {
        setAppointment(res.data);
        setConsultNotes(res.data.consultNotes ?? "");
        setConsultSummary(res.data.consultSummary ?? "");
        if (res.data.status === "in_progress" && res.data.videoRoomUrl) {
          setRoomLive(true);
          setVideoRoomUrl(res.data.videoRoomUrl);
          if (!startedAt.current) startedAt.current = new Date();
        }
      }
      setLoading(false);
    });
  }, [id]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!id) return;
    const base = getBaseUrl();
    if (!base) return;
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${url.toString().replace(/\/$/, "")}/ws/appointments/${id}/`);
    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "status.changed") {
          setAppointment((prev) => prev ? {
            ...prev,
            status: payload.status,
            ...(payload.payment_status && { paymentStatus: payload.payment_status }),
          } : prev);
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [id]);

  const handleRefundAndCancel = async () => {
    if (!appointment) return;
    setRefundStep("processing");
    setIsRefunding(true);
    try {
      const res = await appointmentService.requestRefund(appointment.id, refundReason);
      if (res.success) {
        const data = res.data as Appointment & { refund_issued?: boolean; refund_note?: string; needs_manual_refund?: boolean };
        setAppointment(res.data);
        setRefundNote(data.refund_note ?? "");
        if (data.refund_issued) {
          setRefundStep("success");
        } else if (data.needs_manual_refund) {
          setRefundStep("manual_required");
        } else {
          // No payment was made — just cancelled
          setRefundStep("success");
          setRefundNote("Appointment cancelled. No payment was on record.");
        }
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setRefundStep("confirming");
    } finally {
      setIsRefunding(false);
    }
  };

  const handleMessagePatient = async () => {
    if (!appointment || !user) return;
    setMessagingLoading(true);
    try {
      const res = await chatService.createConversation(appointment.patientId, user.id, 'doctor');
      if (res.success) {
        router.push(`/doctor/messages?conversation=${res.data.id}`);
      }
    } catch {
      toast({ title: "Error", description: "Could not open conversation.", variant: "destructive" });
    } finally {
      setMessagingLoading(false);
    }
  };

  const handleViewMedicalHistory = async () => {
    if (!appointment) return;
    setMedHistoryOpen(true);
    if (medHistory) return;
    setMedHistoryLoading(true);
    try {
      const [rxRes, labRes, certRes] = await Promise.all([
        medicalRecordsService.getPrescriptions(appointment.patientId),
        medicalRecordsService.getLabResults(appointment.patientId),
        medicalRecordsService.getCertificates(appointment.patientId),
      ]);
      setMedHistory({
        prescriptions: rxRes.success ? rxRes.data : [],
        labResults: labRes.success ? labRes.data : [],
        certificates: certRes.success ? certRes.data : [],
      });
    } catch {
      toast({ title: "Error", description: "Could not load medical history.", variant: "destructive" });
    } finally {
      setMedHistoryLoading(false);
    }
  };

  const closeRefundDialog = () => {
    setRefundOpen(false);
    setRefundStep("idle");
    setRefundReason("");
    setRefundNote("");
  };

  const handleStartVideo = async () => {
    if (!appointment) return;
    const alreadyInProgress = appointment.status === "in_progress" || appointment.status === "in-progress";
    if (alreadyInProgress && appointment.videoRoomUrl) {
      setVideoRoomUrl(appointment.videoRoomUrl);
      setRoomLive(true);
      if (!startedAt.current) startedAt.current = new Date();
      return;
    }

    setStarting(true);
    try {
      const res = await appointmentService.startVideoConsult(appointment.id);
      if (res.success) {
        setAppointment(res.data.appointment);
        setVideoRoomUrl(res.data.videoRoomUrl);
        setRoomLive(true);
        startedAt.current = new Date();
        toast({
          title: "Room created ✅",
          description: "Patient has been notified and can now join the call.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const isNotToday = msg.toLowerCase().includes("scheduled date");
      toast({
        title: isNotToday ? "Too early to start" : "Failed to start video",
        description: isNotToday
          ? `This appointment is scheduled for ${appointment.date}. You can only start the video on that day.`
          : msg,
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  const handleEndConsultation = async () => {
    if (!appointment) return;
    setEnding(true);
    try {
      const durationSec = startedAt.current
        ? Math.round((Date.now() - startedAt.current.getTime()) / 1000)
        : undefined;
      const participants = [
        user?.name ?? "Doctor",
        appointment.patient?.name ?? "Patient",
      ].filter(Boolean) as string[];
      const res = await appointmentService.endConsultation(appointment.id, {
        durationSeconds: durationSec,
        participants,
        consultNotes,
        consultSummary,
      });
      if (res.success) {
        setAppointment(res.data);
        setRoomLive(false);
        setVideoRoomUrl(null);
        toast({ title: "Consultation completed", description: "Records have been saved." });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <AlertCircle className="h-10 w-10" />
        <p>Appointment not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const isOnline = appointment.type === "online" || appointment.type === "on_demand";
  const isInProgress = appointment.status === "in_progress" || appointment.status === "in-progress";
  const isCompleted = appointment.status === "completed";
  const isCancelled = appointment.status === "cancelled";
  const today = new Date().toISOString().split("T")[0];
  const isToday = appointment.date === today;
  const canStart = isOnline && ["confirmed", "pending"].includes(appointment.status) && !roomLive && isToday;
  const isScheduledFuture = isOnline && ["confirmed", "pending"].includes(appointment.status) && !isToday;
  const canRefundCancel = appointment.status === "confirmed" && appointment.date >= today;

  // Patient info - handle booked-for-other scenario
  const patientName = appointment.bookedForRelationship !== "self" && appointment.bookedForName
    ? appointment.bookedForName
    : appointment.patient?.name ?? "Patient";
  const patientAge = appointment.bookedForRelationship !== "self" && appointment.bookedForAge
    ? appointment.bookedForAge
    : appointment.patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(appointment.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const patientGender = appointment.bookedForRelationship !== "self" && appointment.bookedForGender
    ? appointment.bookedForGender
    : appointment.patient?.gender ?? "";

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Appointment Details</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(appointment.date), "EEEE, MMMM d, yyyy")} at {appointment.time}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PATIENT INFORMATION CARD - MOST PROMINENT
          ═══════════════════════════════════════════════════════════════════ */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar + Name + Demographics */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary/20">
              <AvatarImage src={appointment.patient?.avatar} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {patientName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{patientName}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {patientAge && <span>{patientAge} years old</span>}
                  {patientGender && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{patientGender}</span>
                    </>
                  )}
                  {appointment.bookedForRelationship !== "self" && appointment.bookedForName && (
                    <>
                      <span>•</span>
                      <span>Booked by {appointment.patient?.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {appointment.bookedForRelationship}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                {appointment.patient?.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{appointment.patient.email}</span>
                  </div>
                )}
                {appointment.patient?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{appointment.patient.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Reason for Consultation - PROMINENT */}
          {appointment.symptoms && (
            <div className="rounded-lg bg-background border border-border p-4">
              <div className="flex items-start gap-3">
                <Stethoscope className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground mb-1">Reason for Consultation</p>
                  <p className="text-base text-foreground leading-relaxed">{appointment.symptoms}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleMessagePatient} disabled={messagingLoading}>
              {messagingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              Message Patient
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleViewMedicalHistory}>
              <FileDown className="h-4 w-4" />
              View Medical History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {["pending", "confirmed", "in_progress", "completed"].map((status, idx) => {
              const isCurrent = appointment.status === status || 
                (status === "in_progress" && appointment.status === "in-progress");
              const isPast = ["pending", "confirmed", "in_progress", "in-progress"].indexOf(appointment.status) > idx;
              return (
                <div key={status} className="flex items-center">
                  <div className={`flex flex-col items-center gap-2 ${idx > 0 ? "ml-4" : ""}`}>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCurrent ? "border-primary bg-primary text-primary-foreground" :
                      isPast ? "border-success bg-success text-success-foreground" :
                      "border-border bg-muted text-muted-foreground"
                    }`}>
                      {isPast || isCurrent ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                      {status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`h-0.5 w-12 mx-2 ${isPast ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment Status */}
      {(appointment.type === "online" || appointment.type === "on_demand") && (() => {
        const paymentDisplayNote = (appointment as Appointment & { paymentDisplayNote?: { doctor: string; badge: string; color: string } }).paymentDisplayNote;
        const note = paymentDisplayNote as { doctor: string; badge: string; color: string } | null | undefined;
        const badge = note?.badge ?? appointment.paymentStatus ?? "pending";
        const statusColors: Record<string, string> = {
          paid: "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800",
          refunded: "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800",
          awaiting: "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800",
          pending: "border-border bg-muted/30",
        };
        const iconColors: Record<string, string> = {
          paid: "text-green-600",
          refunded: "text-yellow-600",
          awaiting: "text-yellow-600",
          pending: "text-muted-foreground",
        };
        const Icon = badge === "paid" ? BadgeCheck : badge === "refunded" ? RefreshCw : CreditCard;
        return (
          <Card className={`border ${statusColors[badge] ?? statusColors.pending}`}>
            <CardContent className="flex items-start gap-3 p-4">
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColors[badge] ?? iconColors.pending}`} />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {badge === "paid" ? "Payment Received" :
                   badge === "refunded" ? "Payment Refunded" :
                   badge === "awaiting" ? "Awaiting Payment" : "Payment Status"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {note?.doctor ?? `Payment status: ${appointment.paymentStatus}`}
                </p>
                {badge === "paid" && (
                  <p className="text-xs text-muted-foreground">
                    Reference: <span className="font-mono font-semibold text-primary">
                      APT-{appointment.id.slice(-8).toUpperCase()}
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Video Consultation Controls */}
      {isOnline && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-5 w-5 text-primary" />
              Video Consultation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {roomLive && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3">
                  <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      Room is live — patient can join now
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Patient notified. Join the room below to start the call.
                    </p>
                  </div>
                </div>

                {videoRoomUrl && (
                  <a href={getJitsiUrl(videoRoomUrl, user?.name ?? "Doctor")} target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full gap-2 bg-primary hover:bg-primary/90 h-11">
                      <Video className="h-4 w-4" />
                      Join Video Room (opens in new tab)
                    </Button>
                  </a>
                )}

                <Button
                  variant="destructive"
                  className="w-full gap-2 h-11"
                  onClick={handleEndConsultation}
                  disabled={ending}
                >
                  {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
                  End Consultation & Mark Complete
                </Button>
              </motion.div>
            )}

            {canStart && (
              <Button
                className="w-full gap-2 bg-primary hover:bg-primary/90 h-12 text-base"
                onClick={handleStartVideo}
                disabled={starting}
              >
                {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />}
                {starting ? "Creating room…" : "Start Video Consultation"}
              </Button>
            )}

            {isScheduledFuture && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-900/20 dark:border-amber-700/40 px-4 py-3">
                <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Scheduled for {format(new Date(appointment.date), "EEEE, MMMM d")}
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                    You can only start the video room on the day of the appointment.
                  </p>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle2 className="h-5 w-5" />
                Consultation completed
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Consultation Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Consultation Notes & Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Doctor Notes</label>
            <Textarea
              value={consultNotes}
              onChange={(e) => setConsultNotes(e.target.value)}
              placeholder="Write your consult notes here..."
              disabled={appointment.status === "completed"}
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Summary (optional)</label>
            <Textarea
              value={consultSummary}
              onChange={(e) => setConsultSummary(e.target.value)}
              placeholder="Optional short summary for the patient..."
              disabled={appointment.status === "completed"}
              className="min-h-[80px]"
            />
          </div>
          {appointment.sharedDocuments && appointment.sharedDocuments.length > 0 && (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-2">Shared Documents</p>
              <div className="space-y-2">
                {appointment.sharedDocuments.map((doc) => (
                  <div key={`${doc.docType}-${doc.documentId}`} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{doc.title || doc.docType}</p>
                      {doc.summary && <p className="text-xs text-muted-foreground">{doc.summary}</p>}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {doc.docType}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lab Request */}
      {!isCancelled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-success" />
              Send Lab Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LabRequestForm
              patientId={appointment.patientId}
              appointmentId={appointment.id}
            />
          </CardContent>
        </Card>
      )}

      {/* Manual Refund Required warning — shown when cancelled but payment still "paid" */}
      {isCancelled && appointment.paymentStatus === "paid" && (
        <Card className="border-amber-400/60 bg-amber-50/60 dark:bg-amber-900/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Refund Pending — Action Required</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  The automatic refund failed (insufficient payout balance). Follow the steps below to complete the refund.
                </p>
              </div>
            </div>
            <div className="space-y-2 pl-8">
              {[
                { step: 1, text: "Go to your PayMongo Dashboard", href: "https://dashboard.paymongo.com/payments" },
                { step: 2, text: `Search for payment reference: APT-${appointment.id.slice(-8).toUpperCase()}` },
                { step: 3, text: "Click the payment → select \"Refund\"" },
                { step: 4, text: `Enter amount: ₱${appointment.fee?.toLocaleString("en-PH", { minimumFractionDigits: 2 }) ?? "0.00"}` },
              ].map(({ step, text, href }) => (
                <div key={step} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-bold flex items-center justify-center">{step}</span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-amber-700 dark:text-amber-300 underline flex items-center gap-1">
                      {text} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-300">{text}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="pl-8">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`APT-${appointment.id.slice(-8).toUpperCase()}`);
                  toast({ title: "Copied!", description: "Reference number copied to clipboard." });
                }}
                className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy reference: APT-{appointment.id.slice(-8).toUpperCase()}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refund & Cancel */}
      {canRefundCancel && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Cancel & Refund
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If the patient requested cancellation, you can approve it here.
              {appointment.paymentStatus === "paid" && " A full refund will be issued to their original payment method."}
            </p>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => { setRefundStep("confirming"); setRefundOpen(true); }}
            >
              <RefreshCw className="h-4 w-4" />
              Refund & Cancel Appointment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Medical History Sheet ─────────────────────────────────────────── */}
      <Sheet open={medHistoryOpen} onOpenChange={setMedHistoryOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Medical History — {patientName}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-2">
            {medHistoryLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : medHistory ? (
              <div className="space-y-6">
                {/* Prescriptions */}
                <div>
                  <p className="text-sm font-semibold mb-2">Prescriptions ({medHistory.prescriptions.length})</p>
                  {medHistory.prescriptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No prescriptions on record.</p>
                  ) : (
                    <div className="space-y-2">
                      {medHistory.prescriptions.map((rx) => (
                        <div key={rx.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
                          <p className="font-medium">{rx.diagnosis}</p>
                          <p className="text-xs text-muted-foreground">{new Date(rx.date).toLocaleDateString()}</p>
                          {rx.medications.map((m, i) => (
                            <p key={i} className="text-xs">{m.name} — {m.dosage}, {m.frequency}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
                {/* Lab Results */}
                <div>
                  <p className="text-sm font-semibold mb-2">Lab Results ({medHistory.labResults.length})</p>
                  {medHistory.labResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No lab results on record.</p>
                  ) : (
                    <div className="space-y-2">
                      {medHistory.labResults.map((lab) => (
                        <div key={lab.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{lab.testName}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">{lab.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{new Date(lab.date).toLocaleDateString()}</p>
                          {lab.notes && <p className="text-xs text-muted-foreground">{lab.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
                {/* Medical Certificates */}
                <div>
                  <p className="text-sm font-semibold mb-2">Medical Certificates ({medHistory.certificates.length})</p>
                  {medHistory.certificates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No certificates on record.</p>
                  ) : (
                    <div className="space-y-2">
                      {medHistory.certificates.map((cert) => (
                        <div key={cert.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
                          <p className="font-medium">{cert.purpose}</p>
                          <p className="text-xs text-muted-foreground">{cert.diagnosis} · {cert.restDays} rest day(s)</p>
                          <p className="text-xs text-muted-foreground">{new Date(cert.date).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ── Guided Refund Dialog ─────────────────────────────────────────── */}
      <Dialog open={refundOpen} onOpenChange={(open) => { if (!open) closeRefundDialog(); }}>
        <DialogContent className="max-w-md">
          <AnimatePresence mode="wait">

            {/* STEP 1: Confirm */}
            {refundStep === "confirming" && (
              <motion.div key="confirming" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-destructive" />
                    Refund & Cancel Appointment
                  </DialogTitle>
                  <DialogDescription>Review the details before proceeding.</DialogDescription>
                </DialogHeader>

                {/* Appointment summary */}
                <div className="my-4 rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Patient</span>
                    <span className="font-medium">{patientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(new Date(appointment.date), "MMM d, yyyy")} at {appointment.time}</span>
                  </div>
                  {appointment.paymentStatus === "paid" && (
                    <>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Refund Amount</span>
                        <span className="text-lg font-bold text-primary">
                          ₱{appointment.fee?.toLocaleString("en-PH", { minimumFractionDigits: 2 }) ?? "0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Refund to</span>
                        <span className="text-xs">Patient&apos;s original payment method</span>
                      </div>
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 text-xs text-blue-700 dark:text-blue-300">
                        GCash/Maya: typically instant · Cards: 3–7 business days
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea
                    placeholder="e.g. Patient requested cancellation due to schedule conflict"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="h-20 resize-none text-sm"
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={closeRefundDialog}>Go Back</Button>
                  <Button variant="destructive" onClick={handleRefundAndCancel} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Confirm Refund & Cancel
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {/* STEP 2: Processing */}
            {refundStep === "processing" && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">Processing refund…</p>
                <p className="text-xs text-muted-foreground text-center">Contacting PayMongo. Please don&apos;t close this window.</p>
              </motion.div>
            )}

            {/* STEP 3a: Success */}
            {refundStep === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 flex flex-col items-center gap-4 text-center">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Refund Processed!</p>
                  <p className="text-sm text-muted-foreground mt-1">{refundNote || "The appointment has been cancelled and the patient has been refunded."}</p>
                </div>
                <div className="w-full rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
                  GCash/Maya: typically instant · Credit/Debit cards: 3–7 business days
                </div>
                <Button className="w-full" onClick={closeRefundDialog}>Done</Button>
              </motion.div>
            )}

            {/* STEP 3b: Manual Required */}
            {refundStep === "manual_required" && (
              <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-5 w-5" />
                    Manual Refund Required
                  </DialogTitle>
                  <DialogDescription>
                    The appointment was cancelled but the automatic refund could not be processed
                    (insufficient payout balance in your PayMongo account).
                    Follow these steps to complete the refund.
                  </DialogDescription>
                </DialogHeader>

                <div className="my-4 space-y-3">
                  {/* Reference to copy */}
                  <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                    <div>
                      <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Payment Reference</p>
                      <p className="font-mono font-bold text-amber-800 dark:text-amber-200">
                        APT-{appointment.id.slice(-8).toUpperCase()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                      onClick={() => {
                        navigator.clipboard.writeText(`APT-${appointment.id.slice(-8).toUpperCase()}`);
                        toast({ title: "Copied!", description: "Reference copied to clipboard." });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>

                  {/* Step-by-step */}
                  <div className="space-y-2">
                    {[
                      { n: 1, label: "Open PayMongo Dashboard", sub: "Go to Payments section", href: "https://dashboard.paymongo.com/payments" },
                      { n: 2, label: "Find the payment", sub: `Search for reference APT-${appointment.id.slice(-8).toUpperCase()}` },
                      { n: 3, label: "Click \"Refund\"", sub: "Select full refund and confirm" },
                      { n: 4, label: "Notify the patient", sub: "Send a message once refund is done" },
                    ].map(({ n, label, sub, href }) => (
                      <div key={n} className="flex items-start gap-3">
                        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                        <div className="flex-1">
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                              {label} <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-foreground">{label}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={closeRefundDialog}>Close</Button>
                  <Button
                    className="gap-2"
                    onClick={() => window.open("https://dashboard.paymongo.com/payments", "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open PayMongo
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
