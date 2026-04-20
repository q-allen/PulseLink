import { getBaseUrl } from "./api";

export type QueueUpdatePayload = {
  type: "queue.update";
  doctor_id: string | number;
  date?: string;
  now_serving?: {
    appointment_id?: number | null;
    patient_name?: string | null;
    queue_number?: number | null;
    status?: string | null;
  } | null;
  waiting?: {
    appointment_id: number;
    patient_name: string;
    queue_number?: number | null;
    queue_position?: number | null;
    estimated_wait_minutes?: number | null;
  }[];
};

export function subscribeToDoctorQueue(
  doctorId: string | number,
  onMessage: (payload: QueueUpdatePayload) => void
) {
  const base = getBaseUrl();
  if (!base) return null;
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${url.toString().replace(/\/$/, "")}/ws/queue/doctor/${doctorId}/`);
  ws.onmessage = (e) => {
    try {
      const payload = JSON.parse(e.data);
      if (payload.type === "queue.update") onMessage(payload);
    } catch {
      // ignore malformed payloads
    }
  };
  return ws;
}
