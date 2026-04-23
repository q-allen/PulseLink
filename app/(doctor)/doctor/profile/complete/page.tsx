
"use client";

/**
 * app/(doctor)/doctor/profile/complete/page.tsx
 *
 * Doctor onboarding wizard — 6 steps:
 *   Step 1 — Basic Info
 *   Step 2 — Clinic & Fees
 *   Step 3 — Schedule
 *   Step 4 — Specialty
 *   Step 5 — Documents & Signature
 *   Step 6 — Face Verification (AWS liveness)
 *
 * Mandatory: doctors cannot leave this page or skip steps until
 * is_profile_complete = true.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, MapPin, DollarSign, Calendar, Stethoscope,
  ChevronRight, ChevronLeft, Check, Loader2, Plus, X,
  Camera, Clock, Zap, FileImage, IdCard, ScanFace, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store";
import { useToast } from "@/hooks/use-toast";
import AwsFaceLivenessVerification from "@/components/doctor/AwsFaceLivenessVerification";
import {
  doctorService,
  DoctorLivenessCompleteResponse,
  DoctorProfileCompletionData,
} from "@/services/doctorService";
import axiosClient from "@/services/axiosClient";
import { API_ENDPOINTS } from "@/services/api";
import { mapDoctorFromDetail } from "@/services/mappers";
import { PH_CITIES } from "@/data/phCities";

const SPECIALTIES = [
  "General Medicine", "Internal Medicine", "Pediatrics", "OB-GYN",
  "Dermatology", "Cardiology", "Neurology", "Orthopedics",
  "ENT", "Ophthalmology", "Psychiatry", "Pulmonology",
  "Gastroenterology", "Endocrinology", "Urology", "Nephrology",
  "Oncology", "Rheumatology", "Surgery", "Dentistry", "Other",
];

const CITIES = PH_CITIES;

const LANGUAGES = ["Filipino", "English", "Cebuano", "Ilocano", "Hiligaynon", "Waray", "Other"];

const SERVICE_CHOICES = [
  "Medical Certificate", "Follow-up Consult", "Prescription Renewal",
  "Lab Result Interpretation", "Sick Leave Certificate", "Referral Letter",
  "Annual Physical Exam", "Teleconsult", "Home Visit", "Other",
];

const HMO_CHOICES = [
  "Maxicare", "Medicard", "PhilCare", "Intellicare",
  "Caritas Health Shield", "Pacific Cross", "Insular Health Care",
  "Avega", "EastWest Healthcare", "Other",
];

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const TOTAL_STEPS = 6;
const STEPS = [
  { label: "Basic Info", icon: User },
  { label: "Clinic & Fees", icon: MapPin },
  { label: "Schedule", icon: Calendar },
  { label: "Specialty", icon: Stethoscope },
  { label: "Documents & Signature", icon: FileImage },
  { label: "Face Verification", icon: ScanFace },
];

type DaySchedule = { start: string; end: string; enabled: boolean };

const defaultSchedule = (): Record<string, DaySchedule> =>
  Object.fromEntries(
    WEEKDAYS.map((d) => [d, { start: "09:00", end: "17:00", enabled: ["monday","tuesday","wednesday","thursday","friday"].includes(d) }])
  );

const toMediaUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  if (!base) return url.startsWith("/") ? url : `/${url}`;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function DoctorProfileCompletePage() {
  const router = useRouter();
  const { user, setDoctorProfileComplete } = useAuthStore();
  const { toast } = useToast();

  const [step, setStep]   = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [allowLeave, setAllowLeave] = useState(false);

  // Step 1 — Basic Info
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [bio,          setBio]          = useState("");
  const [languages,    setLanguages]    = useState<string[]>(["Filipino", "English"]);

  // Step 2 — Clinic & Fees + Services + HMOs
  const [clinicName,    setClinicName]    = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [city,          setCity]          = useState("");
  const [feeOnline,     setFeeOnline]     = useState("");
  const [feeInPerson,   setFeeInPerson]   = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedHmos,     setSelectedHmos]     = useState<string[]>([]);

  // Step 3 — Schedule
  const [schedule,   setSchedule]   = useState<Record<string, DaySchedule>>(defaultSchedule());
  const [isOnDemand, setIsOnDemand] = useState(false);

  // Step 4 — Specialty
  const [specialty,      setSpecialty]      = useState("");
  const [subInput,       setSubInput]       = useState("");
  const [subSpecialties, setSubSpecialties] = useState<string[]>([]);
  const [yearsExp,       setYearsExp]       = useState("");

  // Step 5 — Documents & Signature
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [prcCardFile, setPrcCardFile] = useState<File | null>(null);
  const [prcCardPreview, setPrcCardPreview] = useState("");
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const prcInputRef = useRef<HTMLInputElement | null>(null);

  // Step 6 — Face Verification
  const [faceFrontPreview, setFaceFrontPreview] = useState("");
  const [isFaceVerified, setIsFaceVerified] = useState(false);
  const [faceVerificationStatus, setFaceVerificationStatus] = useState("pending");
  const [faceVerificationError, setFaceVerificationError] = useState("");

  const [faceCaptureOpen, setFaceCaptureOpen] = useState(false);

  // ── Pre-populate from existing profile ──────────────────────────────────
  useEffect(() => {
    if (!user) {
      setLoadingProfile(false);
      return;
    }
    const load = async () => {
      try {
        const res = await axiosClient.get(API_ENDPOINTS.DOCTOR_PROFILE_COMPLETE);
        const detail = res.data;
        const d = mapDoctorFromDetail(detail);

        if (d.avatar) setPhotoPreview(d.avatar);
        if (d.bio) setBio(d.bio);
        if (d.languages?.length) setLanguages(d.languages);

        if (d.hospital) setClinicName(d.hospital);
        if (d.clinicAddress) setClinicAddress(d.clinicAddress);
        if (d.location) setCity(d.location);
        if (d.onlineConsultationFee) setFeeOnline(String(d.onlineConsultationFee));
        if (d.consultationFee) setFeeInPerson(String(d.consultationFee));
        if (d.services?.length) setSelectedServices(d.services);
        if (d.hmoAccepted?.length) setSelectedHmos(d.hmoAccepted);

        if (d.weeklySchedule && Object.keys(d.weeklySchedule).length > 0) {
          setSchedule((prev) => {
            const next = { ...prev };
            WEEKDAYS.forEach((day) => {
              const entry = d.weeklySchedule![day];
              if (entry) {
                next[day] = { start: entry.start, end: entry.end, enabled: true };
              } else {
                next[day] = { ...prev[day], enabled: false };
              }
            });
            return next;
          });
        }
        if (d.isOnDemand !== undefined) setIsOnDemand(Boolean(d.isOnDemand));

        if (d.specialty) setSpecialty(d.specialty);
        if (d.specialties?.length) setSubSpecialties(d.specialties);
        if (d.experience) setYearsExp(String(d.experience));

        const signatureUrl =
          detail?.signature ??
          detail?.e_signature ??
          detail?.eSignature ??
          (d as { signature?: string })?.signature;
        const prcUrl =
          detail?.prc_card_image ??
          detail?.prc_card ??
          detail?.prc_card_photo ??
          detail?.prc_card_url;

        if (signatureUrl) setSignaturePreview(toMediaUrl(signatureUrl));
        if (prcUrl) setPrcCardPreview(toMediaUrl(prcUrl));
        if (detail?.face_front) setFaceFrontPreview(toMediaUrl(detail.face_front));
        if (detail?.is_face_verified !== undefined) setIsFaceVerified(Boolean(detail.is_face_verified));
        if (detail?.face_verification_status) setFaceVerificationStatus(detail.face_verification_status);
        if (detail?.face_verification_error) setFaceVerificationError(detail.face_verification_error);

        if (detail?.is_profile_complete) {
          setAllowLeave(true);
          setDoctorProfileComplete(true);
          router.replace("/doctor");
          return;
        }
      } catch {
        // Non-fatal — wizard still works with empty defaults
      } finally {
        setLoadingProfile(false);
      }
    };
    load();
  }, [user, router, setDoctorProfileComplete]);

  // ── Block navigation away until profile is complete ──────────────────────
  useEffect(() => {
    if (allowLeave || user?.doctorProfileComplete) return;

    const confirmLeave = () =>
      window.confirm(
        "You must complete your doctor profile before leaving this page.\n\nIf you leave now, your profile will remain incomplete."
      );

    const lockedUrl = window.location.href;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    const handlePopState = () => {
      if (confirmLeave()) {
        setAllowLeave(true);
        return;
      }
      history.pushState(null, "", lockedUrl);
    };

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.hasAttribute("download") || anchor.getAttribute("target") === "_blank") return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;

      e.preventDefault();
      e.stopPropagation();
      if (confirmLeave()) {
        setAllowLeave(true);
        window.location.href = anchor.href;
      }
    };

    history.pushState(null, "", lockedUrl);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [allowLeave, user?.doctorProfileComplete]);

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  // ── Validation ────────────────────────────────────────────────────────────
  const step2Valid = Boolean(clinicName.trim()) && Boolean(feeOnline || feeInPerson);
  const step4Valid = Boolean(specialty);
  const step5Valid = Boolean(prcCardFile || prcCardPreview);
  const step6Valid = Boolean(faceFrontPreview) && Boolean(isFaceVerified);

  const stepValidity: Record<number, boolean> = {
    1: true,
    2: step2Valid,
    3: true,
    4: step4Valid,
    5: step5Valid,
    6: step6Valid,
  };

  const isCurrentStepValid = stepValidity[step];

  // ── Photo handler ─────────────────────────────────────────────────────────
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      toast({
        title: "Invalid file type",
        description: "E-signature must be a PNG with transparent background.",
        variant: "destructive",
      });
      return;
    }
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  };

  const handlePrcCard = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "PRC card must be an image file.",
        variant: "destructive",
      });
      return;
    }
    setPrcCardFile(file);
    setPrcCardPreview(URL.createObjectURL(file));
  };

  // ── Build weekly_schedule payload (only enabled days) ────────────────────
  const buildWeeklySchedule = () =>
    Object.fromEntries(
      Object.entries(schedule)
        .filter(([, v]) => v.enabled)
        .map(([day, v]) => [day, { start: v.start, end: v.end }])
    );

  // ── Save helpers ──────────────────────────────────────────────────────────
  const saveStep = async (data: DoctorProfileCompletionData) => {
    setSaving(true);
    const res = await doctorService.completeDoctorProfile(data);
    setSaving(false);
    if (!res.success) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    let ok = false;
    if (step === 1) {
      ok = await saveStep({
        bio,
        languages_spoken: languages,
        ...(photoFile ? { profile_photo: photoFile } : {}),
      });
    } else if (step === 2) {
      ok = await saveStep({
        clinic_name:                clinicName.trim(),
        clinic_address:             clinicAddress.trim(),
        city,
        consultation_fee_online:    feeOnline   ? Number(feeOnline)   : undefined,
        consultation_fee_in_person: feeInPerson ? Number(feeInPerson) : undefined,
        services: selectedServices,
        hmos:     selectedHmos,
      });
    } else if (step === 3) {
      ok = await saveStep({
        weekly_schedule: buildWeeklySchedule(),
        is_on_demand:    isOnDemand,
      });
    } else if (step === 4) {
      ok = await saveStep({
        specialty,
        sub_specialties:     subSpecialties,
        years_of_experience: yearsExp ? Number(yearsExp) : undefined,
      });
    } else if (step === 5) {
      const payload: DoctorProfileCompletionData = {};
      if (signatureFile) payload.signature = signatureFile;
      if (prcCardFile) payload.prc_card_image = prcCardFile;
      ok = await saveStep(payload);
    } else {
      if (!step6Valid) {
        toast({ title: "Face verification required", description: "Please complete the liveness check before finishing.", variant: "destructive" });
        return;
      }
      ok = await saveStep({
        is_profile_complete: true,
      });
      if (ok) {
        setAllowLeave(true);
        setDoctorProfileComplete(true);
        toast({ title: "Profile complete", description: "Your profile is now live." });
        router.replace("/doctor");
        return;
      }
    }
    if (ok) setStep((s) => s + 1);
  };

  const toggleLanguage = (lang: string) =>
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );

  const toggleDay = (day: string) =>
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));

  const updateDayTime = (day: string, field: "start" | "end", val: string) =>
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], [field]: val } }));

  const addSubSpecialty = () => {
    const val = subInput.trim();
    if (val && !subSpecialties.includes(val)) setSubSpecialties([...subSpecialties, val]);
    setSubInput("");
  };

  const handleLivenessVerified = (result: DoctorLivenessCompleteResponse) => {
    setFaceFrontPreview(toMediaUrl(result.face_front ?? ""));
    setIsFaceVerified(Boolean(result.is_face_verified));
    setFaceVerificationStatus(result.face_verification_status ?? "verified");
    setFaceVerificationError(result.face_verification_error ?? "");
    setFaceCaptureOpen(false);
    toast({
      title: "Face verification complete",
      description: "Your liveness check passed and your face matched your PRC card.",
    });
  };

  const startFaceCapture = () => {
    setFaceVerificationError("");
    setFaceCaptureOpen(true);
  };

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "DR";

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-3xl space-y-8">

        {/* Logo Header */}
        <div className="flex items-center gap-3 justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <Stethoscope className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">PulseLink</span>
        </div>

        {/* Header */}
        <div className="text-center space-y-2 px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Complete Your Doctor Profile</h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            This page is mandatory. Finish all steps to unlock your dashboard.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between px-4 md:px-8">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done    = step > n;
            const current = step === n;
            return (
              <div key={s.label} className="flex flex-col items-center gap-2 flex-1">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all shadow-md ${
                  done    ? "bg-primary border-primary text-primary-foreground scale-105" :
                  current ? "border-primary text-primary bg-primary/10 scale-110 shadow-lg" :
                            "border-muted-foreground/30 text-muted-foreground"
                }`}>
                  {done ? <Check className="h-5 w-5" /> : n}
                </div>
                <span className={`text-xs md:text-sm text-center ${current ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <Progress value={progress} className="h-2 shadow-sm" />

        {/* Step cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── Step 1: Basic Info ── */}
            {step === 1 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Photo */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={photoPreview} />
                        <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                      </Avatar>
                      <label className="absolute bottom-0 right-0 h-7 w-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer shadow">
                        <Camera className="h-3.5 w-3.5" />
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} aria-label="Upload profile photo" />
                      </label>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Profile Photo</p>
                      <p className="text-xs text-muted-foreground">Builds patient trust</p>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="space-y-1.5">
                    <Label>Professional Bio</Label>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Brief professional summary shown to patients..."
                      rows={3}
                    />
                  </div>

                  {/* Languages */}
                  <div className="space-y-1.5">
                    <Label>Languages Spoken</Label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                            languages.includes(lang)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input text-muted-foreground hover:border-primary"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 2: Clinic & Fees + Services + HMOs ── */}
            {step === 2 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" /> Clinic, Fees & Services
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Required — at least one fee must be set</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Clinic / Hospital Name *</Label>
                    <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. Makati Medical Center" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Clinic Address</Label>
                    <Input value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="Full street address" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city-select">City</Label>
                    <select
                      id="city-select"
                      name="city"
                      aria-label="City"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">Select city...</option>
                      {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Online Fee (PHP)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" type="number" min="0" value={feeOnline} onChange={(e) => setFeeOnline(e.target.value)} placeholder="500" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>In-Person Fee (PHP)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" type="number" min="0" value={feeInPerson} onChange={(e) => setFeeInPerson(e.target.value)} placeholder="400" />
                      </div>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-primary" /> Services Offered
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_CHOICES.map((s) => {
                        const active = selectedServices.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() =>
                              setSelectedServices((prev) =>
                                active ? prev.filter((x) => x !== s) : [...prev, s]
                              )
                            }
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {active && <span className="mr-1">✓</span>}{s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* HMOs */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-primary" /> HMO Accepted
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {HMO_CHOICES.map((h) => {
                        const active = selectedHmos.includes(h);
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() =>
                              setSelectedHmos((prev) =>
                                active ? prev.filter((x) => x !== h) : [...prev, h]
                              )
                            }
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? "bg-primary/10 text-primary border-primary/40"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {active && <span className="mr-1">✓</span>}{h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 3: Schedule ── */}
            {step === 3 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" /> Weekly Schedule
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Set your recurring availability hours</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* On-demand toggle */}
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">On-Demand Mode</p>
                        <p className="text-xs text-muted-foreground">Show "Available Now" badge to patients</p>
                      </div>
                    </div>
                    <Switch checked={isOnDemand} onCheckedChange={setIsOnDemand} />
                  </div>

                  {/* Day schedule */}
                  <div className="space-y-2">
                    {WEEKDAYS.map((day) => (
                      <div key={day} className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                        schedule[day].enabled ? "border-primary/30 bg-primary/5" : "border-input opacity-60"
                      }`}>
                        <Switch
                          checked={schedule[day].enabled}
                          onCheckedChange={() => toggleDay(day)}
                        />
                        <span className="text-sm font-medium w-24 capitalize">{day}</span>
                        {schedule[day].enabled && (
                          <div className="flex items-center gap-2 flex-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="time" className="h-8 text-xs w-28"
                              value={schedule[day].start}
                              onChange={(e) => updateDayTime(day, "start", e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                              type="time" className="h-8 text-xs w-28"
                              value={schedule[day].end}
                              onChange={(e) => updateDayTime(day, "end", e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 4: Specialty ── */}
            {step === 4 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-primary" /> Specialty & Experience
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Required to appear in patient search</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="primary-specialty">Primary Specialty *</Label>
                    <select
                      id="primary-specialty"
                      name="specialty"
                      aria-label="Primary Specialty"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                    >
                      <option value="">Select specialty...</option>
                      {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Sub-Specialties</Label>
                    <div className="flex gap-2">
                      <Input
                        value={subInput}
                        onChange={(e) => setSubInput(e.target.value)}
                        placeholder="e.g. Neonatology"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubSpecialty(); } }}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={addSubSpecialty}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {subSpecialties.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {subSpecialties.map((s) => (
                          <Badge key={s} variant="secondary" className="gap-1">
                            {s}
                            <button aria-label={`Remove ${s}`} onClick={() => setSubSpecialties(subSpecialties.filter((x) => x !== s))}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Years of Experience</Label>
                    <Input
                      type="number" min="0" max="60"
                      value={yearsExp}
                      onChange={(e) => setYearsExp(e.target.value)}
                      placeholder="e.g. 10"
                    />
                  </div>

                  <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">PRC License Reminder</p>
                    <p>Your PRC license number was submitted during registration. An admin will verify it before your profile goes live in patient search.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 5: Documents & Signature ── */}
            {step === 5 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileImage className="h-5 w-5 text-primary" /> Documents & Signature
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">PRC card is required — signature can be added later from your profile</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-primary" /> E-Signature (PNG, transparent background)
                      <span className="text-xs text-muted-foreground font-normal">(optional — can be added later)</span>
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-40 border rounded-md flex items-center justify-center bg-muted/30 overflow-hidden">
                        {signaturePreview ? (
                          <img src={signaturePreview} alt="E-signature preview" className="max-h-20 w-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">No signature uploaded</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Button type="button" variant="outline" onClick={() => signatureInputRef.current?.click()}>
                          <Camera className="h-4 w-4 mr-2" /> Upload Signature
                        </Button>
                        <p className="text-xs text-muted-foreground">PNG only. Transparent background required.</p>
                      </div>
                    </div>
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png"
                      className="hidden"
                      onChange={handleSignature}
                      aria-label="Upload e-signature file"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-primary" /> PRC License Card (front photo) *
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-40 border rounded-md flex items-center justify-center bg-muted/30 overflow-hidden">
                        {prcCardPreview ? (
                          <img src={prcCardPreview} alt="PRC card preview" className="max-h-20 w-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">No PRC card uploaded</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Button type="button" variant="outline" onClick={() => prcInputRef.current?.click()}>
                          <IdCard className="h-4 w-4 mr-2" /> Upload PRC Card
                        </Button>
                        <p className="text-xs text-muted-foreground">Clear front photo required.</p>
                      </div>
                    </div>
                    <input
                      ref={prcInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePrcCard}
                      aria-label="Upload PRC card photo"
                    />
                  </div>

                  {!step5Valid && (
                    <div className="flex items-start gap-2 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      PRC card photo is required to continue.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Step 6: Face Verification ── */}
            {step === 6 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ScanFace className="h-5 w-5 text-primary" /> Face Verification
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your live photo will be matched against your PRC card to confirm your identity.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Captured reference image */}
                  <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-muted/20">
                    <p className="text-sm font-medium text-muted-foreground">Captured Photo</p>
                    <div className="h-32 w-32 rounded-full border-4 border-primary/20 bg-muted/30 flex items-center justify-center overflow-hidden">
                      {faceFrontPreview ? (
                        <img src={faceFrontPreview} alt="Captured face" className="h-full w-full object-cover" />
                      ) : (
                        <ScanFace className="h-10 w-10 text-muted-foreground/40" />
                      )}
                    </div>
                    {isFaceVerified && (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                        <Check className="h-3.5 w-3.5" /> Matched with PRC card
                      </div>
                    )}
                  </div>

                  {/* Status + action */}
                  <div className="p-3 border rounded-lg flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ShieldCheck className="h-4 w-4 text-primary" /> Identity Check
                        {isFaceVerified ? (
                          <Badge className="bg-emerald-600 text-white">Verified</Badge>
                        ) : (
                          <Badge variant="secondary">Not Verified</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        AWS will run a live challenge then compare your face to your PRC card photo from Step 5.
                      </p>
                      {faceVerificationStatus !== "pending" && (
                        <p className="text-xs text-muted-foreground">
                          Status: <span className="font-medium capitalize">{faceVerificationStatus.replace("_", " ")}</span>
                        </p>
                      )}
                    </div>
                    <Button type="button" variant={isFaceVerified ? "outline" : "default"} onClick={startFaceCapture}>
                      <ScanFace className="h-4 w-4 mr-2" />
                      {isFaceVerified ? "Retake" : "Start Verification"}
                    </Button>
                  </div>

                  {faceVerificationError && (
                    <div className="flex items-start gap-2 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      {faceVerificationError}
                    </div>
                  )}

                  {!step6Valid && !faceVerificationError && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      Complete the face verification before finishing your profile.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1 || saving}
            className="gap-2 h-12 px-6"
          >
            <ChevronLeft className="h-5 w-5" /> Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!isCurrentStepValid || saving}
            className="gap-2 min-w-[180px] h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : step === TOTAL_STEPS ? (
              <><Check className="h-4 w-4" /> Complete Profile</>
            ) : (
              <>Next <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>

      {/* Auto-capture Modal */}
      <Dialog open={faceCaptureOpen} onOpenChange={setFaceCaptureOpen}>
        <DialogContent
          className="max-w-lg p-0 overflow-hidden max-h-[90dvh] overflow-y-auto"
        >
          <DialogTitle className="sr-only">Face Verification</DialogTitle>
          <DialogDescription className="sr-only">
            AWS face verification with liveness check
          </DialogDescription>
          <AwsFaceLivenessVerification
            onVerified={handleLivenessVerified}
            onCancel={() => setFaceCaptureOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

