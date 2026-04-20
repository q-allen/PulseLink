"use client";

/**
 * app/(patient)/patient/teleconsult/[appointmentId]/page.tsx
 *
 * Flow (mirrors NowServing.ph):
 *
 *  1. WAITING  — doctor hasn't started yet.
 *               WebSocket listens for video.started event.
 *
 *  2. READY    — doctor started the room (video.started received OR
 *               appointment already in_progress on page load).
 *               Patient sees doctor info + "Join Video Call" button.
 *               Patient must explicitly click to enter Jitsi.
 *
 *  3. IN CALL  — patient clicked Join → Jitsi iframe is mounted.
 *               Shared-docs sidebar appears when doctor shares a document.
 *               Patient can leave manually (goes back to appointments).
 *
 *  4. ENDED    — doctor clicked "End Consultation" → consultation.ended
 *               WebSocket event → Jitsi unmounts → summary screen →
 *               redirect to /patient/appointments after 4 s.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, CheckCircle2, Clock, FileText,
  Loader2, Video, X, MessageCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge }       from "@/components/ui/badge";
import { Button }      from "@/components/ui/button";
import { Input }       from "@/components/ui/input";
import { ScrollArea }  from "@/components/ui/scroll-area";
import { useToast }    from "@/hooks/use-toast";
import { useAuthStore } from "@/store";
import { appointmentService } from "@/services/appointmentService";
import { getBaseUrl }  from "@/services/api";
import JitsiMeeting    from "@/components/video/JitsiMeeting";
import type { Appointment, SharedDocument } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoCredentials {
  roomName:    string;
  password:    string;
  jitsiDomain: string;
}

/** 3 distinct UI phases */
type Phase = "waiting" | "ready" | "in-call" | "ended";

