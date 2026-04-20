"use client";

/**
 * src/components/video/JitsiMeeting.tsx
 *
 * Embeds a Jitsi Meet room via plain iframe.
 * Both doctor (new tab) and patient (embedded) open the same URL → same room → they meet.
 *
 * SETUP: Add to PulseLinkWeb/.env.local:
 *   NEXT_PUBLIC_JITSI_DOMAIN=meet.jit.si
 *
 * HOW IT WORKS:
 *   meet.jit.si/<roomName>  — anyone who opens this URL joins the same room.
 *   No API key, no account, no server needed for development.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import styles from "./JitsiMeeting.module.css";

export interface JitsiMeetingProps {
  roomName: string;
  displayName: string;
  domain?: string;
  onLoad?: () => void;
  className?: string;
}

export default function JitsiMeeting({
  roomName,
  displayName,
  domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si",
  onLoad,
  className = "",
}: JitsiMeetingProps) {
  const [loading, setLoading] = useState(true);

  // Build a clean Jitsi URL.
  // Only put simple key=value pairs in the fragment — no arrays, no quotes.
  // Complex config (toolbar buttons etc.) is left to Jitsi defaults.
  const encodedName = encodeURIComponent(displayName);
  const iframeSrc =
    `https://${domain}/${roomName}` +
    `#userInfo.displayName="${encodedName}"` +
    `&config.prejoinPageEnabled=false` +
    `&config.startWithAudioMuted=false` +
    `&config.startWithVideoMuted=false` +
    `&config.disableDeepLinking=true`;

  return (
    <div className={`relative flex flex-col bg-gray-900 ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-900 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-white/70 text-sm">Connecting to video room…</p>
          <p className="text-white/30 text-xs">Allow camera &amp; microphone when prompted</p>
        </div>
      )}
      {/*
        allow="camera; microphone" is REQUIRED.
        Without it the browser blocks camera/mic inside the iframe entirely
        and the patient/doctor cannot see or hear each other.
      */}
      <iframe
        src={iframeSrc}
        allow="camera; microphone; display-capture; autoplay; clipboard-write"
        allowFullScreen
        onLoad={() => { setLoading(false); onLoad?.(); }}
        className={`flex-1 w-full border-0 ${styles.iframe}`}
        title="Video Consultation"
      />
    </div>
  );
}

