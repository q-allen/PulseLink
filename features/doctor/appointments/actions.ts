import { appointmentService } from "@/services/appointmentService";

export async function acceptAppointment(appointmentId: string) {
  const res = await appointmentService.acceptAppointment(appointmentId);
  return res.data;
}

export async function declineAppointment(appointmentId: string, reason?: string) {
  const res = await appointmentService.rejectAppointment(appointmentId, reason);
  return res.data;
}

export async function startVideo(appointmentId: string) {
  const res = await appointmentService.startVideoConsult(appointmentId);
  return res.data;
}

export async function markComplete(appointmentId: string, notes?: string) {
  const res = await appointmentService.completeAppointment(appointmentId, notes);
  return res.data;
}
