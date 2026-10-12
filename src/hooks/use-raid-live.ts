"use client";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-utils";

export type RaidLivePresenceMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
};

export type RaidLiveConnectionStatus = "connected" | "degraded" | "offline";

export type UseRaidLiveOptions = {
  guildId?: string | null;
  eventId?: string | null;
  userName?: string;
  userAvatar?: string;
  enabled?: boolean;
  /** Appelé à chaque event live (started/ended/step/objectives) : relecture. */
  onUpdate?: (kind: string) => void;
};

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Lot 2 — session live d'un raid côté client.
 *
 * Join room `guild:<guildId>:raid-live:<eventId>`, heartbeat 20 s (page
 * visible, connecté), écoute `raid-live:event` (→ `onUpdate`, l'appelant
 * relit la session) et `raid-live:presence:update` (compteur « x inscrits
 * avec overlay ouvert », lot 4c).
 *
 * Sans `eventId`/`guildId` : inactif (overlay statique). Fail-soft : WS down
 * ⇒ l'appelant garde son polling (jamais d'écran vide).
 */
export function useRaidLive(options: UseRaidLiveOptions) {
  const { guildId, eventId, userName, userAvatar, enabled = true, onUpdate } = options;
  const [connectionStatus, setConnectionStatus] = useState<RaidLiveConnectionStatus>("degraded");
  const [presence, setPresence] = useState<RaidLivePresenceMember[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const active = enabled && !!guildId && !!eventId;

  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    const socket = getSocket({ guildId: guildId! });
    socketRef.current = socket;

    const onConnect = () => {
      setConnectionStatus("connected");
      socket.emit("raid-live:join", { guildId, eventId });
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", () => setConnectionStatus("offline"));
    socket.on("connect_error", () => setConnectionStatus("offline"));

    const onPresence = (data: { guildId?: string; eventId?: string; members?: RaidLivePresenceMember[] }) => {
      if (data.eventId !== eventId) return;
      setPresence(data.members ?? []);
    };
    const onEvent = (batch: Array<{ kind?: string }>) => {
      if (!Array.isArray(batch) || batch.length === 0) return;
      for (const e of batch) {
        if (e && typeof e.kind === "string") onUpdateRef.current?.(e.kind);
      }
    };
    socket.on("raid-live:presence:update", onPresence);
    socket.on("raid-live:event", onEvent);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("raid-live:presence:update", onPresence);
      socket.off("raid-live:event", onEvent);
      socket.emit("raid-live:leave", { guildId, eventId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [active, guildId, eventId]);

  // Heartbeat : 20 s, page visible, connecté.
  useEffect(() => {
    if (!active) return;
    if (connectionStatus !== "connected") return;
    const emit = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      socketRef.current?.emit("raid-live:heartbeat", { guildId, eventId, userName, userAvatar });
    };
    emit();
    const id = window.setInterval(emit, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, connectionStatus, guildId, eventId, userName, userAvatar]);

  return { connectionStatus, presence };
}
