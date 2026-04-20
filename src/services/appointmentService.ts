import { api, API_ENDPOINTS } from "./api";
import { Appointment, ApiResponse, ConsultationType, Doctor, PaginatedResponse, TimeSlot } from "@/types";
import {
  mapAppointment,
  mapAppointmentStatusForRequest,
  mapConsultationTypeForRequest,
  mapDoctorFromList,
} from "./mappers";

type RawAppointment = Record<string, unknown>;

export interface CreateAppointmentData {
  doctorId: string;
  patientId?: string;
  date: string;
  time: string;
  type: ConsultationType | "on-demand";
  symptoms?: string;
  fee?: number;
  paymongoPaymentId?: string;
  // Patient profile fields from the booking form
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  email?: string;
  sex?: string;
  homeAddress?: string;
  reasonForConsultation?: string;
}

export interface VideoConsultResult {
  roomName: string;
  password: string;
  jitsiDomain: string;
  videoRoomUrl: string;
  appointment: Appointment;
}

export type ShareDocumentType = "prescription" | "certificate" | "lab";

export interface ShareDocumentPayload {
  docType: ShareDocumentType;
  diagnosis?: string;
  medications?: string[] | string;
  instructions?: string;
  validUntil?: string;
  followUpDate?: string;
  remarks?: string;
  purpose?: string;
  restDays?: number;
  validFrom?: string;
  testName?: string;
  testType?: string;
  notes?: string;
}

export interface ShareDocumentResult {
  share: {
    id: number;
    docType: ShareDocumentType;
    documentId: number;
    title?: string;
    summary?: string;
    createdAt?: string;
    pdfUrl?: string | null;
  };
  appointment: Appointment;
}

const unwrapList = <T>(data: T[] | { results?: T[] }) =>
  Array.isArray(data) ? data : (data.results ?? []);

