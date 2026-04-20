import {
  Appointment,
  AppointmentStatus,
  ConsultationType,
  Conversation,
  Doctor,
  LabResult,
  MedicalCertificate,
  Message,
  Notification,
  NotificationType,
  Patient,
  Prescription,
  Review,
  UserRole,
} from "@/types";

const nowIso = () => new Date().toISOString();
const toStr = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const toNum = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const toAbsUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("http")) {
    // Convert absolute backend media URLs to relative so they go through Next.js proxy
    try {
      const u = new URL(url);
      if (u.pathname.startsWith("/media/")) return u.pathname;
    } catch {
      // fall through
    }
    return url;
  }
  const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  return `${base}${url}`;
};

export const mapAppointmentStatus = (status?: string): AppointmentStatus => {
  if (status === "in_progress") return "in-progress";
  if (status === "no_show") return "no-show";
  return (status as AppointmentStatus) || "pending";
};

export const mapAppointmentStatusForRequest = (status?: string) => {
  if (!status) return status;
  if (status === "in-progress") return "in_progress";
  if (status === "no-show") return "no_show";
  return status;
};

export const mapConsultationType = (t?: string): ConsultationType => {
  if (t === "in_clinic") return "in-clinic";
  if (t === "on_demand") return "online";
  return (t as ConsultationType) || "online";
};

export const mapConsultationTypeForRequest = (t?: string) => {
  if (!t) return t;
  if (t === "in-clinic") return "in_clinic";
  if (t === "on-demand") return "on_demand";
  return t;
};

const buildDoctor = (data: any): Doctor => {
  const profileId = data?.id ?? data?.profile_id ?? data?.doctor_profile_id;
  const userId = data?.user_id ?? data?.userId ?? data?.doctor_id ?? data?.doctor;
  const hospitals = Array.isArray(data?.hospitals) ? data.hospitals : [];
  const services = Array.isArray(data?.services) ? data.services : [];
  const hmos = Array.isArray(data?.hmos) ? data.hmos : [];

  const hospitalName =
    data?.clinic_name ??
    data?.clinicName ??
    hospitals[0]?.name ??
    "";

  return {
    id: toStr(profileId || userId),
    userId: userId ? toStr(userId) : undefined,
    email: data?.email ?? "",
    name: data?.full_name ?? data?.fullName ?? data?.name ?? "",
    role: "doctor",
    avatar: toAbsUrl(data?.profile_photo ?? data?.profilePhoto ?? data?.avatar),
    phone: data?.phone ?? undefined,
    createdAt: data?.created_at ?? data?.createdAt ?? nowIso(),
    specialty: data?.specialty ?? "",
    specialties: data?.sub_specialties ?? data?.subSpecialties ?? [],
    hospital: hospitalName,
    location: data?.city ?? data?.location ?? "",
    experience: toNum(data?.years_of_experience ?? data?.yearsOfExperience ?? data?.experience),
    consultationFee: toNum(
      data?.consultation_fee_in_person ??
        data?.consultationFeeInPerson ??
        data?.consultationFee
    ),
    onlineConsultationFee: toNum(
      data?.consultation_fee_online ??
        data?.consultationFeeOnline ??
        data?.onlineConsultationFee
    ),
    rating: toNum(data?.avg_rating ?? data?.rating),
    reviewCount: toNum(data?.review_count ?? data?.reviewCount),
    bio: data?.bio ?? "",
    education: data?.education ?? [],
    languages: data?.languages_spoken ?? data?.languages ?? [],
    isVerified: Boolean(data?.is_verified ?? data?.isVerified),
    /**
     * isInstantAvailable — ONLY true when backend returns is_available_now: true.
     * This means the doctor has on-demand mode on AND pinged within ~10-15 min.
     * Never falls back to is_verified. Offline verified doctors → false.
     */
    isInstantAvailable: Boolean(data?.is_available_now ?? data?.isAvailableNow ?? false),
    /**
     * isBookable — true for all verified doctors regardless of online status.
     * Gates the "Book Appointment" button for scheduled consultations.
     */
    isBookable: Boolean(data?.is_verified ?? data?.isVerified ?? false),
    // acceptsOnline: backend-computed (schedule + fee), fallback to fee > 0
    acceptsOnline: data?.accepts_online !== undefined
      ? Boolean(data.accepts_online)
      : toNum(
          data?.consultation_fee_online ??
          data?.consultationFeeOnline ??
          data?.onlineConsultationFee
        ) > 0,
    // acceptsInClinic: backend-computed (schedule + fee), fallback to fee > 0
    acceptsInClinic: data?.accepts_in_clinic !== undefined
      ? Boolean(data.accepts_in_clinic)
      : toNum(
          data?.consultation_fee_in_person ??
          data?.consultationFeeInPerson ??
          data?.consultationFee
        ) > 0,
    // Deprecated alias kept so existing code referencing isAvailable still compiles.
    isAvailable: Boolean(data?.is_available_now ?? data?.isAvailableNow ?? false),
    isOnDemand: Boolean(data?.is_on_demand ?? data?.isOnDemand),
    availableSlots: data?.availableSlots ?? [],
    hmoAccepted: hmos.map((h: any) => h?.name).filter(Boolean),
    services: services.map((s: any) => s?.name).filter(Boolean),
    clinicAddress: data?.clinic_address ?? data?.clinicAddress,
    weeklySchedule: data?.weekly_schedule ?? data?.weeklySchedule,
    clinicLat: data?.clinic_lat != null ? Number(data.clinic_lat) : undefined,
    clinicLng: data?.clinic_lng != null ? Number(data.clinic_lng) : undefined,
    signature: data?.signature ?? undefined,
  };
};

