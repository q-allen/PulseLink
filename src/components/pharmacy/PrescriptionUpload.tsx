'use client';
import { useRef, useState } from 'react';
import { Upload, FileText, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { useToast } from '@/hooks/use-toast';
import { pharmacyService } from '@/services/pharmacyService';

interface PrescriptionUploadProps {
  compact?: boolean;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export default function PrescriptionUpload({ compact = false }: PrescriptionUploadProps) {
  const { prescriptionFile, setPrescription } = usePharmacyStore();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      toast({ title: 'Invalid file', description: 'Please upload an image (JPG/PNG) or PDF.', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 10MB.', variant: 'destructive' });
      return;
    }

    const localUrl = URL.createObjectURL(file);
    // Optimistically show the file while uploading
    setPrescription(file, localUrl, null);
    setUploading(true);

    try {
      const res = await pharmacyService.uploadPrescription(file);
      setPrescription(file, localUrl, res.data.id);
      toast({ title: 'Prescription uploaded', description: `${file.name} has been attached and submitted for review.` });
    } catch {
      // Keep the local preview but clear the upload ID — order will be blocked server-side
      setPrescription(file, localUrl, null);
      toast({
        title: 'Upload failed',
        description: 'Could not upload prescription to server. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setPrescription(null, null, null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Compact mode (used inside cart warning banner) ────────────────────────
  if (compact && prescriptionFile) {
    return (
      <div className="flex items-center gap-2 p-2 bg-success/10 border border-success/30 rounded-lg text-sm">
        {uploading
          ? <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          : <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
        <span className="flex-1 truncate text-success font-medium">{prescriptionFile.name}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRemove} disabled={uploading}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // ── Attached state ────────────────────────────────────────────────────────
  if (prescriptionFile) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/30 rounded-xl">
        <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
          {uploading
            ? <Loader2 className="h-5 w-5 text-primary animate-spin" />
            : <FileText className="h-5 w-5 text-success" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-success">
            {uploading ? 'Uploading…' : 'Prescription attached'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{prescriptionFile.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={uploading}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── Drop zone ─────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleInputChange}
        title="Upload prescription file"
        aria-label="Upload prescription file"
      />
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
        <Upload className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">Upload Prescription</p>
      <p className="text-xs text-muted-foreground">Drag & drop or click to browse · JPG, PNG, PDF · Max 10MB</p>
    </div>
  );
}
