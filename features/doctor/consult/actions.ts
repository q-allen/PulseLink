import { MedicalCertificate, Prescription, LabResult } from '@/types';
import { appointmentService } from '@/services/appointmentService';
import { medicalRecordsService } from '@/services/medicalRecordsService';

interface SendPrescriptionInput {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  medications: string;
  instructions: string;
  followUpDate?: string;
}

interface SendLabInput {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  testName: string;
  notes: string;
}

interface SendCertificateInput {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  purpose: string;
  diagnosis: string;
  restDays: number;
}

export async function endConsult(appointmentId: string, transcript?: string) {
  const res = await appointmentService.completeAppointment(appointmentId, transcript);
  return res.data;
}

export async function sendPrescription(input: SendPrescriptionInput): Promise<Prescription> {
  const share = await appointmentService.shareDocument(input.appointmentId, {
    docType: "prescription",
    diagnosis: input.diagnosis || "General Consultation",
    medications: input.medications,
    instructions: input.instructions || "Take with food. Stay hydrated.",
    followUpDate: input.followUpDate,
  });

  const rxId = share.data.share.documentId;
  const rxRes = await medicalRecordsService.getPrescriptionById(String(rxId));
  if (!rxRes.success) {
    throw new Error(rxRes.error || "Failed to load prescription");
  }
  return rxRes.data;
}

export async function sendLabRequest(input: SendLabInput): Promise<LabResult> {
  const result = await medicalRecordsService.createLabRequest({
    patient_id: input.patientId,
    test_name: input.testName || 'Laboratory Test',
    test_type: 'Lab Request',
    notes: input.notes,
    laboratory: 'PulseLink Partner Lab',
  });
  if (!result.success) {
    throw new Error(result.error || 'Failed to create lab request');
  }
  return result.data;
}

export async function sendMedicalCertificate(input: SendCertificateInput): Promise<MedicalCertificate> {
  const result = await medicalRecordsService.createCertificate({
    patient_id: input.patientId,
    purpose: input.purpose || 'Medical Certificate',
    diagnosis: input.diagnosis || 'General Consultation',
    rest_days: input.restDays || 1,
  });
  if (!result.success) {
    throw new Error(result.error || 'Failed to create medical certificate');
  }
  return result.data;
}

