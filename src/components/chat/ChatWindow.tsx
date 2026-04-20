"use client";

/**
 * ChatWindow.tsx
 *
 * NowServing-style 1:1 chat window.
 *
 * Send flow (instant, <100ms perceived latency):
 *   1. User presses Send
 *   2. Input clears IMMEDIATELY (optimistic clear)
 *   3. Optimistic message bubble appears instantly in the list
 *   4. WS frame fires to backend → backend persists + broadcasts to both sides
 *   5. Both sides receive chat.message with real DB id + temp_id
 *   6. reconcileOptimistic() swaps the temp bubble for the confirmed message
 *   7. On WS error → removeMessage() rolls back the temp bubble + toast shown
 *
 * Race condition handling:
 *   - isSendingRef (useRef) guards against double-send from the same client
 *   - Backend asyncio.Lock serialises concurrent sends from the same WS connection
 *   - addMessage() deduplicates by id so WS echo never creates a duplicate
 *
 * Read receipts:
 *   ✓  = sent (is_read: false)
 *   ✓✓ = read (is_read: true, read_at set)
 *
 * Removed (not in real NowServing):
 *   - Quick reply chips / message suggestions
 *   - AI-generated reply buttons
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Send, Paperclip, MoreVertical, Check, CheckCheck,
  ArrowLeft, Video, Smile, FileText, Image as ImageIcon, X,
  ShieldCheck, CalendarClock, ChevronUp, AlertCircle, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Conversation, Message, Appointment } from '@/types';
import { useAuthStore } from '@/store';
import { chatService, createOptimisticMessage, OPTIMISTIC_PREFIX } from '@/services/chatService';
import { getChatWsBaseUrl, getBaseUrl } from '@/services/api';
import { mapMessage } from '@/services/mappers';
import { useChatStore } from '@/store/useChatStore';
import { useToast } from '@/hooks/use-toast';
import VideoCallButton from './VideoCallButton';

interface ChatWindowProps {
  conversation: Conversation;
  appointment?: Appointment | null;
  onBack: () => void;
  onStartVideoCall: () => void;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

const EMOJI_LIST = ['😊', '👍', '🙏', '❤️', '😢', '😷', '💊', '🩺', '📋', '✅'];

interface WsPayload {
  type: string;
  temp_id?: string;
  user_id?: string;
  is_typing?: boolean;
  message_id?: number;
  read_at?: string;
  conversation_id?: string;
  count?: number;
  [key: string]: unknown;
}

export default function ChatWindow({
  conversation, appointment, onBack, onStartVideoCall,
}: ChatWindowProps) {
  const { user }   = useAuthStore();
  const { toast }  = useToast();
  const {
    messages, addMessage, removeMessage, reconcileOptimistic,
    setMessages,
    isTyping, setTyping,
    conversations, setConversations,
    markMessageRead, markAllRead, setConversationUnread,
  } = useChatStore();

  const [text, setText]                 = useState('');
  const [isSending, setIsSending]       = useState(false);
  const isSendingRef                    = useRef(false);
  const [showEmoji, setShowEmoji]       = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ file: File; name: string; type: string } | null>(null);
  const [isLoadingOlder, setIsLoadingOlder]   = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const typingTimeoutRef  = useRef<ReturnType<typeof setTimeout>>();
  const wsRef             = useRef<WebSocket | null>(null);
  const pendingQueueRef   = useRef<string[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryRef          = useRef(0);
  const shouldReconnectRef = useRef(true);

  // Send over WS if open, otherwise queue for next onopen
  const wsSend = (data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      pendingQueueRef.current.push(data);
    }
  };
  // Stable ref for handleWsEvent — so onmessage always calls the latest version
  // without recreating the WebSocket on every render.
  const handleWsEventRef  = useRef<(payload: WsPayload) => void>(() => {});
  // Stable ref for user id — avoids stale closures inside WS handlers
  const userIdRef          = useRef(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  // Track which message IDs we've already sent mark_read for (avoid duplicates)
  const markedReadRef = useRef<Set<string>>(new Set());

  const otherParty = conversation.doctor ?? conversation.patient;
  const otherName  = otherParty?.name ?? 'Unknown';
  const otherRole  = user?.role === 'patient' ? 'Doctor' : 'Patient';

  // ── Fetch message history on conversation change ─────────────────────────
  useEffect(() => {
    setMessages([]);
    chatService.getMessages(conversation.id).then((res) => {
      if (res.success) setMessages(res.data);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── WebSocket lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (!conversation?.id) return;
    const base = getChatWsBaseUrl() || getBaseUrl();
    if (!base) return;

    const url = new URL(base);
    // Use origin only to avoid path segments from the base URL mangling the WS path
    const wsUrl = `${url.origin.replace(/^http/, 'ws')}/ws/chat/${conversation.id}/`;

    shouldReconnectRef.current = true;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        // Flush any messages queued before the connection was ready
        const queue = pendingQueueRef.current.splice(0);
        queue.forEach((msg) => ws.send(msg));
        ws.send(JSON.stringify({ type: 'chat.read_all' }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // Always call via ref so reconnects use the latest handler
          handleWsEventRef.current(payload);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setTyping(false);
        if (shouldReconnectRef.current) {
          // Exponential backoff: 1s, 2s, 4s, 8s … capped at 10s
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  // ── WS event router ───────────────────────────────────────────────────────
  // useCallback deps use stable refs (userIdRef) so this never recreates on
  // auth store updates — prevents the stale onmessage handler bug.
  const handleWsEvent = useCallback((payload: WsPayload) => {
    switch (payload?.type) {
      case 'chat.message': {
        // Strip the WS envelope `type` field so mapMessage gets the message
        // type ("text", "image", etc.) not the WS event name ("chat.message").
        const { type: _wsType, ...messageData } = payload;
        const mapped = mapMessage(messageData, {
          conversationId: conversation.id,
          patientId:      conversation.patientId,
          doctorId:       conversation.doctorId,
        });

        // If this message has a temp_id, reconcile the optimistic bubble.
        // Otherwise just add (addMessage deduplicates by real id).
        if (payload.temp_id && payload.temp_id.startsWith(OPTIMISTIC_PREFIX)) {
          reconcileOptimistic(payload.temp_id, mapped);
        } else {
          addMessage(mapped);
        }

        // Bump conversation to top of list with updated last message
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === conversation.id
                ? {
                    ...c,
                    lastMessage: mapped,
                    updatedAt:   mapped.timestamp,
                    unreadCount:
                      String(mapped.senderId) !== String(userIdRef.current)
                        ? (c.unreadCount ?? 0) + 1
                        : c.unreadCount,
                  }
                : c
            )
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
        break;
      }

      case 'chat.typing':
        if (String(payload.user_id) !== String(userIdRef.current)) {
          setTyping(Boolean(payload.is_typing));
        }
        break;

      case 'chat.read':
        markMessageRead(String(payload.message_id), payload.read_at);
        break;

      case 'chat.read_all':
        markAllRead(String(payload.conversation_id));
        setConversationUnread(String(payload.conversation_id), 0);
        break;

      case 'chat.unread_count':
        setConversationUnread(String(payload.conversation_id), payload.count ?? 0);
        break;

      case 'chat.error': {
        const tempId = typeof payload.temp_id === 'string' ? payload.temp_id : undefined;
        if (tempId && tempId.startsWith(OPTIMISTIC_PREFIX)) {
          removeMessage(tempId);
        }
        toast({
          title:       'Message not sent',
          description: String(payload.detail ?? 'Check your connection and try again.'),
          variant:     'destructive',
        });
        break;
      }

      default:
        break;
    }
  }, [
    conversation.id, conversation.patientId, conversation.doctorId,
    addMessage, reconcileOptimistic, setConversations, setTyping,
    markMessageRead, markAllRead, setConversationUnread, removeMessage, toast,
  ]);

  // Keep the ref in sync with the latest handleWsEvent without touching the WS
  useEffect(() => {
    handleWsEventRef.current = handleWsEvent;
  }, [handleWsEvent]);

  // ── IntersectionObserver: auto-mark incoming messages as read ─────────────
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Recreate the observer whenever the conversation changes so stale message
  // elements from the previous conversation are not observed.
  useEffect(() => {
    observerRef.current?.disconnect();
    markedReadRef.current = new Set();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const msgId = (entry.target as HTMLElement).dataset.msgId;
          if (!msgId || markedReadRef.current.has(msgId)) return;
          // Skip optimistic messages — they have no real DB id yet
          if (msgId.startsWith(OPTIMISTIC_PREFIX)) return;

          markedReadRef.current.add(msgId);

          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'chat.read', message_id: Number(msgId) }));
          } else {
            chatService.markMessageRead(msgId);
          }
        });
      },
      { threshold: 0.5 }
    );

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !attachedFile) || !user || isSendingRef.current) return;

    const content    = text.trim();
    const fileToSend = attachedFile;
    const msgType    = fileToSend
      ? (fileToSend.type.startsWith('image/') ? 'image' : 'file')
      : 'text';

    // ── Step 1: Clear input IMMEDIATELY (optimistic clear) ──────────────────
    isSendingRef.current = true;
    setIsSending(true);
    setText('');
    setAttachedFile(null);

    // Stop typing indicator
    if (msgType === 'text') wsSend(JSON.stringify({ type: 'chat.typing', is_typing: false }));

    // ── Step 2: Add optimistic bubble ──────────────────────────────────────
    const optimisticContent = fileToSend ? `📎 ${fileToSend.name}` : content;
    const optimisticMsg = createOptimisticMessage(
      conversation.id,
      user.id,
      user.role as 'patient' | 'doctor',
      optimisticContent,
      msgType as 'text' | 'image' | 'file',
    );
    addMessage(optimisticMsg);

    try {
      if (msgType === 'text') {
        // Always WS-first (queued if still connecting)
        wsSend(JSON.stringify({
          type:     'chat.message',
          content,
          msg_type: 'text',
          temp_id:  optimisticMsg.id,
        }));
      } else {
        // File upload — REST only
        const res = await chatService.sendMessage(
          conversation.id, user.id, user.role,
          content, msgType as 'image' | 'file', fileToSend?.file, optimisticMsg.id
        );
        if (res.success) {
          reconcileOptimistic(optimisticMsg.id, res.data);
        } else {
          throw new Error('Send failed');
        }
      }
    } catch {
      removeMessage(optimisticMsg.id);
      toast({
        title:       'Message not sent',
        description: 'Check your connection and try again.',
        variant:     'destructive',
      });
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  // ── Load older messages (pagination) ─────────────────────────────────────
  const handleLoadOlder = async () => {
    if (isLoadingOlder || !hasOlderMessages || messages.length === 0) return;
    setIsLoadingOlder(true);
    const oldestId = messages[0]?.id;
    // Don't paginate using an optimistic id
    if (oldestId?.startsWith(OPTIMISTIC_PREFIX)) {
      setIsLoadingOlder(false);
      return;
    }
    const res = await chatService.getMessages(conversation.id, oldestId);
    if (res.success) {
      if (res.data.length === 0) {
        setHasOlderMessages(false);
      } else {
        useChatStore.setState((state) => ({
          messages: [
            ...res.data.filter((m) => !state.messages.some((e) => e.id === m.id)),
            ...state.messages,
          ],
        }));
      }
    }
    setIsLoadingOlder(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile({ file, name: file.name, type: file.type });
    e.target.value = '';
  };

  const handleTextChange = (val: string) => {
    setText(val);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat.typing', is_typing: true }));
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        try { ws.send(JSON.stringify({ type: 'chat.typing', is_typing: false })); } catch { /* ignore */ }
      }, 1200);
    }
  };

  // Send chat.read_all when the window gains focus
  useEffect(() => {
    const onFocus = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat.read_all' }));
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative">
            <Avatar>
              <AvatarImage src={otherParty?.avatar} />
              <AvatarFallback>{otherName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-background" />
          </div>
          <div>
            <p className="font-semibold text-sm">{otherName}</p>
            <p className="text-xs text-muted-foreground">
              {(otherParty as { specialty?: string })?.specialty
                ? `${(otherParty as { specialty?: string }).specialty} · `
                : ''}
              <span className="text-success font-medium">Online</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <VideoCallButton appointment={appointment} onStartCall={onStartVideoCall} />
          <Button variant="ghost" size="icon" title="More options">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Active appointment banner ── */}
      {appointment && appointment.type === 'online' && appointment.status === 'in_progress' && (
        <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-2 text-sm shrink-0">
          <CalendarClock className="h-4 w-4 text-primary shrink-0" />
          <span className="text-primary font-medium">
            Consultation in progress — {appointment.date} at {appointment.time}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={onStartVideoCall}
          >
            <Video className="h-3 w-3 mr-1" />
            Join Now
          </Button>
        </div>
      )}

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-3">
          {/* Load older messages */}
          {hasOlderMessages && messages.length >= 50 && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-muted-foreground"
                onClick={handleLoadOlder}
                disabled={isLoadingOlder}
              >
                <ChevronUp className="h-3 w-3" />
                {isLoadingOlder ? 'Loading…' : 'Load older messages'}
              </Button>
            </div>
          )}

          {/* Security label */}
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground py-2">
            <ShieldCheck className="h-3 w-3" />
            Messages are secure and private
          </div>

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={String(msg.senderId) === String(user?.id)}
                formatTime={formatTime}
                observerRef={observerRef}
              />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-2"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={otherParty?.avatar} />
                <AvatarFallback className="text-xs">{otherName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1 items-center">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-xs text-muted-foreground">{otherRole} is typing…</span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* ── Attached file preview ── */}
      {attachedFile && (
        <div className="mx-4 mb-1 px-3 py-2 bg-muted rounded-lg flex items-center gap-2 text-sm shrink-0">
          {attachedFile.type.startsWith('image/') ? (
            <ImageIcon className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="truncate flex-1">{attachedFile.name}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachedFile(null)}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      )}

      {/* ── Emoji picker ── */}
      {showEmoji && (
        <div className="mx-4 mb-1 p-2 bg-card border rounded-xl flex flex-wrap gap-1 shrink-0">
          {EMOJI_LIST.map((e) => (
            <button
              key={e}
              className="text-xl hover:scale-125 transition-transform"
              onClick={() => { setText((t) => t + e); setShowEmoji(false); }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      {/* NOTE: No quick-reply chips here — real NowServing has plain text input only */}
      <form onSubmit={handleSend} className="px-4 py-3 border-t bg-card shrink-0">
        <div className="flex gap-2 items-center">
          <Button type="button" variant="ghost" size="icon" className="shrink-0"
            onClick={() => setShowEmoji((v) => !v)}>
            <Smile className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="shrink-0"
            onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            aria-label="Attach file"
            onChange={handleFileSelect}
          />
          <Input
            placeholder="Type a message…"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
            autoComplete="off"
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isSending || (!text.trim() && !attachedFile)}
            className="shrink-0"
            aria-busy={isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

interface BubbleProps {
  message: Message;
  isOwn: boolean;
  formatTime: (ts: string) => string;
  observerRef: React.MutableRefObject<IntersectionObserver | null>;
}

function MessageBubble({ message, isOwn, formatTime, observerRef }: BubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const isFile    = message.type === 'file' || message.type === 'image';
  // Optimistic messages have a temp id — show a subtle pending indicator
  const isPending = message.id.startsWith(OPTIMISTIC_PREFIX);

  // Attach IntersectionObserver to incoming messages only
  useEffect(() => {
    const el = bubbleRef.current;
    if (!el || isOwn || message.isRead || isPending) return;
    const observer = observerRef.current;
    observer?.observe(el);
    return () => observer?.unobserve(el);
  }, [isOwn, message.isRead, isPending, observerRef]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isPending ? 0.75 : 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div
        ref={bubbleRef}
        data-msg-id={message.id}
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}
      >
        {isFile ? (
          <div className="flex items-center gap-2">
            {message.type === 'image' ? (
              <ImageIcon className="h-4 w-4 shrink-0" />
            ) : (
              <FileText className="h-4 w-4 shrink-0" />
            )}
            {message.fileUrl ? (
              <a
                href={message.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline cursor-pointer"
              >
                {message.fileName || message.content.replace('📎 ', '')}
              </a>
            ) : (
              <span className="text-sm">{message.content.replace('📎 ', '')}</span>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{message.content}</p>
        )}

        {/* Timestamp + read receipt */}
        <div className={`flex items-center justify-end gap-1 mt-1 ${
          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
        }`}>
          <span className="text-xs">{formatTime(message.timestamp)}</span>
          {isOwn && (
            isPending
              ? (
                  // Clock icon while optimistic (not yet confirmed by server)
                  <AlertCircle className="h-3 w-3 opacity-50" aria-label="Sending…" />
                )
              : message.isRead
                ? (
                    // ✓✓ double check — message has been read by receiver
                    <CheckCheck
                      className="h-3 w-3 text-primary-foreground/90"
                      aria-label={`Read${message.readAt ? ` at ${formatTime(message.readAt)}` : ''}`}
                    />
                  )
                : (
                    // ✓ single check — delivered, not yet read
                    <Check className="h-3 w-3" aria-label="Delivered" />
                  )
          )}
        </div>
      </div>
    </motion.div>
  );
}
