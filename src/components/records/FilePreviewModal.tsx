"use client";

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, FlaskConical, Award, Download, Printer, Share2, X,
  Calendar, User, Stethoscope, Pill, ExternalLink, ShieldCheck,
  ChevronRight, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Prescription, LabResult, MedicalCertificate } from '@/types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { api, API_ENDPOINTS, getBaseUrl } from '@/services/api';

interface FilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  type: 'prescription' | 'lab-result' | 'certificate' | null;
  prescription?: Prescription | null;
  labResult?: LabResult | null;
  certificate?: MedicalCertificate | null;
}

export default function FilePreviewModal({
  open, onClose, type, prescription, labResult, certificate
}: FilePreviewModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const fileUrl =
    type === 'prescription' ? prescription?.pdfUrl :
    type === 'lab-result' ? labResult?.fileUrl :
    type === 'certificate' ? certificate?.pdfUrl :
    null;
  const [resolvedFileUrl, setResolvedFileUrl] = useState<string | null>(fileUrl ?? null);

useEffect(() => {
    setResolvedFileUrl(fileUrl ?? null);
    if (!open || fileUrl) return;

    const loadMissingUrl = async () => {
      try {
        if (type === 'prescription' && prescription?.id) {
          const data = await api.get<{ pdf_url?: string; pdfUrl?: string }>(API_ENDPOINTS.PRESCRIPTION_DETAIL(prescription.id));
          const url = data?.pdf_url ?? data?.pdfUrl ?? null;
          if (url) setResolvedFileUrl(url);
        } else if (type === 'lab-result' && labResult?.id) {
          const data = await api.get<{ file_url?: string; fileUrl?: string }>(API_ENDPOINTS.LAB_DETAIL(labResult.id));
          const url = data?.file_url ?? data?.fileUrl ?? null;
          if (url) setResolvedFileUrl(url);
        } else if (type === 'certificate' && certificate?.id) {
          const data = await api.get<{ pdf_url?: string; pdfUrl?: string }>(API_ENDPOINTS.CERTIFICATE_DETAIL(certificate.id));
          const url = data?.pdf_url ?? data?.pdfUrl ?? null;
          if (url) setResolvedFileUrl(url);
        }
      } catch {
        // best effort
      }
    };

    void loadMissingUrl();
  }, [open, fileUrl, type, prescription?.id, labResult?.id, certificate?.id]);

  const safeFormat = (dateStr: string, fmt: string, fallback = 'N/A') => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return fallback;
      return format(d, fmt);
    } catch {
      return fallback;
    }
  };

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    let blobUrl: string | null = null;
    try {
      const base = getBaseUrl();
      let res: Response;
      if (type === 'prescription' && prescription?.id) {
        res = await fetch(`${base}${API_ENDPOINTS.PRESCRIPTION_PDF(prescription.id)}`, { credentials: 'include' });
      } else if (type === 'certificate' && certificate?.id) {
        res = await fetch(`${base}${API_ENDPOINTS.CERTIFICATE_PDF(certificate.id)}`, { credentials: 'include' });
      } else if (type === 'lab-result' && labResult?.id) {
        res = await fetch(`${base}${API_ENDPOINTS.LAB_PDF(labResult.id)}`, { credentials: 'include' });
      } else if (resolvedFileUrl) {
        const url = resolvedFileUrl.startsWith('http') ? resolvedFileUrl : `${base}${resolvedFileUrl}`;
        res = await fetch(url);
      } else {
        toast({ title: 'PDF not ready', description: 'Printing the document instead.' });
        window.print();
        return;
      }
      if (res.status === 401) throw new Error('Your session has expired. Please log in again.');
      if (res.status === 403) throw new Error('You do not have permission to download this file.');
      if (res.status === 404) throw new Error('File not found. It may have been removed.');
      if (!res.ok) throw new Error(`Download failed (${res.status} ${res.statusText}).`);
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${type}-${prescription?.id ?? labResult?.id ?? certificate?.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: 'Download started', description: 'Your file is downloading.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not download the file. Try again.';
      toast({ title: 'Download failed', description: message, variant: 'destructive' });
    } finally {
      setDownloading(false);
      if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl!), 10000);
    }
  }, [type, prescription?.id, labResult?.id, certificate?.id, resolvedFileUrl, toast]);

  const handlePrint = async () => {
    try {
      const base = getBaseUrl();
      let res: Response;
      if (type === 'prescription' && prescription?.id) {
        res = await fetch(`${base}${API_ENDPOINTS.PRESCRIPTION_PDF(prescription.id)}`, { credentials: 'include' });
      } else if (type === 'certificate' && certificate?.id) {
        res = await fetch(`${base}${API_ENDPOINTS.CERTIFICATE_PDF(certificate.id)}`, { credentials: 'include' });
      } else if (type === 'lab-result' && labResult?.id) {
        res = await fetch(`${base}${API_ENDPOINTS.LAB_PDF(labResult.id)}`, { credentials: 'include' });
      } else if (resolvedFileUrl) {
        const url = resolvedFileUrl.startsWith('http') ? resolvedFileUrl : `${base}${resolvedFileUrl}`;
        res = await fetch(url);
      } else {
        window.print();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        toast({ title: 'Popup blocked', description: 'Allow popups for this site to print the document.', variant: 'destructive' });
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      toast({ title: 'Could not open PDF', description: 'Try downloading instead.', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    const base = getBaseUrl();
    const shareUrl = type === 'prescription' && prescription?.id
      ? `${base}${API_ENDPOINTS.PRESCRIPTION_PDF(prescription.id)}`
      : type === 'certificate' && certificate?.id
        ? `${base}${API_ENDPOINTS.CERTIFICATE_PDF(certificate.id)}`
        : type === 'lab-result' && labResult?.id
          ? `${base}${API_ENDPOINTS.LAB_PDF(labResult.id)}`
          : resolvedFileUrl
            ? (resolvedFileUrl.startsWith('http') ? resolvedFileUrl : `${base}${resolvedFileUrl}`)
            : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PulseLink Document', url: shareUrl });
        toast({ title: 'Shared', description: 'Secure link shared.' });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!', description: 'Share this secure link with your healthcare provider.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy the link. Please copy it manually.', variant: 'destructive' });
    }
  };

  const handleOrderMeds = () => {
    onClose();
    router.push('/patient/pharmacy');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            {type === 'prescription' && <FileText className="h-5 w-5 text-primary" />}
            {type === 'lab-result' && <FlaskConical className="h-5 w-5 text-success" />}
            {type === 'certificate' && <Award className="h-5 w-5 text-warning" />}
            <div>
              <DialogTitle className="text-base font-semibold">
                {type === 'prescription' && 'E-Prescription'}
                {type === 'lab-result' && 'Lab Result'}
                {type === 'certificate' && 'Medical Certificate'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-3 w-3 text-success" />
                Encrypted & Secure
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download className={`h-3.5 w-3.5 ${downloading ? 'animate-pulse' : ''}`} />
              {downloading ? 'Downloading...' : 'Download'}
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleShare}>
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* PRESCRIPTION PREVIEW */}
          {type === 'prescription' && prescription && (
            <>
              {/* Mock Prescription Header */}
              <div className="border border-primary/20 rounded-xl overflow-hidden">
                <div className="gradient-primary px-5 py-4 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-80">NowServing Health</p>
                      <h2 className="text-lg font-bold mt-0.5">Electronic Prescription</h2>
                    </div>
                    <div className="text-right text-xs opacity-80">
                      <p>Rx #{prescription.id.slice(-6).toUpperCase()}</p>
                      <p>{safeFormat(prescription.date, 'MMMM d, yyyy')}</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Doctor Info */}
                  <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={prescription.doctor?.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {prescription.doctor?.name?.split(' ').map(n => n[0]).join('').slice(0,2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{prescription.doctor?.name || 'Physician'}</p>
                      <p className="text-xs text-muted-foreground">{prescription.doctor?.specialty} · {prescription.doctor?.hospital}</p>
                    </div>
                    <Badge className="ml-auto text-[10px]" variant="secondary">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-success" />
                      Verified
                    </Badge>
                  </div>

                  {/* Diagnosis */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Diagnosis</p>
                    <p className="font-semibold text-foreground text-sm">{prescription.diagnosis}</p>
                  </div>

                  <Separator />

                  {/* Medications */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Prescribed Medications</p>
                    <div className="space-y-3">
                      {prescription.medications.map((med, i) => (
                        <div key={i} className="flex gap-3 p-3 border border-border rounded-lg">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Pill className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-sm">{med.name}</p>
                              <Badge variant="outline" className="text-[10px]">{med.dosage}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{med.frequency} · {med.duration}</p>
                            {med.instructions && (
                              <p className="text-xs text-accent mt-0.5 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {med.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  {prescription.instructions && (
                    <div className="p-3 bg-primary/5 border border-primary/15 rounded-lg">
                      <p className="text-xs font-medium text-primary mb-1">Doctor's Notes</p>
                      <p className="text-sm text-foreground">{prescription.instructions}</p>
                    </div>
                  )}

                  {/* Validity */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                    <span>Valid until: <strong className="text-foreground">{safeFormat(prescription.validUntil, 'MMMM d, yyyy')}</strong></span>
                    <Badge variant={prescription.isDigital ? 'default' : 'outline'} className="text-[10px]">
                      {prescription.isDigital ? 'Digital ✓' : 'Physical'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Order Meds CTA */}
              <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <Pill className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Order these medications</p>
                  <p className="text-xs text-muted-foreground">Get your prescribed medicines delivered to your door.</p>
                </div>
                <Button size="sm" onClick={handleOrderMeds} className="gap-1.5">
                  Order Now <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}

          {/* LAB RESULT PREVIEW */}
          {type === 'lab-result' && labResult && (
            <>
              <div className="border border-success/20 rounded-xl overflow-hidden">
                <div className="bg-success px-5 py-4 text-success-foreground">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-80">Laboratory Report</p>
                      <h2 className="text-lg font-bold mt-0.5">{labResult.testName}</h2>
                    </div>
                    <div className="text-right text-xs opacity-80">
                      <p>#{labResult.id.slice(-6).toUpperCase()}</p>
                      <p>{safeFormat(labResult.date, 'MMMM d, yyyy')}</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Doctor + Test Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Requested By</p>
                      <p className="font-semibold text-sm">{labResult.doctor?.name || 'Physician'}</p>
                      <p className="text-xs text-muted-foreground">{labResult.doctor?.specialty}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Test Type</p>
                      <p className="font-semibold text-sm">{labResult.testType}</p>
                      <Badge
                        variant={labResult.status === 'completed' ? 'default' : 'secondary'}
                        className="text-[10px] mt-1"
                      >
                        {labResult.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Results Table */}
                  {labResult.results && labResult.results.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Test Results</p>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary text-xs">
                            <tr>
                              <th className="px-3 py-2.5 text-left font-medium">Parameter</th>
                              <th className="px-3 py-2.5 text-left font-medium">Result</th>
                              <th className="px-3 py-2.5 text-left font-medium">Reference</th>
                              <th className="px-3 py-2.5 text-left font-medium">Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {labResult.results.map((r, i) => (
                              <tr key={i} className={`border-t border-border ${r.status !== 'normal' ? 'bg-destructive/3' : ''}`}>
                                <td className="px-3 py-2.5 font-medium">{r.parameter}</td>
                                <td className="px-3 py-2.5">
                                  <span className={r.status !== 'normal' ? 'text-destructive font-semibold' : ''}>
                                    {r.value} {r.unit}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.referenceRange}</td>
                                <td className="px-3 py-2.5">
                                  {r.status === 'normal' ? (
                                    <span className="flex items-center gap-1 text-xs text-success">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Normal
                                    </span>
                                  ) : r.status === 'high' ? (
                                    <span className="flex items-center gap-1 text-xs text-destructive">
                                      <TrendingUp className="h-3.5 w-3.5" /> High
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-warning">
                                      <TrendingDown className="h-3.5 w-3.5" /> Low
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-secondary/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Results are being processed...</p>
                    </div>
                  )}

                  {labResult.notes && (
                    <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
                      <p className="text-xs font-medium text-success mb-1">Pathologist's Notes</p>
                      <p className="text-sm text-foreground">{labResult.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* CERTIFICATE PREVIEW */}
          {type === 'certificate' && certificate && (
            <div className="border border-warning/20 rounded-xl overflow-hidden">
              <div className="bg-warning px-5 py-4 text-warning-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-80">Medical Certificate</p>
                    <h2 className="text-lg font-bold mt-0.5">{certificate.purpose}</h2>
                  </div>
                  <Award className="h-8 w-8 opacity-60" />
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Issued By</p>
                  <p className="font-semibold text-sm">{certificate.doctor?.name || 'Physician'}</p>
                  <p className="text-xs text-muted-foreground">{certificate.doctor?.specialty}</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 border border-border rounded-lg">
                    <p className="text-xs text-muted-foreground mb-0.5">Diagnosis / Condition</p>
                    <p className="font-semibold">{certificate.diagnosis}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-0.5">Rest Days Required</p>
                      <p className="font-bold text-2xl text-warning">{certificate.restDays}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-3 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-0.5">Valid Period</p>
                      <p className="font-semibold text-sm">
                        {safeFormat(certificate.validFrom, 'MMM d')} –<br/>
                        {safeFormat(certificate.validUntil, 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
                  <ShieldCheck className="h-4 w-4 mx-auto mb-1 text-success" />
                  This is a digitally verified medical certificate issued via NowServing Health
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

