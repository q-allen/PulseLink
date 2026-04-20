"use client";

import { useState } from 'react';
import { FileText, ClipboardList, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PrescriptionComposer from '@/components/video/PrescriptionComposer';

type DocType = 'prescription' | 'lab' | 'certificate';

interface DocumentComposerProps {
  onSendPrescription: (payload: { diagnosis: string; medications: string; instructions: string; followUpDate?: string }) => void;
  onSendLab: (payload: { testName: string; notes: string }) => void;
  onSendCertificate: (payload: { purpose: string; diagnosis: string; restDays: number }) => void;
}

export default function DocumentComposer({ onSendPrescription, onSendLab, onSendCertificate }: DocumentComposerProps) {
  const [type, setType] = useState<DocType>('prescription');
  const [testName, setTestName] = useState('');
  const [labNotes, setLabNotes] = useState('');
  const [purpose, setPurpose] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [restDays, setRestDays] = useState('3');

  const tabs: { key: DocType; label: string; icon: React.ElementType }[] = [
    { key: 'prescription', label: 'Rx', icon: FileText },
    { key: 'lab', label: 'Lab', icon: ClipboardList },
    { key: 'certificate', label: 'Cert', icon: FileSignature },
  ];

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = type === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setType(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors
                ${active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {type === 'prescription' && (
        <PrescriptionComposer onSend={onSendPrescription} />
      )}

      {type === 'lab' && (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Test Name *</label>
            <Input
              placeholder="e.g., CBC, Lipid Profile, Urinalysis"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <Textarea
              rows={3}
              placeholder="Special instructions for the lab…"
              value={labNotes}
              onChange={(e) => setLabNotes(e.target.value)}
              className="text-sm resize-none"
            />
          </div>
          <Button
            className="w-full gap-2 h-9"
            disabled={!testName.trim()}
            onClick={() => { onSendLab({ testName, notes: labNotes }); setTestName(''); setLabNotes(''); }}
          >
            <ClipboardList className="h-4 w-4" />
            Send Lab Request
          </Button>
        </div>
      )}

      {type === 'certificate' && (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purpose *</label>
            <Input
              placeholder="e.g., Sick leave, School clearance"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnosis *</label>
            <Input
              placeholder="e.g., Acute gastroenteritis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rest Days</label>
            <Input
              type="number"
              min="0"
              placeholder="3"
              value={restDays}
              onChange={(e) => setRestDays(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            className="w-full gap-2 h-9"
            disabled={!purpose.trim() || !diagnosis.trim()}
            onClick={() => {
              onSendCertificate({ purpose, diagnosis, restDays: Number(restDays || 0) });
              setPurpose(''); setDiagnosis(''); setRestDays('3');
            }}
          >
            <FileSignature className="h-4 w-4" />
            Send Certificate
          </Button>
        </div>
      )}
    </div>
  );
}
