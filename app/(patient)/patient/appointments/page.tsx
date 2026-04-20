"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Calendar, Clock, Video, Building2, MoreVertical,
  Loader2, Search, X, MessageCircle, RefreshCw,
  Zap, FileText, Eye, CalendarCheck, ChevronRight,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { appointmentService } from '@/services/appointmentService';
import { doctorService } from '@/services/doctorService';
import { chatService } from '@/services/chatService';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Appointment, AppointmentStatus } from '@/types';
import { formatTime12Hour } from '@/lib/utils';
import { api, API_ENDPOINTS } from '@/services/api';

interface FollowUpInvitation {
  id: number;
  follow_up_date: string;
  status: 'pending' | 'ignored' | 'booked';
  doctor_name?: string | null;
  doctor_specialty?: string | null;
}

// ── Status display config ─────────────────────────────────────────────────────
const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  pending:       { label: 'Pending',     className: 'bg-warning/15 text-warning border-warning/30' },
  confirmed:     { label: 'Confirmed',   className: 'bg-accent/15 text-accent border-accent/30' },
  'in-progress': { label: 'In Progress', className: 'bg-primary/15 text-primary border-primary/30' },
  in_progress:   { label: 'In Progress', className: 'bg-primary/15 text-primary border-primary/30' },
  completed:     { label: 'Completed',   className: 'bg-success/15 text-success border-success/30' },
  cancelled:     { label: 'Cancelled',   className: 'bg-destructive/15 text-destructive border-destructive/30' },
  'no-show':     { label: 'No-show',     className: 'bg-muted text-muted-foreground border-border' },
  no_show:       { label: 'No-show',     className: 'bg-muted text-muted-foreground border-border' },
};

/**
 * Patient can ONLY join when the doctor has clicked "Start Video Consultation"
 * and the appointment status is in_progress. Confirmed/pending = not yet started.
 */
function isJoinable(apt: Appointment): boolean {
  if (apt.type !== 'online' && apt.type !== 'on_demand') return false;
  return apt.status === 'in_progress' || apt.status === 'in-progress';
}