const buildPatient = (data: any): Patient => {
  const id = data?.id ?? data?.patient_id ?? data?.patient;
  return {
    id: toStr(id),
    email: data?.email ?? "",
    name: data?.name ?? data?.full_name ?? data?.patient_name ?? "",
    role: "patient",
    avatar: data?.avatar ?? "",
    phone: data?.phone ?? undefined,
    createdAt: data?.created_at ?? data?.createdAt ?? nowIso(),
    dateOfBirth: data?.birthdate ?? data?.dateOfBirth,
    gender: data?.gender,
    address: data?.address,
    bloodType: data?.bloodType,
    allergies: data?.allergies,
    emergencyContact: data?.emergencyContact,
    hmoProvider: data?.hmoProvider,
    hmoNumber: data?.hmoNumber,
    walletBalance: data?.walletBalance,
  };
};

export const mapDoctorFromList = (data: any): Doctor => buildDoctor(data);
export const mapPatientFromDetail = (data: any): Patient => buildPatient({
  ...data,
  name: [data?.first_name, data?.middle_name, data?.last_name].filter(Boolean).join(" "),
  dateOfBirth: data?.birthdate,
});
export const mapDoctorFromDetail = (data: any): Doctor => {
  const doctor = buildDoctor(data);
  // Attach recent_reviews from the detail endpoint so the profile page
  // can use them directly without a separate reviews API call.
  if (Array.isArray(data?.recent_reviews)) {
    (doctor as any).recentReviews = data.recent_reviews.map((r: any) => ({
      id: String(r.id),
      doctorId: String(data.user_id ?? data.id),
      patientId: "",
      patient: { id: "", email: "", name: r.patient_name ?? "Patient", role: "patient" as const, createdAt: r.created_at },
      appointmentId: String(r.appointment),
      rating: Number(r.rating),
      comment: r.comment ?? "",
      createdAt: r.created_at ?? "",
      doctorReply: r.doctor_reply ?? null,
      replyAt: r.reply_at ?? null,
    }));
  }
  return doctor;
};

