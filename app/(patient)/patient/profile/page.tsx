"use client";

/**
 * app/(patient)/patient/profile/page.tsx
 *
 * NowServing.ph pattern: profile completion is optional and lightweight.
 * - Only name, phone, birthdate, gender are required for booking.
 * - All other fields (health info, HMO, family, addresses) are optional.
 * - Personal/Health tabs PATCH /api/auth/me/ (partial updates).
 * - Family members use real CRUD: /api/patients/family-members/.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User, Phone, Mail, Calendar, Droplets, AlertTriangle,
  MapPin, Shield, Edit2, Save, X, Plus, Trash2, Heart,
  Lock, Camera, CheckCircle, Users, Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePharmacyStore, DeliveryAddress } from "@/store/pharmacyStore";
import { useAuthStore, syncAuthFromBackend } from "@/store/useAuthStore";
import { api, API_ENDPOINTS } from "@/services/api";
import { userService } from "@/services/userService";
import type { FamilyMember, FamilyMemberRelationship } from "@/types";

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONSHIP_LABELS: Record<FamilyMemberRelationship, string> = {
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  other: "Other",
};

type AddressFieldKey = keyof Omit<DeliveryAddress, "id" | "isDefault">;
const addressFields: { label: string; key: AddressFieldKey; placeholder: string }[] = [
  { label: "Full Name *", key: "fullName", placeholder: "Maria Santos" },
  { label: "Mobile Number *", key: "mobile", placeholder: "09xx-xxx-xxxx" },
  { label: "House/Unit No.", key: "houseUnit", placeholder: "123" },
  { label: "Street *", key: "street", placeholder: "Makati Avenue" },
  { label: "Barangay", key: "barangay", placeholder: "Bel-Air" },
  { label: "City / Municipality *", key: "city", placeholder: "Makati City" },
  { label: "Province", key: "province", placeholder: "Metro Manila" },
  { label: "ZIP Code", key: "zipCode", placeholder: "1209" },
  { label: "Delivery Notes", key: "notes", placeholder: "Near the gate, blue mailbox" },
];

interface ProfileForm {
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  birthdate: string;
  gender: string;
  bloodType: string;
  allergies: string; // comma-separated
}

interface MemberForm {
  name: string;
  age: string;
  gender: "male" | "female" | "other" | "";
  relationship: FamilyMemberRelationship | "";
  birthdate: string;
}

const emptyMemberForm: MemberForm = {
  name: "",
  age: "",
  gender: "",
  relationship: "",
  birthdate: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { savedAddresses, addAddress } = usePharmacyStore();
  const {
    user,
    setUser,
    familyMembers,
    setFamilyMembers,
    addFamilyMember,
    updateFamilyMember,
    removeFamilyMember,
  } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  // HMO (optional)
  const [hmoProvider, setHmoProvider] = useState("");
  const [hmoMemberId, setHmoMemberId] = useState("");
  const [hmoFile, setHmoFile] = useState<File | null>(null);
  const [savingHmo, setSavingHmo] = useState(false);

  // Addresses (pharmacy store)
  const [addAddressOpen, setAddAddressOpen] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<DeliveryAddress>>({
    fullName: user?.name || "",
    mobile: "",
    houseUnit: "",
    street: "",
    barangay: "",
    city: "",
    province: "Metro Manila",
    zipCode: "",
    notes: "",
  });

  // Family member modal
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>(emptyMemberForm);
  const [memberErrors, setMemberErrors] = useState<Partial<Record<keyof MemberForm, string>>>({});
  const [savingMember, setSavingMember] = useState(false);

  // Profile form state
  const [profile, setProfile] = useState<ProfileForm>({
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    birthdate: "",
    gender: "",
    bloodType: "",
    allergies: "",
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const res = await userService.uploadAvatar(file);
    setUploadingAvatar(false);
    if (!res.success) {
      toast({ title: "Upload failed", description: res.error, variant: "destructive" });
      return;
    }
    // Sync the new avatar URL into the store
    const { updateUser } = useAuthStore.getState();
    updateUser({ avatar: res.data.avatar });
    toast({ title: "Profile photo updated" });
  };

  // ── Fetch real profile on mount ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    userService.getCurrentUser().then((result) => {
      if (!active) return;
      if (result) {
        setUser(result.user);
        setFamilyMembers(result.familyMembers);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep local form in sync with store user ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    setProfile({
      firstName: user.firstName ?? "",
      middleName: user.middleName ?? "",
      lastName: user.lastName ?? "",
      phone: user.phone ?? "",
      birthdate: user.birthdate ?? "",
      gender: user.gender ?? "",
      bloodType: user.bloodType ?? "",
      allergies: (user.allergies ?? []).join(", "),
    });
    setNewAddress((prev) => ({ ...prev, fullName: user.name ?? "" }));
  }, [user]);

  const displayName = useMemo(() => {
    const constructed = [profile.firstName, profile.middleName, profile.lastName]
      .filter(Boolean)
      .join(" ");
    return constructed || user?.name || "Patient";
  }, [profile.firstName, profile.middleName, profile.lastName, user?.name]);

  const allergyList = useMemo(
    () => (user?.allergies ?? []).map((a) => a.trim()).filter(Boolean),
    [user?.allergies]
  );

  const isProfileIncomplete = !!user && user.role === "patient" && !user.isProfileComplete;

  const getInitials = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return "NA";
    return cleaned
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Normalize PH phone to E.164 (+639XXXXXXXXX)
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("639") && digits.length === 12) return `+${digits}`;
    if (digits.startsWith("09") && digits.length === 11) return `+63${digits.slice(1)}`;
    if (digits.startsWith("9") && digits.length === 10) return `+63${digits}`;
    return raw.trim(); // return as-is; backend will validate
  };

  // ── Save handlers (PATCH /api/auth/me/) ───────────────────────────────────
  const handleSavePersonal = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      toast({ title: "Missing fields", description: "First name and last name are required.", variant: "destructive" });
      return;
    }
    setSavingSection("personal");
    const res = await userService.updateCurrentUser({
      first_name: profile.firstName.trim(),
      middle_name: profile.middleName.trim(),
      last_name: profile.lastName.trim(),
      phone: normalizePhone(profile.phone),
      birthdate: profile.birthdate || null,
      gender: profile.gender as "male" | "female" | "other",
    });
    setSavingSection(null);
    if (!res.success) {
      toast({ title: "Save failed", description: res.error, variant: "destructive" });
      return;
    }
    syncAuthFromBackend(res.data);
    toast({ title: "Personal info saved" });
    setEditingSection(null);
  };

  const handleSaveHealth = async () => {
    setSavingSection("health");
    const allergies = profile.allergies
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    const res = await userService.updateCurrentUser({
      blood_type: profile.bloodType || "",
      allergies,
    });
    setSavingSection(null);
    if (!res.success) {
      toast({ title: "Save failed", description: res.error, variant: "destructive" });
      return;
    }
    syncAuthFromBackend(res.data);
    toast({ title: "Health info saved" });
    setEditingSection(null);
  };

  const handleSaveHmo = async () => {
    if (!hmoProvider || !hmoMemberId) {
      toast({ title: "Missing HMO details", description: "Provider and member ID are required." });
      return;
    }
    setSavingHmo(true);
    const res = await userService.uploadHmoCard(hmoProvider, hmoMemberId, hmoFile);
    setSavingHmo(false);
    if (res.success) {
      toast({ title: "HMO card saved" });
      setEditingSection(null);
    } else {
      toast({ title: "HMO save failed", description: res.error, variant: "destructive" });
    }
  };

  // ── Address handlers (local pharmacy store) ───────────────────────────────
  const handleAddAddress = () => {
    if (!newAddress.fullName || !newAddress.street || !newAddress.city) {
      toast({ title: "Missing fields", description: "Please fill in required address fields.", variant: "destructive" });
      return;
    }
    addAddress(newAddress as Omit<DeliveryAddress, "id">);
    toast({ title: "Address added", description: "New delivery address saved." });
    setAddAddressOpen(false);
    setNewAddress({
      fullName: user?.name || "",
      mobile: "",
      houseUnit: "",
      street: "",
      barangay: "",
      city: "",
      province: "Metro Manila",
      zipCode: "",
      notes: "",
    });
  };

  // ── Family member CRUD (real backend) ─────────────────────────────────────
  const openAddMember = () => {
    setEditingMemberId(null);
    setMemberForm(emptyMemberForm);
    setMemberErrors({});
    setFamilyModalOpen(true);
  };

  const openEditMember = (member: FamilyMember) => {
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name,
      age: String(member.age),
      gender: member.gender,
      relationship: member.relationship,
      birthdate: member.birthdate ?? "",
    });
    setMemberErrors({});
    setFamilyModalOpen(true);
  };

  const validateMember = (): boolean => {
    const errors: Partial<Record<keyof MemberForm, string>> = {};
    if (!memberForm.name.trim()) errors.name = "Name is required.";
    if (!memberForm.age.trim() || isNaN(Number(memberForm.age))) errors.age = "Valid age required.";
    if (!memberForm.gender) errors.gender = "Gender is required.";
    if (!memberForm.relationship) errors.relationship = "Relationship is required.";
    setMemberErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveMember = async () => {
    if (!validateMember()) return;
    setSavingMember(true);
    try {
      const payload = {
        name: memberForm.name.trim(),
        age: Number(memberForm.age),
        gender: memberForm.gender,
        relationship: memberForm.relationship,
        birthdate: memberForm.birthdate || null,
      };
      if (editingMemberId) {
        const updated = await api.patch<FamilyMember>(
          API_ENDPOINTS.FAMILY_MEMBER_DETAIL(editingMemberId),
          payload
        );
        updateFamilyMember(editingMemberId, updated);
        toast({ title: "Family member updated" });
      } else {
        const created = await api.post<FamilyMember>(API_ENDPOINTS.FAMILY_MEMBERS, payload);
        addFamilyMember(created);
        toast({ title: "Family member added" });
      }
      setFamilyModalOpen(false);
      setMemberForm(emptyMemberForm);
    } catch (err) {
      toast({ title: "Family save failed", description: (err as Error)?.message, variant: "destructive" });
    } finally {
      setSavingMember(false);
    }
  };

  const deleteMember = async (id: number) => {
    try {
      await api.delete(API_ENDPOINTS.FAMILY_MEMBER_DETAIL(id));
      removeFamilyMember(id);
      toast({ title: "Family member removed" });
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error)?.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your personal info, health details, and preferences
          </p>
        </div>

        {isProfileIncomplete && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Complete your profile to make booking faster</p>
                <p className="text-xs text-muted-foreground">
                  Optional — you can still book right away.
                </p>
              </div>
              <Button size="sm" onClick={() => router.push("/patient/profile/complete")}>
                Complete Now
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="health">Health Info</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
          </TabsList>

          {/* PERSONAL INFO */}
          <TabsContent value="personal" className="space-y-4">
            {/* Avatar card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
                        <AvatarImage src={user?.avatar} alt={displayName} />
                        <AvatarFallback className="text-2xl gradient-primary text-primary-foreground">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors cursor-pointer"
                        aria-label="Change photo"
                      >
                        {uploadingAvatar
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Camera className="h-4 w-4" />}
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleAvatarChange}
                          disabled={uploadingAvatar}
                        />
                      </label>
                    </div>
                    <div className="text-center sm:text-left">
                      <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
                      <p className="text-muted-foreground text-sm">{user?.email}</p>
                      <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                        <Badge variant="secondary">Patient</Badge>
                        {hmoProvider && (
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            HMO: {hmoProvider}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Personal details */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Personal Information
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={() => setEditingSection(editingSection === "personal" ? null : "personal")}
                  >
                    {editingSection === "personal"
                      ? (<><X className="h-3.5 w-3.5" /> Cancel</>)
                      : (<><Edit2 className="h-3.5 w-3.5" /> Edit</>)}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingSection === "personal" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>First Name *</Label>
                          <Input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Last Name *</Label>
                          <Input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Middle Name</Label>
                          <Input value={profile.middleName} onChange={(e) => setProfile({ ...profile, middleName: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Phone Number *</Label>
                          <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="09XX-XXX-XXXX or +639XXXXXXXXX" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Date of Birth *</Label>
                          <Input type="date" value={profile.birthdate} onChange={(e) => setProfile({ ...profile, birthdate: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="profile-gender">Gender *</Label>
                          <select
                            id="profile-gender"
                            aria-label="Gender"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={profile.gender}
                            onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                          >
                            <option value="">Select…</option>
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      <Button onClick={handleSavePersonal} className="gap-2" disabled={savingSection === "personal"}>
                        {savingSection === "personal" ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                        ) : (
                          <><Save className="h-4 w-4" /> Save Changes</>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: "Full Name", value: displayName, icon: User },
                        { label: "Phone", value: profile.phone || "—", icon: Phone },
                        { label: "Email", value: user?.email || "—", icon: Mail },
                        { label: "Date of Birth", value: profile.birthdate || "—", icon: Calendar },
                        { label: "Gender", value: profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : "—", icon: User },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="flex items-start gap-3">
                          <div className="p-2 bg-secondary rounded-lg shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-sm font-medium text-foreground">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* HMO */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> HMO / Health Insurance
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={() => setEditingSection(editingSection === "hmo" ? null : "hmo")}
                  >
                    {editingSection === "hmo"
                      ? (<><X className="h-3.5 w-3.5" /> Cancel</>)
                      : (<><Edit2 className="h-3.5 w-3.5" /> Edit</>)}
                  </Button>
                </CardHeader>
                <CardContent>
                  {editingSection === "hmo" ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>HMO Provider</Label>
                        <Input value={hmoProvider} onChange={(e) => setHmoProvider(e.target.value)} placeholder="e.g. Maxicare" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Member ID</Label>
                        <Input value={hmoMemberId} onChange={(e) => setHmoMemberId(e.target.value)} placeholder="e.g. MXC-2024-001234" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Upload HMO Card (optional)</Label>
                        <Input type="file" accept="image/*,.pdf" onChange={(e) => setHmoFile(e.target.files?.[0] ?? null)} />
                      </div>
                      <Button onClick={handleSaveHmo} className="gap-2" disabled={savingHmo}>
                        {savingHmo ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save HMO</>}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {hmoProvider ? (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{hmoProvider}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Member No: <span className="font-mono">{hmoMemberId || "—"}</span>
                              </p>
                            </div>
                            <CheckCircle className="h-5 w-5 text-success" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No HMO on file. You can add one anytime.</p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Lock className="h-3 w-3" /> HMO info is optional and never blocks booking.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* HEALTH INFO */}
          <TabsContent value="health" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" /> Health Information
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={() => setEditingSection(editingSection === "health" ? null : "health")}
                  >
                    {editingSection === "health"
                      ? (<><X className="h-3.5 w-3.5" /> Cancel</>)
                      : (<><Edit2 className="h-3.5 w-3.5" /> Edit</>)}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  {editingSection === "health" ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="profile-blood-type">Blood Type</Label>
                        <select
                          id="profile-blood-type"
                          aria-label="Blood type"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={profile.bloodType}
                          onChange={(e) => setProfile({ ...profile, bloodType: e.target.value })}
                        >
                          <option value="">Select…</option>
                          {bloodTypes.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Known Allergies (comma-separated)</Label>
                        <Input value={profile.allergies} onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} placeholder="e.g. Penicillin, Sulfa" />
                      </div>
                      <Button onClick={handleSaveHealth} className="gap-2" disabled={savingSection === "health"}>
                        {savingSection === "health" ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                        ) : (
                          <><Save className="h-4 w-4" /> Save Changes</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Droplets className="h-8 w-8 text-destructive" />
                          <div>
                            <p className="text-xs text-muted-foreground">Blood Type</p>
                            <p className="text-2xl font-bold text-foreground">{user?.bloodType || "—"}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-warning/5 border border-warning/20 rounded-xl">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Known Allergies</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {allergyList.length === 0 ? (
                                <Badge className="bg-muted text-muted-foreground border-muted text-xs">None reported</Badge>
                              ) : (
                                allergyList.map((a, index) => (
                                  <Badge key={`${a}-${index}`} className="bg-warning/20 text-warning-foreground border-warning/30 text-xs">
                                    {a}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Health data is encrypted and shared only with your consulting doctors.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ADDRESSES */}
          <TabsContent value="addresses" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">Saved Delivery Addresses</h3>
                <Button size="sm" className="gap-1.5" onClick={() => setAddAddressOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Address
                </Button>
              </div>
              <div className="space-y-3">
                {savedAddresses.map((addr) => (
                  <Card key={addr.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-sm text-foreground">{addr.fullName}</p>
                            {addr.isDefault && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Default</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{addr.mobile}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {addr.houseUnit} {addr.street}, Brgy. {addr.barangay}, {addr.city}, {addr.province} {addr.zipCode}
                          </p>
                          {addr.notes && <p className="text-xs italic text-muted-foreground mt-0.5">{addr.notes}</p>}
                        </div>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* FAMILY MEMBERS */}
          <TabsContent value="family" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">Family Members</h3>
                <Button size="sm" className="gap-1.5" onClick={openAddMember}>
                  <Plus className="h-4 w-4" /> Add Member
                </Button>
              </div>
              <div className="space-y-3">
                {familyMembers.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      No family members yet. Add one to book appointments on their behalf.
                    </CardContent>
                  </Card>
                ) : (
                  familyMembers.map((fm) => (
                    <Card key={fm.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                              {fm.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm text-foreground">{fm.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {RELATIONSHIP_LABELS[fm.relationship] ?? fm.relationship} · {fm.age} yrs · {fm.gender}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMember(fm)}>
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMember(fm.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Family members can be selected when booking appointments for dependents.
              </p>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Add Address Dialog */}
        <Dialog open={addAddressOpen} onOpenChange={setAddAddressOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Delivery Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {addressFields.map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    placeholder={placeholder}
                    value={newAddress[key] ?? ""}
                    onChange={(e) => setNewAddress({ ...newAddress, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddAddressOpen(false)}>Cancel</Button>
              <Button onClick={handleAddAddress} className="gap-2">
                <Plus className="h-4 w-4" /> Save Address
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Family Member Dialog */}
        <Dialog open={familyModalOpen} onOpenChange={setFamilyModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {editingMemberId ? "Edit Family Member" : "Add Family Member"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={memberForm.name} onChange={(e) => setMemberForm((p) => ({ ...p, name: e.target.value }))} />
                {memberErrors.name && <p className="text-xs text-destructive">{memberErrors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Age *</Label>
                <Input type="number" value={memberForm.age} onChange={(e) => setMemberForm((p) => ({ ...p, age: e.target.value }))} />
                {memberErrors.age && <p className="text-xs text-destructive">{memberErrors.age}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Gender *</Label>
                <select
                  aria-label="Gender"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={memberForm.gender}
                  onChange={(e) => setMemberForm((p) => ({ ...p, gender: e.target.value as MemberForm["gender"] }))}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {memberErrors.gender && <p className="text-xs text-destructive">{memberErrors.gender}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Relationship *</Label>
                <select
                  aria-label="Relationship"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={memberForm.relationship}
                  onChange={(e) => setMemberForm((p) => ({ ...p, relationship: e.target.value as MemberForm["relationship"] }))}
                >
                  <option value="">Select…</option>
                  {Object.entries(RELATIONSHIP_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {memberErrors.relationship && <p className="text-xs text-destructive">{memberErrors.relationship}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Birthdate (optional)</Label>
                <Input type="date" value={memberForm.birthdate} onChange={(e) => setMemberForm((p) => ({ ...p, birthdate: e.target.value }))} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setFamilyModalOpen(false)}>Cancel</Button>
              <Button onClick={saveMember} disabled={savingMember}>
                {savingMember ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
