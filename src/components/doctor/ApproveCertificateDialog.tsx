import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { toast } from "sonner";

interface ApproveCertificateDialogProps {
  open: boolean;
  onClose: () => void;
  request: {
    id: number;
    patient: { first_name: string; last_name: string };
    purpose: string;
    notes: string;
  };
  onSuccess: () => void;
}

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
  const [loading, setLoading] = useState(false);

  // Auto-calculate valid_until based on rest_days
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
      });

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve & Issue Medical Certificate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">Patient</p>
            <p className="font-medium">
              {request.patient.first_name} {request.patient.last_name}
            </p>
            <p className="text-sm text-gray-600 mt-2">Purpose</p>
            <p className="font-medium">{request.purpose}</p>
            {request.notes && (
              <>
                <p className="text-sm text-gray-600 mt-2">Patient Notes</p>
                <p className="text-sm">{request.notes}</p>
              </>
            )}
          </div>

          <div>
            <Label htmlFor="diagnosis">Diagnosis *</Label>
            <Textarea
              id="diagnosis"
              placeholder="Enter the medical diagnosis..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              required
              rows={3}
            />
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
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter 0 if no rest is required (e.g., fitness certificate)
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
              />
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