export const mapAppointment = (data: any): Appointment => {
  const patientId = toStr(data?.patient);
  const doctorId = toStr(data?.doctor);
  const doctorProfileId = data?.doctor_profile_id ? toStr(data?.doctor_profile_id) : undefined;

  const bookedForName = data?.booked_for_name || undefined;
  const bookedForRelationship = data?.booked_for_relationship || "self";
  
  // Extract patient profile data from patient_profile_data field
  const profileData = data?.patient_profile_data;
  const displayName = (bookedForName && bookedForName.trim())
    ? bookedForName
    : (profileData?.full_name || data?.patient_name || "");

  const patient = displayName
    ? buildPatient({
        id: patientId,
        name: displayName,
        // Use patient_profile_data fields if available, fallback to direct fields
        email: profileData?.email || data?.patient_email || data?.patient_account_email,
        phone: data?.patient_phone,
        birthdate: profileData?.date_of_birth || data?.patient_birthdate || data?.patient_date_of_birth,
        gender: profileData?.sex || data?.patient_gender,
        address: profileData?.home_address || data?.patient_address || data?.patient_home_address,
        avatar: data?.patient_avatar || data?.patient_photo,
      })
    : undefined;

  const doctor = data?.doctor_name
    ? buildDoctor({
        id: doctorProfileId ?? doctorId,
        user_id: doctorId,
        full_name: data.doctor_name,
        specialty: data?.doctor_specialty,
        profile_photo: data?.doctor_avatar ?? data?.doctor_photo,
      })
    : undefined;

  return {
    id: toStr(data?.id),
    patientId,
    doctorId,
    doctorProfileId,
    patient,
    doctor,
    date: data?.date ?? "",
    time: data?.time ?? "",
    type: mapConsultationType(data?.type),
    status: mapAppointmentStatus(data?.status),
    queueNumber: data?.queue_number ?? undefined,
    queuePosition: data?.queue_position ?? undefined,
    estimatedWaitMinutes: data?.estimated_wait_minutes ?? undefined,
    paymentStatus: data?.payment_status ?? undefined,
    paymentDisplayNote: data?.payment_display_note ?? undefined,
    paymongoPaymentId: data?.paymongo_payment_id ?? undefined,
    symptoms: data?.symptoms ?? undefined,
    notes: data?.notes ?? undefined,
    fee: data?.effective_fee ?? data?.fee ? toNum(data?.effective_fee ?? data?.fee) : undefined,
    hmoUsed: data?.hmo_provider ? true : undefined,
    videoRoomUrl:   data?.video_room_url ?? undefined,
    videoPassword:  data?.video_password ?? undefined,
    videoStartedAt: data?.video_started_at ?? undefined,
    videoEndedAt:   data?.video_ended_at ?? undefined,
    consultTranscript: data?.consult_transcript ?? undefined,
    consultNotes: data?.consult_notes ?? undefined,
    consultSummary: data?.consult_summary ?? undefined,
    clinicInfo: data?.clinic_info ?? undefined,
    sharedDocuments: Array.isArray(data?.shared_documents)
      ? data.shared_documents.map((d: any) => ({
          id: d?.id,
          docType: d?.doc_type,
          documentId: d?.document_id,
          title: d?.title ?? undefined,
          summary: d?.summary ?? undefined,
          createdAt: d?.created_at ?? undefined,
          createdBy: d?.created_by_name ?? undefined,
        }))
      : undefined,
    // booked-for-other fields (NowServing pattern)
    bookedForName:         bookedForName,
    bookedForAge:          profileData?.age ?? data?.booked_for_age ?? undefined,
    bookedForGender:       profileData?.sex || data?.booked_for_gender || undefined,
    bookedForRelationship: bookedForRelationship || undefined,
    familyMember:          data?.family_member ?? undefined,
    // Review attached to this appointment (NowServing pattern)
    review: data?.review ? mapReview(data.review) : undefined,
    createdAt: data?.created_at ?? nowIso(),
    updatedAt: data?.updated_at ?? data?.created_at ?? nowIso(),
  };
};

export const mapMessage = (data: any, ctx?: { conversationId?: string; patientId?: string; doctorId?: string }): Message => {
  // sender can be an integer PK (WS/REST) or sender_id — normalise to string
  const senderId = toStr(data?.sender_id ?? data?.sender);
  let senderRole: UserRole | undefined = data?.sender_role;
  if (!senderRole && ctx?.patientId && ctx?.doctorId) {
    senderRole = senderId === String(ctx.patientId) ? "patient" : "doctor";
  }

  const fileName = data?.file_name ?? data?.fileName;
  const contentFallback =
    !data?.content && fileName ? `📎 ${fileName}` : data?.content ?? "";

  // msg_type is the WS field name; type is the REST/serializer field name.
  // Never let the WS envelope type ("chat.message") bleed in here — callers
  // must strip the envelope before calling mapMessage.
  const msgType = data?.msg_type ?? data?.type ?? "text";

  return {
    id: toStr(data?.id),
    conversationId: toStr(data?.conversation ?? ctx?.conversationId),
    senderId,
    senderRole: senderRole || "patient",
    content: contentFallback,
    type: msgType,
    isRead: Boolean(data?.is_read ?? data?.isRead),
    readAt: data?.read_at ?? data?.readAt ?? null,
    timestamp: data?.timestamp ?? nowIso(),
    fileName: fileName ?? undefined,
    fileUrl: data?.file_url ?? data?.fileUrl ?? undefined,
    fileSize: data?.file_size ?? data?.fileSize ?? undefined,
  };
};

export const mapConversation = (data: any): Conversation => {
  const patientId = toStr(data?.patient);
  const doctorId = toStr(data?.doctor);
  const lastMessage = data?.last_message
    ? mapMessage(data.last_message, { conversationId: toStr(data?.id), patientId, doctorId })
    : undefined;

  return {
    id: toStr(data?.id),
    participants: [patientId, doctorId].filter(Boolean),
    patientId,
    doctorId,
    patient: data?.patient_name ? buildPatient({ id: patientId, name: data.patient_name, avatar: data?.patient_avatar ?? '' }) : undefined,
    doctor: data?.doctor_name ? buildDoctor({ user_id: doctorId, full_name: data.doctor_name, specialty: data?.doctor_specialty, profile_photo: data?.doctor_avatar ?? data?.doctor_photo }) : undefined,
    lastMessage,
    unreadCount: toNum(data?.unread_count ?? data?.unreadCount),
    createdAt: data?.created_at ?? nowIso(),
    updatedAt: data?.updated_at ?? nowIso(),
  };
};