function isConfirmedFuture(apt: Appointment): boolean {
  if (apt.type !== 'online' && apt.type !== 'on_demand') return false;
  if (apt.status !== 'confirmed') return false;
  const today = new Date().toISOString().split('T')[0];
  return apt.date > today;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const router     = useRouter();
  const { user }   = useAuthStore();
  const { toast }  = useToast();

  const [invitations, setInvitations] = useState<FollowUpInvitation[]>([]);
  const [appointments,      setAppointments]      = useState<Appointment[]>([]);
  const [isLoading,         setIsLoading]         = useState(true);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [cancelDialogOpen,  setCancelDialogOpen]  = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [detailDialogOpen,  setDetailDialogOpen]  = useState(false);
  const [selectedApt,       setSelectedApt]       = useState<Appointment | null>(null);
  const [cancelReason,      setCancelReason]      = useState('');
  const [isCancelling,      setIsCancelling]      = useState(false);

  useEffect(() => {
    api.get<FollowUpInvitation[]>(API_ENDPOINTS.FOLLOW_UP_INVITATIONS)
      .then((data) => setInvitations((data ?? []).filter((i) => i.status === 'pending')))
      .catch(() => {});
  }, []);

  const fetchAppointments = async () => {
    if (!user) return;
    setIsLoading(true);
    const res = await appointmentService.getAppointments({ patientId: user.id });
    if (res.success) {
      const enriched = await Promise.all(
        res.data.map(async (apt) => {
          if (apt.doctor?.avatar) return apt;
          const id = apt.doctorProfileId ?? apt.doctorId;
          if (!id) return apt;
          const dr = await doctorService.getDoctorById(id);
          return dr.success ? { ...apt, doctor: dr.data } : apt;
        })
      );
      setAppointments(enriched);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user) fetchAppointments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCancelAppointment = async () => {
    if (!selectedApt) return;
    setIsCancelling(true);
    try {
      const res = await appointmentService.cancelAppointment(selectedApt.id, cancelReason);
      if (res.success) {
        const refundIssued = res.data.refund_issued;
        const refundNote   = res.data.refund_note;
        toast({
          title: refundIssued ? 'Cancelled & Refunded' : 'Appointment Cancelled',
          description: refundNote ?? 'Your appointment has been cancelled.',
        });
        fetchAppointments();
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e?.status === 403) {
        setCancelDialogOpen(false);
        setConfirmDialogOpen(true);
      } else {
        toast({ title: 'Error', description: e?.message ?? 'Failed to cancel.', variant: 'destructive' });
      }
    } finally {
      setIsCancelling(false);
      setCancelDialogOpen(false);
      setCancelReason('');
      setSelectedApt(null);
    }
  };

  const handleOpenCancel = (apt: Appointment) => {
    setSelectedApt(apt);
    if (apt.status === 'confirmed') {
      setConfirmDialogOpen(true);
    } else {
      setCancelDialogOpen(true);
    }
  };

  const handleMessageDoctor = async (apt: Appointment) => {
    if (!user || !apt.doctor) return;
    const res = await chatService.createConversation(user.id, apt.doctorId);
    if (res.success) router.push(`/patient/messages?conversation=${res.data.id}`);
  };

  const isAppointmentPast = (apt: Appointment): boolean => {
    // Active appointments (pending/confirmed/in_progress) are NEVER past
    if (['pending', 'confirmed', 'in_progress', 'in-progress'].includes(apt.status)) {
      return false;
    }
    // Completed appointments are always past
    if (apt.status === 'completed') {
      return true;
    }
    // For other statuses, check date/time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (apt.date < today) return true;
    if (apt.date === today) {
      const aptTime = new Date(`${apt.date}T${apt.time.length === 5 ? apt.time : new Date(`1970-01-01 ${apt.time}`).toTimeString().slice(0, 5)}`);
      return aptTime < now;
    }
    return false;
  };

  const filter = (tab: 'upcoming' | 'past' | 'cancelled') => {
    return appointments.filter(apt => {
      const matchSearch = !searchQuery ||
        apt.doctor?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.doctor?.specialty?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      const isPast = isAppointmentPast(apt);
      if (tab === 'upcoming')   return !isPast && !['cancelled', 'completed'].includes(apt.status);
      if (tab === 'past')       return isPast || apt.status === 'completed';
      if (tab === 'cancelled')  return apt.status === 'cancelled';
      return true;
    });
  };

  const upcoming  = filter('upcoming');
  const past      = filter('past');
  const cancelled = filter('cancelled');

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Follow-up Invitations Banner */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5" />
              Follow-Up Invitations
            </p>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="group relative flex items-center gap-4 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/8 to-primary/4 px-4 py-3.5 cursor-pointer hover:border-primary/50 hover:from-primary/12 hover:to-primary/8 transition-all duration-200 shadow-sm"
                onClick={() => router.push(`/patient/invitations/${inv.id}`)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {inv.doctor_name ?? 'Your doctor'} invited you for a follow-up
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inv.doctor_specialty && <span className="text-primary font-medium">{inv.doctor_specialty} · </span>}
                    Suggested: <span className="font-medium text-foreground">
                      {inv.follow_up_date ? format(new Date(inv.follow_up_date), 'MMM d, yyyy') : '—'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-medium hidden sm:flex">
                    Pending
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Appointments</h1>
            <p className="text-muted-foreground">Manage your bookings and join video consultations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAppointments} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />Refresh
            </Button>
            <Button onClick={() => router.push('/patient/doctors')} className="gap-1.5">
              <Calendar className="h-4 w-4" />Book New
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by doctor or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming <span className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">{upcoming.length}</span>
            </TabsTrigger>
            <TabsTrigger value="past">
              Past <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{past.length}</span>
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{cancelled.length}</span>
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="upcoming" className="space-y-3">
                {upcoming.length === 0 ? (
                  <EmptyState
                    icon={<Calendar className="h-12 w-12 text-muted-foreground/40" />}
                    title="No upcoming appointments"
                    description="Need immediate help? Consult a doctor now without prior booking."
                    action={
                      <Button onClick={() => router.push('/patient/doctors?available=true')} className="gap-2">
                        <Zap className="h-4 w-4" />Consult Now
                      </Button>
                    }
                  />
                ) : (
                  upcoming.map((apt, i) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      index={i}
                      onCancel={() => handleOpenCancel(apt)}
                      onMessage={() => handleMessageDoctor(apt)}
                      onViewDetails={() => router.push(`/patient/appointments/${apt.id}`)}
                      onJoinVideo={() => router.push(`/patient/teleconsult/${apt.id}`)}
                      onViewDoctor={() => router.push(`/patient/doctors/${apt.doctorProfileId ?? apt.doctorId}`)}
                      onReschedule={() => router.push(`/patient/appointments/${apt.id}`)}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-3">
                {past.length === 0 ? (
                  <EmptyState
                    icon={<Calendar className="h-12 w-12 text-muted-foreground/40" />}
                    title="No past appointments"
                    description="Your completed appointments will appear here."
                  />
                ) : (
                  past.map((apt, i) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      index={i}
                      onMessage={() => handleMessageDoctor(apt)}
                      onViewDetails={() => router.push(`/patient/appointments/${apt.id}`)}
                      onViewDoctor={() => router.push(`/patient/doctors/${apt.doctorProfileId ?? apt.doctorId}`)}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="cancelled" className="space-y-3">
                {cancelled.length === 0 ? (
                  <EmptyState
                    icon={<X className="h-12 w-12 text-muted-foreground/40" />}
                    title="No cancelled appointments"
                    description="Cancelled appointments will appear here."
                  />
                ) : (
                  cancelled.map((apt, i) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      index={i}
                      onViewDetails={() => router.push(`/patient/appointments/${apt.id}`)}
                      onViewDoctor={() => router.push(`/patient/doctors/${apt.doctorProfileId ?? apt.doctorId}`)}
                    />
                  ))
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Cancel Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Appointment</DialogTitle>
              <DialogDescription>
                Cancel your appointment with{' '}
                <span className="font-semibold">{selectedApt?.doctor?.name}</span> on{' '}
                {selectedApt && format(new Date(selectedApt.date), 'MMMM d, yyyy')} at {selectedApt?.time && formatTime12Hour(selectedApt.time)}?
                {selectedApt?.paymentStatus === 'paid' && (
                  <span className="block mt-2 text-green-600 font-medium">
                    💳 A full refund will be issued automatically.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20"
                placeholder="Let your doctor know why you're cancelling..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelReason(''); }}>
                Keep Appointment
              </Button>
              <Button variant="destructive" onClick={handleCancelAppointment} disabled={isCancelling}>
                {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Yes, Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmed — must message doctor */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contact Your Doctor to Cancel</DialogTitle>
              <DialogDescription>
                Your appointment with{' '}
                <span className="font-semibold">{selectedApt?.doctor?.name}</span> is already{' '}
                <span className="font-semibold text-accent">confirmed</span>. Please message your
                doctor to request cancellation and refund.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Close</Button>
              <Button onClick={() => {
                setConfirmDialogOpen(false);
                if (selectedApt) handleMessageDoctor(selectedApt);
              }}>
                <MessageCircle className="h-4 w-4 mr-2" />Message Doctor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
            </DialogHeader>
            {selectedApt && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={selectedApt.doctor?.avatar} />
                    <AvatarFallback>{selectedApt.doctor?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{selectedApt.doctor?.name}</p>
                    <p className="text-sm text-primary">{selectedApt.doctor?.specialty}</p>
                    <p className="text-xs text-muted-foreground">{selectedApt.doctor?.hospital}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">Date & Time</p>
                    <p className="font-medium">{format(new Date(selectedApt.date), 'MMMM d, yyyy')}</p>
                    <p className="text-muted-foreground">{formatTime12Hour(selectedApt.time)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">Type</p>
                    <p className="font-medium flex items-center gap-1">
                      {selectedApt.type === 'online'
                        ? <Video className="h-3.5 w-3.5 text-primary" />
                        : <Building2 className="h-3.5 w-3.5" />}
                      {selectedApt.type === 'online' ? 'Video Consultation' : 'In-Clinic Visit'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">Status</p>
                    <Badge className={statusConfig[selectedApt.status].className}>
                      {statusConfig[selectedApt.status].label}
                    </Badge>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">Reference #</p>
                    <p className="font-mono font-medium text-xs">{selectedApt.id.toUpperCase()}</p>
                  </div>
                </div>
                {selectedApt.symptoms && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground text-xs mb-1">Reason / Symptoms</p>
                    <p>{selectedApt.symptoms}</p>
                  </div>
                )}
                {selectedApt.notes && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    <p className="text-primary text-xs font-medium mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />Doctor's Notes
                    </p>
                    <p>{selectedApt.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-3">
        <div className="flex justify-center">{icon}</div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}

// ── Appointment card ──────────────────────────────────────────────────────────
interface AppointmentCardProps {
  appointment: Appointment;
  index: number;
  onCancel?: () => void;
  onMessage?: () => void;
  onViewDetails: () => void;
  onJoinVideo?: () => void;
  onViewDoctor: () => void;
  onReschedule?: () => void;
}

function AppointmentCard({
  appointment, index, onCancel, onMessage,
  onViewDetails, onJoinVideo, onViewDoctor, onReschedule,
}: AppointmentCardProps) {
  const doctor     = appointment.doctor;
  const canJoin    = isJoinable(appointment);
  const isFuture   = isConfirmedFuture(appointment);
  const today = new Date().toISOString().split('T')[0];
  const isUpcoming = !['cancelled', 'completed'].includes(appointment.status) &&
    appointment.date >= today;
  const cfg        = statusConfig[appointment.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={onViewDetails}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4">

            {/* Doctor info */}
            <div className="flex gap-3 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <Avatar className="h-14 w-14 shrink-0 cursor-pointer" onClick={onViewDoctor}>
                <AvatarImage src={doctor?.avatar} />
                <AvatarFallback>{doctor?.name?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3
                  className="font-semibold cursor-pointer hover:text-primary transition-colors truncate"
                  onClick={onViewDoctor}
                >
                  {doctor?.name}
                </h3>
                <p className="text-sm text-primary">{doctor?.specialty}</p>
                <p className="text-xs text-muted-foreground truncate">{doctor?.hospital}</p>
              </div>
            </div>

            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(new Date(appointment.date), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime12Hour(appointment.time)}</span>
              </div>
              <Badge variant="outline" className="gap-1 text-xs">
                {appointment.type === 'online'
                  ? <Video className="h-3 w-3" />
                  : <Building2 className="h-3 w-3" />}
                {appointment.type === 'online' ? 'Video' : 'In-Clinic'}
              </Badge>
              <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
              {appointment.queuePosition && isUpcoming && (
                <Badge variant="secondary" className="text-xs">
                  Queue #{appointment.queuePosition}
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Join button — only visible when doctor has started (in_progress) */}
              {canJoin && onJoinVideo && (
                <Button
                  size="sm"
                  onClick={onJoinVideo}
                  className="gap-1.5 animate-pulse-soft"
                >
                  <Video className="h-3.5 w-3.5" />Join Video
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onViewDetails}>
                    <Eye className="h-4 w-4 mr-2" />View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onViewDoctor}>
                    <FileText className="h-4 w-4 mr-2" />Doctor Profile
                  </DropdownMenuItem>
                  {onMessage && (
                    <DropdownMenuItem onClick={onMessage}>
                      <MessageCircle className="h-4 w-4 mr-2" />Message Doctor
                    </DropdownMenuItem>
                  )}
                  {appointment.status === 'completed' && (
                    <DropdownMenuItem onClick={() => window.location.href = '/patient/records'}>
                      <FileText className="h-4 w-4 mr-2" />View Records
                    </DropdownMenuItem>
                  )}
                  {onReschedule && appointment.status === 'pending' && (
                    <DropdownMenuItem onClick={onReschedule}>
                      <RefreshCw className="h-4 w-4 mr-2" />Reschedule
                    </DropdownMenuItem>
                  )}
                  {onCancel && isUpcoming && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onCancel} className="text-destructive focus:text-destructive">
                        <X className="h-4 w-4 mr-2" />Cancel Appointment
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Symptoms */}
          {appointment.symptoms && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Reason: </span>{appointment.symptoms}
              </p>
            </div>
          )}

          {/* Future confirmed online appointment — waiting for appointment day */}
          {isFuture && (
            <div className="mt-3 pt-3 border-t flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Your video consultation is confirmed for{' '}
                <span className="font-semibold">{format(new Date(appointment.date), 'MMMM d, yyyy')}</span>.
                The "Join" button will appear once your doctor starts the session on that day.
              </span>
            </div>
          )}

          {/* Live join banner — only when doctor has started the room */}
          {canJoin && onJoinVideo && (
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">Doctor is ready — join now</span>
              </div>
              <Button size="sm" onClick={onJoinVideo} className="gap-1.5 text-xs">
                <Video className="h-3 w-3" />Join Video Call
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
