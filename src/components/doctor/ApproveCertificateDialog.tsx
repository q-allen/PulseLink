import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { toast } from "sonner";
import { User, Mail, Phone, Calendar, Droplets, MapPin } from "lucide-react";

interface ApproveCertificateDialogProps {
  open: boolean;
  onClose: () => void;
  request: {
    id: number;
    patient: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      date_of_birth?: string;
      gender?: string;
      blood_type?: string;
      address?: string;
    };
    appointment?: { id: number; date: string; time?: string };
    purpose: string;
    notes: string;
  };
  onSuccess: () => void;
}

const safeFormat = (dateStr: string | undefined, fmt: string, fallback = "—") => {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? fallback : format(d, fmt);
};

const getAge = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
};

export function ApproveCertificateDialog({
  open,
  onClose,
  request,
  onSuccess,
}: ApproveCertificateDialogProps) {
  const [diagnosis, setDiagnosis] = useState("");
  const [restDays, setRestDays] = useState("0");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const age = getAge(request.patient.date_of_birth);
  const initials = `${request.patient.first_name?.[0] ?? ""}${request.patient.last_name?.[0] ?? ""}`.toUpperCase() || "?";

  const handleRestDaysChange = (days: string) => {
    setRestDays(days);
    const daysNum = parseInt(days) || 0;
    if (daysNum > 0 && validFrom) {
      const from = new Date(validFrom);
      const until = new Date(from);
      until.setDate(until.getDate() + daysNum);
      setValidUntil(until.toISOString().split("T")[0]);
    }
  };

  const handleValidFromChange = (date: string) => {
    setValidFrom(date);
    const daysNum = parseInt(restDays) || 0;
    if (daysNum > 0) {
      const from = new Date(date);
      const until = new Date(from);
      until.setDate(until.getDate() + daysNum);
      setValidUntil(until.toISOString().split("T")[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      toast.error("Please enter the diagnosis");
      return;
    }
    if (!validFrom || !validUntil) {
      toast.error("Please set valid dates");
      return;
    }

    try {
      setLoading(true);
      const res = await medicalRecordsService.approveCertificateRequest(request.id.toString(), {
        diagnosis: diagnosis.trim(),
        rest_days: parseInt(restDays) || 0,
        valid_from: validFrom,
        valid_until: validUntil,
        notes: doctorNotes.trim() || undefined,
      } as any);

      if (res.success) {
        toast.success("Certificate approved and issued successfully");
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to approve certificate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve & Issue Medical Certificate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Summary Card */}
          <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-teal-100 text-teal-700 font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">
                  {request.patient.first_name} {request.patient.last_name}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {age !== null && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {age} yrs{request.patient.gender ? ` • ${request.patient.gender.charAt(0).toUpperCase() + request.patient.gender.slice(1)}` : ""}
                    </span>
                  )}
                  {request.patient.blood_type && (
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3 w-3" />
                      {request.patient.blood_type}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{request.patient.email}</span>
              </div>
              {request.patient.phone && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{request.patient.phone}</span>
                </div>
              )}
              {request.patient.address && (
                <div className="flex items-center gap-1.5 text-muted-foreground sm:col-span-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{request.patient.address}</span>
                </div>
              )}
            </div>

            {request.appointment && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Appointment: {safeFormat(request.appointment.date, "MMMM d, yyyy")}
                    {request.appointment.time && ` at ${request.appointment.time}`}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border space-y-1">
              <p className="text-xs font-medium text-foreground">Purpose</p>
              <p className="text-sm text-muted-foreground">{request.purpose}</p>
              {request.notes && (
                <>
                  <p className="text-xs font-medium text-foreground pt-1">Patient Notes</p>
                  <p className="text-sm text-muted-foreground">{request.notes}</p>
                </>
              )}
            </div>
          </div>

          {/* Certificate Details */}
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="diagnosis">Diagnosis / Medical Condition *</Label>
              <Textarea
                id="diagnosis"
                placeholder="Enter the medical diagnosis or condition..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                required
                rows={3}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will appear on the medical certificate
              </p>
            </div>

            <div>
              <Label htmlFor="doctorNotes">Doctor's Notes / Remarks (Optional)</Label>
              <Textarea
                id="doctorNotes"
                placeholder="Additional notes or recommendations for the certificate..."
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                rows={2}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: "Patient is advised to avoid strenuous activities" or "Follow-up required in 1 week"
              </p>
            </div>

            <div>
              <Label htmlFor="restDays">Rest Days *</Label>
              <Input
                id="restDays"
                type="number"
                min="0"
                placeholder="Number of rest days"
                value={restDays}
                onChange={(e) => handleRestDaysChange(e.target.value)}
                required
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter 0 if no rest is required (e.g., fitness certificate, clearance)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="validFrom">Valid From *</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={validFrom}
                  onChange={(e) => handleValidFromChange(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="validUntil">Valid Until *</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          {/* Medical Certificate Template Preview */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs">
            <p className="font-semibold text-foreground uppercase tracking-wide">Certificate Preview</p>
            <div className="space-y-1 text-muted-foreground">
              <p>This is to certify that <span className="font-medium text-foreground">{request.patient.first_name} {request.patient.last_name}</span>{age !== null && `, ${age} years old,`} was examined and found to have:</p>
              <p className="pl-4 italic text-foreground">{diagnosis || "[Diagnosis will appear here]"}</p>
              {parseInt(restDays) > 0 && (
                <p>Patient is advised to rest for <span className="font-medium text-foreground">{restDays} day(s)</span> from {validFrom ? safeFormat(validFrom, "MMM d, yyyy") : "[start date]"} to {validUntil ? safeFormat(validUntil, "MMM d, yyyy") : "[end date]"}.</p>
              )}
              {doctorNotes && (
                <p className="pt-1"><span className="font-medium text-foreground">Remarks:</span> {doctorNotes}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
              {loading ? "Issuing..." : "Approve & Issue Certificate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
