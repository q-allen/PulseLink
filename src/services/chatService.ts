/**
 * chatService.ts
 *
 * REST client for NowServing-style 1:1 chat.
 * WebSocket real-time events are handled in ChatWindow.tsx.
 *
 * Architecture:
 *   TEXT messages  → WebSocket (instant, <100ms round-trip)
 *   FILE messages  → REST POST (multipart/form-data, then WS broadcast)
 *   READ receipts  → WebSocket primary, REST fallback
 *
 * Optimistic send flow (text messages):
 *   1. createOptimisticMessage() builds a local Message with a temp UUID id
 *   2. ChatWindow adds it to the store immediately (input clears at this point)
 *   3. WS send fires — backend persists and broadcasts to both sides
 *   4. Both sides receive chat.message with the real DB id + temp_id
 *   5. reconcileOptimistic() in the store swaps the temp bubble for the real one
 *   6. On WS error → rollback removes the temp bubble and shows a toast
 */

import { api, API_ENDPOINTS } from "./api";
import { Conversation, Message, ApiResponse } from "@/types";
import { mapConversation, mapMessage } from "./mappers";

/** Prefix used to identify optimistic (not-yet-confirmed) message IDs. */
export const OPTIMISTIC_PREFIX = "optimistic_";

/**
 * Build a local optimistic Message object before the WS round-trip completes.
 * The id uses a UUID-style temp key so the store can identify and replace it.
 */
