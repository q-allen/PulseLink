import { api, ApiError, API_ENDPOINTS } from "./api";
import { User, UserRole } from "@/types";
import { mapBackendUser, mapFamilyMembers, BackendUserFull } from "./userService";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthdate: string;
  phone: string;
  role: UserRole;
  otp: string;
}

export interface InviteDoctorData {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  specialty: string;
  clinicName: string;
  prcLicense: string;
}

interface BackendUser {
  id: number;
  email: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  phone?: string;
  birthdate?: string | null;
  gender?: string;
  blood_type?: string;
  allergies?: string[];
  role: UserRole;
  is_profile_complete?: boolean;
  doctor_profile_complete?: boolean | null;
  family_members?: BackendUserFull["family_members"];
}

function toFrontendUser(u: BackendUser): User {
  return mapBackendUser(u as BackendUserFull);
}

export const authService = {
  async sendOtp(email: string): Promise<{ detail: string; otp?: string }> {
    return api.post(API_ENDPOINTS.SEND_OTP, { email });
  },

  async register(data: RegisterData): Promise<User> {
    const res = await api.post<{ user: BackendUser }>(API_ENDPOINTS.REGISTER, {
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      middleName: data.middleName ?? "",
      lastName: data.lastName,
      birthdate: data.birthdate,
      phone: data.phone,
      role: data.role,
      otp: data.otp,
    });
    const user = toFrontendUser(res.user);
    document.cookie = `user_role=${user.role};path=/;max-age=${60 * 60 * 24 * 7};samesite=lax`;
    return user;
  },

  async getMe(): Promise<{ user: User; familyMembers: import('@/types').FamilyMember[] } | null> {
    try {
      const res = await api.get<{ user: BackendUser | null }>(API_ENDPOINTS.ME);
      if (res.user) {
        return {
          user: toFrontendUser(res.user),
          familyMembers: mapFamilyMembers(res.user.family_members ?? []),
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  async login(credentials: LoginCredentials): Promise<User> {
    const res = await api.post<{ user: BackendUser }>(API_ENDPOINTS.LOGIN, credentials);
    const user = toFrontendUser(res.user);
    // Set a plain (non-httpOnly) cookie so Next.js middleware can read the role
    document.cookie = `user_role=${user.role};path=/;max-age=${60 * 60 * 24 * 7};samesite=lax`;
    return user;
  },

  async logout(): Promise<void> {
    await api.post(API_ENDPOINTS.LOGOUT, {});
    document.cookie = "user_role=;path=/;max-age=0";
  },

  async refresh(): Promise<void> {
    await api.post(API_ENDPOINTS.REFRESH, {});
  },

  async forgotPassword(email: string): Promise<{ detail: string; otp?: string }> {
    return api.post(API_ENDPOINTS.FORGOT_PASSWORD, { email });
  },

  async resetPassword(email: string, otp: string, new_password: string): Promise<void> {
    await api.post(API_ENDPOINTS.RESET_PASSWORD, { email, otp, new_password });
  },

  async inviteDoctor(data: InviteDoctorData): Promise<{ detail: string }> {
    return api.post(API_ENDPOINTS.DOCTOR_INVITE, data);
  },

  async activateDoctor(uid: string, token: string, password: string, password_confirm: string): Promise<User> {
    const res = await api.post<{ user: BackendUser }>(API_ENDPOINTS.SET_DOCTOR_PASSWORD, {
      uid, token, password, password_confirm,
    });
    const user = toFrontendUser(res.user);
    document.cookie = `user_role=${user.role};path=/;max-age=${60 * 60 * 24 * 7};samesite=lax`;
    return user;
  },
};
