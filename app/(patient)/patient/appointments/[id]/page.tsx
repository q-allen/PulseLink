"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, startOfToday, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isBefore, addMonths, subMonths } from "date-fns";
import {
  Video, Clock, Calendar, User, ArrowLeft,
  AlertCircle, CheckCircle2, Bell, Star, MessageSquare,
  CreditCard, BadgeCheck, RefreshCw, ShoppingBag, Pill, XCircle, FileText,
  Stethoscope, MapPin, Activity, CalendarClock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store";
import { cn } from "@/lib/utils";
import { appointmentService } from "@/services/appointmentService";
import { notificationService } from "@/services/notificationService";
import { pharmacyService } from "@/services/pharmacyService";
import { usePharmacyStore } from "@/store/pharmacyStore";
import { Appointment, Review } from "@/types";
import JitsiMeeting from "@/components/JitsiMeeting";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { api, API_ENDPOINTS, getBaseUrl } from "@/services/api";
import { mapAppointmentStatus } from "@/services/mappers";

import { RequestCertificateDialog } from "@/components/patient/RequestCertificateDialog";

// ── Star picker component ─────────────────────────────────────────────────────
// NowServing-style: clickable stars, hover preview, required before submit.
function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
  const active = hovered || value;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="p-1 transition-transform hover:scale-110 focus:outline-none"
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= active
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
      {active > 0 && (
        <p className="text-sm font-medium text-yellow-600">{labels[active]}</p>
      )}
    </div>
  );
}

