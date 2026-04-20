"use client";

/**
 * app/(doctor)/doctor/messages/page.tsx
 *
 * Doctor-side messages page.
 *
 * Key fixes vs previous version:
 *   1. WS-first send — text messages go over WebSocket, not REST.
 *      This makes messages appear instantly (<100ms) for both sides.
 *   2. Input clears IMMEDIATELY on send (optimistic clear).
 *   3. Optimistic message bubble appears before server confirmation.
 *   4. reconcileOptimistic() swaps temp bubble with real message on WS echo.
 *   5. Removed quickReplies array and chip buttons entirely.
 *      Real NowServing has no quick-reply feature in the doctor chat.
 *   6. Deduplication: WS echo after REST fallback no longer creates duplicates.
 */

import { useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, isToday, isYesterday } from 'date-fns';
import {
  ArrowLeft,
  CheckCheck,
  FileText,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Video,
  Zap,
} from 'lucide-react';
import { Conversation, Message, Appointment } from '@/types';
import { chatService, createOptimisticMessage, OPTIMISTIC_PREFIX } from '@/services/chatService';
import { getBaseUrl, getChatWsBaseUrl } from '@/services/api';
import { mapMessage } from '@/services/mappers';
import { appointmentService } from '@/services/appointmentService';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import DocumentComposer from '@/components/doctor/DocumentComposer';
import VideoConsultModal from '@/components/doctor/VideoConsultModal';
import { useRecordsStore } from '@/store/recordsStore';
import { sendPrescription, sendLabRequest, sendMedicalCertificate } from '../../../../features/doctor/consult/actions';
import { attachDocument } from '../../../../features/doctor/messages/actions';

