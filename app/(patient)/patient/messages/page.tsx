"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { MessageCircle, UserSearch } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import RtcVideoCallModal from '@/components/chat/RtcVideoCallModal';
import { chatService } from '@/services/chatService';
import { useAuthStore, useChatStore } from '@/store';
import { useNotificationStore } from '@/store';
import { Conversation, Appointment } from '@/types';
import { appointmentService } from '@/services/appointmentService';

function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const {
    conversations, setConversations,
    activeConversation, setActiveConversation,
    isLoading, setLoading,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);

  // Stable ref for activeConversation id — used inside fetchConversations
  // without adding activeConversation to its useCallback deps (avoids loop).
  const activeConvIdRef = useRef<string | undefined>(undefined);
  useEffect(() => { activeConvIdRef.current = activeConversation?.id; }, [activeConversation?.id]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await chatService.getConversations(user.id);
      if (res.success) {
        setConversations(res.data);
        // Sync active conversation using the ref — no dep on activeConversation
        if (activeConvIdRef.current) {
          const updated = res.data.find((c) => c.id === activeConvIdRef.current);
          if (updated) setActiveConversation(updated);
        }
      }
    } catch {
      // backend unavailable — show empty state, don't crash
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setConversations, setActiveConversation]);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user, fetchConversations]);

  // Poll conversation list every 10s so new conversations from the other party
  // appear without a page refresh (WS only updates the active conversation).
  useEffect(() => {
    if (!user) return;
    const id = setInterval(fetchConversations, 10_000);
    return () => clearInterval(id);
  }, [user, fetchConversations]);

  // Stable ref for selectConversation — keeps the query-param effect dep-free
  const selectConversationRef = useRef<(conv: Conversation) => void>(() => {});

  const selectConversation = useCallback((conv: Conversation) => {
    setActiveConversation(conv);
    setShowMobileChat(true);
    if (user) chatService.markAsRead(conv.id, user.id).catch(() => {});
  }, [user, setActiveConversation]);

  useEffect(() => { selectConversationRef.current = selectConversation; }, [selectConversation]);

  useEffect(() => {
    const convId = searchParams.get('conversation');
    if (convId && conversations.length > 0) {
      const conv = conversations.find((c) => c.id === convId);
      if (conv) selectConversationRef.current(conv);
    }
  }, [searchParams, conversations]);

  const handleVideoCallEnd = (endedAt: string) => {
    setShowVideoCall(false);
    if (activeConversation && user) {
      addNotification({
        id: `notif-${Date.now()}`,
        userId: user.id,
        type: 'appointment',
        title: 'Consultation Ended',
        message: 'Your video consultation has ended.',
        isRead: false,
        createdAt: endedAt,
      });
    }
  };

  const [relatedAppointment, setRelatedAppointment] = useState<Appointment | null>(null);
  const roomName = activeConversation ? `cc-chat-${activeConversation.id}` : '';
  const displayName = user?.name || user?.email || 'Patient';

  useEffect(() => {
    if (!activeConversation || !user) { setRelatedAppointment(null); return; }
    appointmentService
      .getAppointments({ patientId: activeConversation.patientId, doctorId: activeConversation.doctorId })
      .then((res) => {
        const match = res.success
          ? (res.data.find((a) => a.type === 'online') ?? null)
          : null;
        setRelatedAppointment(match);
      });
  }, [activeConversation, user]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const doctor = conv.doctor;
    return (
      doctor?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor?.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor?.hospital?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <Card className="h-full overflow-hidden">
          <div className="flex h-full">
            {/* Conversation list */}
            <div className={`w-full md:w-80 lg:w-96 border-r flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
              <ConversationList
                conversations={filteredConversations}
                activeConversationId={activeConversation?.id}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelect={selectConversation}
                currentUserId={user?.id ?? ''}
                emptyAction={
                  <Button size="sm" variant="outline" onClick={() => router.push('/patient/doctors')} className="gap-1.5 mt-2">
                    <UserSearch className="h-4 w-4" />Find a Doctor
                  </Button>
                }
              />
            </div>

            {/* Chat area */}
            <div className={`flex-1 flex-col overflow-hidden ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
              {activeConversation ? (
                <ChatWindow
                  conversation={activeConversation}
                  appointment={relatedAppointment}
                  onBack={() => { setShowMobileChat(false); setActiveConversation(null); }}
                  onStartVideoCall={() => setShowVideoCall(true)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Select a conversation</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                        Chat with doctors and staff about schedules, minor questions, and follow-ups
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/patient/doctors')} className="gap-2">
                      <UserSearch className="h-4 w-4" />Find a Doctor to Chat
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Video call overlay */}
      <AnimatePresence>
        {showVideoCall && activeConversation?.doctor && (
          <RtcVideoCallModal
            doctor={activeConversation.doctor}
            roomName={roomName}
            displayName={displayName}
            onEnd={handleVideoCallEnd}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}
