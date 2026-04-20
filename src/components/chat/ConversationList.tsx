"use client";

/**
 * ConversationList.tsx
 *
 * NowServing-style conversation sidebar.
 * - Sorted by last_message timestamp (most recent first)
 * - Per-conversation unread badge (red pill)
 * - Total unread count in the header (for sidebar nav badge)
 * - Search by doctor/patient name
 */

import { motion } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, MessageCircle, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { Conversation } from '@/types';
import { useChatStore } from '@/store';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (conv: Conversation) => void;
  currentUserId: string;
  emptyAction?: React.ReactNode;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function ConversationList({
  conversations, activeConversationId, isLoading,
  searchQuery, onSearchChange, onSelect, currentUserId, emptyAction,
}: ConversationListProps) {
  const { totalUnread } = useChatStore();

  // Sort by updatedAt descending (most recent conversation first)
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Messages</h2>
            {/* Total unread badge — mirrors NowServing sidebar nav badge */}
            {totalUnread > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full text-xs bg-destructive text-destructive-foreground">
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Secure &amp; Private
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* ── List ── */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground">
              Book a consultation to start chatting with your doctor.
            </p>
            {emptyAction}
          </div>
        ) : (
          <div>
            {sorted.map((conv) => {
              // For patient view: show doctor info; for doctor view: show patient info
              const other    = conv.doctor ?? conv.patient;
              const isActive = activeConversationId === conv.id;
              const hasUnread = (conv.unreadCount ?? 0) > 0;

              return (
                <motion.button
                  key={conv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => onSelect(conv)}
                  className={`w-full text-left p-4 border-b transition-colors flex gap-3 ${
                    isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Avatar with online dot */}
                  <div className="relative shrink-0">
                    <Avatar>
                      <AvatarImage src={other?.avatar} />
                      <AvatarFallback>{other?.name?.charAt(0) ?? '?'}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-background" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                        {other?.name ?? 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-1">
                        {conv.updatedAt ? formatTime(conv.updatedAt) : ''}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {(other as any)?.specialty ?? ''}
                    </p>

                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-sm truncate ${hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {conv.lastMessage?.content
                          ? conv.lastMessage.content.length > 40
                            ? conv.lastMessage.content.slice(0, 40) + '…'
                            : conv.lastMessage.content
                          : 'No messages yet'}
                      </p>

                      {/* Per-conversation unread badge */}
                      {hasUnread && (
                        <Badge className="ml-2 h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full text-xs shrink-0 bg-primary text-primary-foreground">
                          {conv.unreadCount! > 99 ? '99+' : conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
