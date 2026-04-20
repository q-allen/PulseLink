import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Prescription, LabResult, MedicalCertificate } from '@/types';

export type FileCategory = 'all' | 'prescriptions' | 'lab-results' | 'certificates' | 'other';

export interface MedicalFile {
  id: string;
  type: 'prescription' | 'lab-result' | 'certificate' | 'other';
  title: string;
  description: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar?: string;
  date: string;
  appointmentId?: string;
  isNew?: boolean; // auto-added after consultation
  // linked data
  prescriptionId?: string;
  labResultId?: string;
  certificateId?: string;
}

interface RecordsState {
  prescriptions: Prescription[];
  labResults: LabResult[];
  certificates: MedicalCertificate[];
  recentlyAdded: string[]; // file IDs added after consult
  setPrescriptions: (rx: Prescription[]) => void;
  setLabResults: (labs: LabResult[]) => void;
  setCertificates: (certs: MedicalCertificate[]) => void;
  addPrescriptionFromConsult: (rx: Prescription) => void;
  addLabResultFromConsult: (lab: LabResult) => void;
  addCertificateFromConsult: (cert: MedicalCertificate) => void;
  clearRecentlyAdded: () => void;
}

export const useRecordsStore = create<RecordsState>()(
  persist(
    (set) => ({
      prescriptions: [],
      labResults: [],
      certificates: [],
      recentlyAdded: [],
      setPrescriptions: (prescriptions) => set({ prescriptions }),
      setLabResults: (labResults) => set({ labResults }),
      setCertificates: (certificates) => set({ certificates }),
      addPrescriptionFromConsult: (rx) =>
        set((state) => ({
          prescriptions: [rx, ...state.prescriptions],
          recentlyAdded: [rx.id, ...state.recentlyAdded],
        })),
      addLabResultFromConsult: (lab) =>
        set((state) => ({
          labResults: [lab, ...state.labResults],
          recentlyAdded: [lab.id, ...state.recentlyAdded],
        })),
      addCertificateFromConsult: (cert) =>
        set((state) => ({
          certificates: [cert, ...state.certificates],
          recentlyAdded: [cert.id, ...state.recentlyAdded],
        })),
      clearRecentlyAdded: () => set({ recentlyAdded: [] }),
    }),
    { name: 'records-storage' }
  )
);
