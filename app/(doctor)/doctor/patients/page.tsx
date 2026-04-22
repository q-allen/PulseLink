"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format, isAfter, subDays } from 'date-fns';
import {
  Calendar,
  FileText,
  MessageCircle,
  MoreVertical,
  Phone,
  Search,
  User,
  Video,
  Zap,
} from 'lucide-react';
import { Appointment, Doctor, Patient } from '@/types';
import { appointmentService } from '@/services/appointmentService';
import { chatService } from '@/services/chatService';
import { doctorService } from '@/services/doctorService';
import { useAuthStore, useAppointmentStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import VideoConsultModal from '@/components/doctor/VideoConsultModal';
import { useRecordsStore } from '@/store/recordsStore';
import { sendPrescription, sendLabRequest, sendMedicalCertificate } from '../../../../features/doctor/consult/actions';
import { startVideo } from '../../../../features/doctor/appointments/actions';
import { addPatientNote, getPatientHistory } from '../../../../features/doctor/patients/actions';

type FilterMode = 'active' | 'all' | 'recent';
type SortMode = 'recent' | 'alpha';

interface PatientSummary {
  patient: Patient;
  lastAppointment?: Appointment;
  lastConsultDate?: string;
  isActive: boolean;
  filesCount: number;
  notePreview?: string;
}

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

const isActiveAppointment = (apt: Appointment) =>
  ['pending', 'confirmed', 'in-progress'].includes(apt.status);

export default function DoctorPatientsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser } = useAuthStore();
  const { appointments, setAppointments, isLoading, setLoading } = useAppointmentStore();
  const {
    prescriptions,
    labResults,
    certificates,
    addPrescriptionFromConsult,
    addLabResultFromConsult,
    addCertificateFromConsult,
  } = useRecordsStore();

  const doctor = user as Doctor | null;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [selected, setSelected] = useState<PatientSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [notesByPatient, setNotesByPatient] = useState<Record<string, { id: string; note: string; createdAt: string }[]>>({
    'patient-1': [{ id: 'note-1', note: 'Hypertension follow-up: BP improved, continue Losartan.', createdAt: new Date().toISOString() }],
    'patient-2': [{ id: 'note-2', note: 'Peds fever case: advised hydration and follow-up in 1 week.', createdAt: new Date().toISOString() }],
  });
  const [activeTab, setActiveTab] = useState('history');
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoAppointment, setVideoAppointment] = useState<Appointment | null>(null);

  const [patientDetails, setPatientDetails] = useState<Map<string, import('@/types').Patient>>(new Map());

  useEffect(() => {
    if (!user) return;
    const fetchPatients = async () => {
      setLoading(true);
      const [aptsRes, patientsRes] = await Promise.all([
        appointmentService.getAppointments({ doctorId: user.id }),
        doctorService.getMyPatients(),
      ]);
      if (aptsRes.success) setAppointments(aptsRes.data);
      if (patientsRes.success) setPatientDetails(new Map(patientsRes.data.map((p) => [p.id, p])));
      setLoading(false);
    };
    fetchPatients();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const patientSummaries = useMemo<PatientSummary[]>(() => {
    const patientMap = new Map<string, Patient>();
    // First seed from appointments — these already have patient_profile_data via the mapper
    appointments.forEach((apt) => {
      if (apt.patient) patientMap.set(apt.patientId, apt.patient);
    });
    // Only fill in patients that have no appointment-derived profile yet
    patientDetails.forEach((p, id) => {
      if (!patientMap.has(id)) patientMap.set(id, p);
    });

    const summaries = Array.from(patientMap.values()).map((patient) => {
      const patientApts = appointments
        .filter((apt) => apt.patientId === patient.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastAppointment = patientApts[0];
      const lastConsultDate = lastAppointment?.date;
      const isActive = patientApts.some(isActiveAppointment);
      const filesCount =
        prescriptions.filter((rx) => rx.patientId === patient.id).length +
        labResults.filter((lab) => lab.patientId === patient.id).length +
        certificates.filter((cert) => cert.patientId === patient.id).length;
      const notePreview = notesByPatient[patient.id]?.[0]?.note;
      return { patient, lastAppointment, lastConsultDate, isActive, filesCount, notePreview };
    });

    return summaries;
  }, [appointments, prescriptions, labResults, certificates, notesByPatient, patientDetails]);

  const filteredSummaries = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const recentLimit = subDays(new Date(), 30);

    let list = patientSummaries.filter((summary) => {
      const match =
        summary.patient.name.toLowerCase().includes(query) ||
        summary.patient.phone?.toLowerCase().includes(query) ||
        summary.patient.email?.toLowerCase().includes(query);
      if (!match) return false;

      if (filterMode === 'active') return summary.isActive;
      if (filterMode === 'recent') {
        if (!summary.lastConsultDate) return false;
        return isAfter(new Date(summary.lastConsultDate), recentLimit);
      }
      return true;
    });

    list = list.sort((a, b) => {
      if (sortMode === 'alpha') return a.patient.name.localeCompare(b.patient.name);
      const aDate = a.lastConsultDate ? new Date(a.lastConsultDate).getTime() : 0;
      const bDate = b.lastConsultDate ? new Date(b.lastConsultDate).getTime() : 0;
      return bDate - aDate;
    });

    return list;
  }, [patientSummaries, searchQuery, filterMode, sortMode]);

  const ensureConversationId = async (patientId: string) => {
    if (!user) return null;
    const convRes = await chatService.createConversation(patientId, user.id, 'doctor');
    return convRes.success ? convRes.data.id : null;
  };

  const handleStartVideo = async (summary: PatientSummary) => {
    const apt = appointments.find(
      (a) => a.patientId === summary.patient.id && a.type === 'online' && isActiveAppointment(a)
    );
    if (!apt) {
      toast({ title: 'No active video consult', description: 'Patient has no active online appointment.' });
      return;
    }
    await startVideo(apt.id);
    setVideoAppointment(apt);
    setVideoOpen(true);
  };

  const handleAddNote = async () => {
    if (!selected || !user || !noteInput.trim()) return;
    const res = await addPatientNote(selected.patient.id, user.id, noteInput.trim());
    setNotesByPatient((prev) => ({
      ...prev,
      [selected.patient.id]: [{ id: res.id, note: res.note, createdAt: res.createdAt }, ...(prev[selected.patient.id] || [])],
    }));
    setNoteInput('');
    setNoteDialogOpen(false);
    toast({ title: 'Note added' });
  };

  const historyForSelected = useMemo(() => {
    if (!selected) return [];
    return appointments
      .filter((apt) => apt.patientId === selected.patient.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, selected]);

  const filesForSelected = useMemo(() => {
    if (!selected) return [];
    const rx = prescriptions.filter((p) => p.patientId === selected.patient.id).map((p) => ({
      id: `rx-${p.id}`,
      title: p.diagnosis,
      date: p.date,
      type: 'Prescription',
    }));
    const labs = labResults.filter((l) => l.patientId === selected.patient.id).map((l) => ({
      id: `lab-${l.id}`,
      title: l.testName,
      date: l.date,
      type: 'Lab Result',
    }));
    const certs = certificates.filter((c) => c.patientId === selected.patient.id).map((c) => ({
      id: `cert-${c.id}`,
      title: c.purpose,
      date: c.date,
      type: 'Certificate',
    }));
    return [...rx, ...labs, ...certs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [certificates, labResults, prescriptions, selected]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Patients</h1>
          <p className="text-muted-foreground">Quick access to patient history, files, and follow-ups.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge className="bg-primary/10 text-primary border-primary/20">{patientSummaries.length} total</Badge>
            <Badge variant="secondary">{patientSummaries.filter((p) => p.isActive).length} active</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['active', 'all', 'recent'] as FilterMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={filterMode === mode ? 'default' : 'outline'}
              onClick={() => setFilterMode(mode)}
            >
              {mode === 'active' ? 'Active' : mode === 'recent' ? 'Recent' : 'All'}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={sortMode === 'recent' ? 'default' : 'outline'} onClick={() => setSortMode('recent')}>
            Recent
          </Button>
          <Button size="sm" variant={sortMode === 'alpha' ? 'default' : 'outline'} onClick={() => setSortMode('alpha')}>
            A-Z
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filteredSummaries.length === 0 ? (
        <EmptyState
          icon={<User className="h-12 w-12 text-muted-foreground/40" />}
          title="No patients yet"
          description="Stay on-demand or view the queue to start seeing patients."
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" className="gap-2" onClick={() => router.push('/doctor/schedule')}>
                <Zap className="h-4 w-4" />
                Go On-Demand
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => router.push('/doctor/queue')}>
                <Calendar className="h-4 w-4" />
                View Queue
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSummaries.map((summary, index) => (
            <motion.div
              key={summary.patient.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className={`h-full ${summary.isActive ? 'border-primary/20 bg-primary/5' : ''}`}>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={summary.patient.avatar} />
                      <AvatarFallback>{summary.patient.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{summary.patient.name}</p>
                        {summary.isActive && (
                          <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Active</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {getAgeLabel(summary.patient.dateOfBirth)} yrs • {getGenderLabel(summary.patient.gender)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Last consult: {summary.lastConsultDate ? format(new Date(summary.lastConsultDate), 'MMM d, yyyy') : '—'}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelected(summary);
                            setActiveTab('history');
                            setDetailOpen(true);
                          }}
                        >
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelected(summary);
                            setActiveTab('files');
                            setDetailOpen(true);
                          }}
                        >
                          View Prescriptions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const convId = await ensureConversationId(summary.patient.id);
                            if (convId) router.push(`/doctor/messages?conversation=${convId}`);
                          }}
                        >
                          Message Patient
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStartVideo(summary)}>
                          Start Video
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSelected(summary);
                            setNoteDialogOpen(true);
                          }}
                        >
                          Add Note
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Recent note</p>
                    <p className="mt-1 line-clamp-2">
                      {summary.notePreview || summary.lastAppointment?.symptoms || 'No notes yet.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {summary.filesCount} files
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {summary.lastAppointment?.type === 'online' ? 'Video' : summary.lastAppointment ? 'In-Clinic' : '—'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setSelected(summary);
                        setActiveTab('history');
                        setDetailOpen(true);
                        getPatientHistory(summary.patient.id, doctor?.id ?? '');
                      }}
                    >
                      <User className="h-3.5 w-3.5" />View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={async () => {
                        const convId = await ensureConversationId(summary.patient.id);
                        if (convId) router.push(`/doctor/messages?conversation=${convId}`);
                      }}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />Message
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleStartVideo(summary)}
                    >
                      <Video className="h-3.5 w-3.5" />Video
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl flex flex-col h-[560px]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Patient Profile</DialogTitle>
            <DialogDescription>Review history, files, notes, and contact details.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              <div className="flex items-center gap-3 shrink-0">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selected.patient.avatar} />
                  <AvatarFallback>{selected.patient.name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{selected.patient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getAgeLabel(selected.patient.dateOfBirth)} yrs • {getGenderLabel(selected.patient.gender)}
                  </p>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
                <TabsList className="shrink-0">
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
                  {historyForSelected.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No appointments yet.</div>
                  ) : (
                    historyForSelected.map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{format(new Date(apt.date), 'MMM d, yyyy')} • {apt.time}</p>
                          <p className="text-xs text-muted-foreground">{apt.symptoms || 'General consult'}</p>
                        </div>
                        <Badge variant="secondary">{apt.status}</Badge>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="files" className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
                  {filesForSelected.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No files yet.</div>
                  ) : (
                    filesForSelected.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{file.title}</p>
                          <p className="text-xs text-muted-foreground">{file.type} • {file.date}</p>
                        </div>
                        <Badge variant="outline">{file.type}</Badge>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="notes" className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
                  <Button size="sm" onClick={() => setNoteDialogOpen(true)} className="gap-2">
                    <FileText className="h-4 w-4" />Add Note
                  </Button>
                  {(notesByPatient[selected.patient.id] || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No notes yet.</div>
                  ) : (
                    (notesByPatient[selected.patient.id] || []).map((note) => (
                      <div key={note.id} className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">{format(new Date(note.createdAt), 'MMM d, yyyy • p')}</p>
                        <p className="text-sm mt-2">{note.note}</p>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="contact" className="flex-1 overflow-y-auto mt-3 pr-1">
                  <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {selected.patient.phone || 'No phone on file'}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageCircle className="h-4 w-4" />
                      {selected.patient.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      {selected.patient.address || 'Quezon City'}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Patient Note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Write a short note for the patient..."
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VideoConsultModal
        open={videoOpen}
        appointment={videoAppointment}
        onClose={() => setVideoOpen(false)}
        onEnd={async () => {
          setVideoOpen(false);
          if (videoAppointment && user) {
            const convId = await ensureConversationId(videoAppointment.patientId);
            if (convId) {
              await chatService.sendMessage(convId, user.id, 'doctor', 'Video consultation ended. Transcript saved.', 'text');
            }
          }
        }}
        onSendPrescription={async (data) => {
          if (!videoAppointment || !user) return;
          try {
            const rx = await sendPrescription({
              appointmentId: videoAppointment.id,
              patientId: videoAppointment.patientId,
              doctorId: user.id,
              diagnosis: data.diagnosis,
              medications: data.medications,
              instructions: data.instructions,
              followUpDate: data.followUpDate,
            });
            addPrescriptionFromConsult(rx);
          } catch (error) {
            toast({
              title: 'Failed to send prescription',
              description: error instanceof Error ? error.message : 'Please try again.',
              variant: 'destructive',
            });
          }
        }}
        onSendLab={async (data) => {
          if (!videoAppointment || !user) return;
          try {
            const lab = await sendLabRequest({
              appointmentId: videoAppointment.id,
              patientId: videoAppointment.patientId,
              doctorId: user.id,
              testName: data.testName,
              notes: data.notes,
            });
            addLabResultFromConsult(lab);
          } catch (error) {
            toast({
              title: 'Failed to send lab request',
              description: error instanceof Error ? error.message : 'Please try again.',
              variant: 'destructive',
            });
          }
        }}
        onSendCertificate={async (data) => {
          if (!videoAppointment || !user) return;
          try {
            const cert = await sendMedicalCertificate({
              appointmentId: videoAppointment.id,
              patientId: videoAppointment.patientId,
              doctorId: user.id,
              purpose: data.purpose,
              diagnosis: data.diagnosis,
              restDays: data.restDays,
            });
            addCertificateFromConsult(cert);
          } catch (error) {
            toast({
              title: 'Failed to send certificate',
              description: error instanceof Error ? error.message : 'Please try again.',
              variant: 'destructive',
            });
          }
        }}
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
