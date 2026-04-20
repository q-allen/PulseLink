import { appointmentService } from "@/services/appointmentService";

export async function startConsult(appointmentId: string) {
  const res = await appointmentService.startConsult(appointmentId);
  return res.data;
}

export async function nextPatient(appointmentId: string) {
  const res = await appointmentService.callNext(appointmentId);
  return res.data;
}

export async function markDone(appointmentId: string, notes?: string) {
  const res = await appointmentService.completeAppointment(appointmentId, notes);
  return res.data;
}
