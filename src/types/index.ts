// User Types
export type UserRole = 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  birthdate?: string;
  gender?: string;
  bloodType?: string;
  allergies?: string[];
  address?: string;
  /** True once the patient/doctor finishes the onboarding wizard */
  isProfileComplete?: boolean;
  /** For doctors: wizard completion lives on DoctorProfile */
  doctorProfileComplete?: boolean;
  createdAt: string;
}

export interface Patient extends User {
  role: 'patient';
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: string;
  hmoProvider?: string;
  hmoNumber?: string;
  walletBalance?: number;
}

export interface Doctor extends User {
  role: 'doctor';
  userId?: string;
  specialty: string;
  specialties: string[];
  hospital: string;
  location: string;
  experience: number;
  consultationFee: number;
  onlineConsultationFee: number;
  rating: number;
  reviewCount: number;
  bio: string;
  education: string[];
  languages: string[];
  isVerified: boolean;
  /**
   * isBookable — true when the doctor is verified and accepts scheduled
   * appointments (online or in-clinic). Maps to backend `is_verified`.
   * A doctor can be bookable even when they are completely offline.
   */
  isBookable: boolean;
  /** true when the doctor has an online consultation fee set (accepts video bookings) */
  acceptsOnline: boolean;
  /** true when the doctor has an in-clinic fee set (accepts walk-in / scheduled clinic bookings) */
  acceptsInClinic: boolean;
  /**
   * isInstantAvailable — true ONLY when the doctor has on-demand mode
   * enabled AND has pinged the backend within the last ~10-15 minutes
   * (backend field: `is_available_now`). This is the NowServing
   * "Available Now" / "Consult Now" gate.
   */
  isInstantAvailable: boolean;
  /** @deprecated use isInstantAvailable — kept for backward compat */
  isAvailable: boolean;
  isOnDemand?: boolean;
  availableSlots: TimeSlot[];
  hmoAccepted?: string[];
  services?: string[];
  clinicAddress?: string;
  clinicLat?: number;
  clinicLng?: number;
  weeklySchedule?: Record<string, { start: string; end: string; consultation_types?: "online" | "in_clinic" | "both" }>;
  signature?: string;
}

// Family Member (NowServing pattern: one account books for the whole family)
export type FamilyMemberRelationship = 'spouse' | 'child' | 'parent' | 'sibling' | 'other';

export interface FamilyMember {
  id: number;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  relationship: FamilyMemberRelationship;
  birthdate?: string | null;
}

// Appointment Types
export type AppointmentStatus = 'pending' | 'confirmed' | 'in-progress' | 'in_progress' | 'completed' | 'cancelled' | 'no-show' | 'no_show';
export type ConsultationType = 'online' | 'in-clinic' | 'on_demand';

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface ClinicInfo {
  clinic_name: string;
  clinic_address: string;
  city: string;
  maps_url: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  doctorProfileId?: string;
  patient?: Patient;
  doctor?: Doctor;
  date: string;
  time: string;
  type: ConsultationType;
  status: AppointmentStatus;
  queueNumber?: number;
  queuePosition?: number;
  paymentStatus?: 'paid' | 'awaiting' | 'pending' | 'refunded';
  /** NowServing alignment: human-readable payment context from the backend */
  paymentDisplayNote?: {
    patient: string;
    doctor: string;
    badge: 'paid' | 'refunded' | 'awaiting' | 'pending';
    color: 'success' | 'warning' | 'muted';
  } | null;
  /** PayMongo payment ID stored after successful checkout */
  paymongoPaymentId?: string;
  symptoms?: string;
  notes?: string;
  fee?: number;
  hmoUsed?: boolean;
  estimatedWaitMinutes?: number;
  videoRoomUrl?: string;
  videoPassword?: string;
  videoStartedAt?: string;
  videoEndedAt?: string;
  consultTranscript?: string;
  consultNotes?: string;
  consultSummary?: string;
  clinicInfo?: ClinicInfo;
  sharedDocuments?: SharedDocument[];
  // booked-for-other (NowServing pattern)
  bookedForName?: string;
  bookedForAge?: number | null;
  bookedForGender?: 'male' | 'female' | 'other' | '';
  bookedForRelationship?: 'self' | 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  familyMember?: number | null;
  /** Review left by the patient after completion (NowServing pattern) */
  review?: Review | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharedDocument {
  id: number;
  docType: "prescription" | "certificate" | "lab";
  documentId: number;
  title?: string;
  summary?: string;
  createdAt?: string;
  createdBy?: string;
}

// Medical Records
export interface Prescription {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  doctor?: Doctor;
  date: string;
  diagnosis: string;
  medications: Medication[];
  instructions: string;
  validUntil: string;
  isDigital: boolean;
  pdfUrl?: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface LabResult {
  id: string;
  patientId: string;
  doctorId: string;
  doctor?: Doctor;
  appointmentId?: string;
  testName: string;
  testType: string;
  date: string;
  status: 'pending' | 'processing' | 'completed';
  results?: LabResultItem[];
  notes?: string;
  fileUrl?: string;
  laboratory?: string;
}

export interface LabResultItem {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'low' | 'high';
}

export interface MedicalCertificate {
  id: string;
  patientId: string;
  doctorId: string;
  doctor?: Doctor;
  date: string;
  purpose: string;
  diagnosis: string;
  restDays: number;
  validFrom: string;
  validUntil: string;
  pdfUrl?: string;
}

// Chat Types
export interface Conversation {
  id: string;
  participants: string[];
  patientId: string;
  doctorId: string;
  patient?: Patient;
  doctor?: Doctor;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  type: 'text' | 'image' | 'file' | 'prescription' | 'system';
  isRead: boolean;
  /** ISO timestamp when the receiver read this message — drives ✓✓ display */
  readAt?: string | null;
  timestamp: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
}

// Notification Types
export type NotificationType = 'appointment' | 'queue' | 'message' | 'prescription' | 'lab-result' | 'system' | 'pharmacy';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

// Review Types
export interface Review {
  id: string;
  doctorId: string;
  patientId: string;
  patient?: Patient;
  appointmentId: string;
  rating: number;
  comment: string;
  createdAt: string;
  /** Doctor's public reply to this review (NowServing pattern) */
  doctorReply?: string | null;
  replyAt?: string | null;
}

// Medicine/Pharmacy Types
export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  price: number;
  description: string;
  dosageForm: string;
  manufacturer: string;
  requiresPrescription: boolean;
  inStock: boolean;
  quantity: number;
  image?: string;
  pharmacyPartner?: string;
}

export interface OrderItem {
  medicine: Medicine;
  quantity: number;
}

export interface Order {
  id: string;
  patientId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryAddress: string;
  prescriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

// Admin Type
export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'admin';
  phone?: string;
  department?: string;
  permissions: string[];
  createdAt: string;
}

// Analytics Types
export interface AnalyticsData {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  totalRevenue: number;
  appointmentsByStatus: Record<string, number>;
  appointmentsByType: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  topDoctors: Doctor[];
  patientGrowth: { month: string; count: number }[];
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
