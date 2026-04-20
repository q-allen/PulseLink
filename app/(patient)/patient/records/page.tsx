"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, FlaskConical, Award, Search, Shield, RefreshCw,
  FolderOpen, CalendarDays, Sparkles, ArrowRight, Pill, File, Upload, Loader2,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store';
import { medicalRecordsService } from '@/services/medicalRecordsService';
import { Prescription, LabResult, MedicalCertificate } from '@/types';
import FileCard from '@/components/records/FileCard';
import FilePreviewModal from '@/components/records/FilePreviewModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

type PreviewType = 'prescription' | 'lab-result' | 'certificate' | null;

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array(3).fill(0).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ type, onFindDoctor }: { type: string; onFindDoctor: () => void }) {
  const config = {
    all: { icon: FolderOpen, title: 'No files yet', desc: 'Book a consultation to receive prescriptions, lab results, and more!' },
    prescriptions: { icon: FileText, title: 'No prescriptions yet', desc: 'Your e-prescriptions will appear here after consultations.' },
    'lab-results': { icon: FlaskConical, title: 'No lab results yet', desc: 'Lab results from your consultations will be available here.' },
    certificates: { icon: Award, title: 'No certificates yet', desc: 'Medical certificates issued by your doctors appear here.' },
    other: { icon: File, title: 'No other documents', desc: 'Files sent by your doctor during consultations will appear here.' },
  }[type] ?? { icon: FolderOpen, title: 'No files found', desc: 'Try a different search or filter.' };

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-16 flex flex-col items-center text-center"
    >
      <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{config.title}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">{config.desc}</p>
      <Button onClick={onFindDoctor} className="gap-2">
        Find a Doctor
        <ArrowRight className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}

