"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, Calendar, Clock, CreditCard, User,
  Video, Building2, CalendarCheck, CheckCircle2,
  Stethoscope, Info,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api, API_ENDPOINTS } from "@/services/api";

type InvitationStatus = "pending" | "ignored" | "booked";

interface FollowUpInvitationDetail {
  id: number;
  appointment: number;
  prescription?: number | null;
  patient: number;
  follow_up_date: string;
  status: InvitationStatus;
  ignored_at?: string | null;
  created_at: string;
  doctor_id?: number | null;
  doctor_profile_id?: number | null;
  doctor_name?: string | null;
  doctor_specialty?: string | null;
  doctor_avatar?: string | null;
  patient_name?: string | null;
  appointment_type?: "online" | "in_clinic" | "on_demand" | null;
}

export default function FollowUpInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<FollowUpInvitationDetail | null>(null);
  const [ignoring, setIgnoring] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<FollowUpInvitationDetail>(API_ENDPOINTS.FOLLOW_UP_INVITATION_DETAIL(id))
      .then((data) => setInvitation(data))
      .catch(() => {
        toast({
          title: "Invitation not found",
          description: "This booking invitation may have expired or been removed.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [id, toast]);

  const bookingDoctorId = useMemo(() => {
    if (!invitation) return null;
    return invitation.doctor_profile_id || invitation.doctor_id || null;
  }, [invitation]);

  const isIgnored = invitation?.status === "ignored";
  const suggestedDate = invitation?.follow_up_date
    ? format(new Date(invitation.follow_up_date), "MMMM d, yyyy")
    : "—";

  const consultLabel =
    invitation?.appointment_type === "in_clinic"
      ? "In-Clinic Consultation"
      : "Online Consultation";

  const consultIcon =
    invitation?.appointment_type === "in_clinic"
      ? <Building2 className="h-3 w-3" />
      : <Video className="h-3 w-3" />;

  const handleProceed = () => {
    if (!invitation || !bookingDoctorId) return;
    router.push(`/patient/book/${bookingDoctorId}?suggestedDate=${encodeURIComponent(invitation.follow_up_date)}`);
  };

  const handleIgnore = async () => {
    if (!invitation || ignoring) return;
    setIgnoring(true);
    try {
      const data = await api.post<FollowUpInvitationDetail>(
        API_ENDPOINTS.FOLLOW_UP_INVITATION_IGNORE(invitation.id),
        {}
      );
      setInvitation(data);
      toast({
        title: "Invitation ignored",
        description: "You can still book a follow-up anytime from the doctor profile.",
      });
    } catch (err) {
      toast({
        title: "Could not ignore invitation",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIgnoring(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4 px-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!invitation) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-5 px-2">

        {/* Back + heading */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              Follow-Up Invitation
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {invitation.doctor_name ?? 'Your doctor'} is recommending a follow-up visit.
            </p>
          </div>
        </div>

        {/* Status banner */}
        {isIgnored ? (
          <div className="flex items-center gap-3 rounded-xl border border-muted bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            You ignored this invitation. You can still book a follow-up anytime from the doctor profile.
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <CalendarCheck className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-foreground">Action required</span>
              <span className="text-muted-foreground"> — confirm your follow-up booking before the suggested date passes.</span>
            </div>
          </div>
        )}

        {/* Doctor card */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarImage src={invitation.doctor_avatar ?? ""} />
                <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                  {(invitation.doctor_name || "D")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-base leading-tight">{invitation.doctor_name ?? 'Doctor'}</p>
                {invitation.doctor_specialty && (
                  <p className="text-sm text-primary font-medium mt-0.5 flex items-center gap-1">
                    <Stethoscope className="h-3.5 w-3.5" />
                    {invitation.doctor_specialty}
                  </p>
                )}
              </div>
              <Badge className="gap-1.5 text-xs shrink-0 bg-primary/10 text-primary border-primary/30 px-2.5 py-1">
                {consultIcon}
                {consultLabel}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Appointment details */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Appointment Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-0">
            <div className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="flex items-center gap-3 py-3 sm:pr-5">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-semibold text-foreground">{invitation.patient_name ?? 'You'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3 sm:pl-5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suggested Date</p>
                  <p className="text-sm font-semibold text-foreground">{suggestedDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3 sm:pr-5">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm font-medium text-muted-foreground">To be set upon booking</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3 sm:pl-5">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment</p>
                  <p className="text-sm font-medium text-muted-foreground">Due upon booking</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            This is a <span className="font-medium text-foreground">suggested date</span>. You can choose a different available time slot when you proceed to booking.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          <Button
            className="w-full h-12 text-base font-bold gap-2"
            onClick={handleProceed}
            disabled={!bookingDoctorId || isIgnored}
          >
            <CheckCircle2 className="h-5 w-5" />
            Proceed to Book
          </Button>
          <Button
            variant="outline"
            className="w-full h-11 text-muted-foreground"
            onClick={handleIgnore}
            disabled={isIgnored || ignoring}
          >
            {ignoring ? 'Ignoring...' : 'Ignore Invitation'}
          </Button>
        </div>

      </div>
    </DashboardLayout>
  );
}
