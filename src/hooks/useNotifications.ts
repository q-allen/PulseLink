"use client";

import { useEffect, useRef } from "react";
import { getBaseUrl, api, API_ENDPOINTS } from "@/services/api";
import { useNotificationStore } from "@/store";
import { useAuthStore } from "@/store";
import { Notification } from "@/types";
import { notificationService } from "@/services/notificationService";
import { useIncomingCallStore } from "@/store/incomingCallStore";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const { addNotification, setNotifications } = useNotificationStore();
  const { setCall } = useIncomingCallStore();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!user) return;

    const base = getBaseUrl();
    if (!base) return;

    const wsBase = base.replace(/^http/, "ws").replace(/\/$/, "");
    shouldReconnectRef.current = true;

    notificationService.getNotifications(String(user.id)).then((res) => {
      if (res.success && res.data) setNotifications(res.data);
    });

    let wsToken = "";
    const connectWithToken = () => {
      const wsUrl = wsToken ? `${wsBase}/ws/notifications/?token=${wsToken}` : `${wsBase}/ws/notifications/`;
      const connect = () => {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => { retryRef.current = 0; };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type !== "notification") return;
            const notif: Notification = {
              id:        String(payload.id),
              userId:    user.id,
              type:      payload.notif_type,
              title:     payload.title,
              message:   payload.message,
              isRead:    false,
              data:      payload.data ?? {},
              createdAt: payload.created_at,
            };
            addNotification(notif);

            const data = payload.data ?? {};
            if (
              payload.notif_type === "appointment" &&
              data.room_name &&
              data.appointment_id
            ) {
              const match = (payload.message as string)?.match(/^(Dr\.\s[^\s]+(?:\s[^\s]+)?)/);
              const doctorName = match ? match[1] : "Your Doctor";
              setCall({
                appointmentId: String(data.appointment_id),
                doctorName,
                doctorSpecialty: "",
                doctorAvatar:  undefined,
              });
            }
          } catch {
            // ignore malformed frames
          }
        };

        ws.onclose = (event) => {
          if (shouldReconnectRef.current && retryRef.current < 5 && event.code !== 1000 && event.code !== 1001 && event.code !== 4001) {
            const delay = Math.min(30000, 1000 * 2 ** retryRef.current);
            retryRef.current += 1;
            reconnectTimerRef.current = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => { ws.close(); };
      };
      connect();
    };

    // Fetch a short-lived token for cross-origin WS auth, fall back to cookie-only
    api.get<{ token: string }>(API_ENDPOINTS.WS_TOKEN)
      .then((res) => { wsToken = res.token ?? ""; })
      .catch(() => {})
      .finally(() => connectWithToken());

    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
