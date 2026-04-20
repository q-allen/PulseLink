"use client";

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, FileText, ChevronRight, ChevronLeft,
  CheckCircle2, Clock, User, PhoneOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Appointment } from '@/types';
import DocumentComposer from '@/components/doctor/DocumentComposer';

interface VideoConsultModalProps {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onEnd: (notes?: string) => void;
  onSendPrescription?: (payload: { diagnosis: string; medications: string; instructions: string; followUpDate?: string }) => void;
  onSendLab?: (payload: { testName: string; notes: string }) => void;
  onSendCertificate?: (payload: { purpose: string; diagnosis: string; restDays: number }) => void;
  videoRoomUrl?: string;
}

type SentDoc = { type: string; label: string; time: string };

export default function VideoConsultModal({
  open,
  appointment,
  onClose,
  onEnd,
  onSendPrescription,
  onSendLab,
  onSendCertificate,
  videoRoomUrl,
}: VideoConsultModalProps) {
  const jitsiUrl = videoRoomUrl ?? appointment?.videoRoomUrl;
  const [note, setNote] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sentDocs, setSentDocs] = useState<SentDoc[]>([]);

  if (!open) return null;

  function reset() {
    setNote('');
    setPanelOpen(false);
    setShowEndConfirm(false);
    setSentDocs([]);
  }

  function recordSent(type: string, label: string) {
    setSentDocs((prev) => [
      { type, label, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ...prev,
    ]);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex bg-gray-950">

      {/* ── Jitsi iframe ── */}
      <div className="relative flex-1 h-full">
        {jitsiUrl ? (
          <iframe
            src={jitsiUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
            title="Video Consultation"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/50">
            <div className="h-12 w-12 rounded-full border-2 border-white/20 flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <p className="text-sm">Connecting to video room…</p>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white/80 text-xs font-medium">LIVE</span>
            {appointment?.patient?.name && (
              <Badge variant="secondary" className="bg-white/10 text-white border-0 text-xs">
                {appointment.patient.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <Button
              size="sm"
              className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
              onClick={() => setPanelOpen((v) => !v)}
            >
              <FileText className="h-4 w-4" />
              {panelOpen ? 'Hide Panel' : 'Documents'}
              {sentDocs.length > 0 && (
                <span className="ml-1 h-4 w-4 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {sentDocs.length}
                </span>
              )}
              {panelOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => setShowEndConfirm(true)}
            >
              <PhoneOff className="h-4 w-4" />
              End Consult
            </Button>
          </div>
        </div>
      </div>

      {/* ── Side panel ── */}
      {panelOpen && (
        <div className="w-[440px] bg-background border-l border-border flex flex-col h-full">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
            <div>
              <p className="font-semibold text-sm">{appointment?.patient?.name ?? 'Patient'}</p>
              <p className="text-xs text-muted-foreground">Active consultation</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Sent documents log */}
          {sentDocs.length > 0 && (
            <div className="px-4 py-3 border-b border-border bg-green-500/5 shrink-0">
              <p className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sent Documents
              </p>
              <div className="space-y-1.5">
                {sentDocs.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-green-500/10 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-green-700">{doc.label}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {doc.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Notes */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Consultation Notes
              </p>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Quick notes for this session…"
              />
            </div>

            {/* Document composer */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Send Document
              </p>
              <DocumentComposer
                onSendPrescription={(payload) => {
                  onSendPrescription?.(payload);
                  recordSent('prescription', `E-Prescription — ${payload.diagnosis || 'Prescription'}`);
                }}
                onSendLab={(payload) => {
                  onSendLab?.(payload);
                  recordSent('lab', `Lab Request — ${payload.testName || 'Lab Test'}`);
                }}
                onSendCertificate={(payload) => {
                  onSendCertificate?.(payload);
                  recordSent('certificate', `Medical Certificate — ${payload.purpose || 'Certificate'}`);
                }}
              />
            </div>
          </div>

          {/* End button */}
          <div className="p-4 border-t border-border shrink-0">
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => setShowEndConfirm(true)}
            >
              <PhoneOff className="h-4 w-4" />
              End Consultation
            </Button>
          </div>
        </div>
      )}

      {/* ── End confirmation overlay ── */}
      {showEndConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-background rounded-2xl p-6 w-96 space-y-4 shadow-2xl border border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <PhoneOff className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-base">End Consultation?</p>
                <p className="text-xs text-muted-foreground">This will close the video call.</p>
              </div>
            </div>

            {sentDocs.length > 0 ? (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 space-y-1">
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {sentDocs.length} document{sentDocs.length > 1 ? 's' : ''} sent
                </p>
                {sentDocs.map((doc, i) => (
                  <p key={i} className="text-xs text-green-600 pl-5">{doc.label}</p>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-700">
                  No documents sent yet. You can still send a prescription before ending.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowEndConfirm(false)}>
                Back to Call
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => { reset(); onEnd(note); }}
              >
                End Call
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
