import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { toast } from "sonner";

interface RequestCertificateDialogProps {
  open: boolean;
  onClose: () => void;
  doctorId: string;
  appointmentId?: string;
  doctorName: string;
}

export function RequestCertificateDialog({
  open,
  onClose,
  doctorId,
  appointmentId,
  doctorName,
}: RequestCertificateDialogProps) {
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purpose.trim()) {
      toast.error("Please enter the purpose");
      return;
    }

    try {
      setLoading(true);
      const res = await medicalRecordsService.requestCertificate({
        doctor_id: doctorId,
        appointment_id: appointmentId,
        purpose: purpose.trim(),
        notes: notes.trim(),
      });

      if (res.success) {
        toast.success("Certificate request submitted successfully");
        setPurpose("");
        setNotes("");
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Medical Certificate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm text-gray-600">Doctor</Label>
            <p className="font-medium">{doctorName}</p>
          </div>

          <div>
            <Label htmlFor="purpose">Purpose *</Label>
            <Input
              id="purpose"
              placeholder="e.g., Sick Leave, Fitness to Work, School Excuse"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
