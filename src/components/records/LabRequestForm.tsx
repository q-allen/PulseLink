"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsService } from "@/services/medicalRecordsService";

const LAB_TYPES = [
  "Blood Test", "Urinalysis", "Stool Exam", "X-Ray", "ECG",
  "Ultrasound", "CT Scan", "MRI", "Biopsy", "Culture & Sensitivity", "Other",
];

interface LabRequestFormProps {
  patientId: string;
  appointmentId?: string;
  onSuccess?: () => void;
}

export default function LabRequestForm({ patientId, appointmentId, onSuccess }: LabRequestFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testName, setTestName] = useState("");
  const [testType, setTestType] = useState("");
  const [laboratory, setLaboratory] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim() || !testType) {
      toast({ title: "Fill in test name and type.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await medicalRecordsService.createLabRequest({
        patient_id: patientId,
        appointment_id: appointmentId,
        test_name: testName.trim(),
        test_type: testType,
        laboratory: laboratory.trim(),
        notes: notes.trim(),
      });
      if (!res.success) throw new Error("Failed");
      toast({ title: "Lab request sent", description: `${testName} request sent to patient.` });
      setTestName(""); setTestType(""); setLaboratory(""); setNotes("");
      onSuccess?.();
    } catch {
      toast({ title: "Failed to send lab request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Test Name *</label>
          <Input
            placeholder="e.g. Complete Blood Count"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Test Type *</label>
          <Select value={testType} onValueChange={setTestType} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {LAB_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Laboratory (optional)</label>
        <Input
          placeholder="e.g. St. Luke's Laboratory"
          value={laboratory}
          onChange={(e) => setLaboratory(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes / Instructions (optional)</label>
        <Textarea
          placeholder="Special instructions for the patient..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
          className="min-h-[70px] resize-none"
        />
      </div>
      <Button type="submit" className="w-full gap-2" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
        Send Lab Request to Patient
      </Button>
    </form>
  );
}
