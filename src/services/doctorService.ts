import { api, API_ENDPOINTS, ApiError } from "./api";
import { Doctor, Patient, ApiResponse, PaginatedResponse } from "@/types";
import { mapDoctorFromDetail, mapDoctorFromList } from "./mappers";

export interface DoctorProfileCompletionData {
  profile_photo?: File;
  signature?: File;
  prc_card_image?: File;
  face_front?: File;
  face_left?: File;
  face_right?: File;
  is_face_verified?: boolean;
  bio?: string;
  languages_spoken?: string[];
  clinic_name?: string;
  clinic_address?: string;
  city?: string;
  consultation_fee_online?: number;
  consultation_fee_in_person?: number;
  weekly_schedule?: Record<string, { start: string; end: string; consultation_types?: string }>;
  is_on_demand?: boolean;
  specialty?: string;
  sub_specialties?: string[];
  years_of_experience?: number;
  is_profile_complete?: boolean;
  services?: string[];
  hmos?: string[];
}

export interface DoctorProfileCompletionResponse {
  is_profile_complete: boolean;
  specialty: string;
  clinic_name: string;
  city: string;
  consultation_fee_online: string;
  consultation_fee_in_person: string;
  is_on_demand: boolean;
  signature: string | null;
  prc_card_image: string | null;
  face_front: string | null;
  face_left: string | null;
  face_right: string | null;
  is_face_verified: boolean;
  face_verification_status?: string;
  face_verification_error?: string;
}

export interface DoctorLivenessSessionResponse {
  session_id: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
  };
}

export interface DoctorLivenessCompleteResponse extends DoctorProfileCompletionResponse {
  session_id: string;
}

export interface DoctorSlot {
  time: string;       // "HH:MM" slot start
  end_time: string;   // "HH:MM" slot end
  is_available: boolean;
  is_booked: boolean;
  slot_id: number | null;
}

export interface DoctorSlotsResponse {
  doctor_id: number;
  doctor_name: string;
  is_on_demand: boolean;
  is_available_now: boolean;
  date: string;
  slots: DoctorSlot[];
}

export interface DoctorSearchFilters {
  specialty?: string;
  name?: string;
  clinic?: string;
  location?: string;
  maxFee?: number;
  isAvailable?: boolean;
}

export interface DoctorEarnings {
  consultsToday: number;
  consultsWeek: number;
  revenueToday: number;
  revenueWeek: number;
  pendingPayouts: number;
  pendingAmount: number;
}

// ── Payout types ──────────────────────────────────────────────────────────────

export type PayoutStatus = "pending" | "approved" | "rejected" | "paid";
export type PayoutMethod = "gcash" | "bank_transfer" | "maya" | "other";

