"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  isToday,
  startOfMonth,
} from 'date-fns';
import {
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Search,
  StickyNote,
  Video,
  X,
  Building2,
  Zap,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Copy,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Appointment, AppointmentStatus, Doctor } from '@/types';

type PatientWithAccountHolder = Appointment['patient'] & { _accountHolder?: Appointment['patient'] };
import { appointmentService } from '@/services/appointmentService';
import { chatService } from '@/services/chatService';
import { doctorService } from '@/services/doctorService';
import { useAuthStore, useAppointmentStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DocumentComposer from '@/components/doctor/DocumentComposer';
import VideoConsultModal from '@/components/doctor/VideoConsultModal';
import { useRecordsStore } from '@/store/recordsStore';
import { sendPrescription, sendLabRequest, sendMedicalCertificate } from '../../../../features/doctor/consult/actions';
import {
  acceptAppointment,
  declineAppointment,
  markComplete,
  startVideo,
} from '../../../../features/doctor/appointments/actions';
import { formatTime12Hour } from '@/lib/utils';

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: 'Request Received', className: 'bg-warning/15 text-warning border-warning/30' },
  confirmed: { label: 'Confirmed', className: 'bg-accent/15 text-accent border-accent/30' },
  'in-progress': { label: 'In Progress', className: 'bg-primary/15 text-primary border-primary/30' },
  in_progress: { label: 'In Progress', className: 'bg-primary/15 text-primary border-primary/30' },
  completed: { label: 'Completed', className: 'bg-success/15 text-success border-success/30' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  'no-show': { label: 'No-show', className: 'bg-muted text-muted-foreground border-border' },
  no_show: { label: 'No-show', className: 'bg-muted text-muted-foreground border-border' },
};

type PaymentStatus = 'paid' | 'awaiting' | 'pending';

const paymentConfig: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-success/15 text-success border-success/30' },
  awaiting: { label: 'Awaiting Payment', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  pending: { label: 'Pending Approval', className: 'bg-warning/15 text-warning border-warning/30' },
};

const getAgeLabel = (dateOfBirth?: string) => {
  if (!dateOfBirth) return '—';
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return '—';
  const diff = Date.now() - dob.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))).toString();
};

const getGenderLabel = (gender?: string) => {
  if (!gender) return '—';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
};

const inferPaymentStatus = (apt: Appointment): PaymentStatus => {
  if (apt.paymentStatus === 'paid') return 'paid';
  if (apt.paymentStatus === 'awaiting') return 'awaiting';
  if (apt.paymentStatus === 'pending') return 'pending';
  // fallback for legacy data
  if (apt.type === 'in-clinic') return 'pending';
  return 'awaiting';
};

const isJoinable = (apt: Appointment) =>
  (apt.type === 'online' || apt.type === 'on_demand') &&
  (apt.status === 'in_progress' || apt.status === 'in-progress');

