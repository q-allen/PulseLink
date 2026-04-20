import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Doctor } from '@/types';
import JitsiMeeting from '@/components/JitsiMeeting';

interface RtcVideoCallModalProps {
  doctor: Doctor;
  roomName: string;
  displayName: string;
  onEnd: (endedAt: string) => void;
}

const sanitizeRoomName = (value: string) =>
  value.replace(/[^a-zA-Z0-9-_]/g, '');

export default function RtcVideoCallModal({
  doctor,
  roomName,
  displayName,
  onEnd,
}: RtcVideoCallModalProps) {
  const safeRoom = useMemo(() => sanitizeRoomName(roomName) || `PulseLink-${doctor.id}`, [roomName, doctor.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <div className="absolute top-4 left-4 z-10 rounded-xl bg-black/60 px-3 py-2 text-white">
        <p className="text-sm font-semibold">{doctor.name}</p>
        <p className="text-xs text-white/70">{doctor.specialty}</p>
      </div>

      <div className="flex-1 min-h-0">
        <JitsiMeeting
          roomName={safeRoom}
          displayName={displayName}
          onLeave={() => onEnd(new Date().toISOString())}
          className="h-full w-full rounded-none"
        />
      </div>
    </motion.div>
  );
}

