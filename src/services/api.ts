const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const DEFAULT_CHAT_WS_URL = process.env.NEXT_PUBLIC_CHAT_WS_URL ?? "";

export function getBaseUrl(): string {
  if (!DEFAULT_BASE_URL) return "";
  if (typeof window === "undefined") return DEFAULT_BASE_URL;
  try {
    const url = new URL(DEFAULT_BASE_URL);
    const frontendHost = window.location.hostname;
    const isLocal =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (frontendHost === "localhost" || frontendHost === "127.0.0.1");
    if (isLocal && url.hostname !== frontendHost) {
      url.hostname = frontendHost;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // fall back to default
  }
  return DEFAULT_BASE_URL;
}

export function getChatWsBaseUrl(): string {
  if (!DEFAULT_CHAT_WS_URL) return "";
  if (typeof window === "undefined") return DEFAULT_CHAT_WS_URL;
  try {
    const url = new URL(DEFAULT_CHAT_WS_URL);
    const frontendHost = window.location.hostname;
    const isLocal =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (frontendHost === "localhost" || frontendHost === "127.0.0.1");
    if (isLocal && url.hostname !== frontendHost) {
      url.hostname = frontendHost;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // fall back to default
  }
  return DEFAULT_CHAT_WS_URL;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let _isRefreshing = false;
let _refreshPromise: Promise<void> | null = null;

async function _refreshToken(): Promise<void> {
  if (_isRefreshing) return _refreshPromise!;
  _isRefreshing = true;
  _refreshPromise = fetch(`${getBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  }).then((r) => {
    if (!r.ok) throw new ApiError(r.status, "Session expired. Please log in again.");
  }).finally(() => {
    _isRefreshing = false;
    _refreshPromise = null;
  });
  return _refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, _retry = true): Promise<T> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && _retry && !path.includes("/api/auth/")) {
    try {
      await _refreshToken();
      return request<T>(path, init, false);
    } catch {
      throw new ApiError(401, "Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body.detail) {
        message = body.detail;
      } else if (body.non_field_errors) {
        message = Array.isArray(body.non_field_errors) ? body.non_field_errors[0] : body.non_field_errors;
      } else {
        // Collect all field-level errors into a readable message
        const fieldErrors: string[] = [];
        for (const [field, errors] of Object.entries(body)) {
          if (Array.isArray(errors)) {
            fieldErrors.push(`${field}: ${errors[0]}`);
          } else if (typeof errors === "string") {
            fieldErrors.push(`${field}: ${errors}`);
          }
        }
        if (fieldErrors.length > 0) message = fieldErrors.join("; ");
      }
    } catch {
      // use default status text
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function upload<T>(path: string, body: FormData, method = "POST", _retry = true): Promise<T> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: "include",
    body,
  });
  if (res.status === 401 && _retry) {
    try {
      await _refreshToken();
      return upload<T>(path, body, method, false);
    } catch {
      throw new ApiError(401, "Session expired. Please log in again.");
    }
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const b = await res.json();
      if (b.detail) {
        message = b.detail;
      } else if (b.non_field_errors) {
        message = Array.isArray(b.non_field_errors) ? b.non_field_errors[0] : b.non_field_errors;
      } else {
        const fieldErrors: string[] = [];
        for (const [field, errors] of Object.entries(b)) {
          if (Array.isArray(errors)) fieldErrors.push(`${field}: ${errors[0]}`);
          else if (typeof errors === "string") fieldErrors.push(`${field}: ${errors}`);
        }
        if (fieldErrors.length > 0) message = fieldErrors.join("; ");
      }
    } catch {
      // use default status text
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get:          <T>(path: string)                 => request<T>(path),
  post:         <T>(path: string, body: unknown)  => request<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  patch:        <T>(path: string, body: unknown)  => request<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete:       <T>(path: string)                 => request<T>(path, { method: "DELETE" }),
  upload:       <T>(path: string, body: FormData) => upload<T>(path, body, "POST"),
  patchUpload:  <T>(path: string, body: FormData) => upload<T>(path, body, "PATCH"),
};

const RECORDS_BASE = "/api/records";

export const API_ENDPOINTS = {
  // Auth
  ME:                   "/api/auth/me",
  ME_COMPLETE:          "/api/auth/me/complete",
  ME_AVATAR:            "/api/auth/me/avatar",
  SEND_OTP:             "/api/auth/send-otp",
  REGISTER:             "/api/auth/register",
  LOGIN:                "/api/auth/login",
  LOGOUT:               "/api/auth/logout",
  REFRESH:              "/api/auth/refresh",
  WS_TOKEN:             "/api/auth/ws-token",
  FORGOT_PASSWORD:      "/api/auth/forgot-password",
  RESET_PASSWORD:       "/api/auth/reset-password",
  SET_DOCTOR_PASSWORD:  "/api/auth/set-doctor-password",
  // Doctors
  DOCTORS:              "/api/doctors/",
  DOCTOR_DETAIL:        (id: number | string) => `/api/doctors/${id}/`,
  DOCTOR_INVITE:        "/api/doctors/invite/",
  DOCTOR_AVAILABLE:     "/api/doctors/available_now/",
  DOCTOR_AVAILABILITY:  "/api/doctors/availability/",
  DOCTOR_EARNINGS:      "/api/doctors/earnings/",
  DOCTOR_SLOTS:         "/api/doctors/slots/",
  DOCTOR_SLOT_DETAIL:   (id: number | string) => `/api/doctors/slots/${id}/`,
  DOCTOR_MY_SCHEDULE:   "/api/doctors/my-schedule/",
  DOCTOR_PROFILE_COMPLETE: "/api/doctors/me/complete/",
  DOCTOR_LIVENESS_SESSION: "/api/doctors/me/liveness/session/",
  DOCTOR_LIVENESS_COMPLETE: "/api/doctors/me/liveness/complete/",
  DOCTOR_MY_PATIENTS:   "/api/doctors/my-patients/",
  // Appointments
  APPOINTMENTS:         "/api/appointments/",
  APPOINTMENT_DETAIL:   (id: number | string) => `/api/appointments/${id}/`,
  APPOINTMENT_ACCEPT:   (id: number | string) => `/api/appointments/${id}/accept/`,
  APPOINTMENT_REJECT:   (id: number | string) => `/api/appointments/${id}/reject/`,
  APPOINTMENT_START:    (id: number | string) => `/api/appointments/${id}/start_consult/`,
  APPOINTMENT_START_VIDEO: (id: number | string) => `/api/appointments/${id}/start_video/`,
  APPOINTMENT_CALL_NEXT:(id: number | string) => `/api/appointments/${id}/call_next/`,
  APPOINTMENT_SHARE_DOCUMENT: (id: number | string) => `/api/appointments/${id}/share_document/`,
  APPOINTMENT_COMPLETE: (id: number | string) => `/api/appointments/${id}/complete/`,
  APPOINTMENT_CANCEL:   (id: number | string) => `/api/appointments/${id}/cancel/`,
  APPOINTMENT_REFUND:   (id: number | string) => `/api/appointments/${id}/refund/`,
  APPOINTMENT_NO_SHOW:  (id: number | string) => `/api/appointments/${id}/no_show/`,
  APPOINTMENT_CONFIRM_PAYMENT: (id: number | string) => `/api/appointments/${id}/confirm_payment/`,
  APPOINTMENT_UPCOMING: "/api/appointments/upcoming/",
  APPOINTMENT_ON_DEMAND: "/api/appointments/on-demand/",
  APPOINTMENT_REVIEWS:  "/api/appointments/reviews/",
  APPOINTMENT_SLOTS:    (doctorId: number | string) => `/api/appointments/slots/${doctorId}/`,
  FOLLOW_UP_INVITATIONS:       "/api/appointments/follow-up-invitations/",
  FOLLOW_UP_INVITATION_DETAIL: (id: number | string) => `/api/appointments/follow-up-invitations/${id}/`,
  FOLLOW_UP_INVITATION_IGNORE: (id: number | string) => `/api/appointments/follow-up-invitations/${id}/ignore/`,
  APPOINTMENT_RESCHEDULE: (id: number | string) => `/api/appointments/${id}/reschedule/`,
  TODAY_QUEUE:          "/api/appointments/queue/today/",
  // Records
  PRESCRIPTIONS:        "/api/records/prescriptions",
  PRESCRIPTION_DETAIL:  (id: number | string) => `/api/records/prescriptions/${id}`,
  PRESCRIPTION_PDF:     (id: number | string) => `/api/records/prescriptions/${id}/pdf/`,
  LAB_RESULTS:          "/api/records/labs",
  LAB_DETAIL:           (id: number | string) => `/api/records/labs/${id}`,
  LAB_PDF:              (id: number | string) => `/api/records/labs/${id}/pdf/`,
  CERTIFICATES:         `${RECORDS_BASE}/certificates`,
  CERTIFICATE_DETAIL:   (id: number | string) => `${RECORDS_BASE}/certificates/${id}`,
  CERTIFICATE_PDF:      (id: number | string) => `${RECORDS_BASE}/certificates/${id}/pdf/`,
  CERT_REQUESTS:        `${RECORDS_BASE}/certificates/request`,
  CERT_REQUEST_APPROVE: (id: number | string) => `${RECORDS_BASE}/certificates/request/${id}/approve`,
  CERT_REQUEST_REJECT:  (id: number | string) => `${RECORDS_BASE}/certificates/request/${id}/reject`,
  // Chat
  CONVERSATIONS:        "/api/chat/",
  MESSAGES:             (convId: number | string) => `/api/chat/${convId}/messages/`,
  MESSAGE_READ:         (msgId: number | string)  => `/api/chat/messages/${msgId}/read/`,
  // Pharmacy
  MEDICINES:            "/api/pharmacy/medicines",
  MEDICINE_DETAIL:      (id: number | string) => `/api/pharmacy/medicines/${id}`,
  PRESCRIPTION_UPLOAD:  "/api/pharmacy/prescriptions/upload",
  PRESCRIPTION_EXTRACT: "/api/pharmacy/prescriptions/extract",
  ORDERS:               "/api/pharmacy/orders",
  ORDER_FROM_PRESCRIPTION: "/api/pharmacy/orders/from-prescription",
  ORDER_DETAIL:         (id: number | string) => `/api/pharmacy/orders/${id}`,
  ORDER_CANCEL:         (id: number | string) => `/api/pharmacy/orders/${id}/cancel`,
  // Payments
  PAYMENTS_PROCESS:     "/api/payments/process/",
  PAYMENTS_STATUS:      (id: number | string) => `/api/payments/${id}/`,
  PAYMENTS_PATIENT:     (id: number | string) => `/api/payments/patient/${id}/`,
  // Notifications
  NOTIFICATIONS:        "/api/notifications/",
  NOTIFICATIONS_UNREAD: "/api/notifications/unread-count",
  NOTIFICATIONS_READ_ALL: "/api/notifications/mark-all-read",
  NOTIFICATION_READ:    (id: number | string) => `/api/notifications/${id}/mark-read`,
  NOTIFICATION_DELETE:  (id: number | string) => `/api/notifications/${id}/`,
  // Patients
  MY_DOCTORS:           "/api/patients/my-doctors/",
  FAMILY_MEMBERS:       "/api/patients/family-members/",
  FAMILY_MEMBER_DETAIL: (id: number | string) => `/api/patients/family-members/${id}/`,
  // Payouts
  PAYOUTS:              "/api/payouts/",
  PAYOUT_REQUEST:       "/api/payouts/request/",
  PAYOUT_EARNINGS:      "/api/payouts/earnings/",
  PAYOUT_DETAIL:        (id: number | string) => `/api/payouts/${id}/`,
  PAYOUT_APPROVE:       (id: number | string) => `/api/payouts/${id}/approve/`,
  PAYOUT_REJECT:        (id: number | string) => `/api/payouts/${id}/reject/`,
  ADMIN_REVENUE:        "/api/payouts/admin/revenue/",
} as const;
