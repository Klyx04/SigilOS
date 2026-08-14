"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-utils";
import type { DofusRealtimeEvent } from "@/lib/dofus-realtime";

export type DofusPresenceMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  questId: string;
};

export type DofusConnectionStatus = "connected" | "degraded" | "offline";

export type UseDofusPresenceOptions = {
  guildId: string;
  dofusSlug: string;
  /** Quête courante → heartbeat de présence. null → pas d'émission. */
  questId?: string | null;
  /** Identité cosmétique (nom/avatar) du membre courant pour le heartbeat. */
  userName?: string;
  userAvatar?: string;
  /** false = mode discret : reçoit les events, n'émet PLUS son heartbeat. */
  enabled?: boolean;
  /** Callback temps réel (batch serveur) — ex: refresh de la synergie sur quest:status. */
  onEvent?: (event: DofusRealtimeEvent) => void;
};

const HEARTBEAT_INTERVAL_MS = 20_000;
const EVENTS_KEEP = 30;

/**
 * Présence temps réel d'une page par-Dofus (chantier #37, suite).
 *
 * Connexion Socket.IO (pattern src/lib/socket-utils.ts, cookie session via
 * withCredentials), join room `guild:<guildId>:dofus:<slug>`, heartbeat toutes
 * les 20s si page visible ET connecté.
 *
 * Sorties :
 *   - connectionStatus : "connected" | "degraded" (connexion en cours) | "offline" ;
 *   - presence : membres actuellement sur la page (par questId) ;
 *   - events : events DofusRealtimeEvent reçus (batch serveur), bornés.
 *
 * Fail-soft : si le WS est down, connectionStatus !== "connected" → l'appelant
 * retombe sur ses props serveur (jamais d'écran vide).
 */
export function useDofusPresence(options: UseDofusPresenceOptions) {
  const { guildId, dofusSlug, questId, userName, userAvatar, enabled = true, onEvent } = options;
  const [connectionStatus, setConnectionStatus] = useState<DofusConnectionStatus>("degraded");
  const [presence, setPresence] = useState<DofusPresenceMember[]>([]);
  const [events, setEvents] = useState<DofusRealtimeEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const socket = getSocket({ guildId });
    socketRef.current = socket;

    const onConnect = () => {
      setConnectionStatus("connected");
      // Re-join à chaque (re)connexion : les rooms ne survivent pas à une déconnexion.
      socket.emit("dofus:join", { guildId, dofusSlug });
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", () => setConnectionStatus("offline"));
    socket.on("connect_error", () => setConnectionStatus("offline"));

    const onPresence = (data: { guildId: string; dofusSlug: string; members?: DofusPresenceMember[] }) => {
      setPresence(data.members ?? []);
    };
    const onEventBatch = (batch: DofusRealtimeEvent[]) => {
      if (!Array.isArray(batch) || batch.length === 0) return;
      setEvents(prev => [...prev, ...batch].slice(-EVENTS_KEEP));
      batch.forEach((e) => onEventRef.current?.(e));
    };
    socket.on("dofus:presence:update", onPresence);
    socket.on("dofus:event", onEventBatch);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("dofus:presence:update", onPresence);
      socket.off("dofus:event", onEventBatch);
      socket.emit("dofus:leave", { guildId, dofusSlug });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [guildId, dofusSlug]);

  // Heartbeat de présence : 20s, page visible, connecté.
  useEffect(() => {
    if (!questId || !enabled) return;
    if (connectionStatus !== "connected") return;
    const emit = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      socketRef.current?.emit("dofus:heartbeat", {
        guildId,
        dofusSlug,
        questId,
        userName,
        userAvatar,
      });
    };
    emit();
    const id = window.setInterval(emit, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [questId, enabled, connectionStatus, guildId, dofusSlug, userName, userAvatar]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { connectionStatus, presence, events, clearEvents };
}