const mapNotificationType = (t?: string): NotificationType => {
  if (!t) return "system";
  return t.replace(/_/g, "-") as NotificationType;
};

export const mapNotification = (data: any): Notification => ({
  id: toStr(data?.id),
  userId: toStr(data?.user ?? data?.user_id),
  type: mapNotificationType(data?.type),
  title: data?.title ?? "",
  message: data?.message ?? "",
  isRead: Boolean(data?.is_read ?? data?.isRead),
  data: data?.data ?? undefined,
  createdAt: data?.created_at ?? nowIso(),
});

export const mapPrescription = (data: any): Prescription => ({
  id: toStr(data?.id),
  appointmentId: toStr(data?.appointment),
  patientId: toStr(data?.patient),
  doctorId: toStr(data?.doctor),
  doctor: data?.doctor_name ? buildDoctor({ user_id: data?.doctor, full_name: data.doctor_name }) : undefined,
  date: data?.date ?? "",
  diagnosis: data?.diagnosis ?? "",
  medications: data?.medications ?? [],
  instructions: data?.instructions ?? "",
  validUntil: data?.valid_until ?? data?.validUntil ?? "",
  isDigital: Boolean(data?.is_digital ?? data?.isDigital),
  // Keep as full absolute URL — do NOT pass through toAbsUrl which strips to /media/...
  // The blob-fetch download needs the full http://backend/media/... URL
  pdfUrl: data?.pdf_url ?? undefined,
});

export const mapLabResult = (data: any): LabResult => ({
  id: toStr(data?.id),
  patientId: toStr(data?.patient),
  doctorId: toStr(data?.doctor),
  doctor: data?.doctor_name ? buildDoctor({ user_id: data?.doctor, full_name: data.doctor_name }) : undefined,
  appointmentId: data?.appointment ? toStr(data?.appointment) : undefined,
  testName: data?.test_name ?? data?.testName ?? "",
  testType: data?.test_type ?? data?.testType ?? "",
  date: data?.date ?? "",
  status: data?.status ?? "pending",
  results: data?.results ?? undefined,
  notes: data?.notes ?? undefined,
  fileUrl: data?.file_url ?? data?.fileUrl ?? undefined,
  laboratory: data?.laboratory ?? undefined,
});

export const mapMedicalCertificate = (data: any): MedicalCertificate => ({
  id: toStr(data?.id),
  patientId: toStr(data?.patient),
  doctorId: toStr(data?.doctor),
  doctor: data?.doctor_name ? buildDoctor({ user_id: data?.doctor, full_name: data.doctor_name }) : undefined,
  date: data?.date ?? "",
  purpose: data?.purpose ?? "",
  diagnosis: data?.diagnosis ?? "",
  restDays: toNum(data?.rest_days ?? data?.restDays),
  validFrom: data?.valid_from ?? data?.validFrom ?? "",
  validUntil: data?.valid_until ?? data?.validUntil ?? "",
  pdfUrl: data?.pdf_url ?? undefined,
});

export const mapReview = (data: any): Review => ({
  id: toStr(data?.id),
  doctorId: toStr(data?.doctor),
  patientId: toStr(data?.patient),
  patient: data?.patient_name ? buildPatient({ id: data?.patient, name: data.patient_name }) : undefined,
  appointmentId: toStr(data?.appointment),
  rating: toNum(data?.rating),
  comment: data?.comment ?? "",
  createdAt: data?.created_at ?? nowIso(),
  doctorReply: data?.doctor_reply ?? null,
  replyAt: data?.reply_at ?? null,
});

export const mapMedicine = (data: any) => ({
  id: toStr(data?.id),
  name: data?.name ?? "",
  genericName: data?.generic_name ?? data?.genericName ?? "",
  category: data?.category ?? "",
  price: toNum(data?.price),
  description: data?.description ?? "",
  dosageForm: data?.dosage_form ?? data?.dosageForm ?? "",
  manufacturer: data?.manufacturer ?? "",
  requiresPrescription: Boolean(data?.requires_prescription ?? data?.requiresPrescription),
  inStock: Boolean(data?.in_stock ?? data?.inStock),
  quantity: toNum(data?.quantity),
  image: data?.image_url ?? data?.image ?? undefined,
  pharmacyPartner: data?.pharmacy_partner ?? data?.pharmacyPartner ?? undefined,
});