interface ChatMsg {
  id:     string;
  sender: string;
  text:   string;
  time:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Extract Jitsi room name from a full URL like https://meet.jit.si/PulseLink-5-abc123 */
function roomNameFromUrl(url: string): string {
  return url.split("#")[0].split("/").pop() ?? "";
}

function buildWsUrl(appointmentId: string): string | null {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    const u    = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return `${u.toString().replace(/\/$/, "")}/ws/appointments/${appointmentId}/`;
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientTeleconsultPage() {
  const params        = useParams<{ appointmentId: string }>();
  const appointmentId = Array.isArray(params?.appointmentId)
    ? params.appointmentId[0]
    : params?.appointmentId;

  const router     = useRouter();
  const { toast }  = useToast();
  const { user }   = useAuthStore();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [phase,       setPhase]       = useState<Phase>("waiting");
  const [videoCreds,  setVideoCreds]  = useState<VideoCredentials | null>(null);
  const [endedMins,   setEndedMins]   = useState(0);

  // ── Sidebar state ──────────────────────────────────────────────────────────
  const [sharedDocs, setSharedDocs] = useState<SharedDocument[]>([]);
  const [docsOpen,   setDocsOpen]   = useState(false);
  const [chatOpen,   setChatOpen]   = useState(false);
  const [chatMsgs,   setChatMsgs]   = useState<ChatMsg[]>([]);
  const [chatInput,  setChatInput]  = useState("");

  const wsRef = useRef<WebSocket | null>(null);

  // ── Fetch appointment on mount ─────────────────────────────────────────────
  const fetchAppointment = useCallback(async () => {
    if (!appointmentId) return;
    try {
      const res = await appointmentService.getAppointmentById(appointmentId);
      if (!res.success || !res.data) return;

      const apt = res.data;
      setAppointment(apt);
      setSharedDocs(apt.sharedDocuments ?? []);

      const alreadyInProgress =
        apt.status === "in_progress" || apt.status === "in-progress";

      if (alreadyInProgress && apt.videoRoomUrl) {
        // Doctor already started before patient opened this page → go to READY
        setVideoCreds({
          roomName:    roomNameFromUrl(apt.videoRoomUrl),
          password:    apt.videoPassword ?? "",
          jitsiDomain: process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si",
        });
        setPhase("ready");
      }
      // else: stay in "waiting" — WebSocket will push video.started when doctor starts
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => { fetchAppointment(); }, [fetchAppointment]);

  // ── WebSocket — real-time events ───────────────────────────────────────────
  useEffect(() => {
    if (!appointmentId) return;
    const wsUrl = buildWsUrl(appointmentId);
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data as string);

        switch (payload.type) {

          // Doctor clicked "Start Video Consultation" ─────────────────────────
          // Backend broadcasts room credentials → patient moves to READY phase.
          // Patient still has to click "Join" themselves (NowServing pattern).
          case "video.started": {
            setVideoCreds({
              roomName:    payload.room_name,
              password:    payload.password ?? "",
              jitsiDomain: payload.jitsi_domain ?? "meet.jit.si",
            });
            setAppointment((prev) =>
              prev ? { ...prev, status: "in_progress" } : prev
            );
            setPhase("ready");
            toast({
              title:       "Doctor is ready 🎥",
              description: "Tap 'Join Video Call' to start your consultation.",
            });
            break;
          }

          // Doctor clicked "End Consultation" ───────────────────────────────
          // Jitsi unmounts, patient sees summary screen, then redirects.
          case "consultation.ended": {
            setEndedMins(payload.duration_minutes ?? 0);
            setAppointment((prev) =>
              prev ? { ...prev, status: "completed" } : prev
            );
            setPhase("ended");
            toast({
              title:       "Consultation ended",
              description: `Duration: ${payload.duration_minutes ?? 0} min`,
            });
            setTimeout(() => router.push("/patient/appointments"), 4000);
            break;
          }

          // Generic status update (confirmed, cancelled, etc.) ───────────────
          case "status.changed": {
            setAppointment((prev) =>
              prev ? { ...prev, status: payload.status } : prev
            );
            break;
          }

          // Doctor shared a document mid-call ───────────────────────────────
          case "document.shared": {
            const doc: SharedDocument = {
              id:         payload.document_id,
              docType:    payload.doc_type,
              documentId: payload.document_id,
              title:      payload.title,
              summary:    payload.summary,
              createdAt:  payload.created_at,
            };
            setSharedDocs((prev) => [doc, ...prev]);
            setDocsOpen(true);
            toast({
              title:       `New ${payload.doc_type} shared`,
              description: payload.title ?? "A document was added to your records.",
            });
            break;
          }
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => ws.close();
  }, [appointmentId, toast, router]);

  // ── In-call notes (local only — not a real chat channel) ──────────────────
  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChatMsgs((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: "You", text: chatInput.trim(), time: fmtTime() },
    ]);
    setChatInput("");
  };

  // ── Render: loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-white/60 text-sm">Loading consultation…</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-3 text-white/60">
          <AlertCircle className="h-10 w-10 mx-auto" />
          <p>Appointment not found.</p>
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  // ── Render: ENDED ──────────────────────────────────────────────────────────
  if (phase === "ended") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-5 bg-gray-800 rounded-2xl p-8 max-w-sm w-full"
        >
          <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
          <div>
            <h2 className="text-white text-xl font-semibold">Consultation Complete</h2>
            {endedMins > 0 && (
              <p className="text-white/50 text-sm mt-1">Duration: {endedMins} min</p>
            )}
          </div>
          {sharedDocs.length > 0 && (
            <div className="text-left space-y-2">
              <p className="text-white/50 text-xs font-medium">Documents shared by doctor:</p>
              {sharedDocs.map((doc) => (
                <div
                  key={`${doc.docType}-${doc.documentId}`}
                  className="flex items-center justify-between bg-gray-700/60 rounded-lg px-3 py-2"
                >
                  <p className="text-white text-xs">{doc.title ?? doc.docType}</p>
                  <Badge variant="secondary" className="text-[10px]">{doc.docType}</Badge>
                </div>
              ))}
            </div>
          )}
          <p className="text-white/30 text-xs">Redirecting to your appointments…</p>
        </motion.div>
      </div>
    );
  }

