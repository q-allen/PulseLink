"use client";

/**
 * PatientDetailsStep.tsx - SIMPLIFIED
 *
 * Step 2 of the booking flow:
 * - Default: booking for the logged-in user (pre-filled from auth store)
 * - Optional: toggle to book for someone else (shows name/age/gender/relationship fields)
 * - No "Patient Type" radio — just a simple toggle
 */

import { useEffect, useState } from "react";
import { User, Mail, FileText, MapPin, Calendar, AlertCircle, Phone, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useBookingStore } from "@/store/bookingStore";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

function computeAge(dob: string): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  return String(Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))));
}

function buildFullName(first: string, middle: string, last: string): string {
  return [first, middle, last].filter(Boolean).join(" ");
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateDateOfBirth(dob: string): string | null {
  if (!dob) return "Date of birth is required";
  const date = new Date(dob);
  if (isNaN(date.getTime())) return "Invalid date format";
  
  const today = new Date();
  if (date > today) return "Date of birth cannot be in the future";
  
  const age = Math.floor((today.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) return "You must be at least 18 years old to book an appointment";
  if (age > 120) return "Please enter a valid date of birth";
  
  return null;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  email?: string;
  sex?: string;
  homeAddress?: string;
  reasonForConsultation?: string;
  bookedForName?: string;
  bookedForAge?: string;
  bookedForGender?: string;
}

interface PatientDetailsStepProps {
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

export default function PatientDetailsStep({ onValidationChange }: PatientDetailsStepProps) {
  const { user } = useAuthStore();
  const { patientDetails, setPatientDetails } = useBookingStore();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false);
  const [isBookingForMyself, setIsBookingForMyself] = useState(false);

  // Validate all fields and notify parent
  useEffect(() => {
    const errors: FieldErrors = {};
    const errorMessages: string[] = [];

    // Reason for consultation
    if (!patientDetails.reasonForConsultation.trim()) {
      errors.reasonForConsultation = "Please describe your reason for consultation";
      errorMessages.push("Reason for consultation is required");
    }

    // First name
    if (!patientDetails.firstName.trim()) {
      errors.firstName = "First name is required";
      errorMessages.push("First name is required");
    }

    // Last name
    if (!patientDetails.lastName.trim()) {
      errors.lastName = "Last name is required";
      errorMessages.push("Last name is required");
    }

    // Date of birth
    const dobError = validateDateOfBirth(patientDetails.dateOfBirth);
    if (dobError) {
      errors.dateOfBirth = dobError;
      errorMessages.push(dobError);
    }

    // Email
    if (!patientDetails.email.trim()) {
      errors.email = "Email is required";
      errorMessages.push("Email is required");
    } else if (!isValidEmail(patientDetails.email)) {
      errors.email = "Please enter a valid email address";
      errorMessages.push("Valid email is required");
    }

    // Sex
    if (!patientDetails.sex) {
      errors.sex = "Please select your sex";
      errorMessages.push("Sex is required");
    }

    // Home address
    if (!patientDetails.homeAddress.trim()) {
      errors.homeAddress = "Home address is required";
      errorMessages.push("Home address is required");
    }

    // If booking for someone else, validate those fields too
    if (bookingForSomeoneElse) {
      if (!patientDetails.bookedForName?.trim()) {
        errors.bookedForName = "Please enter the patient's full name";
        errorMessages.push("Patient name is required");
      }
      if (!patientDetails.age) {
        errors.bookedForAge = "Please enter the patient's age";
        errorMessages.push("Patient age is required");
      }
      if (!patientDetails.sex) {
        errors.bookedForGender = "Please select the patient's gender";
        errorMessages.push("Patient gender is required");
      }
    }

    setFieldErrors(errors);
    onValidationChange?.(errorMessages.length === 0, errorMessages);
  }, [patientDetails, bookingForSomeoneElse, onValidationChange]);

  // Pre-fill ONLY PulseLink account email (read-only field)
  useEffect(() => {
    if (user?.email && !patientDetails.accountEmail) {
      setPatientDetails({ accountEmail: user.email });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleBookingForMyselfToggle = (checked: boolean) => {
    setIsBookingForMyself(checked);
    if (checked && user) {
      const nameParts = user.name?.split(' ') ?? [];
      const firstName = user.firstName || nameParts[0] || '';
      const lastName = user.lastName || nameParts[nameParts.length - 1] || '';
      const middleName = user.middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '') || '';
      const sex = (user.gender as '' | 'male' | 'female' | 'other') || '';
      syncLegacy({
        firstName,
        middleName,
        lastName,
        email: user.email || '',
        dateOfBirth: user.birthdate || '',
        sex,
        homeAddress: user.address || '',
        contactNumber: user.phone || '',
      });
    } else {
      // Clear all fields when toggled off
      syncLegacy({
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        dateOfBirth: '',
        sex: '',
        homeAddress: '',
        contactNumber: '',
      });
      setTouched({});
    }
  };

  const syncLegacy = (patch: Partial<typeof patientDetails>) => {
    const merged = { ...patientDetails, ...patch };
    const fullName = buildFullName(merged.firstName, merged.middleName, merged.lastName);
    const age = computeAge(merged.dateOfBirth);
    setPatientDetails({
      ...patch,
      fullName,
      age,
      gender: merged.sex,
      symptoms: merged.reasonForConsultation,
      isForSelf: !bookingForSomeoneElse,
      bookedForRelationship: bookingForSomeoneElse ? "other" : "self",
    });
  };

  const set = <K extends keyof typeof patientDetails>(
    field: K,
    value: typeof patientDetails[K]
  ) => {
    syncLegacy({ [field]: value } as Partial<typeof patientDetails>);
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const showError = (field: keyof FieldErrors) => {
    return touched[field] && fieldErrors[field];
  };

  return (
    <div className="space-y-6">

      {/* ── Section 1: PulseLink Account ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            PulseLink Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email — read-only, pre-filled */}
          <div className="space-y-1.5">
            <Label htmlFor="accountEmail" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="accountEmail"
              type="email"
              value={patientDetails.accountEmail}
              readOnly
              className="bg-muted/50 cursor-not-allowed text-muted-foreground"
              aria-label="PulseLink account email (read-only)"
            />
            <p className="text-xs text-muted-foreground">
              This is the email linked to your PulseLink account.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Reason for Consultation ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Reason for Consultation
            <span className="text-destructive ml-0.5">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Textarea
              placeholder="Describe your symptoms or reason for consultation..."
              value={patientDetails.reasonForConsultation}
              onChange={(e) => set("reasonForConsultation", e.target.value)}
              onBlur={() => handleBlur("reasonForConsultation")}
              rows={4}
              className={cn(
                showError("reasonForConsultation") && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {showError("reasonForConsultation") && (
              <div className="flex items-center gap-1.5 text-destructive text-sm">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{fieldErrors.reasonForConsultation}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Patient Profile ──────────────────────────────────── */}
      <Card className="border-primary/20 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <User className="h-4 w-4 text-primary" />
              </div>
              Patient Information
            </CardTitle>
            {isBookingForMyself && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Auto-filled
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-4 p-3 bg-background/60 rounded-lg border border-border/50">
            <Switch
              id="bookingForMyself"
              checked={isBookingForMyself}
              onCheckedChange={handleBookingForMyselfToggle}
            />
            <div>
              <Label htmlFor="bookingForMyself" className="text-sm font-medium text-foreground cursor-pointer">
                Booking for myself
              </Label>
              <p className="text-xs text-muted-foreground">
                {isBookingForMyself ? "Fields below have been pre-filled from your account." : "Toggle on to auto-fill with your account details."}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">

          {/* Name row */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                First Name <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="Juan"
                value={patientDetails.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                onBlur={() => handleBlur("firstName")}
                className={cn(showError("firstName") && "border-destructive focus-visible:ring-destructive")}
              />
              {showError("firstName") && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{fieldErrors.firstName}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="middleName" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Middle Name
              </Label>
              <Input
                id="middleName"
                placeholder="Santos"
                value={patientDetails.middleName}
                onChange={(e) => set("middleName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Last Name <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="Dela Cruz"
                value={patientDetails.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                onBlur={() => handleBlur("lastName")}
                className={cn(showError("lastName") && "border-destructive focus-visible:ring-destructive")}
              />
              {showError("lastName") && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{fieldErrors.lastName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Date of Birth, Email & Phone row */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Date of Birth <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={patientDetails.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                onBlur={() => handleBlur("dateOfBirth")}
                max={new Date().toISOString().split("T")[0]}
                className={cn(showError("dateOfBirth") && "border-destructive focus-visible:ring-destructive")}
              />
              {patientDetails.dateOfBirth && !showError("dateOfBirth") && (
                <p className="text-xs text-muted-foreground">Age: {computeAge(patientDetails.dateOfBirth)} years old</p>
              )}
              {showError("dateOfBirth") && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{fieldErrors.dateOfBirth}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patientEmail" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="patientEmail"
                type="email"
                placeholder="patient@email.com"
                value={patientDetails.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                className={cn(showError("email") && "border-destructive focus-visible:ring-destructive")}
              />
              {showError("email") && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{fieldErrors.email}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="contactNumber" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Contact Number
              </Label>
              <Input
                id="contactNumber"
                type="tel"
                placeholder="09XX XXX XXXX"
                value={patientDetails.contactNumber ?? ""}
                onChange={(e) => set("contactNumber" as keyof typeof patientDetails, e.target.value as never)}
              />
            </div>
          </div>

          {/* Sex */}
          <div className="space-y-2.5">
            <Label className="text-sm font-medium">
              Sex <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={patientDetails.sex}
              onValueChange={(v) => {
                set("sex", v as "" | "male" | "female" | "other");
                handleBlur("sex");
              }}
              className="flex flex-wrap gap-4"
            >
              {(["male", "female", "other"] as const).map((s) => (
                <div
                  key={s}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2.5 border transition-colors cursor-pointer",
                    patientDetails.sex === s
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/30 border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={s} id={`sex-${s}`} />
                  <Label htmlFor={`sex-${s}`} className="cursor-pointer capitalize font-normal">
                    {s === "male" ? "Male" : s === "female" ? "Female" : "Other"}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {showError("sex") && (
              <div className="flex items-center gap-1.5 text-destructive text-sm mt-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{fieldErrors.sex}</span>
              </div>
            )}
          </div>

          {/* Home Address */}
          <div className="space-y-1.5">
            <Label htmlFor="homeAddress" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Home Address <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Textarea
              id="homeAddress"
              placeholder="Street, Barangay, City, Province"
              rows={2}
              value={patientDetails.homeAddress}
              onChange={(e) => set("homeAddress", e.target.value)}
              onBlur={() => handleBlur("homeAddress")}
              className={cn(
                "resize-none",
                showError("homeAddress") && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {showError("homeAddress") && (
              <div className="flex items-center gap-1.5 text-destructive text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{fieldErrors.homeAddress}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Required fields notice */}
      <p className="text-xs text-muted-foreground text-center">
        <span className="text-destructive">*</span> Required fields must be filled before continuing.
      </p>
    </div>
  );
}

