"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  User, Phone, Mail, MapPin, Edit2, Save, X,
  Star, Clock, Camera, Lock, CheckCircle, Stethoscope,
  Building2, Languages, DollarSign, CalendarDays, Award, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Doctor } from '@/types';
import axiosClient from '@/services/axiosClient';
import { API_ENDPOINTS } from '@/services/api';
import { mapDoctorFromDetail } from '@/services/mappers';
import VerificationBanner, { calcProfileCompletion } from '@/components/doctor/VerificationBanner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ClinicLocationPicker, { ClinicLocation } from '@/components/doctor/ClinicLocationPicker';
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const SERVICE_CHOICES = [
  'Medical Certificate', 'Follow-up Consult', 'Prescription Renewal',
  'Lab Result Interpretation', 'Sick Leave Certificate', 'Referral Letter',
  'Annual Physical Exam', 'Teleconsult', 'Home Visit', 'Other',
];

const HMO_CHOICES = [
  'Maxicare', 'Medicard', 'PhilCare', 'Intellicare',
  'Caritas Health Shield', 'Pacific Cross', 'Insular Health Care',
  'Avega', 'EastWest Healthcare', 'Other',
];

const buildProfileState = (doctor: Doctor | null) => ({
  name: doctor?.name || '',
  phone: doctor?.phone || '',
  email: doctor?.email || '',
  bio: doctor?.bio || '',
  specialty: doctor?.specialty || '',
  hospital: doctor?.hospital || '',
  location: doctor?.location || '',
  clinicAddress: doctor?.clinicAddress || '',
  experience: String(doctor?.experience ?? ''),
  consultationFee: String(doctor?.consultationFee ?? ''),
  onlineConsultationFee: String(doctor?.onlineConsultationFee ?? ''),
  languages: (doctor?.languages ?? []).join(', '),
});

