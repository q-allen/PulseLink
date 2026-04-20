"use server";

import { medicalRecordsService } from "@/services/medicalRecordsService";
import { Medication } from "@/types";

interface IssuePrescriptionInput {
  appointmentId?: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  medications: string | Medication[];
  instructions: string;
}

export async function issuePrescription(input: IssuePrescriptionInput) {
  const medications: Medication[] = Array.isArray(input.medications)
    ? input.medications
    : input.medications
        .split("\n")
        .filter(Boolean)
        .map((line) => ({
          name: line.split("-")[0]?.trim() || line.trim(),
          dosage: line.split("-")[1]?.trim() || "500mg",
          frequency: line.split("-")[2]?.trim() || "Once daily",
          duration: line.split("-")[3]?.trim() || "7 days",
        }));

  const res = await medicalRecordsService.createPrescription({
    appointment_id: input.appointmentId || undefined,
    patient_id: input.patientId,
    diagnosis: input.diagnosis || "General Consultation",
    medications,
    instructions: input.instructions || "Take with food. Stay hydrated.",
  });

  if (!res.success) throw new Error("Failed to issue prescription");
  return res.data;
}

export async function getDoctorPrescriptions(doctorId: string) {
  const res = await medicalRecordsService.getPrescriptions(doctorId);
  if (!res.success) return [];
  return res.data;
}
