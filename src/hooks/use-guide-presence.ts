"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-utils";
import type { GuideRealtimeEvent } from "@/lib/guide-realtime";

export type GuidePresenceMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  milestoneId: string;
  /** Emplacement du personnage (`PRINCIPAL` ou pseudo de mule). */
  characterSlot?: string;
  /** Surfaces actives du personnage (dashboard et/ou overlay). */
  surfaces?: string[];
  /** Classe Dofus du personnage (icône à côté du pseudo). */
  dofusClass?: string | null;
  /** Alignement du personnage — lu côté SERVEUR au join, jamais envoyé par le client. */
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number | null;
};

export type GuidePresenceSurface = "dashboard" | "overlay" | "public";

export type GuideConnectionStatus = "connected" | "degraded" | "offline";

export type UseGuidePresenceOptions = {
  guildId: string;
  guideSlug: string;
  /** Jalon courant → heartbeat de présence. null → pas d'émission. */
  milestoneId: string | null;
  /** Identité cosmétique (nom/avatar) du membre courant pour le heartbeat. */
  userName?: string;
  userAvatar?: string;
  /** Emplacement du personnage (`PRINCIPAL` ou pseudo de mule) — clé de présence. */
  characterSlot?: string;
  /** Surface qui émet : dashboard (défaut) ou overlay (PiP). */
  surface?: GuidePresenceSurface;
  /** Classe Dofus du personnage, affichée à côté du pseudo. */
  dofusClass?: string | null;
  /** false = récepteur seul (invité / aperçu) : n'émet pas de heartbeat. */
  enabled?: boolean;
};

const HEARTBEAT_INTERVAL_MS = 20_000;
const EVENTS_KEEP = 30;

/**
 * Présence temps réel d'un guide (Phase F).
 *
 * Connexion Socket.IO (pattern src/lib/socket-utils.ts, cookie session via
 * withCredentials), join room `guild:<guildId>:guide:<slug>`, heartbeat toutes
 * les 20s tant que la page est **montée** et le WebSocket connecté. On ne filtre
 * plus sur `document.visibilityState` : un onglet réduit ou la fenêtre PiP reste
 * « sur le Rush » (présence réelle, retour user du 26/11/2026).
 *
 * Sorties :
 *   - connectionStatus : "connected" | "degraded" (connexion en cours) | "offline" ;
 *   - presence : membres actuellement présents sur le guide (par jalon) ;
 *   - events : events GuideRealtimeEvent reçus (batch serveur), bornés.
 *
 * Fail-soft : si le WS est down, connectionStatus !== "connected" → l'appelant
 * retombe sur ses props serveur (jamais d'écran vide).
 */
export function useGuidePresence(options: UseGuidePresenceOptions) {
  const {
    guildId,
    guideSlug,
    milestoneId,
    userName,
    userAvatar,
    characterSlot,
    surface = "dashboard",
    dofusClass,
    enabled = true,
  } = options;
  const [connectionStatus, setConnectionStatus] = useState<GuideConnectionStatus>("degraded");
  const [presence, setPresence] = useState<GuidePresenceMember[]>([]);
  const [events, setEvents] = useState<GuideRealtimeEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);
  /** Jalon courant au moment du join, sans ré-abonner à chaque changement de bloc. */
  const milestoneIdRef = useRef(milestoneId);
  useEffect(() => {
    milestoneIdRef.current = milestoneId;
  }, [milestoneId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const socket = getSocket({ guildId });
    socketRef.current = socket;

    const onConnect = () => {
      setConnectionStatus("connected");
      // Re-join à chaque (re)connexion : les rooms ne survivent pas à une déconnexion.
      socket.emit("guide:join", {
        guildId,
        guideSlug,
        characterSlot,
        surface,
        milestoneId: milestoneIdRef.current,
      });
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", () => setConnectionStatus("offline"));
    socket.on("connect_error", () => setConnectionStatus("offline"));

    const onPresence = (data: { guildId: string; guideSlug: string; members?: GuidePresenceMember[] }) => {
      setPresence(data.members ?? []);
    };
    const onEvent = (batch: GuideRealtimeEvent[]) => {
      if (!Array.isArray(batch) || batch.length === 0) return;
      setEvents(prev => [...prev, ...batch].slice(-EVENTS_KEEP));
    };
    socket.on("guide:presence:update", onPresence);
    socket.on("guide:event", onEvent);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("guide:presence:update", onPresence);
      socket.off("guide:event", onEvent);
      socket.emit("guide:leave", { guildId, guideSlug, characterSlot, surface });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [guildId, guideSlug, characterSlot, surface]);

  // Heartbeat de présence : 20s, tant que la page est montée et le WS connecté.
  useEffect(() => {
    if (!milestoneId || !enabled) return;
    if (connectionStatus !== "connected") return;
    const emit = () => {
      socketRef.current?.emit("guide:heartbeat", {
        guildId,
        guideSlug,
        milestoneId,
        userName,
        userAvatar,
        characterSlot,
        surface,
        dofusClass,
      });
    };
    emit();
    const id = window.setInterval(emit, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [milestoneId, enabled, connectionStatus, guildId, guideSlug, userName, userAvatar, characterSlot, surface, dofusClass]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { connectionStatus, presence, events, clearEvents };
}
