import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Notification, Doctor, Appointment, Conversation, Message } from '@/types';

// Auth Store — no persistence; auth state is driven by HttpOnly cookies
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Saved family members — fetched once from GET /api/auth/me/ and kept in sync */
  familyMembers: import('@/types').FamilyMember[];
  setUser: (user: User | null) => void;
  /** Merge partial fields into the current user without replacing the whole object */
  updateUser: (patch: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  /** Mark patient profile wizard as complete in local state */
  setProfileComplete: (complete: boolean) => void;
  /** Mark doctor profile wizard as complete in local state */
  setDoctorProfileComplete: (complete: boolean) => void;
  /** Sync family members list (called after GET /api/auth/me/ or family CRUD) */
  setFamilyMembers: (members: import('@/types').FamilyMember[]) => void;
  /** Add a single family member (optimistic after POST) */
  addFamilyMember: (member: import('@/types').FamilyMember) => void;
  /** Remove a family member by id (optimistic after DELETE) */
  removeFamilyMember: (id: number) => void;
  /** Replace a family member by id (optimistic after PATCH) */
  updateFamilyMember: (id: number, patch: Partial<import('@/types').FamilyMember>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  familyMembers: [],
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  updateUser: (patch) =>
    set((state) =>
      state.user ? { user: { ...state.user, ...patch } } : state
    ),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    if (typeof document !== "undefined") {
      document.cookie = "user_role=;path=/;max-age=0";
    }
    set({ user: null, isAuthenticated: false, familyMembers: [] });
  },
  setProfileComplete: (complete) =>
    set((state) =>
      state.user ? { user: { ...state.user, isProfileComplete: complete } } : state
    ),
  setDoctorProfileComplete: (complete) =>
    set((state) =>
      state.user ? { user: { ...state.user, doctorProfileComplete: complete } } : state
    ),
  setFamilyMembers: (members) => set({ familyMembers: members }),
  addFamilyMember: (member) =>
    set((state) => ({ familyMembers: [...state.familyMembers, member] })),
  removeFamilyMember: (id) =>
    set((state) => ({ familyMembers: state.familyMembers.filter((m) => m.id !== id) })),
  updateFamilyMember: (id, patch) =>
    set((state) => ({
      familyMembers: state.familyMembers.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    })),
}));

// Notification Store
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearBadge: () => void;
  removeNotification: (id: string) => void;
  setNotifications: (notifications: Notification[]) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    }));
  },
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  },
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },
  clearBadge: () => set({ unreadCount: 0 }),
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  setNotifications: (notifications) => {
    set((state) => {
      // Preserve local isRead:true for notifications the user already clicked
      const localReadIds = new Set(state.notifications.filter((n) => n.isRead).map((n) => n.id));
      const merged = notifications.map((n) =>
        localReadIds.has(n.id) ? { ...n, isRead: true } : n
      );
      return {
        notifications: merged,
        unreadCount: merged.filter((n) => !n.isRead).length,
      };
    });
  },
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));

// Doctor Search Store
interface DoctorSearchState {
  doctors: Doctor[];
  selectedDoctor: Doctor | null;
  filters: {
    specialty: string;
    location: string;
    name: string;
  };
  isLoading: boolean;
  setDoctors: (doctors: Doctor[]) => void;
  setSelectedDoctor: (doctor: Doctor | null) => void;
  setFilters: (filters: Partial<DoctorSearchState['filters']>) => void;
  setLoading: (loading: boolean) => void;
  resetFilters: () => void;
}