// ── Rate & Review card ────────────────────────────────────────────────────────
// Shown only when: status === "completed" AND no review yet.
// NowServing pattern: gentle prompt, not forced. Star required, comment optional.
function RateReviewCard({
  appointment,
  onSubmitted,
}: {
  appointment: Appointment;
  onSubmitted: (review: Review) => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Please select a star rating.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await appointmentService.createReview(
        appointment.id,
        rating,
        comment,
      );
      if (res.success) {
        toast({
          title: "Thank you for your review! ⭐",
          description: "Your feedback helps other patients find great doctors.",
        });
        onSubmitted(res.data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Could not submit review",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <Star className="h-5 w-5 fill-primary text-primary" />
              Rate Your Consultation
            </CardTitle>
            {/* Gentle dismiss — NowServing never forces a review */}
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              Maybe later
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            How was your consultation with{" "}
            <span className="font-medium text-foreground">
              {appointment.doctor?.name ?? "your doctor"}
            </span>
            ? Your review helps build trust for other patients.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Star picker */}
          <StarPicker value={rating} onChange={setRating} />

          {/* Optional comment */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Comment <span className="font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Share your experience — what went well, what could improve…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none text-sm"
            />
            <p className="text-right text-xs text-muted-foreground">
              {comment.length}/500
            </p>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
          >
            {submitting ? (
              <>Submitting…</>
            ) : (
              <>
                <Star className="h-4 w-4" />
                Submit Review
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Submitted review display ──────────────────────────────────────────────────
function SubmittedReviewCard({ review }: { review: Review }) {
  return (
    <Card className="border-success/30 bg-success/5">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <p className="text-sm font-medium text-success">Review submitted</p>
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`h-4 w-4 ${
                s <= review.rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        {review.comment && (
          <p className="text-sm text-muted-foreground">{review.comment}</p>
        )}
        {/* Doctor reply (NowServing pattern: public reply visible to patient) */}
        {review.doctorReply && (
          <div className="mt-2 pl-3 border-l-2 border-primary/40 space-y-0.5">
            <p className="text-xs font-medium text-primary flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Doctor&apos;s reply
            </p>
            <p className="text-sm text-muted-foreground">{review.doctorReply}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Reschedule Dialog ────────────────────────────────────────────────────────
// Patient picks a new date + time slot. No re-entry of details or payment.
const DAY_NAME_TO_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function RescheduleDialog({
  appointment,
  open,
  onClose,
  onRescheduled,
}: {
  appointment: Appointment;
  open: boolean;
  onClose: () => void;
  onRescheduled: (updated: Appointment) => void;
}) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<{ time: string; is_available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(startOfToday()));

  const doctor = appointment.doctor as (Appointment["doctor"] & { weeklySchedule?: Record<string, { start: string; end: string }> }) | undefined;
  const schedule = doctor?.weeklySchedule ?? {};
  const activeDayNums = new Set(
    Object.keys(schedule).map((d) => DAY_NAME_TO_NUM[d.toLowerCase()]).filter((n) => n !== undefined)
  );
  const today = startOfToday();
  const maxDate = addDays(today, 60);
  const isBookable = (date: Date) =>
    !isBefore(date, today) && !isBefore(maxDate, date) &&
    (activeDayNums.size === 0 || activeDayNums.has(date.getDay()));

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 }),
  });

  useEffect(() => {
    if (!selectedDate || !appointment.doctorId) return;
    setLoadingSlots(true);
    setSelectedTime("");
    appointmentService.getAvailableSlots(appointment.doctorId, selectedDate)
      .then((res) => {
        if (res.success) {
          const [y, mo, d] = selectedDate.split("-").map(Number);
          const now = new Date();
          const filtered = isToday(new Date(y, mo - 1, d))
            ? res.data.filter((s) => {
                const [h, m] = s.startTime.split(":").map(Number);
                return new Date(y, mo - 1, d, h, m) > now;
              })
            : res.data;
          setSlots(filtered.map((s) => ({ time: s.startTime, is_available: s.isAvailable })));
        }
      })
      .catch(() => toast({ title: "Failed to load slots", variant: "destructive" }))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, appointment.doctorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const res = await appointmentService.rescheduleAppointment(appointment.id, selectedDate, selectedTime);
      if (res.success) {
        toast({ title: "Appointment rescheduled ✅", description: `New schedule: ${format(new Date(selectedDate + "T00:00:00"), "MMM d, yyyy")} at ${selectedTime}` });
        onRescheduled(res.data);
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reschedule";
      if (msg.includes("message your doctor")) {
        toast({ title: "Cannot reschedule directly", description: "Please message your doctor to request rescheduling.", variant: "destructive" });
      } else {
        toast({ title: "Reschedule failed", description: msg, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Reschedule Appointment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Calendar */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select new date</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                disabled={isBefore(endOfMonth(subMonths(calendarMonth, 1)), today)}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="text-sm">‹</span>
              </button>
              <span className="text-sm font-semibold">{format(calendarMonth, "MMMM yyyy")}</span>
              <button
                onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                disabled={isBefore(maxDate, startOfMonth(addMonths(calendarMonth, 1)))}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="text-sm">›</span>
              </button>
            </div>
            <div className="grid grid-cols-7">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {calendarDays.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const inMonth = isSameMonth(date, calendarMonth);
                const bookable = isBookable(date);
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => bookable && setSelectedDate(dateStr)}
                    disabled={!bookable}
                    className={cn(
                      "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all",
                      !inMonth && "opacity-0 pointer-events-none",
                      inMonth && !bookable && "text-muted-foreground/40 cursor-not-allowed",
                      inMonth && bookable && !isSelected && "hover:bg-primary/10 text-foreground",
                      isSelected && "bg-primary text-primary-foreground font-bold",
                      isToday(date) && !isSelected && "ring-2 ring-primary/50 font-semibold",
                    )}
                  >
                    {format(date, "d")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Select time — {format(new Date(selectedDate + "T00:00:00"), "EEE, MMM d")}
              </p>
              {loadingSlots ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available slots for this date.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <Button
                      key={s.time}
                      variant={selectedTime === s.time ? "default" : "outline"}
                      size="sm"
                      disabled={!s.is_available}
                      onClick={() => s.is_available && setSelectedTime(s.time)}
                      className={cn(
                        "h-9 text-xs",
                        selectedTime === s.time && "gradient-primary border-0",
                        !s.is_available && "opacity-40 cursor-not-allowed line-through",
                      )}
                    >
                      {s.time.slice(0, 5)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selectedDate || !selectedTime || submitting}>
            {submitting ? "Rescheduling…" : "Confirm Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PatientAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [videoData, setVideoData] = useState<{
    roomName: string; password: string; jitsiDomain: string;
  } | null>(null);
  const [doctorStarted, setDoctorStarted] = useState(false);
  const [submittedReview, setSubmittedReview] = useState<Review | null>(null);
  const [prescriptionPdfUrl, setPrescriptionPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [followUpInvite, setFollowUpInvite] = useState<{ id: string; followUpDate?: string } | null>(null);
  // NowServing handoff: tracks ordering state for "Order These Medicines" button
  const [orderingRx, setOrderingRx] = useState(false);
  const { prefillFromPrescription } = usePharmacyStore();
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  // Reschedule dialog state
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  // Request certificate dialog state
  const [showCertDialog, setShowCertDialog] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  const parseRoomInfo = (url?: string) => {
    if (!url) return { roomName: "", domain: "" };
    const clean = url.split("#")[0];
    try {
      const parsed = new URL(clean);
      return { roomName: parsed.pathname.replace(/^\/+/, ""), domain: parsed.host };
    } catch {
      const parts = clean.split("/");
      return { roomName: parts[parts.length - 1] ?? "", domain: "" };
    }
  };

  // ── Load appointment ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    appointmentService.getAppointmentById(id).then((res) => {
      if (res.success) {
        setAppointment(res.data);
        // Pre-populate submitted review if it already exists on the appointment
        if (res.data.review) setSubmittedReview(res.data.review);
        if (res.data.status === "in_progress" && res.data.videoRoomUrl) {
          const info = parseRoomInfo(res.data.videoRoomUrl);
          setVideoData({
            roomName:    info.roomName,
            password:    res.data.videoPassword ?? "",
            jitsiDomain: info.domain || (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si"),
          });
          setDoctorStarted(true);
        }
        const rxDoc = res.data.sharedDocuments?.find((d) => d.docType === "prescription");
        if (rxDoc) {
          void loadPrescriptionPdf(rxDoc.documentId);
        }
      }
      setLoading(false);
    });
  }, [id]);

  // ── Scroll to review section when arriving from a notification ────────────
  useEffect(() => {
    if (!appointment || !reviewRef.current) return;
    if (searchParams.get("review") === "1") {
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, [appointment, searchParams]);

  // ── Fetch follow-up invitation (from notifications) ──────────────────────
  useEffect(() => {
    if (!appointment) return;
    notificationService.getNotifications("")
      .then((res) => {
        if (!res.success || !res.data) return;
        const match = res.data.find((n) => {
          const data = n.data as Record<string, unknown> | undefined;
          const inviteId = data?.invitation_id ?? data?.invitationId;
          const aptId = data?.appointment_id ?? data?.appointmentId;
          return inviteId && String(aptId) === String(appointment.id);
        });
        if (match) {
          const data = match.data as Record<string, unknown> | undefined;
          setFollowUpInvite({
            id: String(data?.invitation_id ?? data?.invitationId),
            followUpDate: String(data?.follow_up_date ?? data?.followUpDate ?? ""),
          });
        }
      })
      .catch(() => {
        // best effort only
      });
  }, [appointment]);

  const loadPrescriptionPdf = async (prescriptionId: number | string) => {
    setLoadingPdf(true);
    try {
      // Fetch PDF bytes through our backend proxy — avoids Cloudinary embedding restrictions
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/records/prescriptions/${prescriptionId}/pdf/`, {
        credentials: "include",
      });
      if (res.ok) {
        const blob = await res.blob();
        setPrescriptionPdfUrl(URL.createObjectURL(blob));
        return;
      }
      // Fallback: get the pdf_url from the detail endpoint and clean double-nested Cloudinary URLs
      const data = await api.get<{ pdf_url?: string; pdfUrl?: string; file_url?: string }>(
        API_ENDPOINTS.PRESCRIPTION_DETAIL(prescriptionId)
      );
      const raw = data?.pdf_url ?? data?.pdfUrl ?? data?.file_url ?? null;
      if (raw) {
        const lastHttpIdx = raw.lastIndexOf("https://");
        setPrescriptionPdfUrl(lastHttpIdx > 0 ? raw.slice(lastHttpIdx) : raw);
      }
    } catch {
      // best effort
    } finally {
      setLoadingPdf(false);
    }
  };

  // ── WebSocket: real-time events ─────────────────────────────────────────────
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

        if (payload.type === "video.started") {
          setVideoData({
            roomName:    payload.room_name,
            password:    payload.password,
            jitsiDomain: payload.jitsi_domain,
          });
          setDoctorStarted(true);
          setAppointment((prev) => prev ? { ...prev, status: "in_progress" } : prev);
          toast({
            title: "Your doctor has started the consultation! 🎥",
            description: "Click 'Join Consultation' to connect.",
          });
        }

        if (payload.type === "status.changed") {
          setAppointment((prev) => prev ? {
            ...prev,
            status: mapAppointmentStatus(payload.status),
            ...(payload.payment_status && { paymentStatus: payload.payment_status }),
          } : prev);
          if (payload.status === "completed") {
            setInCall(false);
            toast({
              title: "Consultation completed ✅",
              description: "How was your experience? Leave a review below.",
            });
          }
          if (payload.status === "cancelled" && payload.refund_issued) {
            toast({
              title: "Appointment cancelled & refunded",
              description: "Your refund has been processed. GCash/Maya: typically instant. Cards: 3–7 business days.",
            });
          }
          if (payload.status === "cancelled" && payload.needs_manual_refund) {
            toast({
              title: "Appointment cancelled — Refund pending",
              description: "Your payment could not be automatically refunded. Your doctor has been notified and will process it manually.",
              variant: "destructive",
            });
          }
        }

        if (payload.type === "queue.update") {
          setAppointment((prev) => prev ? {
            ...prev,
            queuePosition: payload.queue_position ?? prev.queuePosition,
            estimatedWaitMinutes: payload.estimated_wait_minutes ?? prev.estimatedWaitMinutes,
          } : prev);
        }

        if (payload.type === "document.shared") {
          setAppointment((prev) => {
            if (!prev) return prev;
            const existing = prev.sharedDocuments ?? [];
            const newDoc = {
              id: payload.document_id,
              docType: payload.doc_type,
              documentId: payload.document_id,
              title: payload.title,
              summary: payload.summary,
              createdAt: payload.created_at,
              createdBy: payload.created_by_name,
            };
            return { ...prev, sharedDocuments: [newDoc, ...existing] };
          });
          if (payload.doc_type === "prescription" && payload.pdf_url) {
            const raw: string = payload.pdf_url;
            const lastHttpIdx = raw.lastIndexOf("https://");
            setPrescriptionPdfUrl(lastHttpIdx > 0 ? raw.slice(lastHttpIdx) : raw);
          }
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-4 px-1">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-56" />
            </div>
          </div>
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <AlertCircle className="h-10 w-10" />
          <p>Appointment not found.</p>
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const isOnline = appointment.type === "online" || appointment.type === "on_demand";
  const isInProgress = appointment.status === "in_progress";
  const isCompleted = appointment.status === "completed";
  const isPending = appointment.status === "pending";
  const isConfirmed = appointment.status === "confirmed";
  const isCancelled = appointment.status === "cancelled";
  const canJoin = isOnline && isInProgress && videoData && !inCall;
  const canCancel = isPending && !isCancelled;
  const canReschedule = isPending && !isCancelled && isOnline;

  const showReviewForm = isCompleted && !submittedReview && !appointment.review;

  // NowServing pattern: show "Order These Medicines" when appointment is completed
  // and the doctor issued at least one prescription (sharedDocuments contains a prescription).
  const prescriptionDoc = appointment.sharedDocuments?.find((d) => d.docType === "prescription");
  const showOrderButton = isCompleted && !!prescriptionDoc;

  const followUpDateLabel = followUpInvite?.followUpDate
    ? format(new Date(followUpInvite.followUpDate), "MMMM d, yyyy")
    : "Suggested date";

  /**
   * NowServing pattern: patient cancels pending appointment with clear confirmation.
   * Shows refund timeline. Confirmed appointments require messaging doctor.
   */
  const handleCancelAppointment = async () => {
    if (!appointment) return;
    setIsCancelling(true);
    try {
      const res = await appointmentService.cancelAppointment(appointment.id, cancelReason);
      if (res.success) {
        const cancelData = res.data as Appointment & { refund_issued?: boolean; refund_note?: string; action_required?: string };
        const refundIssued = cancelData.refund_issued ?? false;
        const refundNote = cancelData.refund_note ?? "";
        const actionRequired = cancelData.action_required ?? "";

        if (actionRequired === "message_doctor") {
          toast({
            title: "Cannot cancel directly",
            description: "This appointment is confirmed. Please message your doctor to request cancellation.",
            variant: "destructive",
          });
          setCancelDialogOpen(false);
          return;
        }

        setAppointment(res.data);
        setCancelDialogOpen(false);
        setCancelReason("");
        toast({
          title: refundIssued ? "Appointment cancelled & refunded" : "Appointment cancelled",
          description: refundNote,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel appointment";
      if (msg.includes("confirmed") || msg.includes("message your doctor")) {
        toast({
          title: "Cannot cancel directly",
          description: "This appointment is confirmed. Please message your doctor to request cancellation.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * One-tap handoff: calls createOrderFromPrescription, pre-fills the
   * pharmacy store cart, then redirects to /patient/pharmacy.
   * NowServing alignment: patient never has to manually re-enter medicines.
   */
  const handleOrderMedicines = async () => {
    if (!prescriptionDoc) return;
    setOrderingRx(true);
    try {
      // Use patient's first saved address or a placeholder
      const deliveryAddress = "Please update delivery address in pharmacy";
      const res = await pharmacyService.createOrderFromPrescription(
        prescriptionDoc.documentId,
        deliveryAddress,
        "cod",
      );
      if (res.success) {
        // Pre-fill the store so pharmacy page shows the items immediately
        prefillFromPrescription(res.data.items, prescriptionDoc.documentId);
        toast({
          title: "Cart pre-filled! 💊",
          description: `${res.data.items.filter((i) => !i.not_in_catalogue).length} medicine(s) added. Update your delivery address to complete the order.`,
        });
        if (res.data.unmatched_items?.length) {
          toast({
            title: "Some medicines not available",
            description: `Not in catalogue: ${res.data.unmatched_items.join(", ")}`,
            variant: "destructive",
          });
        }
        router.push("/patient/pharmacy");
      }
    } catch (err) {
      toast({
        title: "Could not create order",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setOrderingRx(false);
    }
  };

  const statusMeta = {
    in_progress: { label: "In Progress", cls: "bg-primary text-primary-foreground", dot: "bg-primary" },
    completed:   { label: "Completed",   cls: "bg-emerald-500 text-white",           dot: "bg-emerald-500" },
    cancelled:   { label: "Cancelled",   cls: "bg-destructive text-destructive-foreground", dot: "bg-destructive" },
    confirmed:   { label: "Confirmed",   cls: "bg-blue-500 text-white",              dot: "bg-blue-500" },
    pending:     { label: "Pending",     cls: "bg-amber-500 text-white",             dot: "bg-amber-500" },
  } as const;
  const sm = statusMeta[appointment.status as keyof typeof statusMeta] ?? { label: appointment.status, cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* ── Sticky page header ── */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-4 bg-background/95 backdrop-blur-md border-b border-border/60 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0 h-10 w-10 rounded-full hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight font-bold tracking-tight truncate leading-tight">Appointment Details</h1>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                <span className="font-medium text-foreground/80">{appointment.doctor?.name}</span>
                {appointment.date && (
                  <> · <span>{format(new Date(appointment.date), "MMM d, yyyy")}</span></>
                )}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shrink-0 ${sm.cls}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              {sm.label}
            </span>
          </div>
        </div>

        {/* Doctor started banner */}
        <AnimatePresence>
          {doctorStarted && !inCall && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/40 shadow-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">Doctor is ready!</p>
                <p className="text-xs text-primary/70">Your consultation has started. Join now to connect.</p>
              </div>
              <Button size="sm" className="gap-2 shrink-0 rounded-full" onClick={() => setInCall(true)}>
                <Video className="h-4 w-4" />
                Join Now
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancel Button — only for pending appointments */}
        {canCancel && (
          <Card className="border-destructive/25 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <XCircle className="h-4.5 w-4.5 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Need to cancel?</p>
                  <p className="text-xs text-muted-foreground">Full refund will be issued automatically.</p>
                </div>
                <Button variant="destructive" size="sm" className="rounded-full" onClick={() => setCancelDialogOpen(true)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reschedule Button — only for pending online appointments */}
        {canReschedule && (
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarClock className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Need to reschedule?</p>
                  <p className="text-xs text-muted-foreground">Pick a new date and time — no re-entry needed.</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full border-primary/40 text-primary hover:bg-primary/10" onClick={() => setRescheduleOpen(true)}>
                  Reschedule
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmed — cannot cancel directly */}
        {isConfirmed && !isCancelled && (
          <Card className="border-amber-300/60 bg-gradient-to-r from-amber-50/80 to-orange-50/40 dark:from-amber-900/15 dark:to-orange-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4.5 w-4.5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Need to cancel?</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Message your doctor to request cancellation &amp; refund.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
                  onClick={() => router.push(`/patient/messages?doctor=${appointment.doctorId}`)}
                >
                  Message
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancelled status */}
        {isCancelled && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <XCircle className="h-4.5 w-4.5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-destructive">Appointment Cancelled</p>
                  {(appointment as Appointment & { cancel_reason?: string }).cancel_reason && (
                    <p className="text-xs text-muted-foreground">Reason: {(appointment as Appointment & { cancel_reason?: string }).cancel_reason}</p>
                  )}
                </div>
              </div>
              {appointment.paymentStatus === "refunded" && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Refund Processed</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">GCash/Maya: typically instant · Cards: 3–7 business days</p>
                  </div>
                </div>
              )}
              {isCancelled && appointment.paymentStatus === "paid" && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Refund Pending</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Your payment could not be automatically refunded. Your doctor has been notified and will process it manually. Please contact your doctor if you don&apos;t receive your refund within 3–5 business days.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Doctor Info Card ── */}
        <Card className="overflow-hidden border-border/60 shadow-sm">
          {/* Hero gradient strip */}
          <div className="h-24 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
          </div>
          <CardContent className="px-5 pb-5 -mt-10 space-y-4">
            {/* Doctor avatar + name row */}
            <div className="flex items-end gap-4">
              <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg shrink-0">
                <AvatarImage src={appointment.doctor?.avatar} />
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                  {appointment.doctor?.name?.[0] ?? "D"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 pb-1">
                <p className="font-bold text-xl leading-tight truncate">{appointment.doctor?.name ?? "Doctor"}</p>
                <p className="text-sm text-primary font-medium flex items-center gap-1 mt-0.5">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {appointment.doctor?.specialty ?? "Specialist"}
                </p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 mb-1 text-[11px] gap-1 rounded-full border-primary/30 text-primary bg-primary/5"
              >
                {appointment.type === "online" ? <><Video className="h-3 w-3" /> Video</> :
                 appointment.type === "on_demand" ? <>⚡ On-Demand</> :
                 <><MapPin className="h-3 w-3" /> In-Clinic</>}
              </Badge>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/60" />

            {/* Date / time / symptoms grid */}
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Date</p>
                  <p className="text-foreground font-medium text-xs">{appointment.date && format(new Date(appointment.date), "EEE, MMM d, yyyy")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Time</p>
                  <p className="text-foreground font-medium text-xs">{appointment.time}</p>
                </div>
              </div>
              {appointment.symptoms && (
                <div className="sm:col-span-2 flex items-start gap-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Reason / Symptoms</p>
                    <p className="text-foreground text-xs mt-0.5">{appointment.symptoms}</p>
                  </div>
                </div>
              )}
            </div>

            {appointment.queuePosition && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  #{appointment.queuePosition} in queue
                </span>
                {appointment.estimatedWaitMinutes && (
                  <span className="text-xs text-muted-foreground">· Est. {appointment.estimatedWaitMinutes} min wait</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-up Invitation (NowServing pattern) */}
        {followUpInvite && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Follow-up Consultation Invitation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {appointment.doctor?.name ?? "Your doctor"} suggested a follow-up on{" "}
                    <span className="font-semibold text-foreground">{followUpDateLabel}</span>.
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Invitation</Badge>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => router.push(`/patient/invitations/${followUpInvite.id}`)}
              >
                Proceed to Booking
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Status Card — NowServing alignment: patient always sees clear payment context */}
        {(appointment.type === "online" || appointment.type === "on_demand") && (() => {
          const note = (appointment as Appointment & { paymentDisplayNote?: { patient: string; badge: string; color: string } }).paymentDisplayNote;
          const statusColors: Record<string, string> = {
            paid:     "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
            refunded: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
            awaiting: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
            pending:  "bg-muted border-border",
          };
          const iconColors: Record<string, string> = {
            paid:     "text-green-600",
            refunded: "text-yellow-600",
            awaiting: "text-yellow-600",
            pending:  "text-muted-foreground",
          };
          const badge = note?.badge ?? appointment.paymentStatus ?? "pending";
          const colorClass = statusColors[badge] ?? statusColors.pending;
          const iconClass  = iconColors[badge]  ?? iconColors.pending;
          const Icon = badge === "paid" ? BadgeCheck : badge === "refunded" ? RefreshCw : CreditCard;
          return (
            <Card className={`border ${colorClass}`}>
              <CardContent className="flex items-start gap-3 p-4">
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconClass}`} />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    {badge === "paid"     ? "Payment Confirmed" :
                     badge === "refunded" ? "Payment Refunded"  :
                     badge === "awaiting" ? "Payment Pending"   : "Payment Status"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {note?.patient ?? `Payment status: ${appointment.paymentStatus}`}
                  </p>
                  {badge === "paid" && (
                    <p className="text-xs text-muted-foreground">
                      A receipt has been sent to your email. Reference:{' '}
                      <span className="font-mono font-semibold text-primary">
                        APT-{appointment.id.slice(-8).toUpperCase()}
                      </span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Video Section */}
        {isOnline && (
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                  <Video className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Video Consultation</p>
                  <p className="text-xs font-normal text-muted-foreground">Secure end-to-end encrypted call</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {inCall && videoData && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <JitsiMeeting
                    roomName={videoData.roomName}
                    password={videoData.password}
                    domain={videoData.jitsiDomain}
                    displayName={user?.name ?? "Patient"}
                    className="w-full"
                    onLeave={() => setInCall(false)}
                  />
                </motion.div>
              )}

              {canJoin && (
                <Button
                  className="w-full gap-2 gradient-primary border-0 h-12 text-base"
                  onClick={() => setInCall(true)}
                >
                  <Video className="h-5 w-5" />
                  Join Consultation
                </Button>
              )}

              {isOnline && !isInProgress && appointment.status === "confirmed" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/60 text-sm">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Waiting for doctor</p>
                    <p className="text-xs text-muted-foreground">You&apos;ll be notified automatically when the session starts.</p>
                  </div>
                </div>
              )}

              {isCompleted && (
                <div className="flex items-center gap-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="text-green-700 dark:text-green-300 font-medium">Consultation completed</span>
                  {appointment.videoStartedAt && appointment.videoEndedAt && (
                    <span className="text-green-600/70 dark:text-green-400/70 ml-auto">
                      {Math.round(
                        (new Date(appointment.videoEndedAt).getTime() -
                          new Date(appointment.videoStartedAt).getTime()) / 60000
                      )} min
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Medicines CTA */}
        <AnimatePresence>
          {showOrderButton && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="border-teal-300 overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-teal-400 to-emerald-400" />
                <CardContent className="p-5 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-11 w-11 rounded-xl bg-teal-100 dark:bg-teal-800 flex items-center justify-center shrink-0 shadow-sm">
                        <Pill className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                      </div>
                      <div>
                        <p className="font-semibold text-teal-900 dark:text-teal-100">Prescription issued</p>
                        <p className="text-sm text-teal-700 dark:text-teal-300">
                          Order medicines — cart pre-filled automatically.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shrink-0 w-full sm:w-auto shadow-sm"
                      onClick={handleOrderMedicines}
                      disabled={orderingRx}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {orderingRx ? "Preparing cart…" : "Order These Medicines"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Request Certificate CTA */}
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="border-blue-300 overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-blue-400 to-indigo-400" />
                <CardContent className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-800 flex items-center justify-center shrink-0 shadow-sm">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Need a medical certificate?</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Request for sick leave, fitness to work, or school excuse.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0 w-full sm:w-auto shadow-sm"
                      onClick={() => setShowCertDialog(true)}
                    >
                      <FileText className="h-4 w-4" />
                      Request Certificate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── E-Prescription ── */}
        {(prescriptionDoc || prescriptionPdfUrl || loadingPdf) && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span>E-Prescription</span>
                {prescriptionDoc && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">Issued by doctor</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {loadingPdf && (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading prescription…</span>
                </div>
              )}
              {!loadingPdf && !prescriptionPdfUrl && prescriptionDoc && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Prescription available</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PDF preview could not load. Use the button below to open it.</p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open(`${getBaseUrl()}/api/records/prescriptions/${prescriptionDoc.documentId}/pdf/`, "_blank")}
                  >
                    <FileText className="h-4 w-4" />
                    Open Prescription
                  </Button>
                </div>
              )}
              {prescriptionPdfUrl && (
                <>
                  <div className="rounded-xl border border-border overflow-hidden bg-muted/30 h-[560px]">
                    <iframe
                      src={`${prescriptionPdfUrl}#toolbar=1&navpanes=0`}
                      className="w-full h-full"
                      title="Prescription PDF"
                      onError={() => setPrescriptionPdfUrl(null)}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 flex-1 sm:flex-none"
                      onClick={() => window.open(prescriptionPdfUrl, "_blank")}
                    >
                      <FileText className="h-4 w-4" />
                      Open in New Tab
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 flex-1 sm:flex-none"
                      asChild
                    >
                      <a href={prescriptionPdfUrl} download="prescription.pdf">
                        ⬇ Download PDF
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Rate & Review section (NowServing pattern) ──────────────────────
            Shown after completion. Gentle prompt — not forced.
            Swaps to a thank-you card after submission.
        ─────────────────────────────────────────────────────────────────────── */}
        <div ref={reviewRef}>
          <AnimatePresence mode="wait">
            {showReviewForm && (
              <RateReviewCard
                key="review-form"
                appointment={appointment}
                onSubmitted={(review) => setSubmittedReview(review)}
              />
            )}
            {(submittedReview || appointment.review) && (
              <SubmittedReviewCard
                key="review-submitted"
                review={(submittedReview ?? appointment.review)!}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Consult Summary */}
        {(appointment.consultSummary || appointment.consultTranscript) && (
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-gradient-to-r from-violet-50/60 to-transparent dark:from-violet-950/20">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shadow-sm">
                  <FileText className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold">Consultation Summary</p>
                  <p className="text-xs font-normal text-muted-foreground">Notes from your session</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {appointment.consultSummary && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Summary</p>
                  <p className="text-foreground whitespace-pre-line">{appointment.consultSummary}</p>
                </div>
              )}
              {appointment.consultTranscript && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Transcript</p>
                  <p className="text-foreground whitespace-pre-line">{appointment.consultTranscript}</p>
                </div>
              )}
              {appointment.sharedDocuments && appointment.sharedDocuments.length > 0 && (
                <div>
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
        )}

        {/* Reschedule Dialog */}
        {canReschedule && (
          <RescheduleDialog
            appointment={appointment}
            open={rescheduleOpen}
            onClose={() => setRescheduleOpen(false)}
            onRescheduled={(updated) => setAppointment(updated)}
          />
        )}

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Are you sure you want to cancel your appointment with{" "}
                  <span className="font-semibold text-foreground">{appointment.doctor?.name}</span> on{" "}
                  <span className="font-semibold text-foreground">
                    {appointment.date && format(new Date(appointment.date), "MMMM d, yyyy")}
                  </span>?
                </p>
                {appointment.paymentStatus === "paid" && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">Full Refund</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Your payment will be refunded to your original payment method.
                    </p>
                    <ul className="text-xs text-green-600 dark:text-green-400 mt-2 space-y-0.5 list-disc list-inside">
                      <li>GCash / Maya: Typically instant</li>
                      <li>Credit / Debit card: 3–7 business days</li>
                    </ul>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Reason (optional)</label>
                  <Textarea
                    placeholder="Let us know why you're cancelling..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="h-20 resize-none text-sm"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>Go Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleCancelAppointment();
                }}
                disabled={isCancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel Appointment"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Request Certificate Dialog */}
        {appointment.doctor && (
          <RequestCertificateDialog
            open={showCertDialog}
            onClose={() => setShowCertDialog(false)}
            doctorId={appointment.doctorId}
            appointmentId={appointment.id}
            doctorName={appointment.doctor.name ?? "Doctor"}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