export default function MedicalRecordsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [certificates, setCertificates] = useState<MedicalCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Preview state
  const [previewType, setPreviewType] = useState<PreviewType>(null);
  const [previewRx, setPreviewRx] = useState<Prescription | null>(null);
  const [previewLab, setPreviewLab] = useState<LabResult | null>(null);
  const [previewCert, setPreviewCert] = useState<MedicalCertificate | null>(null);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedLab, setSelectedLab] = useState<LabResult | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const [rxRes, labRes, certRes] = await Promise.all([
        medicalRecordsService.getPrescriptions(user.id),
        medicalRecordsService.getLabResults(user.id),
        medicalRecordsService.getCertificates(user.id),
      ]);
      if (rxRes.success) setPrescriptions(rxRes.data);
      if (labRes.success) setLabResults(labRes.data);
      if (certRes.success) setCertificates(certRes.data);
    } catch {
      setError(true);
      toast({ title: 'Failed to load files', description: 'Try refreshing the page.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Filtered helpers
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filterRx = (rx: Prescription) =>
      !q || rx.diagnosis.toLowerCase().includes(q) ||
      rx.medications.some(m => m.name.toLowerCase().includes(q)) ||
      rx.doctor?.name?.toLowerCase().includes(q);

    const filterLab = (lab: LabResult) =>
      !q || lab.testName.toLowerCase().includes(q) ||
      lab.testType.toLowerCase().includes(q) ||
      lab.doctor?.name?.toLowerCase().includes(q);

    const filterCert = (cert: MedicalCertificate) =>
      !q || cert.purpose.toLowerCase().includes(q) ||
      cert.diagnosis.toLowerCase().includes(q) ||
      cert.doctor?.name?.toLowerCase().includes(q);

    return {
      prescriptions: prescriptions.filter(filterRx),
      labResults: labResults.filter(filterLab),
      certificates: certificates.filter(filterCert),
    };
  }, [prescriptions, labResults, certificates, searchQuery]);

  const totalCount = prescriptions.length + labResults.length + certificates.length;
  const totalFiltered = filtered.prescriptions.length + filtered.labResults.length + filtered.certificates.length;

  const openPreview = (type: PreviewType, data: Prescription | LabResult | MedicalCertificate) => {
    setPreviewType(type);
    if (type === 'prescription') setPreviewRx(data as Prescription);
    else if (type === 'lab-result') setPreviewLab(data as LabResult);
    else if (type === 'certificate') setPreviewCert(data as MedicalCertificate);
  };

  const closePreview = () => {
    setPreviewType(null);
    setPreviewRx(null);
    setPreviewLab(null);
    setPreviewCert(null);
  };

  const handleFindDoctor = () => { router.push('/patient/doctors'); };

  const openUploadDialog = (lab: LabResult, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLab(lab);
    setUploadFile(null);
    setUploadOpen(true);
  };

  const handleUploadResults = async () => {
    if (!selectedLab || !uploadFile) {
      toast({ title: 'Please select a file', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const res = await medicalRecordsService.uploadLabResults(selectedLab.id, uploadFile);
      if (!res.success) throw new Error('Upload failed');
      toast({ title: 'Results uploaded', description: 'Your doctor has been notified.' });
      setUploadOpen(false);
      setSelectedLab(null);
      setUploadFile(null);
      fetchRecords();
    } catch {
      toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const statsCards = [
    {
      label: 'Prescriptions',
      value: prescriptions.length,
      icon: FileText,
      bg: 'bg-primary/10',
      iconColor: 'text-primary',
      tab: 'prescriptions',
    },
    {
      label: 'Lab Results',
      value: labResults.length,
      icon: FlaskConical,
      bg: 'bg-success/10',
      iconColor: 'text-success',
      tab: 'lab-results',
    },
    {
      label: 'Certificates',
      value: certificates.length,
      icon: Award,
      bg: 'bg-warning/10',
      iconColor: 'text-warning',
      tab: 'certificates',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Files</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Your medical documents from consultations, all in one place
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={fetchRecords}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3">
          {statsCards.map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setActiveTab(stat.tab)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none">
                        {loading ? '—' : stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Order Meds Banner — show when prescriptions exist */}
        {!loading && prescriptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">You have active prescriptions</p>
              <p className="text-xs text-muted-foreground">Order your medicines from our pharmacy partner.</p>
            </div>
            <Link href="/patient/pharmacy">
              <Button size="sm" className="gap-1.5 shrink-0">
                <Pill className="h-3.5 w-3.5" />
                Order Meds
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive text-sm">Failed to load files</p>
                <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
              </div>
              <Button size="sm" variant="outline" onClick={fetchRecords}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by medicine, test name, diagnosis, doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
          />
          {searchQuery && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Badge variant="secondary" className="text-xs">
                {totalFiltered} result{totalFiltered !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-5">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              All
              {!loading && totalCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{totalCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 mr-1 hidden sm:block" />
              Rx
              {!loading && prescriptions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{prescriptions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="lab-results" className="text-xs sm:text-sm">
              <FlaskConical className="h-3.5 w-3.5 mr-1 hidden sm:block" />
              Labs
              {!loading && labResults.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{labResults.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="certificates" className="text-xs sm:text-sm">
              <Award className="h-3.5 w-3.5 mr-1 hidden sm:block" />
              Certs
              {!loading && certificates.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{certificates.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="other" className="text-xs sm:text-sm hidden sm:flex">
              <File className="h-3.5 w-3.5 mr-1" />
              Other
            </TabsTrigger>
          </TabsList>

          {/* ALL FILES */}
          <TabsContent value="all" className="space-y-3">
            {loading ? <LoadingSkeleton /> : totalFiltered === 0 ? (
              <EmptyState type={searchQuery ? 'other' : 'all'} onFindDoctor={handleFindDoctor} />
            ) : (
              <>
                {filtered.prescriptions.map((rx, i) => (
                  <FileCard
                    key={rx.id}
                    id={rx.id}
                    type="prescription"
                    title={`E-Prescription — ${rx.diagnosis}`}
                    description={rx.medications.map(m => m.name).join(', ')}
                    doctorName={rx.doctor?.name || 'Physician'}
                    doctorSpecialty={rx.doctor?.specialty || ''}
                    doctorAvatar={rx.doctor?.avatar}
                    date={rx.date}
                    hasPrescriptionMeds
                    pdfUrl={rx.pdfUrl}
                    index={i}
                    onClick={() => openPreview('prescription', rx)}
                  />
                ))}
                {filtered.labResults.map((lab, i) => (
                  <div key={lab.id} className="relative">
                    <FileCard
                      id={lab.id}
                      type="lab-result"
                      title={lab.testName}
                      description={`${lab.testType} · ${lab.status === 'completed' ? 'Results available' : 'Pending results'}`}
                      doctorName={lab.doctor?.name || 'Physician'}
                      doctorSpecialty={lab.doctor?.specialty || ''}
                      doctorAvatar={lab.doctor?.avatar}
                      date={lab.date}
                      fileUrl={lab.fileUrl}
                      statusBadge={{
                        label: lab.status,
                        variant: lab.status === 'completed' ? 'default' : 'secondary',
                      }}
                      index={filtered.prescriptions.length + i}
                      onClick={() => openPreview('lab-result', lab)}
                    />
                    {lab.status === 'pending' && (
                      <div className="absolute top-4 right-4">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => openUploadDialog(lab, e)}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload Results
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {filtered.certificates.map((cert, i) => (
                  <FileCard
                    key={cert.id}
                    id={cert.id}
                    type="certificate"
                    title={cert.purpose}
                    description={`${cert.diagnosis} · ${cert.restDays} days rest`}
                    doctorName={cert.doctor?.name || 'Physician'}
                    doctorSpecialty={cert.doctor?.specialty || ''}
                    doctorAvatar={cert.doctor?.avatar}
                    date={cert.date}
                    pdfUrl={cert.pdfUrl}
                    index={filtered.prescriptions.length + filtered.labResults.length + i}
                    onClick={() => openPreview('certificate', cert)}
                  />
                ))}
              </>
            )}
          </TabsContent>

          {/* PRESCRIPTIONS */}
          <TabsContent value="prescriptions" className="space-y-3">
            {loading ? <LoadingSkeleton /> : filtered.prescriptions.length === 0 ? (
              <EmptyState type="prescriptions" onFindDoctor={handleFindDoctor} />
            ) : (
              filtered.prescriptions.map((rx, i) => (
                <FileCard
                  key={rx.id}
                  id={rx.id}
                  type="prescription"
                  title={`E-Prescription — ${rx.diagnosis}`}
                  description={rx.medications.map(m => m.name).join(', ')}
                  doctorName={rx.doctor?.name || 'Physician'}
                  doctorSpecialty={rx.doctor?.specialty || ''}
                  doctorAvatar={rx.doctor?.avatar}
                  date={rx.date}
                  hasPrescriptionMeds
                  pdfUrl={rx.pdfUrl}
                  index={i}
                  onClick={() => openPreview('prescription', rx)}
                />
              ))
            )}
          </TabsContent>

          {/* LAB RESULTS */}
          <TabsContent value="lab-results" className="space-y-3">
            {loading ? <LoadingSkeleton /> : filtered.labResults.length === 0 ? (
              <EmptyState type="lab-results" onFindDoctor={handleFindDoctor} />
            ) : (
              filtered.labResults.map((lab, i) => (
                <div key={lab.id} className="relative">
                  <FileCard
                    id={lab.id}
                    type="lab-result"
                    title={lab.testName}
                    description={`${lab.testType} · ${lab.status === 'completed' ? 'Results available' : 'Pending results'}`}
                    doctorName={lab.doctor?.name || 'Physician'}
                    doctorSpecialty={lab.doctor?.specialty || ''}
                    doctorAvatar={lab.doctor?.avatar}
                    date={lab.date}
                    fileUrl={lab.fileUrl}
                    statusBadge={{
                      label: lab.status,
                      variant: lab.status === 'completed' ? 'default' : 'secondary',
                    }}
                    index={i}
                    onClick={() => openPreview('lab-result', lab)}
                  />
                  {lab.status === 'pending' && (
                    <div className="absolute top-4 right-4">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => openUploadDialog(lab, e)}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Results
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* CERTIFICATES */}
          <TabsContent value="certificates" className="space-y-3">
            {loading ? <LoadingSkeleton /> : filtered.certificates.length === 0 ? (
              <EmptyState type="certificates" onFindDoctor={handleFindDoctor} />
            ) : (
              filtered.certificates.map((cert, i) => (
                <FileCard
                  key={cert.id}
                  id={cert.id}
                  type="certificate"
                  title={cert.purpose}
                  description={`${cert.diagnosis} · ${cert.restDays} days rest`}
                  doctorName={cert.doctor?.name || 'Physician'}
                  doctorSpecialty={cert.doctor?.specialty || ''}
                  doctorAvatar={cert.doctor?.avatar}
                  date={cert.date}
                  pdfUrl={cert.pdfUrl}
                  index={i}
                  onClick={() => openPreview('certificate', cert)}
                />
              ))
            )}
          </TabsContent>

          {/* OTHER */}
          <TabsContent value="other" className="space-y-3">
            <EmptyState type="other" onFindDoctor={handleFindDoctor} />
          </TabsContent>
        </Tabs>

        {/* Privacy / Trust Footer */}
        <div className="flex items-center gap-2 p-4 rounded-xl bg-secondary/50 border border-border">
          <Shield className="h-4 w-4 text-success flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            All medical documents are <strong>encrypted and secure</strong>. Only you and your authorized healthcare providers can access these files.
          </p>
        </div>
      </div>

      {/* Preview Modal */}
      <FilePreviewModal
        open={previewType !== null}
        onClose={closePreview}
        type={previewType}
        prescription={previewRx}
        labResult={previewLab}
        certificate={previewCert}
      />

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!uploading) setUploadOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-success" />
              Upload Lab Results
            </DialogTitle>
          </DialogHeader>

          {selectedLab && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                <p className="font-semibold">{selectedLab.testName}</p>
                <p className="text-xs text-muted-foreground">{selectedLab.testType}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Requested by: {selectedLab.doctor?.name || 'Doctor'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Lab Result File (PDF, image) *
                </label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                {uploadFile && (
                  <p className="text-xs text-success mt-1">{uploadFile.name} selected</p>
                )}
              </div>

              <div className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                <p>💡 Upload the lab results you received from the laboratory. Your doctor will be notified once uploaded.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUploadResults} disabled={uploading || !uploadFile} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading...' : 'Upload & Notify Doctor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
