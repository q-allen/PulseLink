import { create } from "zustand";

interface IncomingCall {
  appointmentId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar?: string;
}

interface IncomingCallState {
  call: IncomingCall | null;
  setCall: (call: IncomingCall) => void;
  clearCall: () => void;
}

export const useIncomingCallStore = create<IncomingCallState>((set) => ({
  call: null,
  setCall: (call) => set({ call }),
  clearCall: () => set({ call: null }),
}));