export default function DoctorProfilePage() {
  const { user, setUser, updateUser } = useAuthStore();
  const { toast } = useToast();
  const doctor = user as Doctor | null;

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await axiosClient.post(API_ENDPOINTS.ME_AVATAR, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const avatarUrl: string = res.data.avatar;
      updateDoctorState({ avatar: avatarUrl });
      toast({ title: 'Profile photo updated' });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
        : 'Failed to upload photo.';
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(doctor);
  const [profile, setProfile] = useState(() => buildProfileState(doctor));
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<'personal' | 'professional' | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedHmos, setSelectedHmos] = useState<string[]>([]);
  const [clinicLocation, setClinicLocation] = useState<ClinicLocation | null>(null);

  const getInitials = (name: string) =>
    name.trim().split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'DR';

  const splitName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
    if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  };

  const updateDoctorState = (updates: Partial<Doctor>) => {
    setDoctorProfile((prev) => {
      const base = prev ?? (doctor as Doctor | null);
      if (!base) return prev;
      return { ...base, ...updates } as Doctor;
    });
    updateUser(updates);
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!doctor?.id) { setLoading(false); return; }
      setLoading(true);
      try {
        // Use the authenticated "my own profile" endpoint — works regardless of verification status.
        const res = await axiosClient.get(API_ENDPOINTS.DOCTOR_PROFILE_COMPLETE);
        const mapped = mapDoctorFromDetail(res.data);
        setDoctorProfile(mapped);
        setProfile(buildProfileState(mapped));
        setSelectedServices(mapped.services ?? []);
        setSelectedHmos(mapped.hmoAccepted ?? []);
        if (mapped.clinicLat && mapped.clinicLng) {
          setClinicLocation({
            address: mapped.clinicAddress ?? '',
            city: mapped.location ?? '',
            lat: mapped.clinicLat,
            lng: mapped.clinicLng,
          });
        }
        setUser(mapped);
      } catch (err) {
        const message =
          axios.isAxiosError(err)
            ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
            : err instanceof Error ? err.message : 'Failed to load doctor profile.';
        toast({ title: 'Profile load failed', description: message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [doctor?.id, setUser, toast]);

  const languageList = profile.languages.split(',').map((l) => l.trim()).filter(Boolean);

  const handleSavePersonal = async () => {
    setSavingSection('personal');
    try {
      const { firstName, middleName, lastName } = splitName(profile.name);
      const userPayload: Record<string, unknown> = {};
      if (firstName) userPayload.first_name = firstName;
      if (middleName) userPayload.middle_name = middleName;
      if (lastName) userPayload.last_name = lastName;
      if (profile.phone?.trim()) userPayload.phone = profile.phone.trim();

      if (Object.keys(userPayload).length > 0) {
        await axiosClient.patch(API_ENDPOINTS.ME_COMPLETE, userPayload);
      }

      await axiosClient.patch(API_ENDPOINTS.DOCTOR_PROFILE_COMPLETE, {
        languages_spoken: languageList,
      });

      updateDoctorState({
        name: profile.name,
        phone: profile.phone,
        languages: languageList,
      });

      toast({ title: 'Profile updated', description: 'Personal information saved successfully.' });
      setEditingSection(null);
    } catch (err) {
      const message =
        axios.isAxiosError(err)
          ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
          : 'Failed to save personal information.';
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveProfessional = async () => {
    setSavingSection('professional');
    try {
      const payload: Record<string, unknown> = {};
      if (profile.specialty?.trim()) payload.specialty = profile.specialty.trim();
      if (profile.hospital?.trim()) payload.clinic_name = profile.hospital.trim();
      payload.bio = profile.bio ?? '';

      // Location from map picker
      if (clinicLocation) {
        payload.clinic_address = clinicLocation.address;
        payload.city = clinicLocation.city || profile.location.trim();
        payload.clinic_lat = clinicLocation.lat;
        payload.clinic_lng = clinicLocation.lng;
      } else {
        if (profile.location?.trim()) payload.city = profile.location.trim();
        if (profile.clinicAddress?.trim()) payload.clinic_address = profile.clinicAddress.trim();
      }

      const exp = profile.experience.trim();
      payload.years_of_experience = exp === '' ? null : Number(exp);

      const feeIn = profile.consultationFee.trim();
      payload.consultation_fee_in_person = feeIn === '' ? null : Number(feeIn);

      const feeOn = profile.onlineConsultationFee.trim();
      payload.consultation_fee_online = feeOn === '' ? null : Number(feeOn);

      // Services and HMOs
      payload.services = selectedServices;
      payload.hmos = selectedHmos;

      await axiosClient.patch(API_ENDPOINTS.DOCTOR_PROFILE_COMPLETE, payload);

      updateDoctorState({
        specialty: profile.specialty,
        hospital: profile.hospital,
        location: clinicLocation?.city || profile.location,
        clinicAddress: clinicLocation?.address || profile.clinicAddress,
        clinicLat: clinicLocation?.lat,
        clinicLng: clinicLocation?.lng,
        experience: exp === '' ? 0 : Number(exp),
        consultationFee: feeIn === '' ? 0 : Number(feeIn),
        onlineConsultationFee: feeOn === '' ? 0 : Number(feeOn),
        bio: profile.bio,
        services: selectedServices,
        hmoAccepted: selectedHmos,
      });

      toast({ title: 'Profile updated', description: 'Professional details saved successfully.' });
      setEditingSection(null);
    } catch (err) {
      const message =
        axios.isAxiosError(err)
          ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
          : 'Failed to save professional details.';
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setSavingSection(null);
    }
  };

  const activeDoctor = doctorProfile ?? doctor;
  const schedule = activeDoctor?.weeklySchedule ?? {};
  const isVerified = activeDoctor?.isVerified ?? false;
  const completionPct = activeDoctor ? calcProfileCompletion(activeDoctor) : 0;

  return (
      <TooltipProvider>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your professional info, schedule, and public listing</p>
        </div>

        {/* Verification banner + completion progress */}
        <VerificationBanner doctor={activeDoctor as Doctor} />

        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          {/* ── PERSONAL ── */}
          <TabsContent value="personal" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
                        <AvatarImage src={activeDoctor?.avatar} alt={activeDoctor?.name ?? 'Doctor'} />
                        <AvatarFallback className="text-2xl gradient-primary text-primary-foreground">
                          {getInitials(activeDoctor?.name || 'DR')}
                        </AvatarFallback>
                      </Avatar>
                      <label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors cursor-pointer"
                        aria-label="Change photo"
                      >
                        {uploadingAvatar
                          ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                      <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
                      <p className="text-muted-foreground text-sm">{profile.specialty}</p>
                      <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                        <Badge variant="secondary">Doctor</Badge>
                        {activeDoctor?.isVerified ? (
                          <Badge className="bg-success/10 text-success border-success/20 gap-1">
                            <CheckCircle className="h-3 w-3" /> Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-warning/10 text-warning border-warning/20 gap-1">
                            <Clock className="h-3 w-3" /> Pending Verification
                          </Badge>
                        )}
                        {/* Completion % badge on avatar card */}
                        <Badge variant="secondary" className="gap-1">
                          {completionPct}% complete
                        </Badge>
                        {activeDoctor?.isOnDemand && (
                          <Badge className="bg-warning/10 text-warning border-warning/20">On-Demand</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Personal Information
                  </CardTitle>
                  <Button
                    variant="ghost" size="sm" className="gap-1.5 h-8"
                    onClick={() => setEditingSection(editingSection === 'personal' ? null : 'personal')}
                  >
                    {editingSection === 'personal' ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Edit2 className="h-3.5 w-3.5" /> Edit</>}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingSection === 'personal' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Full Name</Label>
                          <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Phone Number</Label>
                          <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Languages Spoken (comma-separated)</Label>
                          <Input value={profile.languages} onChange={(e) => setProfile({ ...profile, languages: e.target.value })} placeholder="English, Filipino" />
                        </div>
                      </div>
                      <Button onClick={handleSavePersonal} className="gap-2" disabled={savingSection === 'personal' || loading}>
                        <Save className="h-4 w-4" /> {savingSection === 'personal' ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: 'Full Name', value: profile.name, icon: User },
                        { label: 'Phone', value: profile.phone || '—', icon: Phone },
                        { label: 'Email', value: profile.email, icon: Mail },
                        { label: 'Location', value: profile.location || '—', icon: MapPin },
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
                      {languageList.length > 0 && (
                        <div className="flex items-start gap-3 sm:col-span-2">
                          <div className="p-2 bg-secondary rounded-lg shrink-0">
                            <Languages className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Languages</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {languageList.map((l) => (
                                <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

          </TabsContent>

          {/* ── PROFESSIONAL ── */}
          <TabsContent value="professional" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" /> Professional Details
                  </CardTitle>
                  <Button
                    variant="ghost" size="sm" className="gap-1.5 h-8"
                    onClick={() => setEditingSection(editingSection === 'professional' ? null : 'professional')}
                  >
                    {editingSection === 'professional' ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Edit2 className="h-3.5 w-3.5" /> Edit</>}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingSection === 'professional' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Specialty</Label>
                          <Input value={profile.specialty} onChange={(e) => setProfile({ ...profile, specialty: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Hospital / Clinic</Label>
                          <Input value={profile.hospital} onChange={(e) => setProfile({ ...profile, hospital: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Years of Experience</Label>
                          <Input type="number" value={profile.experience} onChange={(e) => setProfile({ ...profile, experience: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>In-Clinic Fee (₱)</Label>
                          <Input type="number" value={profile.consultationFee} onChange={(e) => setProfile({ ...profile, consultationFee: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Online Fee (₱)</Label>
                          <Input type="number" value={profile.onlineConsultationFee} onChange={(e) => setProfile({ ...profile, onlineConsultationFee: e.target.value })} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Bio / About</Label>
                          <Textarea rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Tell patients about your background and approach..." />
                        </div>
                      </div>

                      {/* ── Clinic Location (Google Maps) ── */}
                      <ClinicLocationPicker
                        value={clinicLocation}
                        onChange={setClinicLocation}
                        label="Clinic Location (pin on map)"
                      />

                      {/* ── Services ── */}
                      <div className="space-y-2">
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
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                }`}
                              >
                                {active && <span className="mr-1">✓</span>}{s}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── HMO Accepted ── */}
                      <div className="space-y-2">
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
                                    ? 'bg-primary/10 text-primary border-primary/40'
                                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                }`}
                              >
                                {active && <span className="mr-1">✓</span>}{h}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <Button onClick={handleSaveProfessional} className="gap-2" disabled={savingSection === 'professional' || loading}>
                        <Save className="h-4 w-4" /> {savingSection === 'professional' ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: 'Specialty', value: profile.specialty || '—', icon: Stethoscope },
                          { label: 'Hospital / Clinic', value: profile.hospital || '—', icon: Building2 },
                          { label: 'Location', value: profile.location || '—', icon: MapPin },
                          { label: 'Experience', value: profile.experience ? `${profile.experience} years` : '—', icon: Award },
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

                      {/* Fees */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-primary" />
                            <p className="text-xs text-muted-foreground">In-Clinic Fee</p>
                          </div>
                          <p className="text-xl font-bold text-foreground">
                            {profile.consultationFee ? `₱${Number(profile.consultationFee).toLocaleString()}` : '—'}
                          </p>
                        </div>
                        <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-accent" />
                            <p className="text-xs text-muted-foreground">Online Fee</p>
                          </div>
                          <p className="text-xl font-bold text-foreground">
                            {profile.onlineConsultationFee ? `₱${Number(profile.onlineConsultationFee).toLocaleString()}` : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Rating */}
                      {activeDoctor?.rating != null && (
                        <div className="flex items-center gap-3 p-3 bg-warning/5 border border-warning/20 rounded-xl">
                          <Star className="h-5 w-5 fill-warning text-warning shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{activeDoctor.rating.toFixed(1)} / 5.0</p>
                            <p className="text-xs text-muted-foreground">{activeDoctor.reviewCount ?? 0} patient reviews</p>
                          </div>
                        </div>
                      )}

                      {/* Bio */}
                      {profile.bio && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">About</p>
                          <p className="text-sm text-foreground leading-relaxed">{profile.bio}</p>
                        </div>
                      )}

                      {/* Education */}
                      {(activeDoctor?.education ?? []).length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Education</p>
                          <ul className="space-y-1">
                            {(activeDoctor?.education ?? []).map((edu, i) => (
                              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                                {edu}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Services */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services Offered</p>
                        {(activeDoctor?.services ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(activeDoctor?.services ?? []).map((s) => (
                              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No services added — edit to add.</p>
                        )}
                      </div>

                      {/* HMOs */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">HMO Accepted</p>
                        {(activeDoctor?.hmoAccepted ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(activeDoctor?.hmoAccepted ?? []).map((h) => (
                              <Badge key={h} className="bg-primary/10 text-primary border-primary/20 text-xs">{h}</Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No HMOs added — edit to add.</p>
                        )}
                      </div>

                      {/* Clinic location map link */}
                      {activeDoctor?.clinicLat && activeDoctor?.clinicLng && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clinic on Map</p>
                          <a
                            href={`https://www.google.com/maps?q=${activeDoctor.clinicLat},${activeDoctor.clinicLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary underline"
                          >
                            <MapPin className="h-3 w-3" />
                            {activeDoctor.clinicAddress || 'View on Google Maps'}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="p-3 bg-secondary/50 rounded-xl">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> Profile changes are reviewed before appearing in patient search results.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          {/* ── SCHEDULE ── */}
          <TabsContent value="schedule" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Weekly Schedule
                  </CardTitle>
                  <Button
                    variant="ghost" size="sm" className="gap-1.5 h-8"
                    onClick={() => toast({ title: 'Edit schedule', description: 'Use the Schedule page to update your availability.' })}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                </CardHeader>
                <CardContent>
                  {Object.keys(schedule).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No schedule set yet.</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.href = '/doctor/schedule'}>
                        Set Up Schedule
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(schedule).map(([day, hours]) => {
                        const h = hours as { start: string; end: string; consultation_types?: string };
                        return (
                          <div key={day} className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                            <div className="w-10 text-center">
                              <p className="text-xs font-bold text-primary uppercase">{DAY_LABELS[day.toLowerCase()] ?? day.slice(0, 3)}</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{h.start} – {h.end}</p>
                              {h.consultation_types && (
                                <p className="text-xs text-muted-foreground capitalize">{h.consultation_types.replace('_', ' ')}</p>
                              )}
                            </div>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" /> Consultation Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`p-4 rounded-xl border-2 transition-opacity ${
                          !isVerified
                            ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                            : activeDoctor?.acceptsOnline
                              ? 'border-success/40 bg-success/5'
                              : 'border-border bg-muted/30 opacity-60'
                        }`}>
                          <p className="text-sm font-semibold text-foreground">Online Video</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {activeDoctor?.acceptsOnline ? `₱${activeDoctor.onlineConsultationFee?.toLocaleString()}` : 'Not offered'}
                          </p>
                          {activeDoctor?.acceptsOnline && isVerified && <CheckCircle className="h-4 w-4 text-success mt-2" />}
                        </div>
                      </TooltipTrigger>
                      {!isVerified && <TooltipContent><p>Available after verification</p></TooltipContent>}
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`p-4 rounded-xl border-2 transition-opacity ${
                          !isVerified
                            ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                            : activeDoctor?.acceptsInClinic
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-muted/30 opacity-60'
                        }`}>
                          <p className="text-sm font-semibold text-foreground">In-Clinic</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {activeDoctor?.acceptsInClinic ? `₱${activeDoctor.consultationFee?.toLocaleString()}` : 'Not offered'}
                          </p>
                          {activeDoctor?.acceptsInClinic && isVerified && <CheckCircle className="h-4 w-4 text-primary mt-2" />}
                        </div>
                      </TooltipTrigger>
                      {!isVerified && <TooltipContent><p>Available after verification</p></TooltipContent>}
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
      </TooltipProvider>
  );
}
