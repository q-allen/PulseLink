import { create } from 'zustand';
import { Doctor, ConsultationType, FamilyMember, TimeSlot } from '@/types';

export interface PatientDetails {
  // PulseLink Account section (pre-filled, read-only)
  accountEmail: string;
  // Reason for consultation
  reasonForConsultation: string;
  // Patient Profile section
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  sex: 'male' | 'female' | 'other' | '';
  homeAddress: string;
  // Legacy / computed fields kept for backward compat with booking flow
  fullName: string;   // computed: firstName + middleName + lastName
  age: string;        // computed from dateOfBirth
  gender: 'male' | 'female' | 'other' | '';  // alias for sex
  contactNumber: string;
  symptoms: string;   // alias for reasonForConsultation
  isForSelf: boolean;
  familyMemberId?: number | null;
  bookedForRelationship: 'self' | 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  // Booked-for-other fields (simplified)
  bookedForName?: string;
  bookedForAge?: number | null;
  bookedForGender?: 'male' | 'female' | 'other' | '';
  bookedForEmail?: string;
}

export interface BookingState {
  // Step 1: Schedule
  selectedDoctor: Doctor | null;
  consultationType: ConsultationType | null;
  selectedDate: string;
  selectedTimeSlot: TimeSlot | null;
  consultationFee: number;
  
  // Step 2: Patient Details
  patientDetails: PatientDetails;
  isExistingPatient: boolean;
  
  // Step 3: Payment
  paymentMethod: 'gcash' | 'bank' | null;
  paymentStatus: 'idle' | 'processing' | 'awaiting_payment' | 'success' | 'failed';
  transactionId: string | null;
  checkoutId: string | null;
  checkoutUrl: string | null;
  
  // Flow control
  currentStep: number;
  isComplete: boolean;
  appointmentId: string | null;
  
  // Actions
  setDoctor: (doctor: Doctor) => void;
  setConsultationType: (type: ConsultationType) => void;
  setSchedule: (date: string, slot: TimeSlot, fee: number) => void;
  setPatientDetails: (details: Partial<PatientDetails>) => void;
  setIsExistingPatient: (isExisting: boolean) => void;
  setPaymentMethod: (method: 'gcash' | 'bank') => void;
  setPaymentStatus: (status: 'idle' | 'processing' | 'awaiting_payment' | 'success' | 'failed') => void;
  setTransactionId: (id: string) => void;
  setCheckout: (payload: { checkoutId: string; checkoutUrl: string }) => void;
  clearCheckout: () => void;
  setAppointmentId: (id: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeBooking: () => void;
  resetBooking: () => void;
}

const initialPatientDetails: PatientDetails = {
  accountEmail: '',
  reasonForConsultation: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  email: '',
  sex: '',
  homeAddress: '',
  fullName: '',
  age: '',
  gender: '',
  contactNumber: '',
  symptoms: '',
  isForSelf: true,
  familyMemberId: null,
  bookedForRelationship: 'self',
  bookedForName: '',
  bookedForAge: null,
  bookedForGender: '',
  bookedForEmail: '',
};

export const useBookingStore = create<BookingState>((set) => ({
  // Initial state
  selectedDoctor: null,
  consultationType: null,
  selectedDate: '',
  selectedTimeSlot: null,
  consultationFee: 0,
  patientDetails: initialPatientDetails,
  isExistingPatient: false,
  paymentMethod: null,
  paymentStatus: 'idle',
  transactionId: null,
  checkoutId: null,
  checkoutUrl: null,
  currentStep: 1,
  isComplete: false,
  appointmentId: null,

  // Actions
  setDoctor: (doctor) => set({ 
    selectedDoctor: doctor,
    consultationFee: doctor.consultationFee,
  }),
  
  setConsultationType: (type) => set((state) => ({ 
    consultationType: type,
    consultationFee: type === 'online' 
      ? state.selectedDoctor?.onlineConsultationFee || 0
      : state.selectedDoctor?.consultationFee || 0,
  })),
  
  setSchedule: (date, slot, fee) => set({ 
    selectedDate: date,
    selectedTimeSlot: slot,
    consultationFee: fee,
  }),
  
  setPatientDetails: (details) => set((state) => ({ 
    patientDetails: { ...state.patientDetails, ...details },
  })),
  
  setIsExistingPatient: (isExisting) => set({ isExistingPatient: isExisting }),
  
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  
  setPaymentStatus: (status) => set({ paymentStatus: status }),
  
  setTransactionId: (id) => set({ transactionId: id }),

  setCheckout: ({ checkoutId, checkoutUrl }) => set({ checkoutId, checkoutUrl }),

  clearCheckout: () => set({ checkoutId: null, checkoutUrl: null }),
  
  setAppointmentId: (id) => set({ appointmentId: id }),
  
  nextStep: () => set((state) => ({ 
    currentStep: Math.min(state.currentStep + 1, 4),
  })),
  
  prevStep: () => set((state) => ({ 
    currentStep: Math.max(state.currentStep - 1, 1),
  })),
  
  goToStep: (step) => set({ currentStep: step }),
  
  completeBooking: () => set({ isComplete: true }),
  
  resetBooking: () => set({
    selectedDoctor: null,
    consultationType: null,
    selectedDate: '',
    selectedTimeSlot: null,
    consultationFee: 0,
    patientDetails: initialPatientDetails,
    isExistingPatient: false,
    paymentMethod: null,
    paymentStatus: 'idle',
    transactionId: null,
    checkoutId: null,
    checkoutUrl: null,
    currentStep: 1,
    isComplete: false,
    appointmentId: null,
  }),
}));

