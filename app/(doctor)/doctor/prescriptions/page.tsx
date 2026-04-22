"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format, isAfter, subDays } from 'date-fns';
import {
  Calendar, FileText, MessageCircle, Plus, Printer, Search,
} from 'lucide-react';
import { Medication, Patient, Doctor, Prescription } from '@/types';
import { appointmentService } from '@/services/appointmentService';
import { medicalRecordsService } from '@/services/medicalRecordsService';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { useRecordsStore } from '@/store/recordsStore';
import { chatService } from '@/services/chatService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import PrescriptionComposer, { PrescriptionPayload, PrescriptionPrefill } from '@/components/video/PrescriptionComposer';

type FilterMode = 'recent' | 'week' | 'all';

interface PrescriptionWithPatient extends Prescription {
  patient?: Patient;
}

const isActive = (rx: Prescription) => new Date(rx.validUntil) >= new Date();

const buildMedSummary = (meds: Medication[]) =>
  meds.slice(0, 2).map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`).join(' + ') +
  (meds.length > 2 ? ` +${meds.length - 2} more` : '');

export default function DoctorPrescriptionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { prescriptions, setPrescriptions, addPrescriptionFromConsult } = useRecordsStore();

  const doctor = user as Doctor | null;
  const doctorId = doctor?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('recent');
  const [selected, setSelected] = useState<PrescriptionWithPatient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const [patientId, setPatientId] = useState('');
  const [prefill, setPrefill] = useState<PrescriptionPrefill | undefined>(undefined);
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    if (!doctorId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [rxRes, aptsRes] = await Promise.all([
          medicalRecordsService.getPrescriptions(doctorId),
          appointmentService.getAppointments({ doctorId }),
        ]);
        if (rxRes.success) setPrescriptions(rxRes.data);
        if (aptsRes.success) {
          const patientMap = new Map<string, Patient>();
          aptsRes.data.forEach((apt) => {
            if (apt.patient) patientMap.set(apt.patientId, apt.patient);
          });
          setPatients(Array.from(patientMap.values()));
        }
      } catch {
        toast({ title: 'Failed to load prescriptions', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [doctorId, setPrescriptions, toast]);

  const enriched = useMemo<PrescriptionWithPatient[]>(() =>
    prescriptions.map((rx) => ({ ...rx, patient: patients.find((p) => p.id === rx.patientId) })),
    [prescriptions, patients]
  );

  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  const togglePatient = useCallback((pid: string) => {
    setExpandedPatients((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const weekLimit = subDays(new Date(), 7);
    return enriched.filter((rx) => {
      const matches =
        rx.patient?.name?.toLowerCase().includes(query) ||
        rx.medications.some((m) => m.name.toLowerCase().includes(query)) ||
        rx.diagnosis.toLowerCase().includes(query);
      if (!matches) return false;
      if (filterMode === 'week') return isAfter(new Date(rx.date), weekLimit);
      if (filterMode === 'recent') return isAfter(new Date(rx.date), subDays(new Date(), 30));
      return true;
    });
  }, [enriched, filterMode, searchQuery]);

  const groupedByPatient = useMemo(() => {
    const map = new Map<string, { patient: Patient | undefined; prescriptions: PrescriptionWithPatient[] }>();
    filtered.forEach((rx) => {
      if (!map.has(rx.patientId)) map.set(rx.patientId, { patient: rx.patient, prescriptions: [] });
      map.get(rx.patientId)!.prescriptions.push(rx);
    });
    return Array.from(map.values());
  }, [filtered]);

  const resetIssueForm = () => {
    setPatientId('');
    setPrefill(undefined);
  };

  const handleIssue = async (payload: PrescriptionPayload) => {
    if (!user || !patientId) {
      toast({ title: 'Select a patient first.' });
      return;
    }
    setIssuing(true);
    try {
      // PrescriptionComposer serialises medications as JSON; parse it back
      let parsedMeds: Medication[] = [];
      try {
        const parsed = JSON.parse(payload.medications) as { medications?: Medication[] };
        parsedMeds = parsed.medications ?? [];
      } catch {
        parsedMeds = [];
      }

      const res = await medicalRecordsService.createPrescription({
        patient_id: patientId,
        diagnosis: payload.diagnosis || 'General Consultation',
        medications: parsedMeds,
        instructions: payload.instructions || 'Take as directed.',
      });
      if (!res.success) throw new Error('Failed to issue prescription');

      addPrescriptionFromConsult(res.data);
      setIssueOpen(false);
      resetIssueForm();

      const convRes = await chatService.createConversation(patientId, user.id);
      if (convRes.success) {
        const note = payload.followUpDate
          ? `E-prescription sent. Follow-up scheduled on ${format(new Date(payload.followUpDate), 'MMM d, yyyy')}. Please check My Files.`
          : 'E-prescription sent. Please check My Files.';
        await chatService.sendMessage(convRes.data.id, user.id, 'doctor', note, 'prescription');
      }

      toast({ title: 'Prescription issued', description: 'Sent to patient files.' });
    } catch (err) {
      toast({
        title: 'Failed to issue prescription',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIssuing(false);
    }
  };

  const handleMessagePatient = async (patient: Patient | undefined) => {
    if (!user || !patient) return;
    const convRes = await chatService.createConversation(patient.id, user.id);
    if (convRes.success) router.push(`/doctor/messages?conversation=${convRes.data.id}`);
  };

  const handleIssueForPatient = (rx: PrescriptionWithPatient) => {
    setPatientId(rx.patientId);
    setPrefill({
      diagnosis: rx.diagnosis,
      instructions: rx.instructions,
      followUpDate: '',
    });
    setIssueOpen(true);
  };

  const handlePrint = async () => {
    if (!selected?.id) {
      toast({ title: 'No prescription selected', variant: 'destructive' });
      return;
    }
    try {
      const { getBaseUrl } = await import('@/services/api');
      const res = await fetch(
        `${getBaseUrl()}/api/records/prescriptions/${selected.id}/pdf/`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        toast({ title: 'Popup blocked', description: 'Allow popups to print this document.', variant: 'destructive' });
      }
      // Revoke after a short delay to allow the tab to load
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({
        title: 'Could not load PDF',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prescriptions</h1>
          <p className="text-muted-foreground">Issue, review, and reprint digital prescriptions.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge className="bg-primary/10 text-primary border-primary/20">{prescriptions.length} issued</Badge>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
        </div>
        <Button className="gap-2" onClick={() => { resetIssueForm(); setIssueOpen(true); }}>
          <Plus className="h-4 w-4" />
          Issue New Prescription
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, medicine, or diagnosis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['recent', 'week', 'all'] as FilterMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={filterMode === mode ? 'default' : 'outline'}
              onClick={() => setFilterMode(mode)}
            >
              {mode === 'recent' ? 'Last 30 Days' : mode === 'week' ? 'This Week' : 'All Time'}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12 text-muted-foreground/40" />}
          title="No prescriptions found"
          description={searchQuery ? 'Try a different search term or filter.' : 'Issue a prescription to see it here.'}
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={() => router.push('/doctor/patients')}>
                View Patients
              </Button>
              <Button size="sm" className="gap-2" onClick={() => router.push('/doctor/queue')}>
                <Calendar className="h-4 w-4" />
                View Queue
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {groupedByPatient.map(({ patient, prescriptions: rxList }, gi) => {
            const pid = rxList[0].patientId;
            const isOpen = expandedPatients.has(pid);
            const activeCount = rxList.filter(isActive).length;
            return (
              <motion.div
                key={pid}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
              >
                <Card>
                  {/* Patient header row */}
                  <div
                    className="w-full text-left cursor-pointer"
                    onClick={() => togglePatient(pid)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={patient?.avatar} />
                        <AvatarFallback>{patient?.name?.[0] ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{patient?.name ?? 'Unknown patient'}</p>
                        <p className="text-xs text-muted-foreground">
                          {rxList.length} prescription{rxList.length !== 1 ? 's' : ''}
                          {activeCount > 0 && (
                            <span className="ml-2 text-success font-medium">{activeCount} active</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); handleMessagePatient(patient); }}
                        >
                          <MessageCircle className="h-3 w-3" />
                          Message
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); handleIssueForPatient(rxList[0]); }}
                        >
                          <Plus className="h-3 w-3" />
                          New Rx
                        </Button>
                        <span className="text-muted-foreground text-xs">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </CardContent>
                  </div>

                  {/* Prescription log rows */}
                  {isOpen && (
                    <div className="border-t border-border divide-y divide-border max-h-72 overflow-y-auto">
                      {rxList.map((rx) => (
                        <div key={rx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{rx.diagnosis}</p>
                            <p className="text-xs text-muted-foreground truncate">{buildMedSummary(rx.medications)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(rx.date), 'MMM d, yyyy')} &bull; Valid until {format(new Date(rx.validUntil), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={isActive(rx)
                              ? 'bg-success/15 text-success border-success/30 text-xs'
                              : 'bg-muted text-muted-foreground border-border text-xs'}>
                              {isActive(rx) ? 'Active' : 'Expired'}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 p-0">
                                <div className="px-3 py-2 border-b border-border">
                                  <span className="text-xs font-semibold text-muted-foreground">Actions</span>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  <DropdownMenuItem onClick={() => { setSelected(rx); setDetailOpen(true); }}>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelected(rx); setPrintOpen(true); }}>
                                    Reprint
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleMessagePatient(rx.patient)}>
                                    Message Patient
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleIssueForPatient(rx)}>
                                    Issue New (Pre-fill)
                                  </DropdownMenuItem>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
            <DialogDescription>Review issued medicines and instructions.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selected.patient?.avatar} />
                  <AvatarFallback>{selected.patient?.name?.[0] ?? '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selected.patient?.name ?? 'Unknown patient'}</p>
                  <p className="text-xs text-muted-foreground">
                    Issued {format(new Date(selected.date), 'MMM d, yyyy')} &bull; Valid until {format(new Date(selected.validUntil), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground italic">{selected.diagnosis}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border">
                {selected.medications.map((med, i) => (
                  <div key={`${med.name}-${i}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5">
                    <div>
                      <p className="font-medium text-sm">{med.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' • ')}
                      </p>
                      {med.instructions && (
                        <p className="text-xs text-muted-foreground mt-0.5">{med.instructions}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={isActive(selected) ? 'text-success border-success/40' : ''}>
                      {isActive(selected) ? 'Active' : 'Expired'}
                    </Badge>
                  </div>
                ))}
              </div>

              {selected.instructions && (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">Instructions</p>
                  <p>{selected.instructions}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="gap-2" onClick={() => { setPrintOpen(true); }}>
                  <Printer className="h-4 w-4" />
                  Reprint
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleMessagePatient(selected.patient)}>
                  Message Patient
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); handleIssueForPatient(selected); }}>
                  Issue New (Pre-fill)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prescription Preview</DialogTitle>
            <DialogDescription>Review before printing.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border p-3 space-y-0.5">
                <p className="font-semibold">{selected.patient?.name ?? 'Unknown patient'}</p>
                <p className="text-xs text-muted-foreground">
                  Issued {format(new Date(selected.date), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground italic">{selected.diagnosis}</p>
              </div>
              <div className="rounded-lg border border-border divide-y divide-border">
                {selected.medications.map((med, i) => (
                  <div key={`${med.name}-${i}`} className="flex justify-between px-3 py-2">
                    <span className="font-medium">{med.name}</span>
                    <span className="text-muted-foreground text-xs text-right">
                      {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
              {selected.instructions && (
                <p className="text-xs text-muted-foreground px-1">{selected.instructions}</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPrintOpen(false)}>Cancel</Button>
                <Button className="gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print PDF
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Issue Dialog */}
      <Dialog open={issueOpen} onOpenChange={(v) => { if (!issuing) { setIssueOpen(v); if (!v) resetIssueForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue New Prescription</DialogTitle>
            <DialogDescription>Select a patient, then fill in the prescription details below.</DialogDescription>
          </DialogHeader>

          {/* Patient selector — lives outside PrescriptionComposer */}
          <div className="space-y-1 pb-1 border-b border-border">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Patient <span className="text-destructive">*</span>
            </label>
            {patients.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">No patients found. Complete an appointment first.</p>
            ) : (
              <Select value={patientId} onValueChange={setPatientId} disabled={issuing}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={p.avatar} />
                          <AvatarFallback className="text-[10px]">{p.name?.[0]}</AvatarFallback>
                        </Avatar>
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Prescription composer — same UI as video consult */}
          <PrescriptionComposer
            key={patientId + JSON.stringify(prefill)}
            onSend={handleIssue}
            prefill={prefill}
            loading={issuing}
            sendLabel="Send to Patient"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({
  icon, title, description, action,
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