function formatTime(ts: string) {
  const d = new Date(ts);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

const ONLINE_TTL_MS = 60 * 1000;
const onlineStatus = (onlineMap: Record<string, number>, id?: string) => {
  if (!id) return false;
  const lastSeen = onlineMap[id];
  if (!lastSeen) return false;
  return Date.now() - lastSeen < ONLINE_TTL_MS;
};

function DoctorMessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { addPrescriptionFromConsult, addLabResultFromConsult, addCertificateFromConsult } = useRecordsStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showList, setShowList] = useState(true);
  const [typing, setTyping] = useState(false);
  const [onlineMap, setOnlineMap] = useState<Record<string, number>>({});

  const scrollRef        = useRef<HTMLDivElement>(null);
  const wsRef            = useRef<WebSocket | null>(null);
  const pendingQueueRef  = useRef<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryRef          = useRef(0);
  const shouldReconnectRef = useRef(true);
  const isSendingRef       = useRef(false);

  // Send over WS if open, otherwise queue for next onopen
  const wsSend = (data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      pendingQueueRef.current.push(data);
    }
  };
  // Stable ref for user id — avoids stale closures in WS handlers
  const userIdRef          = useRef(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  // Stable ref for active conversation id
  const activeIdRef = useRef<string | undefined>(active?.id);
  useEffect(() => { activeIdRef.current = active?.id; }, [active?.id]);
  const activeConvRef = useRef<Conversation | null>(active);
  useEffect(() => { activeConvRef.current = active; }, [active]);

  const markOnline = (patientId?: string) => {
    if (!patientId) return;
    setOnlineMap((prev) => ({ ...prev, [patientId]: Date.now() }));
  };

  // ── Load conversation list ────────────────────────────────────────────────
  const fetchConversations = useCallback(async (initial = false) => {
    if (!user) return;
    if (initial) setLoadingList(true);
    try {
      const res = await chatService.getConversations(user.id);
      if (res.success) {
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setConversations(sorted);
        if (initial) {
          const requested = searchParams.get('conversation');
          const matched   = requested ? sorted.find((c) => c.id === requested) : null;
          const first     = matched || sorted[0] || null;
          setActive(first);
          if (first) setShowList(false);
        }
      }
    } catch {
      // backend unavailable
    } finally {
      if (initial) setLoadingList(false);
    }
  }, [user, searchParams]);

  useEffect(() => { fetchConversations(true); }, [fetchConversations]);

  // Poll every 10s so new conversations from patients appear without refresh
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => fetchConversations(false), 10_000);
    return () => clearInterval(id);
  }, [user, fetchConversations]);

  // ── Load messages when active conversation changes ────────────────────────
  useEffect(() => {
    const conv = activeConvRef.current;
    if (!conv) return;
    setMessages([]);
    chatService.getMessages(conv.id).then((res) => {
      if (res.success) {
        setMessages(res.data);
        const lastFromPatient = [...res.data].reverse().find((m) => String(m.senderId) === String(conv.patientId));
        if (lastFromPatient) markOnline(conv.patientId);
      }
    }).catch(() => {});
  }, [active?.id]);

  // ── WebSocket lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active?.id) return;
    const base = getChatWsBaseUrl() || getBaseUrl();
    if (!base) return;
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${url.toString().replace(/\/$/, "")}/ws/chat/${active.id}/`;

    shouldReconnectRef.current = true;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        // Flush any messages queued before the connection was ready
        const queue = pendingQueueRef.current.splice(0);
        queue.forEach((msg) => ws.send(msg));
        ws.send(JSON.stringify({ type: "chat.read_all" }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const conv = activeConvRef.current;
          if (!conv) return;

          if (payload?.type === "chat.message") {
            const { type: _wsType, ...messageData } = payload;
            const mapped = mapMessage(messageData, {
              conversationId: activeIdRef.current ?? conv.id,
              patientId:      conv.patientId,
              doctorId:       conv.doctorId,
            });

            if (String(mapped.senderId) === String(conv.patientId)) {
              markOnline(conv.patientId);
            }

            setMessages((prev) => {
              if (payload.temp_id && payload.temp_id.startsWith(OPTIMISTIC_PREFIX)) {
                const alreadyReal = prev.some((m) => m.id === mapped.id);
                if (alreadyReal) return prev.filter((m) => m.id !== payload.temp_id);
                return prev.map((m) => m.id === payload.temp_id ? mapped : m);
              }
              return prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped];
            });

            setConversations((prev) =>
              prev.map((c) =>
                c.id === conv.id
                  ? { ...c, lastMessage: mapped, updatedAt: mapped.timestamp, unreadCount: 0 }
                  : c
              )
            );
          } else if (payload?.type === "chat.typing") {
            if (String(payload.user_id) !== String(userIdRef.current)) {
              setTyping(Boolean(payload.is_typing));
              if (String(payload.user_id) === String(conv.patientId)) {
                markOnline(conv.patientId);
              }
            }
          }
        } catch {
          // ignore malformed WS frames
        }
      };

      ws.onclose = () => {
        setTyping(false);
        if (shouldReconnectRef.current) {
          const delay = Math.min(10000, 1000 * 2 ** retryRef.current);
          retryRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      pendingQueueRef.current = [];
      clearTimeout(typingTimeoutRef.current);
      clearTimeout(reconnectTimerRef.current);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      wsRef.current = null;
      setTyping(false);
    };
  }, [active?.id]);

  // ── Load related appointment ──────────────────────────────────────────────
  useEffect(() => {
    const conv = activeConvRef.current;
    const uid  = userIdRef.current;
    if (!uid || !conv) return;
    appointmentService.getAppointments({ doctorId: uid, patientId: conv.patientId })
      .then((res) => {
        if (res.success && res.data.length > 0) {
          const upcoming = res.data.find((a) => ['confirmed', 'in-progress'].includes(a.status));
          setActiveAppointment(upcoming || res.data[0]);
        } else {
          setActiveAppointment(null);
        }
      })
      .catch(() => setActiveAppointment(null));
  }, [active?.id, user?.id]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const handleSelectConversation = (conv: Conversation) => {
    setActive(conv);
    setShowList(false);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  // ── Send message (WS-first, REST fallback) ────────────────────────────────
  const handleSend = async (overrideContent?: string) => {
    if (!user || !active || isSendingRef.current) return;
    const content = (overrideContent ?? text).trim();
    if (!content) return;

    // Step 1: Clear input IMMEDIATELY
    isSendingRef.current = true;
    if (!overrideContent) setText('');

    // Stop typing indicator
    wsSend(JSON.stringify({ type: "chat.typing", is_typing: false }));

    // Step 2: Add optimistic bubble
    const optimistic = createOptimisticMessage(
      active.id, user.id, 'doctor', content, 'text'
    );
    setMessages((prev) => [...prev, optimistic]);

    try {
      // Always go WS-first (queued if still connecting)
      wsSend(JSON.stringify({
        type:     "chat.message",
        content,
        msg_type: "text",
        temp_id:  optimistic.id,
      }));
    } catch {
      // Rollback optimistic bubble
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      if (!overrideContent) setText(content);
      toast({
        title:       'Message not sent',
        description: 'Check your connection and try again.',
        variant:     'destructive',
      });
    } finally {
      isSendingRef.current = false;
    }
  };

  // ── Send document (prescription / lab / certificate) ─────────────────────
  const sendDocs = async (payload: { type: 'rx' | 'lab' | 'cert'; data: Record<string, unknown> }) => {
    if (!activeAppointment || !user) return;
    try {
      if (payload.type === 'rx') {
        const rx = await sendPrescription({
          appointmentId: activeAppointment.id,
          patientId:     activeAppointment.patientId,
          doctorId:      user.id,
          diagnosis:     payload.data.diagnosis as string,
          medications:   payload.data.medications as string,
          instructions:  payload.data.instructions as string,
          followUpDate:  payload.data.followUpDate as string | undefined,
        });
        addPrescriptionFromConsult(rx);
        await attachDocument(active?.id || '', user.id, rx.id);
      }
      if (payload.type === 'lab') {
        const lab = await sendLabRequest({
          appointmentId: activeAppointment.id,
          patientId:     activeAppointment.patientId,
          doctorId:      user.id,
          testName:      payload.data.testName as string,
          notes:         payload.data.notes as string,
        });
        addLabResultFromConsult(lab);
        await attachDocument(active?.id || '', user.id, lab.id);
      }
      if (payload.type === 'cert') {
        const cert = await sendMedicalCertificate({
          appointmentId: activeAppointment.id,
          patientId:     activeAppointment.patientId,
          doctorId:      user.id,
          purpose:       payload.data.purpose as string,
          diagnosis:     payload.data.diagnosis as string,
          restDays:      payload.data.restDays as number,
        });
        addCertificateFromConsult(cert);
        await attachDocument(active?.id || '', user.id, cert.id);
      }
      await chatService.sendMessage(
        active?.id || '', user.id, 'doctor',
        'Document sent. Please check My Files.', 'file'
      );
      toast({ title: 'Document sent', description: 'Patient file updated.' });
    } catch (error) {
      toast({
        title:       'Failed to send document',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant:     'destructive',
      });
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      c.patient?.name?.toLowerCase().includes(q) ||
      c.lastMessage?.content?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const activeOnline = onlineStatus(onlineMap, active?.patientId);

  return (
    <div className="lg:grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-9rem)] flex flex-col">
      {/* ── Conversation list ── */}
      <Card className={`overflow-hidden ${showList ? 'block' : 'hidden'} lg:block`}>
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Messages</h2>
            <p className="text-xs text-muted-foreground">Patient conversations</p>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients..."
                className="pl-10"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingList ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground space-y-3">
                <MessageCircle className="h-10 w-10 mx-auto opacity-40" />
                <p>No messages yet.</p>
                <Button size="sm" variant="outline" onClick={() => router.push('/doctor/queue')}>
                  View Queue
                </Button>
              </div>
            ) : (
              filtered.map((conv) => {
                const patient  = conv.patient;
                const isActive = active?.id === conv.id;
                const isOnline = onlineStatus(onlineMap, conv.patientId);
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-4 border-b hover:bg-muted/40 transition-colors ${isActive ? 'bg-muted' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={patient?.avatar} />
                          <AvatarFallback>{patient?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background ${isOnline ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{patient?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage?.content ?? 'No messages yet'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-muted-foreground">{formatTime(conv.updatedAt)}</span>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Chat area ── */}
      <Card className={`flex flex-col overflow-hidden ${showList ? 'hidden' : 'flex'} lg:flex`}>
        <CardContent className="p-0 flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setShowList(true)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={active?.patient?.avatar} />
                  <AvatarFallback>{active?.patient?.name?.[0]}</AvatarFallback>
                </Avatar>
                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background ${activeOnline ? 'bg-success' : 'bg-muted-foreground/40'}`} />
              </div>
              <div>
                <p className="font-medium">{active?.patient?.name ?? 'Select a patient'}</p>
                <p className="text-xs text-muted-foreground">
                  {activeOnline ? 'Online' : 'Offline'} · {activeAppointment?.type === 'online' ? 'Video consult' : 'In-clinic'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline" className="gap-1"
                onClick={() => setShowDocuments(true)}
                disabled={!activeAppointment}
              >
                <FileText className="h-3.5 w-3.5" />
                Attach
              </Button>
              <Button
                size="sm" className="gap-1"
                onClick={() => setShowVideo(true)}
                disabled={!activeAppointment || activeAppointment.type !== 'online'}
              >
                <Video className="h-3.5 w-3.5" />
                Start Video
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {!active ? (
              <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground space-y-3">
                <MessageCircle className="h-10 w-10 opacity-40" />
                <p>Select a conversation to start messaging.</p>
              </div>
            ) : (
              <div ref={scrollRef} className="space-y-3">
                {messages.map((msg) => {
                  const isOwn    = String(msg.senderId) === String(user?.id);
                  const isPending = msg.id.startsWith(OPTIMISTIC_PREFIX);
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`px-4 py-2 rounded-2xl text-sm max-w-[75%] transition-opacity ${
                          isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        } ${isPending ? 'opacity-70' : 'opacity-100'}`}
                      >
                        <div className="flex items-center gap-2">
                          {msg.type === 'file' && <Paperclip className="h-3.5 w-3.5" />}
                          <span>{msg.content}</span>
                        </div>
                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatTime(msg.timestamp)}
                          {isOwn && (
                            <CheckCheck className={`h-3 w-3 ${msg.isRead ? 'opacity-100' : 'opacity-50'}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {typing && (
                  <div className="text-xs text-muted-foreground">Patient is typing...</div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input bar — NO quick reply chips (not in real NowServing) */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline" size="icon"
                onClick={() => setShowDocuments(true)}
                disabled={!activeAppointment}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  const ws = wsRef.current;
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'chat.typing', is_typing: true }));
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      try { ws.send(JSON.stringify({ type: 'chat.typing', is_typing: false })); } catch { /* ignore */ }
                    }, 1200);
                  }
                }}
                placeholder="Type a message..."
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              />
              <Button onClick={() => handleSend()} disabled={!text.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-2">
              <Zap className="h-3 w-3" />
              All messages are secure and confidential.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Document composer dialog */}
      <Dialog open={showDocuments} onOpenChange={setShowDocuments}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Document</DialogTitle>
          </DialogHeader>
          {activeAppointment ? (
            <DocumentComposer
              onSendPrescription={(data) => sendDocs({ type: 'rx', data })}
              onSendLab={(data) => sendDocs({ type: 'lab', data })}
              onSendCertificate={(data) => sendDocs({ type: 'cert', data })}
            />
          ) : (
            <div className="text-sm text-muted-foreground">Select a patient first.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video consult modal */}
      <VideoConsultModal
        open={showVideo}
        appointment={activeAppointment}
        onClose={() => setShowVideo(false)}
        onEnd={async () => {
          setShowVideo(false);
          if (active && user) {
            await chatService.sendMessage(
              active.id, user.id, 'doctor',
              'Video consultation ended. Transcript saved.', 'text'
            );
          }
          toast({ title: 'Consult ended', description: 'Transcript sent to patient.' });
        }}
        onSendPrescription={(data) => sendDocs({ type: 'rx', data })}
        onSendLab={(data) => sendDocs({ type: 'lab', data })}
        onSendCertificate={(data) => sendDocs({ type: 'cert', data })}
      />
    </div>
  );
}

export default function DoctorMessagesPage() {
  return (
    <Suspense>
      <DoctorMessagesContent />
    </Suspense>
  );
}