export function createOptimisticMessage(
  conversationId: string,
  senderId: string,
  senderRole: "patient" | "doctor" | "admin",
  content: string,
  type: Message["type"] = "text",
): Message {
  const tempId = `${OPTIMISTIC_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id:             tempId,
    conversationId,
    senderId,
    senderRole,
    content,
    type,
    isRead:         false,
    readAt:         null,
    // Use current time so the bubble appears in the right position
    timestamp:      new Date().toISOString(),
  };
}

export const chatService = {
  async getConversations(_userId: string): Promise<ApiResponse<Conversation[]>> {
    try {
      const data = await api.get<any[]>(API_ENDPOINTS.CONVERSATIONS);
      const mapped = data.map(mapConversation).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      return { data: mapped, success: true };
    } catch {
      return { data: [], success: false, message: 'Backend unavailable' };
    }
  },

  async getConversationById(conversationId: string): Promise<ApiResponse<Conversation>> {
    const all  = await api.get<any[]>(API_ENDPOINTS.CONVERSATIONS);
    const conv = all.map(mapConversation).find((c) => String(c.id) === String(conversationId));
    if (!conv) throw new Error("Conversation not found");
    return { data: conv, success: true };
  },

  /**
   * Fetch messages — limited to 50 most recent.
   * Pass beforeId to paginate older messages (infinite scroll upward).
   * GET /chat/<convId>/messages/?before=<beforeId>
   */
  async getMessages(
    conversationId: string,
    beforeId?: string | number
  ): Promise<ApiResponse<Message[]>> {
    try {
      const query = beforeId ? `?before=${beforeId}` : "";
      const data  = await api.get<any[]>(`${API_ENDPOINTS.MESSAGES(conversationId)}${query}`);
      return {
        data: data.map((m) => mapMessage(m, { conversationId })),
        success: true,
      };
    } catch {
      return { data: [], success: false, message: 'Backend unavailable' };
    }
  },

  /**
   * Send a message via REST.
   *
   * TEXT messages should go over WebSocket for instant delivery.
   * This REST path is the fallback for:
   *   - File/image uploads (multipart)
   *   - WS not connected (background tab, reconnecting)
   *
   * The caller is responsible for clearing the input BEFORE calling this
   * (optimistic clear pattern) and rolling back on error.
   *
   * tempId (optional) is included for forward compatibility so the backend
   * can echo it back when it supports REST-based optimistic reconciliation.
   */
  async sendMessage(
    conversationId: string,
    _senderId: string,
    _senderRole: string,
    content: string,
    type: "text" | "image" | "file" | "prescription" = "text",
    file?: File,
    tempId?: string
  ): Promise<ApiResponse<Message>> {
    let result: Message;
    if (file) {
      const form = new FormData();
      form.append("content", content);
      form.append("type", type);
      if (tempId) form.append("temp_id", tempId);
      form.append("file", file);
      const res = await api.upload<any>(API_ENDPOINTS.MESSAGES(conversationId), form);
      result = mapMessage(res, { conversationId });
    } else {
      const payload: Record<string, unknown> = { content, type };
      if (tempId) payload.temp_id = tempId;
      const res = await api.post<any>(API_ENDPOINTS.MESSAGES(conversationId), payload);
      result = mapMessage(res, { conversationId });
    }
    return { data: result, success: true, message: "Message sent" };
  },

  /**
   * Start or retrieve a 1:1 conversation between a patient and a doctor.
   *
   * NowServing alignment: both roles can initiate.
   * - Patient calls this → sends { doctor_id } to the backend.
   * - Doctor calls this  → sends { patient_id } to the backend.
   *
   * The backend uses get_or_create so duplicate conversations are never created.
   * We also do a local GET-first check to avoid an unnecessary POST round-trip
   * when the conversation already exists in the user's list.
   *
   * @param patientId  ID of the patient participant
   * @param doctorId   ID of the doctor participant
   * @param callerRole Role of the user making this call ('patient' | 'doctor').
   *                   Defaults to 'patient' for backward compatibility.
   */
  async createConversation(
    patientId: string,
    doctorId: string,
    callerRole: 'patient' | 'doctor' | 'admin' = 'patient',
  ): Promise<ApiResponse<Conversation>> {
    // 1. Check local conversation list first — avoids a redundant POST
    try {
      const all = await api.get<any[]>(API_ENDPOINTS.CONVERSATIONS);
      const existing = all
        .map(mapConversation)
        .find(
          (c) =>
            String(c.patientId) === String(patientId) &&
            String(c.doctorId)  === String(doctorId),
        );
      if (existing) return { data: existing, success: true };
    } catch {
      // GET failed (network, auth) — fall through and let POST handle it
    }

    // 2. POST to create (or get_or_create on the backend)
    //    Backend expects the *other* party's ID, keyed by the caller's role.
    const body =
      callerRole === 'doctor'
        ? { patient_id: Number(patientId) }   // doctor initiates → send patient_id
        : { doctor_id:  Number(doctorId)  };  // patient/admin initiates → send doctor_id

    const data = await api.post<any>(API_ENDPOINTS.CONVERSATIONS, body);
    return { data: mapConversation(data), success: true };
  },

  /**
   * Mark a single message as read via REST.
   * Primary path is WS { type: "chat.read", message_id: X }.
   * This is the fallback when WS is not connected.
   */
  async markMessageRead(messageId: string | number): Promise<ApiResponse<void>> {
    try {
      await api.post(API_ENDPOINTS.MESSAGE_READ(messageId), {});
    } catch (err) {
      // Non-critical — WS mark_read is the primary path
    }
    return { data: undefined, success: true };
  },

  /**
   * Mark all messages in a conversation as read (REST fallback).
   * Primary path is WS { type: "chat.read_all" }.
   */
  async markAsRead(conversationId: string, _userId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/api/chat/${conversationId}/read_all/`, {});
    } catch (err) {
      // Ignore — best effort, WS chat.read_all is the primary path
    }
    return { data: undefined, success: true };
  },

  /** Total unread count across all conversations — used for the sidebar badge. */
  async getTotalUnread(_userId: string): Promise<ApiResponse<number>> {
    const all   = await api.get<any[]>(API_ENDPOINTS.CONVERSATIONS);
    const count = all.reduce((sum, c) => sum + (c?.unread_count ?? 0), 0);
    return { data: count, success: true };
  },

  // Kept for backward compat
  async getUnreadCount(userId: string): Promise<ApiResponse<number>> {
    return this.getTotalUnread(userId);
  },
};
