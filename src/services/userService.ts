/**
 * userService.ts
 *
 * Patient profile service — mirrors NowServing.ph's lightweight onboarding.
 * - getCurrentUser()         → GET  /api/auth/me/           (full profile + family members)
 * - completePatientProfile() → PATCH /api/auth/me/complete/ (partial update, any step)
 * - uploadHmoCard()          → POST  /api/patients/hmo/     (optional HMO card upload)
 *
 * NowServing pattern: signup is fast (email OTP only). Profile completion is
 * optional and gentle — patients can book immediately after signup.
 * is_profile_complete=true is set when the wizard is explicitly finished or skipped.
 */

import { api, API_ENDPOINTS } from "./api";
import { ApiResponse, FamilyMember, User } from "@/types";

// ── Backend shape returned by GET /api/auth/me/ ───────────────────────────────
export interface BackendUserFull {
  id: number;
  email: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  phone: string;
  birthdate: string | null;
  gender: string;
  blood_type: string;
  allergies: string[];
  address?: string;
  role: "patient" | "doctor" | "admin";
  avatar?: string | null;
  is_profile_complete: boolean;
  doctor_profile_complete?: boolean | null;
  family_members: Array<{
    id: number;
    name: string;
    age: number;
    gender: "male" | "female" | "other";
    relationship: string;
    birthdate: string | null;
  }>;
}

type BackendUserResponse = BackendUserFull | { user: BackendUserFull };

function normalizeBackendUser(res: BackendUserResponse): BackendUserFull {
  return (res as { user?: BackendUserFull })?.user ?? (res as BackendUserFull);
}

/** Map backend snake_case → frontend camelCase User */
export function mapBackendUser(u: BackendUserFull): User {
  return {
    id: String(u.id),
    email: u.email,
    name: [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" "),
    firstName: u.first_name,
    middleName: u.middle_name,
    lastName: u.last_name,
    phone: u.phone ?? "",
    birthdate: u.birthdate ?? undefined,
    gender: u.gender ?? "",
    bloodType: u.blood_type ?? "",
    allergies: u.allergies ?? [],
    address: u.address ?? "",
    role: u.role,
    avatar: u.avatar ?? undefined,
    isProfileComplete: u.is_profile_complete ?? false,
    doctorProfileComplete: u.doctor_profile_complete ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

/** Map backend family_members array → FamilyMember[] */
export function mapFamilyMembers(raw: BackendUserFull["family_members"]): FamilyMember[] {
  return raw.map((m) => ({
    id: m.id,
    name: m.name,
    age: m.age,
    gender: m.gender,
    relationship: m.relationship as FamilyMember["relationship"],
    birthdate: m.birthdate ?? null,
  }));
}

// ── PATCH payload types (one per wizard step) ─────────────────────────────────

export interface PatientProfileStep1 {
  first_name: string;
  last_name: string;
  middle_name?: string;
  phone: string;
  birthdate: string; // YYYY-MM-DD
  gender: "male" | "female" | "other";
  address?: string;
}

export interface PatientProfileStep2 {
  blood_type?: string;
  allergies?: string[];
}

export interface PatientProfileCompletion
  extends Partial<PatientProfileStep1>,
    Partial<PatientProfileStep2> {
  is_profile_complete?: boolean;
  address?: string;
}

export const userService = {
  /**
   * GET /api/auth/me/
   * Returns the full patient profile including nested family members.
   * Called on app boot (DashboardLayout) and after profile completion.
   */
  async getCurrentUser(): Promise<{ user: User; familyMembers: FamilyMember[] } | null> {
    try {
      const res = await api.get<{ user: BackendUserFull | null }>(API_ENDPOINTS.ME);
      if (!res.user) return null;
      return {
        user: mapBackendUser(res.user),
        familyMembers: mapFamilyMembers(res.user.family_members ?? []),
      };
    } catch {
      return null;
    }
  },

  /**
   * PATCH /api/auth/me/complete/
   * Partial update — call once per wizard step.
   * Final step: pass { is_profile_complete: true } to unlock the dashboard.
   * Returns the full updated user so the store can sync in one call.
   */
  async completePatientProfile(
    data: PatientProfileCompletion
  ): Promise<ApiResponse<BackendUserFull>> {
    try {
      const res = await api.patch<BackendUserResponse>(API_ENDPOINTS.ME_COMPLETE, data);
      return { data: normalizeBackendUser(res), success: true };
    } catch (err: any) {
      return { data: null as any, success: false, error: err?.message ?? "Failed to save profile." };
    }
  },

  /**
   * PATCH /api/auth/me/
   * Partial update for main profile page tabs (personal + health info).
   */
  async updateCurrentUser(
    data: PatientProfileCompletion
  ): Promise<ApiResponse<BackendUserFull>> {
    try {
      const res = await api.patch<BackendUserResponse>(API_ENDPOINTS.ME, data);
      return { data: normalizeBackendUser(res), success: true };
    } catch (err: any) {
      return { data: null as any, success: false, error: err?.message ?? "Failed to update profile." };
    }
  },

  /**
   * POST /api/auth/me/avatar/
   * Upload a new profile photo. Returns { avatar: url }.
   */
  async uploadAvatar(file: File): Promise<ApiResponse<{ avatar: string }>> {
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await api.upload<{ avatar: string }>(API_ENDPOINTS.ME_AVATAR, form);
      return { data: res, success: true };
    } catch (err: any) {
      return { data: null as any, success: false, error: err?.message ?? "Failed to upload avatar." };
    }
  },

  /**
   * POST /api/patients/hmo/
   * Optional HMO card upload — encouraged but never blocking.
   */
  async uploadHmoCard(
    provider: string,
    memberId: string,
    file: File | null
  ): Promise<ApiResponse<void>> {
    try {
      const form = new FormData();
      form.append("provider", provider);
      form.append("member_id", memberId);
      if (file) form.append("card_image", file);
      await api.upload<void>("/api/patients/hmo/", form);
      return { data: undefined as any, success: true };
    } catch (err: any) {
      return { data: null as any, success: false, error: err?.message ?? "Failed to save HMO card." };
    }
  },
};