  // ── Render: WAITING ────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-sm w-full">
          <Avatar className="h-24 w-24 mx-auto ring-4 ring-primary/30">
            <AvatarImage src={appointment.doctor?.avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {appointment.doctor?.name?.charAt(0) ?? "D"}
            </AvatarFallback>
          </Avatar>

          <div>
            <h1 className="text-white text-xl font-semibold">
              {appointment.doctor?.name}
            </h1>
            <p className="text-white/50 text-sm">{appointment.doctor?.specialty}</p>
          </div>

          <Badge variant="secondary" className="gap-2 px-4 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            Waiting for doctor to start the session…
          </Badge>

          {/* Pulsing dots — visual feedback that we're listening */}
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <p className="text-white/30 text-xs">
            Keep this page open. You'll be notified the moment the doctor
            starts the session.
          </p>

          <Button
            variant="ghost"
            className="text-white/40 hover:text-white/60 text-sm"
            onClick={() => router.push("/patient/appointments")}
          >
            Back to Appointments
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: READY — doctor started, patient hasn't joined yet ─────────────
  if (phase === "ready") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-sm w-full"
        >
          <div className="relative mx-auto w-fit">
            <Avatar className="h-24 w-24 ring-4 ring-green-500/40">
              <AvatarImage src={appointment.doctor?.avatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {appointment.doctor?.name?.charAt(0) ?? "D"}
              </AvatarFallback>
            </Avatar>
            {/* Live indicator dot */}
            <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse" />
          </div>

          <div>
            <h1 className="text-white text-xl font-semibold">
              {appointment.doctor?.name}
            </h1>
            <p className="text-white/50 text-sm">{appointment.doctor?.specialty}</p>
          </div>

          <Badge className="gap-2 px-4 py-1.5 bg-green-500/20 text-green-400 border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Doctor is ready
          </Badge>

          {/* The patient explicitly clicks to enter Jitsi */}
          <Button
            className="w-full gap-2 gradient-primary border-0 h-12 text-base"
            onClick={() => setPhase("in-call")}
          >
            <Video className="h-5 w-5" />
            Join Video Call
          </Button>

          <p className="text-white/30 text-xs">
            Your doctor is waiting. Click above to enter the video room.
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Render: IN CALL — Jitsi is mounted ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">

      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800/70 backdrop-blur border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={appointment.doctor?.avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {appointment.doctor?.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-medium text-sm leading-tight">
              {appointment.doctor?.name}
            </p>
            <p className="text-white/40 text-xs">{appointment.doctor?.specialty}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Shared docs button — only visible when doctor has shared something */}
          {sharedDocs.length > 0 && (
            <Button
              variant={docsOpen ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 text-white/70 hover:text-white"
              onClick={() => setDocsOpen((v) => !v)}
            >
              <FileText className="h-4 w-4" />
              <span className="text-xs">{sharedDocs.length}</span>
            </Button>
          )}

          {/* Notes toggle */}
          <Button
            variant={chatOpen ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 text-white/70 hover:text-white"
            onClick={() => setChatOpen((v) => !v)}
          >
            <MessageCircle className="h-4 w-4" />
            {chatMsgs.length > 0 && (
              <span className="text-xs">{chatMsgs.length}</span>
            )}
          </Button>
        </div>
      </header>

      {/* Body: Jitsi + sidebars */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Jitsi iframe ── */}
        <div className="flex-1 min-w-0">
          <JitsiMeeting
            roomName={videoCreds!.roomName}
            domain={videoCreds!.jitsiDomain}
            displayName={user?.name ?? "Patient"}
            className="h-full w-full rounded-none"
          />
        </div>

        {/* ── Shared documents sidebar ── */}
        <AnimatePresence>
          {docsOpen && sharedDocs.length > 0 && (
            <motion.aside
              key="docs"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 272, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="bg-gray-800 border-l border-white/10 flex flex-col overflow-hidden shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <p className="text-white text-sm font-medium">Shared Documents</p>
                <button onClick={() => setDocsOpen(false)}>
                  <X className="h-4 w-4 text-white/40 hover:text-white" />
                </button>
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {sharedDocs.map((doc) => (
                    <div
                      key={`${doc.docType}-${doc.documentId}`}
                      className="rounded-lg bg-gray-700/60 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white text-xs font-medium truncate">
                          {doc.title ?? doc.docType}
                        </p>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {doc.docType}
                        </Badge>
                      </div>
                      {doc.summary && (
                        <p className="text-white/50 text-xs">{doc.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── In-call notes sidebar ── */}
        <AnimatePresence>
          {chatOpen && (
            <motion.aside
              key="notes"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="bg-gray-800 border-l border-white/10 flex flex-col overflow-hidden shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <p className="text-white text-sm font-medium">Notes</p>
                <button onClick={() => setChatOpen(false)}>
                  <X className="h-4 w-4 text-white/40 hover:text-white" />
                </button>
              </div>

              <ScrollArea className="flex-1 p-3">
                {chatMsgs.length === 0 ? (
                  <p className="text-white/30 text-xs text-center mt-6">
                    Jot down notes during your consultation.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {chatMsgs.map((msg) => (
                      <div key={msg.id} className="rounded-xl bg-white/10 px-3 py-2">
                        <p className="text-white text-xs">{msg.text}</p>
                        <p className="text-white/30 text-[10px] mt-0.5 text-right">
                          {msg.time}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t border-white/10 flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Add a note…"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-sm"
                />
                <Button size="icon" onClick={sendChat} className="shrink-0">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

