"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, PhoneOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useIncomingCallStore } from "@/store/incomingCallStore";

export default function IncomingCallOverlay() {
  const { call, clearCall } = useIncomingCallStore();
  const router = useRouter();

  // Simple ringtone via Web Audio API
  useEffect(() => {
    if (!call) return;
    const ctx = new AudioContext();
    let stopped = false;

    const ring = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      setTimeout(ring, 1200);
    };
    ring();

    return () => {
      stopped = true;
      ctx.close();
    };
  }, [call?.appointmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = () => {
    if (!call) return;
    const id = call.appointmentId;
    clearCall();
    router.push(`/patient/teleconsult/${id}`);
  };

  return (
    <AnimatePresence>
      {call && (
        <motion.div
          initial={{ opacity: 0, y: -80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -80 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4"
        >
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-14 w-14 ring-2 ring-green-500/50">
                <AvatarImage src={call.doctorAvatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {call.doctorName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{call.doctorName}</p>
              <p className="text-white/50 text-xs truncate">{call.doctorSpecialty}</p>
              <p className="text-green-400 text-xs font-medium mt-0.5 animate-pulse">
                Incoming video call…
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400"
                onClick={clearCall}
                title="Decline"
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-10 w-10 rounded-full bg-green-500 hover:bg-green-600 text-white"
                onClick={handleAccept}
                title="Accept"
              >
                <Video className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
