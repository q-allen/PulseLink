"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type MedicationDraft = {
  name: string;
  strength: string;
  form: string;
  sig: string;
  duration: string;
  quantity: string;
  generic: string;
  route: string;
  refills: string;
};

export type PrescriptionPayload = {
  diagnosis: string;
  medications: string;
  instructions: string;
  followUpDate?: string;
};

export type PrescriptionPrefill = {
  diagnosis?: string;
  instructions?: string;
  followUpDate?: string;
  medications?: MedicationDraft[];
};

interface PrescriptionComposerProps {
  onSend: (payload: PrescriptionPayload) => void;
  prefill?: PrescriptionPrefill;
  loading?: boolean;
  sendLabel?: string;
}

const emptyMed = (): MedicationDraft => ({
  name: "", strength: "", form: "", sig: "",
  duration: "", quantity: "1", generic: "", route: "", refills: "",
});

function MedRow({
  med, idx, total,
  onChange, onRemove,
}: {
  med: MedicationDraft;
  idx: number;
  total: number;
  onChange: (field: keyof MedicationDraft, value: string) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Med header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-secondary/40 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] shrink-0">
          {idx + 1}
        </Badge>
        <span className="flex-1 text-sm font-medium truncate text-foreground">
          {med.name || <span className="text-muted-foreground italic">Medicine name</span>}
          {med.strength && <span className="text-muted-foreground ml-1 font-normal">{med.strength}</span>}
        </span>
        <div className="flex items-center gap-1">
          {total > 1 && (
            <button
              type="button"
              title="Remove medication"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-2.5">
          {/* Row 1: Name + Strength */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              placeholder="Medicine name *"
              value={med.name}
              onChange={(e) => onChange("name", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Strength"
              value={med.strength}
              onChange={(e) => onChange("strength", e.target.value)}
              className="h-8 text-sm w-28"
            />
          </div>

          {/* Row 2: Form + Route */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Form (tablet, capsule…)"
              value={med.form}
              onChange={(e) => onChange("form", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Route (PO, IM, IV…)"
              value={med.route}
              onChange={(e) => onChange("route", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Sig */}
          <Input
            placeholder="Sig — e.g. Take 1 tab every 8 hours after meals"
            value={med.sig}
            onChange={(e) => onChange("sig", e.target.value)}
            className="h-8 text-sm"
          />

          {/* Row 3: Duration + Qty + Refills */}
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Duration"
              value={med.duration}
              onChange={(e) => onChange("duration", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Qty"
              value={med.quantity}
              onChange={(e) => onChange("quantity", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Refills"
              value={med.refills}
              onChange={(e) => onChange("refills", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Generic (optional, collapsed by default feel) */}
          <Input
            placeholder="Generic name (optional)"
            value={med.generic}
            onChange={(e) => onChange("generic", e.target.value)}
            className="h-8 text-sm text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}

export default function PrescriptionComposer({ onSend, prefill, loading, sendLabel }: PrescriptionComposerProps) {
  const [diagnosis, setDiagnosis] = useState(prefill?.diagnosis ?? "");
  const [remarks, setRemarks] = useState(prefill?.instructions ?? "");
  const [followUpDate, setFollowUpDate] = useState(prefill?.followUpDate ?? "");
  const [medications, setMedications] = useState<MedicationDraft[]>(
    prefill?.medications?.length ? prefill.medications : [emptyMed()]
  );

  // Sync prefill when it changes (e.g. pre-fill from existing prescription)
  const prefillKey = JSON.stringify(prefill);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!prefill) return;
    if (prefill.diagnosis !== undefined) setDiagnosis(prefill.diagnosis);
    if (prefill.instructions !== undefined) setRemarks(prefill.instructions);
    if (prefill.followUpDate !== undefined) setFollowUpDate(prefill.followUpDate);
    if (prefill.medications?.length) setMedications(prefill.medications);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const canSend = useMemo(() =>
    diagnosis.trim().length > 0 && medications.some((m) => m.name.trim().length > 0),
    [diagnosis, medications]
  );

  const updateMed = (idx: number, field: keyof MedicationDraft, value: string) =>
    setMedications((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const removeMed = (idx: number) =>
    setMedications((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = () => {
    const meds = medications.filter((m) => m.name.trim()).map((m) => ({ ...m }));
    const meta: Record<string, string> = {};
    if (followUpDate) meta.follow_up_date = followUpDate;
    onSend({
      diagnosis: diagnosis.trim(),
      medications: JSON.stringify({ medications: meds, meta }),
      instructions: remarks.trim(),
      followUpDate: followUpDate || undefined,
    });
    // Reset after send
    setDiagnosis("");
    setRemarks("");
    setFollowUpDate("");
    setMedications([emptyMed()]);
  };

  return (
    <div className="space-y-3">
      {/* Diagnosis */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Diagnosis <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder="e.g., Acute pharyngitis, URTI"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Medications */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Medications <span className="text-destructive">*</span>
        </label>
        <div className="space-y-2">
          {medications.map((med, idx) => (
            <MedRow
              key={idx}
              med={med}
              idx={idx}
              total={medications.length}
              onChange={(field, value) => updateMed(idx, field, value)}
              onRemove={() => removeMed(idx)}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-dashed h-8 text-xs"
          onClick={() => setMedications((prev) => [...prev, emptyMed()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Another Medicine
        </Button>
      </div>

      {/* Follow-up + Remarks */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Follow-Up
          </label>
          <Input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Remarks
          </label>
          <Textarea
            rows={2}
            placeholder="Additional notes…"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="text-sm resize-none"
          />
        </div>
      </div>

      <Button
        className="w-full gap-2 h-9"
        disabled={!canSend || loading}
        onClick={handleSend}
      >
        <Send className="h-4 w-4" />
        {loading ? 'Sending...' : (sendLabel ?? 'Send Prescription')}
      </Button>
    </div>
  );
}
