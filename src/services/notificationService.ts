import { api, API_ENDPOINTS } from "./api";
import { Notification, NotificationType, ApiResponse } from "@/types";
import { mapNotification } from "./mappers";

export const notificationService = {
  async getNotifications(_userId: string): Promise<ApiResponse<Notification[]>> {
    const data = await api.get<Record<string, unknown>[]>(API_ENDPOINTS.NOTIFICATIONS);
    return { data: data.map(mapNotification), success: true };
  },

  async markAsRead(notificationId: string): Promise<ApiResponse<void>> {
    await api.post(API_ENDPOINTS.NOTIFICATION_READ(notificationId), {});
    return { data: undefined, success: true };
  },

  async markAllAsRead(_userId: string): Promise<ApiResponse<void>> {
    await api.post(API_ENDPOINTS.NOTIFICATIONS_READ_ALL, {});
    return { data: undefined, success: true };
  },

  async getUnreadCount(_userId: string): Promise<ApiResponse<number>> {
    const res = await api.get<{ unread_count: number }>(API_ENDPOINTS.NOTIFICATIONS_UNREAD);
    return { data: res.unread_count, success: true };
  },

  // kept for compatibility — notifications are created server-side
  async createNotification(_data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<ApiResponse<Notification>> {
    return { data: null as unknown as Notification, success: false, error: "Use server-side notification creation." };
  },

  async deleteNotification(notificationId: string): Promise<ApiResponse<void>> {
    await api.delete(API_ENDPOINTS.NOTIFICATION_DELETE(notificationId));
    return { data: undefined, success: true };
  },
};
