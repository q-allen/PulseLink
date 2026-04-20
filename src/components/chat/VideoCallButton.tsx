/**
 * VideoCallButton.tsx
 *
 * NowServing alignment:
 * - Only shows "Join Video Call" when the appointment is:
 *     type === 'online'  AND  status === 'in_progress'
 * - This matches NowServing's behavior: the button appears only when the
 *   doctor has clicked "Start Consult" (status transitions to in_progress).
 * - Confirmed/pending appointments show the appointment banner instead.
 */

import { Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Appointment } from '@/types';

interface VideoCallButtonProps {
  appointment?: Appointment | null;
  onStartCall: () => void;
}

export default function VideoCallButton({ appointment, onStartCall }: VideoCallButtonProps) {
  if (!appointment) return null;
  if (appointment.type !== 'online') return null;
  // Only show when consult is actively in progress (doctor has started it)
  if (appointment.status !== 'in_progress' && appointment.status !== 'in-progress') return null;

  return (
    <Button
      onClick={onStartCall}
      size="sm"
      className="bg-success text-success-foreground hover:bg-success/90 gap-2 animate-pulse-soft"
    >
      <Video className="h-4 w-4" />
      <span className="hidden sm:inline">Join Video Call</span>
      <span className="sm:hidden">Join</span>
    </Button>
  );
}