export interface Payout {
  id: number;
  doctor: number;
  doctor_name: string;
  amount: string;          // Decimal comes as string from DRF
  method: PayoutMethod;
  account_name: string;
  account_number: string;
  bank_name: string;
  status: PayoutStatus;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string;
  payout_reference: string;
  admin_notes: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface EarningsSummary {
  total_gross: string;
  total_commission: string;
  total_earnings: string;
  available_earnings: string;
  paid_out: string;
  pending_payout: string;
  completed_count: number;
  commission_rate: string;
  week_earnings: string;
  week_commission: string;
  week_consults: number;
  today_earnings: string;
  today_commission: string;
  today_consults: number;
  breakdown: EarningsBreakdownItem[];
}

export interface EarningsBreakdownItem {
  id: number;
  date: string;
  type: string;
  fee: string;
  platform_commission: string;
  doctor_earnings: string;
  payment_status: string;
}

export interface PayoutRequestPayload {
  amount: string;
  method: PayoutMethod;
  account_name: string;
  account_number: string;
  bank_name?: string;
  period_start?: string;
  period_end?: string;
}

export const doctorService = {
  async getDoctors(
    filters?: DoctorSearchFilters,
    _page = 1,
    _limit = 10
  ): Promise<PaginatedResponse<Doctor>> {
    if (filters?.isAvailable) {
      const data = await api.get<Record<string, unknown>[]>(API_ENDPOINTS.DOCTOR_AVAILABLE);
      const mapped = data.map(mapDoctorFromList);
      return { data: mapped, success: true, page: 1, limit: mapped.length, total: mapped.length, totalPages: 1 };
    }
    const params = new URLSearchParams();
    if (filters?.specialty) params.set("specialty", filters.specialty);
    if (filters?.name) params.set("search", filters.name);
    if (filters?.clinic) params.set("hospital", filters.clinic);
    if (filters?.location) params.set("city", filters.location);
    if (filters?.maxFee) {
      params.set("fee_online_lte", String(filters.maxFee));
      params.set("fee_inperson_lte", String(filters.maxFee));
    }
    const query = params.toString() ? `?${params}` : "";
    try {
      const data = await api.get<Record<string, unknown>[]>(`${API_ENDPOINTS.DOCTORS}${query}`);
      const mapped = data.map(mapDoctorFromList);
      return { data: mapped, success: true, page: 1, limit: mapped.length, total: mapped.length, totalPages: 1 };
    } catch {
      return { data: [], success: false, page: 1, limit: 0, total: 0, totalPages: 1 };
    }
  },

  async getDoctorById(id: string): Promise<ApiResponse<Doctor>> {
    try {
      const data = await api.get<Record<string, unknown>>(API_ENDPOINTS.DOCTOR_DETAIL(id));
      return { data: mapDoctorFromDetail(data), success: true };
    } catch {
      return { data: null as unknown as Doctor, success: false };
    }
  },

  async getTopDoctors(limit = 5): Promise<ApiResponse<Doctor[]>> {
    const res = await this.getDoctors(undefined, 1, limit);
    return { data: res.data.slice(0, limit), success: true };
  },

  async getDoctorsBySpecialty(specialty: string): Promise<ApiResponse<Doctor[]>> {
    const res = await this.getDoctors({ specialty });
    return { data: res.data, success: true };
  },

  /**
   * Fetch 30-min availability slots for a doctor on a specific date.
   * Calls GET /appointments/slots/<doctorId>?date=YYYY-MM-DD
   * Priority: explicit DoctorAvailableSlot rows > weekly_schedule auto-gen.
   * Booked slots have is_available=false and is_booked=true.
   */
  async getDoctorSlots(doctorId: string, date: string): Promise<ApiResponse<DoctorSlotsResponse>> {
    try {
      const data = await api.get<DoctorSlotsResponse>(
        `${API_ENDPOINTS.APPOINTMENT_SLOTS(doctorId)}?date=${date}`
      );
      return { data, success: true };
    } catch {
      return { data: null as unknown as DoctorSlotsResponse, success: false };
    }
  },

  async updateOnDemand(id: string, isOnDemand: boolean): Promise<ApiResponse<Doctor>> {
    try {
      const data = await api.patch<Record<string, unknown>>(API_ENDPOINTS.DOCTOR_DETAIL(id), { is_on_demand: isOnDemand });
      return { data: mapDoctorFromDetail(data), success: true };
    } catch (error) {
      // If caller passed a user id instead of profile id, resolve via list
      if (error instanceof ApiError && error.status === 404) {
        try {
          const list = await api.get<Record<string, unknown>[]>(API_ENDPOINTS.DOCTORS);
          const match = list.find((d) => String(d.user_id) === String(id));
          if (match) {
            const matchId = String(match.id);
            const data = await api.patch<Record<string, unknown>>(API_ENDPOINTS.DOCTOR_DETAIL(matchId), { is_on_demand: isOnDemand });
            return { data: mapDoctorFromDetail(data), success: true };
          }
        } catch {
          // fall through
        }
      }
      return { data: null as unknown as Doctor, success: false };
    }
  },

  async getMyPatients(): Promise<ApiResponse<Patient[]>> {
    try {
      const data = await api.get<Record<string, unknown>[]>(API_ENDPOINTS.DOCTOR_MY_PATIENTS);
      const { mapPatientFromDetail } = await import("./mappers");
      return { data: data.map(mapPatientFromDetail), success: true };
    } catch {
      return { data: [], success: false };
    }
  },

  async getEarnings(): Promise<ApiResponse<DoctorEarnings>> {
    try {
      const data = await api.get<{
        consults_today: number;
        consults_week: number;
        revenue_today: number;
        revenue_week: number;
        pending_payouts: number;
        pending_amount: number;
      }>(API_ENDPOINTS.DOCTOR_EARNINGS);
      return {
        data: {
          consultsToday: data.consults_today,
          consultsWeek: data.consults_week,
          revenueToday: data.revenue_today,
          revenueWeek: data.revenue_week,
          pendingPayouts: data.pending_payouts,
          pendingAmount: data.pending_amount,
        },
        success: true,
      };
    } catch {
      return { data: null as unknown as DoctorEarnings, success: false };
    }
  },

  // ── Payout methods ──────────────────────────────────────────────────────────────

  /** GET /api/payouts/earnings/ — full earnings summary for doctor dashboard */
  async getEarningsSummary(): Promise<ApiResponse<EarningsSummary>> {
    try {
      const data = await api.get<EarningsSummary>(API_ENDPOINTS.PAYOUT_EARNINGS);
      return { data, success: true };
    } catch {
      return { data: null as unknown as EarningsSummary, success: false };
    }
  },

  /** GET /api/payouts/ — doctor's own payout history */
  async getPayouts(): Promise<ApiResponse<Payout[]>> {
    try {
      const data = await api.get<Payout[]>(API_ENDPOINTS.PAYOUTS);
      return { data, success: true };
    } catch {
      return { data: [], success: false };
    }
  },

  /** POST /api/payouts/request/ — submit a payout request */
  async requestPayout(payload: PayoutRequestPayload): Promise<ApiResponse<Payout>> {
    try {
      const data = await api.post<Payout>(API_ENDPOINTS.PAYOUT_REQUEST, payload);
      return { data, success: true };
    } catch (err) {
      return {
        data: null as unknown as Payout,
        success: false,
        error: (err as Error)?.message ?? "Failed to submit payout request.",
      };
    }
  },

  /**
   * PATCH /api/doctors/me/complete/
   *
   * Doctor onboarding wizard — save partial data per step.
   * Supports multipart (profile_photo upload) via FormData.
   * Final step: send { is_profile_complete: true } to unlock dashboard.
   *
   * NowServing.ph / SeriousMD pattern: doctors must complete clinic info,
   * fees, and schedule before appearing in patient search results.
   */
  async completeDoctorProfile(
    data: DoctorProfileCompletionData
  ): Promise<ApiResponse<DoctorProfileCompletionResponse>> {
    try {
      let res: DoctorProfileCompletionResponse;
      const hasFileUpload = Object.values(data).some((v) => v instanceof File);
      if (hasFileUpload) {
        // Use multipart when a photo file is included
        const form = new FormData();
        Object.entries(data).forEach(([key, val]) => {
          if (val === undefined || val === null) return;
          if (val instanceof File) {
            form.append(key, val);
          } else if (Array.isArray(val) || typeof val === "object") {
            form.append(key, JSON.stringify(val));
          } else {
            form.append(key, String(val));
          }
        });
        // Use fetch directly for PATCH multipart (api.upload only does POST)
        const baseUrl = (await import("./api")).getBaseUrl();
        const fetchRes = await fetch(`${baseUrl}${API_ENDPOINTS.DOCTOR_PROFILE_COMPLETE}`, {
          method: "PATCH",
          credentials: "include",
          body: form,
        });
        if (!fetchRes.ok) {
          const err = await fetchRes.json().catch(() => ({}));
          let errMsg = err.detail ?? "Failed to save profile.";
          if (!err.detail) {
            if (err.non_field_errors) {
              errMsg = Array.isArray(err.non_field_errors) ? err.non_field_errors[0] : err.non_field_errors;
            } else {
              const fieldErrors: string[] = [];
              for (const [field, errors] of Object.entries(err)) {
                if (Array.isArray(errors)) fieldErrors.push(`${field}: ${errors[0]}`);
                else if (typeof errors === "string") fieldErrors.push(`${field}: ${errors}`);
              }
              if (fieldErrors.length > 0) errMsg = fieldErrors.join("; ");
            }
          }
          throw new Error(errMsg);
        }
        res = await fetchRes.json();
      } else {
        res = await api.patch<DoctorProfileCompletionResponse>(
          API_ENDPOINTS.DOCTOR_PROFILE_COMPLETE,
          data
        );
      }
      return { data: res, success: true };
    } catch (err: unknown) {
      let errorMsg = (err as Error)?.message ?? "Failed to save profile.";
      // If the error is an ApiError with a JSON body, try to extract field errors
      if (err instanceof ApiError) {
        errorMsg = err.message;
      }
      return { data: null as unknown as DoctorProfileCompletionResponse, success: false, error: errorMsg };
    }
  },

  async createDoctorLivenessSession(): Promise<ApiResponse<DoctorLivenessSessionResponse>> {
    try {
      const data = await api.post<DoctorLivenessSessionResponse>(
        API_ENDPOINTS.DOCTOR_LIVENESS_SESSION,
        {}
      );
      return { data, success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof ApiError
        ? err.message
        : (err as Error)?.message ?? "Failed to create face liveness session.";
      return { data: null as unknown as DoctorLivenessSessionResponse, success: false, error: errorMsg };
    }
  },

  async completeDoctorLivenessSession(
    sessionId: string
  ): Promise<ApiResponse<DoctorLivenessCompleteResponse>> {
    try {
      const data = await api.post<DoctorLivenessCompleteResponse>(
        API_ENDPOINTS.DOCTOR_LIVENESS_COMPLETE,
        { session_id: sessionId }
      );
      return { data, success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof ApiError
        ? err.message
        : (err as Error)?.message ?? "Failed to verify face liveness.";
      return { data: null as unknown as DoctorLivenessCompleteResponse, success: false, error: errorMsg };
    }
  },
};