export const appointmentService = {
  async getAppointments(
    filters?: { status?: string; date?: string; doctorId?: string; patientId?: string; type?: string },
    _page = 1,
    _limit = 10
  ): Promise<PaginatedResponse<Appointment>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", mapAppointmentStatusForRequest(filters.status) ?? filters.status);
    if (filters?.type)   params.set("type", mapConsultationTypeForRequest(filters.type) ?? filters.type);
    if (filters?.date)   params.set("date", filters.date);
    if (filters?.doctorId) params.set("doctor", String(filters.doctorId));
    const query = params.toString() ? `?${params}` : "";
    const raw = await api.get<Appointment[] | { results: Appointment[] }>(`${API_ENDPOINTS.APPOINTMENTS}${query}`);
    let list = unwrapList(raw).map(mapAppointment);
    if (filters?.patientId) {
      list = list.filter((apt) => apt.patientId === String(filters.patientId));
    }
    return { data: list, success: true, page: 1, limit: list.length, total: list.length, totalPages: 1 };
  },

  async getAppointmentById(id: string): Promise<ApiResponse<Appointment>> {
    const data = await api.get<RawAppointment>(API_ENDPOINTS.APPOINTMENT_DETAIL(id));
    return { data: mapAppointment(data), success: true };
  },

  async createAppointment(data: CreateAppointmentData): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(API_ENDPOINTS.APPOINTMENTS, {
      doctor_id:              Number(data.doctorId),
      date:                   data.date,
      time:                   data.time,
      type:                   mapConsultationTypeForRequest(data.type),
      symptoms:               data.symptoms,
      ...(data.paymongoPaymentId && { paymongo_payment_id: data.paymongoPaymentId }),
      // Patient profile fields
      firstName:              data.firstName ?? "",
      middleName:             data.middleName ?? "",
      lastName:               data.lastName ?? "",
      dateOfBirth:            data.dateOfBirth ?? "",
      email:                  data.email ?? "",
      sex:                    data.sex ?? "",
      homeAddress:            data.homeAddress ?? "",
      reasonForConsultation:  data.reasonForConsultation ?? data.symptoms ?? "",
    });
    return { data: mapAppointment(result), success: true, message: "Appointment booked successfully" };
  },

  async updateAppointmentStatus(id: string, status: string, notes?: string): Promise<ApiResponse<Appointment>> {
    const payload: Record<string, unknown> = {};
    if (status) payload.status = mapAppointmentStatusForRequest(status) ?? status;
    if (notes) payload.notes = notes;
    const result = await api.patch<RawAppointment>(API_ENDPOINTS.APPOINTMENT_DETAIL(id), payload);
    return { data: mapAppointment(result), success: true };
  },

  async cancelAppointment(id: string, reason?: string): Promise<ApiResponse<Appointment & { refund_issued?: boolean; refund_note?: string; action_required?: string }>> {
    const result = await api.post<RawAppointment & { refund_issued?: boolean; refund_note?: string; action_required?: string }>(
      API_ENDPOINTS.APPOINTMENT_CANCEL(id),
      { reason: reason ?? "" },
    );
    return {
      data: { ...mapAppointment(result), refund_issued: result.refund_issued, refund_note: result.refund_note, action_required: result.action_required } as any,
      success: true,
    };
  },

  async requestRefund(id: string, reason?: string): Promise<ApiResponse<Appointment & { refund_issued?: boolean; refund_note?: string }>> {
    const result = await api.post<RawAppointment & { refund_issued?: boolean; refund_note?: string }>(
      API_ENDPOINTS.APPOINTMENT_REFUND(id),
      { reason: reason ?? "" },
    );
    return {
      data: { ...mapAppointment(result), refund_issued: result.refund_issued, refund_note: result.refund_note } as any,
      success: true,
    };
  },

  async getAvailableSlots(doctorId: string, date: string): Promise<ApiResponse<TimeSlot[]>> {
    const res = await api.get<{ date: string; slots: { time: string; is_available: boolean }[] }>(
      `${API_ENDPOINTS.APPOINTMENT_SLOTS(doctorId)}?date=${date}`
    );
    const slots: TimeSlot[] = res.slots.map((s, i) => ({
      id: `slot-${date}-${s.time}`,
      date,
      startTime: s.time,
      endTime: s.time,
      isAvailable: s.is_available,
    }));
    return { data: slots, success: true };
  },

  async getTodayQueue(): Promise<ApiResponse<Appointment[]>> {
    const data = await api.get<RawAppointment[]>(API_ENDPOINTS.TODAY_QUEUE);
    return { data: data.map(mapAppointment), success: true };
  },

  async acceptAppointment(id: string): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(API_ENDPOINTS.APPOINTMENT_ACCEPT(id), {});
    return { data: mapAppointment(result), success: true };
  },

  async rejectAppointment(id: string, reason?: string): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(API_ENDPOINTS.APPOINTMENT_REJECT(id), { rejection_reason: reason ?? "" });
    return { data: mapAppointment(result), success: true };
  },

  async startConsult(id: string): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(API_ENDPOINTS.APPOINTMENT_START(id), {});
    return { data: mapAppointment(result), success: true };
  },

  async callNext(id: string): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(API_ENDPOINTS.APPOINTMENT_CALL_NEXT(id), {});
    return { data: mapAppointment(result), success: true };
  },

  async completeAppointment(
    id: string,
    transcriptOrMeta?: string | {
      transcript?: string;
      durationSeconds?: number;
      participants?: string[];
      consultNotes?: string;
      consultSummary?: string;
    }
  ): Promise<ApiResponse<Appointment>> {
    const payload: Record<string, unknown> = {};
    if (typeof transcriptOrMeta === "string") {
      if (transcriptOrMeta) payload.transcript = transcriptOrMeta;
    } else if (transcriptOrMeta) {
      if (transcriptOrMeta.transcript) payload.transcript = transcriptOrMeta.transcript;
      if (typeof transcriptOrMeta.durationSeconds === "number") {
        payload.duration_seconds = transcriptOrMeta.durationSeconds;
      }
      if (Array.isArray(transcriptOrMeta.participants)) {
        payload.participants = transcriptOrMeta.participants;
      }
      if (transcriptOrMeta.consultNotes) {
        payload.consult_notes = transcriptOrMeta.consultNotes;
      }
      if (transcriptOrMeta.consultSummary) {
        payload.consult_summary = transcriptOrMeta.consultSummary;
      }
    }
    const result = await api.post<RawAppointment>(API_ENDPOINTS.APPOINTMENT_COMPLETE(id), payload);
    return { data: mapAppointment(result), success: true };
  },

  async markNoShow(id: string): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(API_ENDPOINTS.APPOINTMENT_NO_SHOW(id), {});
    return { data: mapAppointment(result), success: true };
  },

  /**
   * NowServing pattern: patient submits a star rating + optional comment
   * after a completed appointment. One review per appointment.
   * POST /appointments/<id>/review/
   */
  async createReview(
    appointmentId: string,
    rating: number,
    comment?: string,
  ): Promise<ApiResponse<import("@/types").Review>> {
    const { mapReview } = await import("./mappers");
    const result = await api.post<any>(
      `/api/appointments/${appointmentId}/review/`,
      { rating, comment: comment ?? "" },
    );
    return { data: mapReview(result), success: true, message: "Review submitted" };
  },

  /**
   * NowServing pattern: doctor publicly replies to a patient review.
   * PATCH /appointments/<id>/review/reply/
   */
  async replyToReview(
    appointmentId: string,
    reply: string,
  ): Promise<ApiResponse<import("@/types").Review>> {
    const { mapReview } = await import("./mappers");
    const result = await api.patch<any>(
      `/api/appointments/${appointmentId}/review/reply/`,
      { reply },
    );
    return { data: mapReview(result), success: true };
  },

  async rescheduleAppointment(id: string, date: string, time: string): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(
      API_ENDPOINTS.APPOINTMENT_RESCHEDULE(id),
      { date, time },
    );
    return { data: mapAppointment(result), success: true, message: "Appointment rescheduled successfully" };
  },

  async getUpcomingAppointments(): Promise<ApiResponse<Appointment[]>> {
    const data = await api.get<RawAppointment[]>(API_ENDPOINTS.APPOINTMENT_UPCOMING);
    return { data: data.map(mapAppointment), success: true };
  },

  async getOnDemandDoctors(): Promise<ApiResponse<Doctor[]>> {
    const data = await api.get<RawAppointment[]>(API_ENDPOINTS.APPOINTMENT_ON_DEMAND);
    return { data: data.map(mapDoctorFromList), success: true };
  },

  async startVideoConsult(id: string): Promise<ApiResponse<VideoConsultResult>> {
    const res = await api.post<{
      room_name: string;
      password: string;
      jitsi_domain: string;
      video_room_url: string;
      appointment: RawAppointment;
    }>(API_ENDPOINTS.APPOINTMENT_START_VIDEO(id), {});
    return {
      data: {
        roomName:     res.room_name,
        password:     res.password,
        jitsiDomain:  res.jitsi_domain,
        videoRoomUrl: res.video_room_url,
        appointment:  mapAppointment(res.appointment),
      },
      success: true,
    };
  },

  /**
   * joinVideoRoom — patient calls this to get the Jitsi credentials for an
   * already-started consultation (status === in_progress).
   * Returns the same VideoConsultResult shape as startVideoConsult so the
   * patient page can use identical logic.
   *
   * NowServing pattern: patient does NOT start the room — they join an
   * existing room created by the doctor.
   */
  async joinVideoRoom(id: string): Promise<ApiResponse<VideoConsultResult>> {
    // Fetch the appointment — credentials are embedded in the detail response
    const res = await appointmentService.getAppointmentById(id);
    if (!res.success || !res.data) {
      throw new Error("Appointment not found.");
    }
    const apt = res.data;
    if (!apt.videoRoomUrl) {
      throw new Error("Video room not started yet.");
    }
    const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";
    const roomName = apt.videoRoomUrl.split("#")[0].split("/").pop() ?? "";
    return {
      data: {
        roomName,
        password:     apt.videoPassword ?? "",
        jitsiDomain:  domain,
        videoRoomUrl: apt.videoRoomUrl,
        appointment:  apt,
      },
      success: true,
    };
  },

  /**
   * endConsultation — doctor calls this to mark the appointment completed.
   * Alias for completeAppointment with a cleaner call signature.
   * Broadcasts consultation.ended via Channels so patient page closes Jitsi.
   */
  async endConsultation(
    id: string,
    opts: {
      durationSeconds?: number;
      participants?: string[];
      consultNotes?: string;
      consultSummary?: string;
      transcript?: string;
    } = {}
  ): Promise<ApiResponse<Appointment>> {
    return appointmentService.completeAppointment(id, {
      durationSeconds: opts.durationSeconds,
      participants:    opts.participants,
      consultNotes:    opts.consultNotes,
      consultSummary:  opts.consultSummary,
      transcript:      opts.transcript,
    });
  },

  /**
   * NowServing alignment: called after PayMongo redirect succeeds.
   * Stores the paymongo_payment_id on the appointment, sets payment_status=paid,
   * and triggers the patient receipt email + doctor notification via Celery.
   */
  async confirmPayment(id: string, paymongoPaymentId: string): Promise<ApiResponse<Appointment>> {
    const result = await api.post<RawAppointment>(
      `/api/appointments/${id}/confirm_payment/`,
      { paymongo_payment_id: paymongoPaymentId },
    );
    return { data: mapAppointment(result), success: true, message: "Payment confirmed. Receipt sent to your email." };
  },

  async shareDocument(id: string, payload: ShareDocumentPayload): Promise<ApiResponse<ShareDocumentResult>> {
    const res = await api.post<{
      share: {
        id: number;
        doc_type: ShareDocumentType;
        document_id: number;
        title?: string;
        summary?: string;
        created_at?: string;
        pdf_url?: string | null;
      };
      appointment: RawAppointment;
    }>(API_ENDPOINTS.APPOINTMENT_SHARE_DOCUMENT(id), {
      doc_type: payload.docType,
      diagnosis: payload.diagnosis,
      medications: payload.medications,
      instructions: payload.instructions,
      valid_until: payload.validUntil,
      follow_up_date: payload.followUpDate,
      remarks: payload.remarks,
      purpose: payload.purpose,
      rest_days: payload.restDays,
      valid_from: payload.validFrom,
      test_name: payload.testName,
      test_type: payload.testType,
      notes: payload.notes,
    });
    return {
      data: {
        share: {
          id: res.share.id,
          docType: res.share.doc_type,
          documentId: res.share.document_id,
          title: res.share.title,
          summary: res.share.summary,
          createdAt: res.share.created_at,
          pdfUrl: res.share.pdf_url ?? null,
        },
        appointment: mapAppointment(res.appointment),
      },
      success: true,
    };
  },
};
