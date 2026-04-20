import { api, API_ENDPOINTS } from "./api";
import { Prescription, LabResult, MedicalCertificate, Medication, ApiResponse } from "@/types";
import { mapLabResult, mapMedicalCertificate, mapPrescription } from "./mappers";

export const medicalRecordsService = {
  // Prescriptions
  async getPrescriptions(_patientId: string): Promise<ApiResponse<Prescription[]>> {
    const data = await api.get<any[]>(API_ENDPOINTS.PRESCRIPTIONS);
    return { data: data.map(mapPrescription), success: true };
  },

  async getPrescriptionById(id: string): Promise<ApiResponse<Prescription>> {
    const data = await api.get<any>(API_ENDPOINTS.PRESCRIPTION_DETAIL(id));
    return { data: mapPrescription(data), success: true };
  },

  async createPrescription(data: {
    appointment_id?: string;
    patient_id: string;
    diagnosis: string;
    medications: Medication[];
    instructions: string;
    valid_days?: number;
  }): Promise<ApiResponse<Prescription>> {
    const result = await api.post<any>(API_ENDPOINTS.PRESCRIPTIONS, data);
    return { data: mapPrescription(result), success: true, message: "Prescription created" };
  },

  // Lab Results
  async getLabResults(_patientId: string): Promise<ApiResponse<LabResult[]>> {
    const data = await api.get<any[]>(API_ENDPOINTS.LAB_RESULTS);
    return { data: data.map(mapLabResult), success: true };
  },

  async getLabResultById(id: string): Promise<ApiResponse<LabResult>> {
    const data = await api.get<any>(API_ENDPOINTS.LAB_DETAIL(id));
    return { data: mapLabResult(data), success: true };
  },

  async createLabRequest(data: {
    patient_id: string;
    appointment_id?: string;
    test_name: string;
    test_type: string;
    notes?: string;
    laboratory?: string;
  }): Promise<ApiResponse<LabResult>> {
    const result = await api.post<any>(API_ENDPOINTS.LAB_RESULTS, data);
    return { data: mapLabResult(result), success: true, message: "Lab request created" };
  },

  async uploadLabResults(labId: string, file: File, results?: unknown[], notes?: string): Promise<ApiResponse<LabResult>> {
    const form = new FormData();
    form.append("file", file);
    if (results) form.append("results", JSON.stringify(results));
    if (notes)   form.append("notes", notes);
    form.append("status", "completed");
    const result = await api.patchUpload<any>(API_ENDPOINTS.LAB_DETAIL(labId), form);
    return { data: mapLabResult(result), success: true, message: "Lab results uploaded" };
  },

  // Medical Certificates
  async getCertificates(_patientId: string): Promise<ApiResponse<MedicalCertificate[]>> {
    const data = await api.get<any[]>(API_ENDPOINTS.CERTIFICATES);
    return { data: data.map(mapMedicalCertificate), success: true };
  },

  async createCertificate(data: {
    patient_id: string;
    purpose: string;
    diagnosis: string;
    rest_days: number;
  }): Promise<ApiResponse<MedicalCertificate>> {
    const result = await api.post<any>(API_ENDPOINTS.CERTIFICATES, data);
    return { data: mapMedicalCertificate(result), success: true, message: "Medical certificate created" };
  },

  // Certificate Requests
  async getCertificateRequests(): Promise<ApiResponse<any[]>> {
    const data = await api.get<any[]>(API_ENDPOINTS.CERT_REQUESTS);
    return { data, success: true };
  },

  async requestCertificate(data: {
    doctor_id: string;
    appointment_id?: string;
    purpose: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    const result = await api.post<any>(API_ENDPOINTS.CERT_REQUESTS, data);
    return { data: result, success: true, message: "Certificate request submitted" };
  },

  async approveCertificateRequest(id: string, data: {
    diagnosis: string;
    rest_days: number;
    valid_from: string;
    valid_until: string;
  }): Promise<ApiResponse<any>> {
    const result = await api.post<any>(API_ENDPOINTS.CERT_REQUEST_APPROVE(id), data);
    return { data: result, success: true, message: "Certificate approved" };
  },

  async rejectCertificateRequest(id: string): Promise<ApiResponse<any>> {
    const result = await api.post<any>(API_ENDPOINTS.CERT_REQUEST_REJECT(id), {});
    return { data: result, success: true, message: "Certificate request rejected" };
  },
};
