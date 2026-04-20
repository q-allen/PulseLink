"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isToday } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, CheckCircle2, Clock, MessageCircle, RefreshCw, Video, Zap, User, Stethoscope,
} from 'lucide-react';
import { Appointment, Doctor } from '@/types';
import { appointmentService } from '@/services/appointmentService';
import { chatService } from '@/services/chatService';
import { doctorService } from '@/services/doctorService';
import { subscribeToDoctorQueue } from '@/services/queueService';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import VideoConsultModal from '@/components/doctor/VideoConsultModal';
import { useRecordsStore } from '@/store/recordsStore';
import {
  sendPrescription,
  sendLabRequest,
  sendMedicalCertificate,
} from '../../../../features/doctor/consult/actions';
import {
  markDone,
  nextPatient,
} from '../../../../features/doctor/queue/actions';

const waitMinutesPerPatient = 12;

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

/**
 * Enhanced Doctor Queue Page
 * 
 * UX Improvements:
 * - Clear "Now Serving" section with prominent patient card
 * - Organized "Waiting List" with queue positions
 * - Live queue updates via WebSocket
 * - Quick action buttons on each patient card
 * - Visual wait time estimates
 * - On-demand toggle with live status indicator
 */
export default function DoctorQueuePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser } = useAuthStore();
  const { addPrescriptionFromConsult, addLabResultFromConsult, addCertificateFromConsult } = useRecordsStore();

  const doctor = user as Doctor | null;
  const doctorId = doctor?.userId ?? doctor?.id;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | undefined>();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const currentPatient = useMemo(
    () => appointments.find((apt) => apt.id === currentPatientId) ?? null,
    [appointments, currentPatientId]
  );

  const queueWaiting = useMemo(
    () =>
      appointments
        .filter((apt) => apt.status === 'confirmed' && apt.id !== currentPatientId)
        .sort((a, b) => {
          if (a.queueNumber && b.queueNumber) return a.queueNumber - b.queueNumber;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }),
    [appointments, currentPatientId]
  );

  const completedCount = appointments.filter((apt) => apt.status === 'completed').length;
  const hasQueue = Boolean(currentPatient) || queueWaiting.length > 0;

  const enrichAppointments = (apts: Appointment[], patientMap: Map<string, import('@/types').Patient>) =>
    apts.map((apt) => {
      // apt.patient is already built from patient_profile_data in the mapper — keep it.
      // Only fall back to the account-holder record when the appointment has no patient at all.
      if (apt.patient) return apt;
      const full = patientMap.get(apt.patientId);
      return full ? { ...apt, patient: full } : apt;
    });

  // Initial load effect
  useEffect(() => {
    if (!doctorId) return;
    
    let isMounted = true;
    
    const fetchQueue = async () => {
      setLoading(true);
      const [res, patientsRes] = await Promise.all([
        appointmentService.getAppointments({ doctorId }),
        doctorService.getMyPatients(),
      ]);
      if (res.success && isMounted) {
        const patientMap = new Map(
          (patientsRes.success ? patientsRes.data : []).map((p) => [p.id, p])
        );
        const todayApts = enrichAppointments(
          res.data.filter((apt) => isToday(new Date(apt.date))),
          patientMap
        );
        setAppointments(todayApts);
        const inProgress = todayApts.find((apt) => apt.status === 'in-progress' || apt.status === 'in_progress');
        const firstWaiting = todayApts.find((apt) => apt.status === 'confirmed');
        setCurrentPatientId(inProgress?.id ?? firstWaiting?.id ?? null);
        setLastUpdated(new Date());
      }
      if (isMounted) {
        setLoading(false);
      }
    };
    
    fetchQueue();
    
    return () => {
      isMounted = false;
    };
  }, [doctorId]);

  // Manual refresh function
  const loadQueue = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    const [res, patientsRes] = await Promise.all([
      appointmentService.getAppointments({ doctorId }),
      doctorService.getMyPatients(),
    ]);
    if (res.success) {
      const patientMap = new Map(
        (patientsRes.success ? patientsRes.data : []).map((p) => [p.id, p])
      );
      const todayApts = enrichAppointments(
        res.data.filter((apt) => isToday(new Date(apt.date))),
        patientMap
      );
      setAppointments(todayApts);
      const inProgress = todayApts.find((apt) => apt.status === 'in-progress' || apt.status === 'in_progress');
      const firstWaiting = todayApts.find((apt) => apt.status === 'confirmed');
      setCurrentPatientId(inProgress?.id ?? firstWaiting?.id ?? null);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [doctorId]);

  // WebSocket subscription
  useEffect(() => {
    if (!doctorId) return;
    const ws = subscribeToDoctorQueue(doctorId, () => {
      loadQueue();
    });
    return () => ws?.close();
  }, [doctorId, loadQueue]);

  const ensureConversationId = async (appointment: Appointment) => {
    if (!user) return null;
    const convRes = await chatService.createConversation(appointment.patientId, user.id, 'doctor');
    return convRes.success ? convRes.data.id : null;
  };

  const updateAppointment = (id: string, data: Partial<Appointment>) => {
    setAppointments((prev) => prev.map((apt) => (apt.id === id ? { ...apt, ...data } : apt)));
  };

  const handleStartConsultation = async (appointment?: Appointment) => {
    const target = appointment ?? currentPatient;
    if (!target) return;
    try {
      const res = await appointmentService.startVideoConsult(target.id);
      if (!res.success) throw new Error('Failed to start video room');
      const roomUrl = res.data.videoRoomUrl;
      updateAppointment(target.id, { status: 'in-progress', videoRoomUrl: roomUrl });
      setVideoRoomUrl(roomUrl);
      setCurrentPatientId(target.id);
      setShowVideo(true);
      setLastUpdated(new Date());
    } catch (err) {
      toast({
        title: 'Failed to start consultation',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCallNext = async (appointment?: Appointment) => {
    if (currentPatient?.status === 'in-progress') {
      toast({
        title: 'Finish current consult first',
        description: 'Mark done before calling the next patient.',
      });
      return;
    }
    const next = appointment ?? queueWaiting[0];
    if (!next) return;
    await nextPatient(next.id);
    updateAppointment(next.id, { status: 'in-progress' });
    setCurrentPatientId(next.id);
    setLastUpdated(new Date());
    toast({ title: `Calling ${next.patient?.name}` });
  };

  const handleCompleteConsultation = async (appointment?: Appointment, notes?: string) => {
    const target = appointment ?? currentPatient;
    if (!target) return;
    await markDone(target.id, notes);
    updateAppointment(target.id, { status: 'completed' });
    if (currentPatientId === target.id) {
      setCurrentPatientId(queueWaiting[0]?.id ?? null);
    }
    setLastUpdated(new Date());
    toast({
      title: 'Consultation completed',
      description: queueWaiting[0]?.patient?.name
        ? `Next patient: ${queueWaiting[0].patient?.name}`
        : 'Queue is empty',
    });
  };

  const handleMessagePatient = async (appointment: Appointment) => {
    const conversationId = await ensureConversationId(appointment);
    if (conversationId) {
      router.push(`/doctor/messages?conversation=${conversationId}`);
    }
  };

  const handleSendPrescription = async (payload: { diagnosis: string; medications: string; instructions: string; followUpDate?: string }) => {
    if (!currentPatient || !user) return;
    try {
      const rx = await sendPrescription({
        appointmentId: currentPatient.id,
        patientId: currentPatient.patientId,
        doctorId: user.id,
        diagnosis: payload.diagnosis,
        medications: payload.medications,
        instructions: payload.instructions,
        followUpDate: payload.followUpDate,
      });
      addPrescriptionFromConsult(rx);
      const conversationId = await ensureConversationId(currentPatient);
      if (conversationId) {
        await chatService.sendMessage(
          conversationId,
          user.id,
          'doctor',
          'E-prescription sent. Please check My Files.',
          'prescription'
        );
      }
      toast({ title: 'Prescription sent', description: 'Patient received the e-prescription.' });
    } catch (error) {
      toast({
        title: 'Failed to send prescription',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSendLab = async (payload: { testName: string; notes: string }) => {
    if (!currentPatient || !user) return;
    try {
      const lab = await sendLabRequest({
        appointmentId: currentPatient.id,
        patientId: currentPatient.patientId,
        doctorId: user.id,
        testName: payload.testName,
        notes: payload.notes,
      });
      addLabResultFromConsult(lab);
      const conversationId = await ensureConversationId(currentPatient);
      if (conversationId) {
        await chatService.sendMessage(conversationId, user.id, 'doctor', 'Lab request sent. Please check My Files.', 'file');
      }
      toast({ title: 'Lab request sent', description: 'Lab request added to patient files.' });
    } catch (error) {
      toast({
        title: 'Failed to send lab request',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSendCertificate = async (payload: { purpose: string; diagnosis: string; restDays: number }) => {
    if (!currentPatient || !user) return;
    try {
      const cert = await sendMedicalCertificate({
        appointmentId: currentPatient.id,
        patientId: currentPatient.patientId,
        doctorId: user.id,
        purpose: payload.purpose,
        diagnosis: payload.diagnosis,
        restDays: payload.restDays,
      });
      addCertificateFromConsult(cert);
      const conversationId = await ensureConversationId(currentPatient);
      if (conversationId) {
        await chatService.sendMessage(conversationId, user.id, 'doctor', 'Medical certificate issued. Please check My Files.', 'file');
      }
      toast({ title: 'Medical certificate sent', description: 'Certificate added to patient files.' });
    } catch (error) {
      toast({
        title: 'Failed to send certificate',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Queue Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">
              {queueWaiting.length} waiting
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {completedCount} completed today
            </Badge>
            {lastUpdated && (
              <Badge variant="outline" className="text-xs">
                Updated {format(lastUpdated, 'p')}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadQueue}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Now Serving Section */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-6 w-6 text-primary" />
                Now Serving
              </CardTitle>
              {currentPatient ? (
                <Badge className="bg-success/15 text-success border-success/30 text-sm px-3 py-1">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-sm px-3 py-1">Idle</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : currentPatient ? (
                <div className="space-y-4">
                  {/* Patient Card */}
                  <div className="rounded-xl bg-background border-2 border-primary/20 p-5 space-y-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 border-2 border-primary/30">
                        <AvatarImage src={currentPatient.patient?.avatar} />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary">
                          {currentPatient.patient?.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold text-foreground">{currentPatient.patient?.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {currentPatient.type === 'online' ? 'Video' : 'In-Clinic'}
                          </Badge>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                            Queue #{currentPatient.queueNumber ?? 1}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>{getAgeLabel(currentPatient.patient?.dateOfBirth)} years</span>
                          <span>•</span>
                          <span className="capitalize">{getGenderLabel(currentPatient.patient?.gender)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Arrived {format(new Date(currentPatient.createdAt), 'p')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Reason */}
                    {currentPatient.symptoms && (
                      <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                        <Stethoscope className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Chief Complaint</p>
                          <p className="text-sm text-foreground">{currentPatient.symptoms}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {currentPatient.status !== 'in-progress' && currentPatient.status !== 'in_progress' ? (
                      <Button onClick={() => handleStartConsultation(currentPatient)} className="gap-2 col-span-2 h-11">
                        <Video className="h-4 w-4" />
                        Start Video Consult
                      </Button>
                    ) : (
                      <Button onClick={() => handleStartConsultation(currentPatient)} variant="outline" className="gap-2 col-span-2">
                        <Video className="h-4 w-4" />
                        Resume Call
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => handleMessagePatient(currentPatient)} className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Button>
                    <Button variant="outline" onClick={() => router.push(`/doctor/appointments/${currentPatient.id}`)} className="gap-2">
                      <User className="h-4 w-4" />
                      View Details
                    </Button>
                    <Button onClick={() => handleCompleteConsultation(currentPatient)} className="gap-2 col-span-2 bg-success hover:bg-success/90">
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Complete
                    </Button>
                  </div>
                </div>
              ) : hasQueue ? (
                <div className="text-center py-12 space-y-4">
                  <Clock className="h-16 w-16 mx-auto text-muted-foreground/30" />
                  <div>
                    <p className="font-semibold text-foreground">No active patient</p>
                    <p className="text-sm text-muted-foreground mt-1">Call the next patient to begin consultation</p>
                  </div>
                  <Button size="lg" className="gap-2" onClick={() => handleCallNext()}>
                    <Bell className="h-5 w-5" />
                    Call Next Patient
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <CheckCircle2 className="h-16 w-16 mx-auto text-success/50" />
                  <div>
                    <p className="font-semibold text-foreground">Queue is empty</p>
                    <p className="text-sm text-muted-foreground mt-1">Enable on-demand to receive instant consultations</p>
                  </div>
                  <Button size="lg" className="gap-2" onClick={() => router.push('/doctor/schedule')}>
                    <Zap className="h-5 w-5" />
                    Go On-Demand
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Waiting List */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Waiting List</CardTitle>
              <Badge variant="secondary" className="text-sm px-3 py-1">{queueWaiting.length}</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : queueWaiting.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No patients waiting</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  <AnimatePresence>
                    {queueWaiting.map((apt, index) => {
                      const waitMinutes = Math.max(waitMinutesPerPatient, (index + 1) * waitMinutesPerPatient);
                      return (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="group rounded-xl border border-border bg-background p-4 hover:border-primary/30 hover:bg-primary/5 transition-all"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                              {index + 1}
                            </div>
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={apt.patient?.avatar} />
                              <AvatarFallback>{apt.patient?.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-foreground truncate">
                                  {apt.patient?.name}
                                </p>
                                <Badge variant="secondary" className="text-[10px]">
                                  {apt.type === 'online' ? 'Video' : 'In-Clinic'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {getAgeLabel(apt.patient?.dateOfBirth)} yrs • {getGenderLabel(apt.patient?.gender)}
                              </p>
                              {apt.symptoms && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                  {apt.symptoms}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(apt.createdAt), 'p')}
                                </span>
                                <span>•</span>
                                <span>~{waitMinutes} min wait</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" className="flex-1 gap-1.5" onClick={() => handleStartConsultation(apt)}>
                              <Video className="h-3.5 w-3.5" />
                              Start
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => handleCallNext(apt)}>
                              <Bell className="h-3.5 w-3.5" />
                              Call
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <VideoConsultModal
        open={showVideo}
        appointment={currentPatient}
        videoRoomUrl={videoRoomUrl}
        onClose={() => { setShowVideo(false); setVideoRoomUrl(undefined); }}
        onEnd={(notes) => {
          setShowVideo(false);
          setVideoRoomUrl(undefined);
          handleCompleteConsultation(currentPatient ?? undefined, notes);
        }}
        onSendPrescription={handleSendPrescription}
        onSendLab={handleSendLab}
        onSendCertificate={handleSendCertificate}
      />
    </div>
  );
}