const isStartable = (apt: Appointment) => {
  if (apt.type !== 'online' && apt.type !== 'on_demand') return false;
  if (!['confirmed', 'pending'].includes(apt.status)) return false;
  const today = new Date().toISOString().split('T')[0];
  return apt.date === today;
};

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();
  const { addPrescriptionFromConsult, addLabResultFromConsult, addCertificateFromConsult } = useRecordsStore();
  const { appointments, setAppointments, updateAppointment, isLoading, setLoading } = useAppointmentStore();

  const doctor = user as Doctor | null;

  const [activeTab, setActiveTab] = useState('upcoming');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  type RefundStep = 'idle' | 'confirming' | 'processing' | 'success' | 'manual_required';
  const [refundStep, setRefundStep] = useState<RefundStep>('idle');
  const [refundNote, setRefundNote] = useState('');

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    const [aptsRes, patientsRes] = await Promise.all([
      appointmentService.getAppointments({ doctorId: user.id }),
      doctorService.getMyPatients(),
    ]);
    if (aptsRes.success) {
      const patientMap = new Map(
        (patientsRes.success ? patientsRes.data : []).map((p) => [p.id, p])
      );
      const enriched = aptsRes.data.map((apt) => {
        // apt.patient is already built from patient_profile_data in the mapper — keep it.
        // Only attach _accountHolder for proxy bookings so the UI can show "booked by X".
        const accountHolder = patientMap.get(apt.patientId) ?? apt.patient;
        const isProxy = apt.bookedForRelationship && apt.bookedForRelationship !== 'self' && apt.bookedForName;
        const displayPatient = isProxy
          ? { ...apt.patient, _accountHolder: accountHolder }
          : apt.patient;

        return {
          ...apt,
          paymentStatus: inferPaymentStatus(apt),
          patient: displayPatient,
        };
      });
      setAppointments(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAppointments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const today = useMemo(
    () => appointments.filter((apt) => isToday(new Date(apt.date))),
    [appointments]
  );
  const upcoming = useMemo(
    () => appointments.filter((apt) => isAfter(new Date(apt.date), new Date()) && !isToday(new Date(apt.date))),
    [appointments]
  );
  const past = useMemo(
    () => appointments.filter((apt) => isBefore(new Date(apt.date), new Date()) && !isToday(new Date(apt.date))),
    [appointments]
  );
  const requests = useMemo(
    () => appointments.filter((apt) => apt.status === 'pending'),
    [appointments]
  );

  const pendingCount = requests.length;

  const filterAppointments = (list: Appointment[]) =>
    list.filter((apt) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        apt.patient?.name?.toLowerCase().includes(q) ||
        apt.patient?.email?.toLowerCase().includes(q) ||
        apt.symptoms?.toLowerCase().includes(q)
      );
    });

  const ensureConversationId = async (appointment: Appointment) => {
    if (!user) return null;
    const convRes = await chatService.createConversation(appointment.patientId, user.id, 'doctor');
    return convRes.success ? convRes.data.id : null;
  };

  type DocPayload =
    | { type: 'rx';   data: { diagnosis: string; medications: string; instructions: string; followUpDate?: string } }
    | { type: 'lab';  data: { testName: string; notes: string } }
    | { type: 'cert'; data: { purpose: string; diagnosis: string; restDays: number } };

  const sendDocs = async (appointment: Appointment, payload: DocPayload) => {
    if (!user) return;
    try {
      if (payload.type === 'rx') {
        const rx = await sendPrescription({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: user.id,
          diagnosis: payload.data.diagnosis,
          medications: payload.data.medications,
          instructions: payload.data.instructions,
          followUpDate: payload.data.followUpDate,
        });
        addPrescriptionFromConsult(rx);
      }
      if (payload.type === 'lab') {
        const lab = await sendLabRequest({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: user.id,
          testName: payload.data.testName,
          notes: payload.data.notes,
        });
        addLabResultFromConsult(lab);
      }
      if (payload.type === 'cert') {
        const cert = await sendMedicalCertificate({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: user.id,
          purpose: payload.data.purpose,
          diagnosis: payload.data.diagnosis,
          restDays: payload.data.restDays,
        });
        addCertificateFromConsult(cert);
      }
    } catch (error) {
      toast({
        title: 'Failed to send document',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      return;
    }
    const conversationId = await ensureConversationId(appointment);
    if (conversationId) {
      await chatService.sendMessage(conversationId, user.id, 'doctor', 'Document sent. Please check My Files.', 'file');
    }
    toast({ title: 'Document sent', description: 'Patient file updated.' });
  };

  const handleApprove = async (apt: Appointment) => {
    const updated = await acceptAppointment(apt.id);
    updateAppointment(apt.id, {
      status: updated?.status ?? 'confirmed',
      paymentStatus: updated?.paymentStatus ?? 'awaiting',
    });
    toast({ title: 'Appointment approved' });
  };

  const handleDecline = async (apt: Appointment, reason?: string) => {
    const updated = await declineAppointment(apt.id, reason);
    updateAppointment(apt.id, { status: updated?.status ?? 'cancelled' });
    toast({ title: 'Appointment declined' });
  };

  const handleStartVideo = async (apt: Appointment) => {
    // If already in_progress, just open the video modal
    if (apt.status === 'in_progress' || apt.status === 'in-progress') {
      setSelected(apt);
      setShowVideo(true);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (apt.date !== today) {
      toast({
        title: 'Too early to start',
        description: `This appointment is scheduled for ${format(new Date(apt.date), 'MMMM d, yyyy')}. You can only start the video on that day.`,
      });
      return;
    }
    const paymentStatus = inferPaymentStatus(apt);
    if (paymentStatus !== 'paid') {
      toast({
        title: 'Awaiting payment',
        description: 'Video consults are enabled once payment is confirmed.',
      });
      return;
    }
    try {
      const updated = await startVideo(apt.id);
      const appointmentStatus = (updated?.appointment?.status ?? 'in_progress') as AppointmentStatus;
      const videoUrl = updated?.videoRoomUrl ?? apt.videoRoomUrl;
      updateAppointment(apt.id, {
        status: appointmentStatus,
        videoRoomUrl: videoUrl,
      });
      setSelected({ ...apt, status: 'in_progress', videoRoomUrl: videoUrl });
      setShowVideo(true);
    } catch (err) {
      toast({
        title: 'Failed to start video',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRefundAndCancel = async (apt: Appointment) => {
    setRefundStep('processing');
    setIsRefunding(true);
    try {
      const res = await appointmentService.requestRefund(apt.id, refundReason);
      if (res.success) {
        const data = res.data as Appointment & { refund_issued?: boolean; refund_note?: string; needs_manual_refund?: boolean };
        updateAppointment(apt.id, { status: 'cancelled', paymentStatus: data.refund_issued ? 'refunded' : apt.paymentStatus });
        setRefundNote(data.refund_note ?? '');
        if (data.refund_issued) {
          setRefundStep('success');
        } else if (data.needs_manual_refund) {
          setRefundStep('manual_required');
        } else {
          setRefundStep('success');
          setRefundNote('Appointment cancelled. No payment was on record.');
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
      setRefundStep('confirming');
    } finally {
      setIsRefunding(false);
    }
  };

  const closeRefundDialog = () => {
    setRefundDialogOpen(false);
    setRefundStep('idle');
    setRefundReason('');
    setRefundNote('');
  };

  const handleMarkComplete = async (apt: Appointment) => {
    const updated = await markComplete(apt.id);
    updateAppointment(apt.id, { status: updated?.status ?? 'completed', paymentStatus: updated?.paymentStatus ?? 'paid' });
    toast({ title: 'Consultation completed' });
  };

  const renderList = (list: Appointment[], emptyTitle: string, emptyDesc: string, emptyAction?: React.ReactNode) => {
    const filtered = filterAppointments(list);
    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={<Calendar className="h-12 w-12 text-muted-foreground/40" />}
          title={emptyTitle}
          description={emptyDesc}
          action={emptyAction}
        />
      );
    }
    return (
      <div className="space-y-3">
        {filtered.map((apt, i) => (
          <AppointmentCard
            key={apt.id}
            appointment={apt}
            index={i}
            onApprove={() => handleApprove(apt)}
            onDecline={() => {
              setSelected(apt);
              setCancelReason('');
              setCancelDialogOpen(true);
            }}
            onMessage={async () => {
              const convId = await ensureConversationId(apt);
              if (convId) router.push(`/doctor/messages?conversation=${convId}`);
            }}
            onStartVideo={() => handleStartVideo(apt)}
            onSendDocument={() => {
              setSelected(apt);
              setShowDocuments(true);
            }}
            onViewDetails={() => router.push(`/doctor/appointments/${apt.id}`)}
            onRefundCancel={() => {
              setSelected(apt);
              setRefundReason('');
              setRefundStep('confirming');
              setRefundDialogOpen(true);
            }}
            onMarkComplete={() => handleMarkComplete(apt)}
            onViewQueue={() => router.push('/doctor/queue')}
          />
        ))}
      </div>
    );
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return eachDayOfInterval({ start, end });
  }, []);

  const startOffset = getDay(startOfMonth(new Date()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Payment-aware schedule with queued and upcoming consults.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge className="bg-primary/10 text-primary border-primary/20">{pendingCount} pending requests</Badge>
            <Badge variant="secondary">{appointments.length} total</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchAppointments} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient or concern..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            onClick={() => setViewMode('calendar')}
          >
            Calendar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming
            <span className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">{upcoming.length}</span>
          </TabsTrigger>
          <TabsTrigger value="today">
            Today
            <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{today.length}</span>
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            <span className="ml-1.5 bg-warning/20 text-warning text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          </TabsTrigger>
          <TabsTrigger value="past">
            Past
            <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{past.length}</span>
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {viewMode === 'calendar' && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Calendar Preview</CardTitle>
                  <Badge variant="secondary">{format(new Date(), 'MMMM yyyy')}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="text-center">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`offset-${i}`} />
                    ))}
                    {calendarDays.map((day) => {
                      const count = appointments.filter((apt) => isSameDay(new Date(apt.date), day)).length;
                      return (
                        <div
                          key={day.toISOString()}
                          className={`rounded-lg border p-2 text-xs text-center ${isToday(day) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                        >
                          <p className="font-medium">{format(day, 'd')}</p>
                          <p className="text-[10px] text-muted-foreground">{count} appt</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <TabsContent value="upcoming" className="space-y-3">
              {renderList(
                upcoming,
                'No upcoming appointments',
                'New bookings will appear here once confirmed.',
                <Button size="sm" className="gap-2" onClick={() => router.push('/doctor/schedule')}>
                  <Zap className="h-4 w-4" />
                  Go On-Demand
                </Button>
              )}
            </TabsContent>
            <TabsContent value="today" className="space-y-3">
              {renderList(
                today,
                'No appointments today',
                'Stay on-demand to receive instant consults.',
                <Button size="sm" className="gap-2" onClick={() => router.push('/doctor/schedule')}>
                  <Zap className="h-4 w-4" />
                  Go On-Demand
                </Button>
              )}
            </TabsContent>
            <TabsContent value="requests" className="space-y-3">
              {renderList(
                requests,
                'No pending requests',
                'New appointment requests will appear here.',
                <Button size="sm" variant="outline" onClick={fetchAppointments}>
                  Refresh
                </Button>
              )}
            </TabsContent>
            <TabsContent value="past" className="space-y-3">
              {renderList(
                past,
                'No past appointments',
                'Completed and cancelled consultations will show here.'
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={showDocuments} onOpenChange={setShowDocuments}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Document</DialogTitle>
          </DialogHeader>
          {selected && (
            <DocumentComposer
              onSendPrescription={(data) => sendDocs(selected, { type: 'rx', data })}
              onSendLab={(data) => sendDocs(selected, { type: 'lab', data })}
              onSendCertificate={(data) => sendDocs(selected, { type: 'cert', data })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>Review appointment information and patient notes.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selected.patient?.avatar} />
                  <AvatarFallback>{selected.patient?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selected.patient?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.bookedForRelationship !== 'self' && selected.bookedForName
                      ? `${selected.bookedForAge ? `${selected.bookedForAge} yrs` : '—'} • ${getGenderLabel(selected.bookedForGender)} • booked by ${(selected.patient as PatientWithAccountHolder)?._accountHolder?.name || 'Account Holder'}`
                      : `${getAgeLabel(selected.patient?.dateOfBirth)} yrs • ${getGenderLabel(selected.patient?.gender)}`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Date & Time</p>
                  <p className="font-medium">{format(new Date(selected.date), 'MMMM d, yyyy')}</p>
                  <p className="text-muted-foreground">{formatTime12Hour(selected.time)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Type</p>
                  <p className="font-medium flex items-center gap-1">
                    {selected.type === 'online' ? <Video className="h-3.5 w-3.5 text-primary" /> : <Building2 className="h-3.5 w-3.5" />}
                    {selected.type === 'online' ? 'Video Consultation' : 'In-Clinic Visit'}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Status</p>
                  <Badge className={statusConfig[selected.status].className}>
                    {statusConfig[selected.status].label}
                  </Badge>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Payment</p>
                  <Badge className={paymentConfig[inferPaymentStatus(selected)].className}>
                    {paymentConfig[inferPaymentStatus(selected)].label}
                  </Badge>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground text-xs mb-1">Reason / Symptoms</p>
                <p>{selected.symptoms || '—'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>Provide a reason to notify the patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Reason for cancellation"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selected) handleDecline(selected, cancelReason);
                setCancelDialogOpen(false);
              }}
            >
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialogOpen} onOpenChange={(open) => { if (!open) closeRefundDialog(); }}>
        <DialogContent className="max-w-md">
          <AnimatePresence mode="wait">

            {refundStep === 'confirming' && (
              <motion.div key="confirming" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-destructive" />
                    Refund & Cancel Appointment
                  </DialogTitle>
                  <DialogDescription>Review the details before proceeding.</DialogDescription>
                </DialogHeader>
                {selected && (
                  <div className="my-4 rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Patient</span>
                      <span className="font-medium">{selected.patient?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{format(new Date(selected.date), 'MMM d, yyyy')} at {formatTime12Hour(selected.time)}</span>
                    </div>
                    {selected.paymentStatus === 'paid' && (
                      <>
                        <div className="h-px bg-border" />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Refund Amount</span>
                          <span className="text-lg font-bold text-primary">
                            ₱{selected.fee?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '0.00'}
                          </span>
                        </div>
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 text-xs text-blue-700 dark:text-blue-300">
                          GCash/Maya: typically instant · Cards: 3–7 business days
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="space-y-1.5 mb-4">
                  <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    placeholder="e.g. Patient requested cancellation"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={closeRefundDialog}>Go Back</Button>
                  <Button variant="destructive" onClick={() => selected && handleRefundAndCancel(selected)} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Confirm Refund & Cancel
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {refundStep === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-medium">Processing refund…</p>
                <p className="text-xs text-muted-foreground text-center">Contacting PayMongo. Please don&apos;t close this window.</p>
              </motion.div>
            )}

            {refundStep === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 flex flex-col items-center gap-4 text-center">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-base font-semibold">Refund Processed!</p>
                  <p className="text-sm text-muted-foreground mt-1">{refundNote || 'The appointment has been cancelled and the patient has been refunded.'}</p>
                </div>
                <div className="w-full rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
                  GCash/Maya: typically instant · Credit/Debit cards: 3–7 business days
                </div>
                <Button className="w-full" onClick={closeRefundDialog}>Done</Button>
              </motion.div>
            )}

            {refundStep === 'manual_required' && (
              <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-5 w-5" />
                    Manual Refund Required
                  </DialogTitle>
                  <DialogDescription>
                    Appointment cancelled. Automatic refund failed (insufficient payout balance). Follow these steps.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-3">
                  {selected && (
                    <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                      <div>
                        <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Payment Reference</p>
                        <p className="font-mono font-bold text-amber-800 dark:text-amber-200">APT-{selected.id.slice(-8).toUpperCase()}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-amber-700 hover:bg-amber-100"
                        onClick={() => { navigator.clipboard.writeText(`APT-${selected.id.slice(-8).toUpperCase()}`); toast({ title: 'Copied!' }); }}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {[
                      { n: 1, label: 'Open PayMongo Dashboard', sub: 'Go to Payments section', href: 'https://dashboard.paymongo.com/payments' },
                      { n: 2, label: 'Find the payment', sub: selected ? `Search: APT-${selected.id.slice(-8).toUpperCase()}` : '' },
                      { n: 3, label: 'Click "Refund"', sub: 'Select full refund and confirm' },
                      { n: 4, label: 'Notify the patient', sub: 'Send a message once done' },
                    ].map(({ n, label, sub, href }) => (
                      <div key={n} className="flex items-start gap-3">
                        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                        <div className="flex-1">
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                              {label} <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <p className="text-sm font-medium">{label}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={closeRefundDialog}>Close</Button>
                  <Button className="gap-2" onClick={() => window.open('https://dashboard.paymongo.com/payments', '_blank')}>
                    <ExternalLink className="h-4 w-4" /> Open PayMongo
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <VideoConsultModal
        open={showVideo}
        appointment={selected}
        onClose={() => setShowVideo(false)}
        onEnd={async () => {
          setShowVideo(false);
          if (selected && user) {
            const convId = await ensureConversationId(selected);
            if (convId) {
              await chatService.sendMessage(convId, user.id, 'doctor', 'Video consultation ended. Transcript saved.', 'text');
            }
          }
        }}
        onSendPrescription={(data) => selected && sendDocs(selected, { type: 'rx', data })}
        onSendLab={(data) => selected && sendDocs(selected, { type: 'lab', data })}
        onSendCertificate={(data) => selected && sendDocs(selected, { type: 'cert', data })}
      />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
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

interface AppointmentCardProps {
  appointment: Appointment;
  index: number;
  onApprove: () => void;
  onDecline: () => void;
  onMessage: () => void;
  onStartVideo: () => void;
  onSendDocument: () => void;
  onViewDetails: () => void;
  onMarkComplete: () => void;
  onViewQueue: () => void;
  onRefundCancel: () => void;
}

function AppointmentCard({
  appointment,
  index,
  onApprove,
  onDecline,
  onMessage,
  onStartVideo,
  onSendDocument,
  onViewDetails,
  onMarkComplete,
  onViewQueue,
  onRefundCancel,
}: AppointmentCardProps) {
  const canJoin = isJoinable(appointment);
  const canStart = isStartable(appointment);
  const cfg = statusConfig[appointment.status];
  const paymentStatus = inferPaymentStatus(appointment);
  const paymentBadge = paymentConfig[paymentStatus];
  const showQueueLink = isToday(new Date(appointment.date)) && ['confirmed', 'in-progress', 'in_progress'].includes(appointment.status);
  const isActiveStatus = ['pending', 'confirmed', 'in_progress', 'in-progress'].includes(appointment.status);
  const isFutureOrToday = !isBefore(new Date(appointment.date), new Date()) || isToday(new Date(appointment.date));
  const canCancel = isActiveStatus && isFutureOrToday;
  const canRefund = appointment.status === 'confirmed' && isFutureOrToday;
  const canSendDoc = appointment.status === 'in_progress' || appointment.status === 'in-progress';
  const canMarkComplete = canSendDoc || (appointment.status === 'confirmed' && isToday(new Date(appointment.date)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className={`hover:shadow-sm transition-shadow ${appointment.status === 'pending' ? 'border-warning/40 bg-warning/5' : ''}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex gap-3 flex-1 min-w-0">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={appointment.patient?.avatar} />
                <AvatarFallback>{appointment.patient?.name?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{appointment.patient?.name}</h3>
                  {appointment.status === 'pending' && (
                    <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">Request</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {appointment.bookedForRelationship !== 'self' && appointment.bookedForName
                    ? `${appointment.bookedForAge ? `${appointment.bookedForAge} yrs` : '—'} • ${getGenderLabel(appointment.bookedForGender)} • via ${(appointment.patient as PatientWithAccountHolder)?._accountHolder?.name || 'Account Holder'}`
                    : `${getAgeLabel(appointment.patient?.dateOfBirth)} yrs • ${getGenderLabel(appointment.patient?.gender)}`}
                </p>
                {appointment.symptoms && (
                  <p className="text-xs text-muted-foreground truncate">Reason: {appointment.symptoms}</p>
                )}
              </div>
            </div>

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
                {appointment.type === 'online' ? <Video className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                {appointment.type === 'online' ? 'Video' : 'In-Clinic'}
              </Badge>
              <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
              <Badge className={`text-xs ${paymentBadge.className}`}>{paymentBadge.label}</Badge>
              {showQueueLink && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onViewQueue}>
                  <Bell className="h-3.5 w-3.5" />
                  View Queue
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {appointment.status === 'pending' && (
                <>
                  <Button size="sm" onClick={onApprove}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={onDecline}>Decline</Button>
                </>
              )}
              {canStart && (
                <Button size="sm" onClick={onStartVideo} className="gap-1.5 bg-primary text-primary-foreground">
                  <Video className="h-3.5 w-3.5" />Start Video
                </Button>
              )}
              {canJoin && (
                <Button size="sm" onClick={onStartVideo} variant="outline" className="gap-1.5">
                  <Video className="h-3.5 w-3.5" />Resume Call
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
                    <StickyNote className="h-4 w-4 mr-2" />View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onMessage}>
                    <MessageCircle className="h-4 w-4 mr-2" />Message
                  </DropdownMenuItem>
                  {canSendDoc && (
                    <DropdownMenuItem onClick={onSendDocument}>
                      <FileText className="h-4 w-4 mr-2" />Send Document
                    </DropdownMenuItem>
                  )}
                  {canMarkComplete && (
                    <DropdownMenuItem onClick={onMarkComplete}>
                      <CheckCircle className="h-4 w-4 mr-2" />Mark Complete
                    </DropdownMenuItem>
                  )}
                  {canRefund && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onRefundCancel} className="text-destructive focus:text-destructive">
                        <RefreshCw className="h-4 w-4 mr-2" />Refund &amp; Cancel
                      </DropdownMenuItem>
                    </>
                  )}
                  {canCancel && !canRefund && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onDecline} className="text-destructive focus:text-destructive">
                        <X className="h-4 w-4 mr-2" />Cancel
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {(canStart || canJoin) && (
            <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2">
              {canJoin ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-medium">Session in progress — patient may be waiting</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Video className="h-4 w-4" />
                  <span className="font-medium">Ready to start the video consult?</span>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={onStartVideo} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-1.5 text-xs">
                <Video className="h-3 w-3" />{canJoin ? 'Resume' : 'Start Now'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