export const useDoctorSearchStore = create<DoctorSearchState>((set) => ({
  doctors: [],
  selectedDoctor: null,
  filters: {
    specialty: '',
    location: '',
    name: '',
  },
  isLoading: false,
  setDoctors: (doctors) => set({ doctors }),
  setSelectedDoctor: (selectedDoctor) => set({ selectedDoctor }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  setLoading: (isLoading) => set({ isLoading }),
  resetFilters: () =>
    set({ filters: { specialty: '', location: '', name: '' } }),
}));

// Appointment Store
interface AppointmentState {
  appointments: Appointment[];
  selectedAppointment: Appointment | null;
  isLoading: boolean;
  setAppointments: (appointments: Appointment[]) => void;
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  setSelectedAppointment: (appointment: Appointment | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: [],
  selectedAppointment: null,
  isLoading: false,
  setAppointments: (appointments) => set({ appointments }),
  addAppointment: (appointment) =>
    set((state) => ({ appointments: [appointment, ...state.appointments] })),
  updateAppointment: (id, data) =>
    set((state) => ({
      appointments: state.appointments.map((a) =>
        a.id === id ? { ...a, ...data } : a
      ),
    })),
  setSelectedAppointment: (selectedAppointment) => set({ selectedAppointment }),
  setLoading: (isLoading) => set({ isLoading }),
}));

// Chat Store
interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  totalUnread: number;
  setConversations: (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  /**
   * Remove a message by id — used to roll back an optimistic bubble on WS error.
   * Also used to deduplicate when the WS echo arrives after a REST fallback send.
   */
  removeMessage: (messageId: string) => void;
  /**
   * Swap an optimistic (temp) message with the real persisted message.
   * Called when the server echoes back chat.message with temp_id matching
   * the optimistic id we generated locally.
   *
   * If the real message id already exists in the list (duplicate guard),
   * the optimistic bubble is simply removed instead of replaced.
   */
  reconcileOptimistic: (tempId: string, realMessage: Message) => void;
  setLoading: (loading: boolean) => void;
  setTyping: (typing: boolean) => void;
  /** Mark a single message as read — updates is_read in the messages array */
  markMessageRead: (messageId: string, readAt?: string) => void;
  /** Mark all messages in a conversation as read (chat.read_all WS event) */
  markAllRead: (conversationId: string) => void;
  /** Update unread_count for a specific conversation */
  setConversationUnread: (conversationId: string, count: number) => void;
  /** Recompute totalUnread from all conversations */
  recomputeTotalUnread: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoading: false,
  isTyping: false,
  totalUnread: 0,

  setConversations: (conversations) =>
    set((state) => {
      const next = typeof conversations === 'function' ? conversations(state.conversations) : conversations;
      const totalUnread = next.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
      return { conversations: next, totalUnread };
    }),

  setActiveConversation: (activeConversation) => set({ activeConversation }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) =>
      state.messages.some((m) => m.id === message.id)
        ? state
        : { messages: [...state.messages, message] }
    ),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),

  reconcileOptimistic: (tempId, realMessage) =>
    set((state) => {
      // If the real message is already in the list (e.g. arrived via WS before
      // reconcile was called), just remove the optimistic bubble.
      const alreadyExists = state.messages.some((m) => m.id === realMessage.id);
      if (alreadyExists) {
        return { messages: state.messages.filter((m) => m.id !== tempId) };
      }
      // Replace the optimistic bubble with the confirmed message
      return {
        messages: state.messages.map((m) =>
          m.id === tempId ? realMessage : m
        ),
      };
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setTyping:  (isTyping) => set({ isTyping }),

  markMessageRead: (messageId, readAt) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, isRead: true, readAt: readAt ?? m.readAt } : m
      ),
    })),

  markAllRead: (conversationId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        // Only mark messages that belong to this conversation and are unread
        String(m.conversationId) === String(conversationId) && !m.isRead
          ? { ...m, isRead: true }
          : m
      ),
      // Zero out unread count for this conversation
      conversations: state.conversations.map((c) =>
        String(c.id) === String(conversationId) ? { ...c, unreadCount: 0 } : c
      ),
    })),

  setConversationUnread: (conversationId, count) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        String(c.id) === String(conversationId) ? { ...c, unreadCount: count } : c
      );
      const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
      return { conversations, totalUnread };
    }),

  recomputeTotalUnread: () =>
    set((state) => ({
      totalUnread: state.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    })),
}));

// UI Store
interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileMenuOpen: false,
      theme: 'light',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleMobileMenu: () =>
        set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
      setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
);
