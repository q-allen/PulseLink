"use client";

/**
 * JitsiMeeting.tsx
 *
 * Embeds a Jitsi Meet iframe for video consultations.
 * Uses meet.jit.si (public, free) by default.
 *
 * Self-hosting later:
 *   1. Deploy Jitsi on your own server (docker-compose from jitsi/docker-jitsi-meet)
 *   2. Set NEXT_PUBLIC_JITSI_DOMAIN=your.jitsi.server in .env.local
 *   3. Enable JWT auth in Jitsi config for room-level security
 *
 * For React Native / Expo: use react-native-jitsi-meet package instead of this iframe.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JitsiMeetingProps {
  roomName: string;
  password?: string;
  displayName: string;
  domain?: string;
  onLeave?: () => void;
  onJoin?: () => void;
  className?: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: object) => {
      executeCommand: (cmd: string, ...args: unknown[]) => void;
      addEventListeners: (listeners: Record<string, () => void>) => void;
      dispose: () => void;
    };
  }
}

export default function JitsiMeeting({
  roomName,
  password,
  displayName,
  domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si",
  onLeave,
  onJoin,
  className = "",
}: JitsiMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<InstanceType<typeof window.JitsiMeetExternalAPI> | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    // Load Jitsi External API script dynamically
    const scriptId = "jitsi-external-api";
    const existing = document.getElementById(scriptId);

    const initJitsi = () => {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

      const api = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: containerRef.current,
        userInfo: { displayName },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false,       // skip pre-join screen for seamless UX
          enableWelcomePage: false,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            "microphone", "camera", "closedcaptions", "desktop",
            "fullscreen", "fodeviceselection", "hangup", "chat",
            "recording", "livestreaming", "etherpad", "sharedvideo",
            "settings", "raisehand", "videoquality", "filmstrip",
            "feedback", "stats", "shortcuts", "tileview", "videobackgroundblur",
            "download", "help", "mute-everyone",
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: "",
          SHOW_POWERED_BY: false,
          DEFAULT_BACKGROUND: "#1a2a3a",
        },
      });

      apiRef.current = api;

      api.addEventListeners({
        videoConferenceJoined: () => {
          setLoading(false);
          // Set password after joining (Jitsi room password flow)
          if (password) {
            api.executeCommand("password", password);
          }
          onJoin?.();
        },
        videoConferenceLeft: () => {
          onLeave?.();
        },
        readyToClose: () => {
          onLeave?.();
        },
      });
    };

    if (existing) {
      initJitsi();
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = initJitsi;
      document.head.appendChild(script);
    }

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [roomName, domain]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMute = () => {
    apiRef.current?.executeCommand("toggleAudio");
    setMuted((v) => !v);
  };

  const handleToggleVideo = () => {
    apiRef.current?.executeCommand("toggleVideo");
    setVideoOff((v) => !v);
  };

  const handleHangup = () => {
    apiRef.current?.executeCommand("hangup");
    onLeave?.();
  };

  return (
    <div className={`relative flex flex-col rounded-2xl overflow-hidden bg-gray-900 ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-900 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-white/70 text-sm">Connecting to consultation room…</p>
        </div>
      )}

      {/* Jitsi iframe mounts here */}
      <div ref={containerRef} className="flex-1 min-h-[480px]" />

      {/* Custom controls overlay (optional — Jitsi has its own toolbar too) */}
      <div className="flex items-center justify-center gap-3 bg-gray-900/95 border-t border-white/10 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleMute}
          className={`h-11 w-11 rounded-full text-white hover:bg-white/20 ${muted ? "bg-red-500/30 text-red-400" : ""}`}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleVideo}
          className={`h-11 w-11 rounded-full text-white hover:bg-white/20 ${videoOff ? "bg-red-500/30 text-red-400" : ""}`}
          title={videoOff ? "Turn on camera" : "Turn off camera"}
        >
          {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
        <Button
          size="icon"
          onClick={handleHangup}
          className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white"
          title="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
