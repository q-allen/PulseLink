"use client";

import { motion } from 'framer-motion';
import { 
  FileText, FlaskConical, Award, File, Download, Eye, Share2, 
  User, Calendar, ChevronRight, Sparkles, Pill, Printer
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl, API_ENDPOINTS } from '@/services/api';

type FileType = 'prescription' | 'lab-result' | 'certificate' | 'other';

interface FileCardProps {
  id: string;
  type: FileType;
  title: string;
  description: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar?: string;
  date: string;
  isNew?: boolean;
  statusBadge?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
  hasPrescriptionMeds?: boolean;
  pdfUrl?: string;
  fileUrl?: string;
  index?: number;
  onClick: () => void;
}

const typeConfig: Record<FileType, { icon: React.ElementType; bg: string; iconColor: string; label: string }> = {
  prescription: { icon: FileText, bg: 'bg-primary/10', iconColor: 'text-primary', label: 'E-Prescription' },
  'lab-result': { icon: FlaskConical, bg: 'bg-success/10', iconColor: 'text-success', label: 'Lab Result' },
  certificate: { icon: Award, bg: 'bg-warning/10', iconColor: 'text-warning', label: 'Medical Certificate' },
  other: { icon: File, bg: 'bg-accent/10', iconColor: 'text-accent', label: 'Document' },
};

export default function FileCard({
  id, type, title, description, doctorName, doctorSpecialty, doctorAvatar,
  date, isNew, statusBadge, hasPrescriptionMeds, pdfUrl, fileUrl, index = 0, onClick,
}: FileCardProps) {
  const { icon: Icon, bg, iconColor, label } = typeConfig[type];
  const router = useRouter();
  const { toast } = useToast();

  const effectiveUrl = pdfUrl || fileUrl;

  // Use backend proxy for prescriptions, certificates, and lab results to avoid Cloudinary CORS issues.
  const fetchFile = async (): Promise<Blob> => {
    const base = getBaseUrl();
    let proxyUrl: string | null = null;
    if (type === 'prescription') proxyUrl = `${base}${API_ENDPOINTS.PRESCRIPTION_PDF(id)}`;
    else if (type === 'certificate') proxyUrl = `${base}${API_ENDPOINTS.CERTIFICATE_PDF(id)}`;
    else if (type === 'lab-result') proxyUrl = `${base}${API_ENDPOINTS.LAB_PDF(id)}`;
    if (proxyUrl) {
      const res = await fetch(proxyUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.blob();
    }
    if (!effectiveUrl) throw new Error('no-url');
    const url = effectiveUrl.startsWith('http') ? effectiveUrl : `${base}${effectiveUrl}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return res.blob();
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type !== 'prescription' && type !== 'certificate' && type !== 'lab-result' && !effectiveUrl) {
      toast({ title: 'No file available', description: 'The file has not been generated yet.', variant: 'destructive' });
      return;
    }
    try {
      const blob = await fetchFile();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${type}-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      toast({ title: 'Download failed', description: 'Could not download the file. Try again.', variant: 'destructive' });
    }
  };

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type !== 'prescription' && type !== 'certificate' && type !== 'lab-result' && !effectiveUrl) {
      toast({ title: 'No printable file', description: 'File not available for printing.', variant: 'destructive' });
      return;
    }
    try {
      const blob = await fetchFile();
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) toast({ title: 'Popup blocked', description: 'Allow popups for this site to print.', variant: 'destructive' });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      toast({ title: 'Print failed', description: 'Could not load the file. Try downloading instead.', variant: 'destructive' });
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const base = getBaseUrl();
    const shareUrl = type === 'prescription'
      ? `${base}${API_ENDPOINTS.PRESCRIPTION_PDF(id)}`
      : type === 'certificate'
        ? `${base}${API_ENDPOINTS.CERTIFICATE_PDF(id)}`
        : type === 'lab-result'
          ? `${base}${API_ENDPOINTS.LAB_PDF(id)}`
          : (effectiveUrl?.startsWith('http') ? effectiveUrl : `${base}${effectiveUrl ?? ''}`) || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PulseLink Document', url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!', description: 'Secure file link copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy the link.', variant: 'destructive' });
    }
  };

  const handleOrderMeds = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/patient/pharmacy');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card
        className="group hover:shadow-md transition-all duration-200 cursor-pointer border-border hover:border-primary/30 overflow-hidden"
        onClick={onClick}
      >
        {isNew && (
          <div className="h-0.5 w-full bg-gradient-to-r from-primary to-accent" />
        )}
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Type Icon */}
            <div className={`p-3 rounded-xl ${bg} flex-shrink-0`}>
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                    {isNew && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-0 gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        New
                      </Badge>
                    )}
                    {statusBadge && (
                      <Badge variant={statusBadge.variant} className="text-[10px] px-1.5 py-0 h-4">
                        {statusBadge.label}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mt-0.5 truncate">{title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
              </div>

              {/* Doctor + Date Row */}
              <div className="flex items-center gap-4 mt-2.5">
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={doctorAvatar} />
                    <AvatarFallback className="text-[9px] bg-secondary text-secondary-foreground">
                      {doctorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{doctorName}</span>
                  <span className="text-xs text-muted-foreground/50">·</span>
                  <span className="text-xs text-muted-foreground">{doctorSpecialty}</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {(() => { try { const d = new Date(date); return isNaN(d.getTime()) ? date : format(d, 'MMM d, yyyy'); } catch { return date; } })()}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={onClick}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={handlePrint}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={handleShare}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
                {hasPrescriptionMeds && (
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 ml-auto"
                    onClick={handleOrderMeds}
                  >
                    <Pill className="h-3.5 w-3.5" />
                    Order Meds
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

