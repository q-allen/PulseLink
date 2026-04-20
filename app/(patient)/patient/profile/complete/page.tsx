"use client";

/**
 * app/(patient)/patient/profile/complete/page.tsx
 *
 * NowServing.ph pattern: post-registration onboarding is OPTIONAL and gentle.
 * - Patients can book immediately after signup (no hard gate).
 * - "Skip for now" sets is_profile_complete=true and goes to dashboard.
 * - Each step PATCHes /api/auth/me/complete/ to save progress.
 * - Step 3 uses the real family-member API (GET/POST /api/patients/family-members/).
 * - On mount: fetches GET /api/auth/me/ to pre-populate all fields.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Phone, Calendar, Heart, Shield, Users,
  ChevronRight, ChevronLeft, Check, Loader2, Plus, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuthStore, syncAuthFromBackend } from "@/store/useAuthStore";
import { useToast } from "@/hooks/use-toast";
import { userService } from "@/services/userService";
import { api, API_ENDPOINTS } from "@/services/api";
import type { FamilyMember, FamilyMemberRelationship } from "@/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const TOTAL_STEPS = 3;
const STEPS = [
  { label: "Personal",     icon: User },
  { label: "Health",       icon: Heart },
  { label: "HMO & Family", icon: Shield },
];

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "Spouse", child: "Child", parent: "Parent", sibling: "Sibling", other: "Other",
};

interface NewMemberForm {
  name: string; age: string;
  gender: "male" | "female" | "other" | "";
  relationship: FamilyMemberRelationship | "";
}
interface NewMemberErrors {
  name?: string; age?: string; gender?: string; relationship?: string;
}
const emptyMember: NewMemberForm = { name: "", age: "", gender: "", relationship: "" };

export default function PatientProfileCompletePage() {
  const router = useRouter();
  const { setUser, setProfileComplete, setFamilyMembers, familyMembers, addFamilyMember } = useAuthStore();
  const { toast } = useToast();

  const [step, setStep]         = useState(1);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);

  // Step 1
  const [firstName,  setFirstName]  = useState("");
  const [lastName,   setLastName]   = useState("");
  const [middleName, setMiddleName] = useState("");
  const [phone,      setPhone]      = useState("");
  const [birthdate,  setBirthdate]  = useState("");
  const [gender,     setGender]     = useState("");

  // Step 2
  const [bloodType,    setBloodType]    = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [allergies,    setAllergies]    = useState<string[]>([]);

  // Step 3 — HMO
  const [hmoProvider, setHmoProvider] = useState("");
  const [hmoMemberId, setHmoMemberId] = useState("");
  const [hmoFile,     setHmoFile]     = useState<File | null>(null);
  const [savingHmo,   setSavingHmo]   = useState(false);

  // Step 3 — Add family member modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember,    setNewMember]    = useState<NewMemberForm>(emptyMember);
  const [memberErrors, setMemberErrors] = useState<NewMemberErrors>({});
  const [savingMember, setSavingMember] = useState(false);

  // ── Fetch real profile on mount ───────────────────────────────────────────
  useEffect(() => {
    userService.getCurrentUser().then((result) => {
      if (result) {
        const u = result.user;
        setUser(u);
        setFamilyMembers(result.familyMembers);
        setFirstName(u.firstName  ?? "");
        setLastName(u.lastName    ?? "");
        setMiddleName(u.middleName ?? "");
        setPhone(u.phone          ?? "");
        setBirthdate(u.birthdate  ?? "");
        setGender(u.gender        ?? "");
        setBloodType(u.bloodType  ?? "");
        setAllergies(u.allergies  ?? []);
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = ((step - 1) / TOTAL_STEPS) * 100;
  const step1Valid = firstName.trim() && lastName.trim() && phone.trim() && birthdate && gender;

  // ── Save helpers ──────────────────────────────────────────────────────────
  const saveStep1 = async () => {
    setSaving(true);
    const res = await userService.completePatientProfile({
      first_name: firstName.trim(), last_name: lastName.trim(),
      middle_name: middleName.trim(), phone: phone.trim(),
      birthdate, gender: gender as "male" | "female" | "other",
    });
    setSaving(false);
    if (!res.success) { toast({ title: "Error", description: res.error, variant: "destructive" }); return false; }
    syncAuthFromBackend(res.data);
    return true;
  };

  const saveStep2 = async () => {
    setSaving(true);
    const res = await userService.completePatientProfile({ blood_type: bloodType || undefined, allergies });
    setSaving(false);
    if (!res.success) { toast({ title: "Error", description: res.error, variant: "destructive" }); return false; }
    syncAuthFromBackend(res.data);
    return true;
  };

  const saveHmo = async () => {
    if (!hmoProvider || !hmoMemberId) return;
    setSavingHmo(true);
    const res = await userService.uploadHmoCard(hmoProvider, hmoMemberId, hmoFile);
    setSavingHmo(false);
    if (res.success) toast({ title: "HMO card saved!" });
    else toast({ title: "HMO save failed", description: "You can add it later from your profile.", variant: "destructive" });
  };

  /** Sets is_profile_complete=true and redirects to dashboard. */
  const finishWizard = async () => {
    setSaving(true);
    const res = await userService.completePatientProfile({ is_profile_complete: true });
    setSaving(false);
    if (!res.success) { toast({ title: "Error", description: res.error, variant: "destructive" }); return; }
    syncAuthFromBackend(res.data);
    setProfileComplete(true);
    toast({ title: "Profile complete!", description: "Welcome to PulseLink." });
    router.replace("/patient");
  };

  /**
   * "Skip for now" — marks profile complete without requiring health/HMO data.
   * NowServing pattern: patients can always book immediately; profile is optional.
   */
  const skipWizard = async () => {
    setSaving(true);
    const res = await userService.completePatientProfile({ is_profile_complete: true });
    setSaving(false);
    if (!res.success) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return;
    }
    syncAuthFromBackend(res.data);
    setProfileComplete(true);
    router.replace("/patient");
  };

  const handleNext = async () => {
    if (step === 1) { const ok = await saveStep1(); if (ok) setStep(2); }
    else if (step === 2) { const ok = await saveStep2(); if (ok) setStep(3); }
    else { await finishWizard(); }
  };

  const addAllergy = () => {
    const val = allergyInput.trim();
    if (val && !allergies.includes(val)) setAllergies([...allergies, val]);
    setAllergyInput("");
  };

  // ── Add family member ─────────────────────────────────────────────────────
  const validateMember = (): boolean => {
    const errors: NewMemberErrors = {};
    if (!newMember.name.trim())  errors.name = "Name is required.";
    if (!newMember.age.trim() || isNaN(Number(newMember.age))) errors.age = "Valid age required.";
    if (!newMember.gender)       errors.gender = "Gender is required.";
    if (!newMember.relationship) errors.relationship = "Relationship is required.";
    setMemberErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddMember = async () => {
    if (!validateMember()) return;
    setSavingMember(true);
    try {
      const created = await api.post<FamilyMember>(API_ENDPOINTS.FAMILY_MEMBERS, {
        name: newMember.name.trim(),
        age: Number(newMember.age),
        gender: newMember.gender,
        relationship: newMember.relationship,
      });
      addFamilyMember(created);
      toast({ title: "Family member added!" });
      setShowAddModal(false);
      setNewMember(emptyMember);
      setMemberErrors({});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast({ title: "Failed to add member", description: message, variant: "destructive" });
    } finally {
      setSavingMember(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl space-y-8">

        {/* Logo Header */}
        <div className="flex items-center gap-3 justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <Heart className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">PulseLink</span>
        </div>

        {/* Header */}
        <div className="text-center space-y-3 px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            Optional — add details now to make booking faster, or skip and continue.
          </p>
          <Button
            variant="secondary"
            size="default"
            onClick={skipWizard}
            disabled={saving}
            className="mt-2 shadow-md hover:shadow-lg transition-all"
          >
            Skip for now
          </Button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between px-4 md:px-12">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = step > n; const current = step === n;
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
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}
          >
            {/* ── Step 1: Personal Info ── */}
            {step === 1 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Personal Information
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Required to book appointments</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First Name *</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Maria" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name *</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Santos" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Middle Name</Label>
                    <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone * <span className="text-muted-foreground text-xs">(+639XXXXXXXXX)</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+639171234567" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date of Birth *</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Gender *</Label>
                      <select
                        aria-label="Gender"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={gender} onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="">Select...</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 2: Health Info (optional) ── */}
            {step === 2 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" /> Health Information
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Optional — helps doctors provide better care</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Blood Type</Label>
                    <select
                      aria-label="Blood Type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={bloodType} onChange={(e) => setBloodType(e.target.value)}
                    >
                      <option value="">Select blood type...</option>
                      {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Known Allergies</Label>
                    <div className="flex gap-2">
                      <Input
                        value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)}
                        placeholder="e.g. Penicillin"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAllergy(); } }}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={addAllergy}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {allergies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {allergies.map((a) => (
                          <Badge key={a} variant="secondary" className="gap-1">
                            {a}
                            <button aria-label={`Remove ${a}`} onClick={() => setAllergies(allergies.filter((x) => x !== a))}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    🔒 Health data is encrypted and only shared with your consulting doctors.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ── Step 3: HMO & Family (optional) ── */}
            {step === 3 && (
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" /> HMO & Family Members
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Optional — add now or later from your profile</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* HMO */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> HMO / Health Insurance
                    </p>
                    <Input value={hmoProvider} onChange={(e) => setHmoProvider(e.target.value)} placeholder="Provider (e.g. Maxicare, Medicard)" />
                    <Input value={hmoMemberId} onChange={(e) => setHmoMemberId(e.target.value)} placeholder="Member ID" />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Upload HMO Card (optional)</Label>
                      <Input type="file" accept="image/*,.pdf" onChange={(e) => setHmoFile(e.target.files?.[0] ?? null)} />
                    </div>
                    {(hmoProvider || hmoMemberId) && (
                      <Button type="button" variant="outline" size="sm" onClick={saveHmo} disabled={savingHmo} className="gap-2">
                        {savingHmo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save HMO Card
                      </Button>
                    )}
                  </div>

                  {/* Family Members — real API */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" /> Family Members
                      </p>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddModal(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                    {familyMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No family members yet. Add them to book appointments on their behalf.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {familyMembers.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50 text-sm">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{m.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{m.relationship} · {m.age} yrs · {m.gender}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 1 || saving} className="gap-2 h-12 px-6">
            <ChevronLeft className="h-5 w-5" /> Back
          </Button>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleNext}
              disabled={(step === 1 && !step1Valid) || saving}
              className="gap-2 min-w-[140px] h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : step === TOTAL_STEPS ? (
                <><Check className="h-4 w-4" /> Finish</>
              ) : (
                <>Next <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Family Member Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Add Family Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input placeholder="e.g. Juan Santos Jr." value={newMember.name}
                onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))} />
              {memberErrors.name && <p className="text-xs text-destructive">{memberErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Age *</Label>
              <Input type="number" placeholder="e.g. 8" value={newMember.age}
                onChange={(e) => setNewMember((p) => ({ ...p, age: e.target.value }))} />
              {memberErrors.age && <p className="text-xs text-destructive">{memberErrors.age}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gender *</Label>
              <select aria-label="Gender" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newMember.gender} onChange={(e) => setNewMember((p) => ({ ...p, gender: e.target.value as "male" | "female" | "other" | "" }))}>  
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {memberErrors.gender && <p className="text-xs text-destructive">{memberErrors.gender}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Relationship *</Label>
              <select aria-label="Relationship" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newMember.relationship} onChange={(e) => setNewMember((p) => ({ ...p, relationship: e.target.value as FamilyMemberRelationship | "" }))}>  
                <option value="">Select...</option>
                {Object.entries(RELATIONSHIP_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              {memberErrors.relationship && <p className="text-xs text-destructive">{memberErrors.relationship}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddModal(false); setNewMember(emptyMember); setMemberErrors({}); }}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={savingMember}>
              {savingMember ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

