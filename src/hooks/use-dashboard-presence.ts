"use client";
import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-utils";
import { emitDashboardPresence } from "@/lib/dashboard-presence-bus";

export type DashboardPresenceEvent = {
  type: "join" | "leave";
  profileId: string;
  userName?: string;
  userAvatar?: string;
};

/**
 * Présence temps réel du Dashboard (chantier #39).
 *
 * - Rejoint la room `guild:<guildId>` via le socket partagé.
 * - Écoute `dashboard:presence:event` (broadcast serveur vers les AUTRES
 *   membres de la guilde — pas de notif « toi »).
 * - Publie chaque événement sur le bus `dashboard-presence-bus` → rendu par
 *   `GuildActivityStream` (popups discrets, même UI que les autres activités).
 *
 * Fail-soft : si le WS est down, aucune erreur — la présence Redis + polling
 * de la SmartBar reste le fallback (jamais d'écran cassé).
 */
export function useDashboardPresence({ guildId, enabled = true }: { guildId?: string; enabled?: boolean }) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!guildId || !enabled) return;
    if (typeof window === "undefined") return;

    const socket = getSocket({ guildId });
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit("dashboard:join", { guildId });
    };

    const onEvent = (e: DashboardPresenceEvent) => {
      if (!e || (e.type !== "join" && e.type !== "leave")) return;
      emitDashboardPresence(e);
    };

    socket.on("connect", onConnect);
    socket.on("dashboard:presence:event", onEvent);

    return () => {
      socket.off("connect", onConnect);
      socket.off("dashboard:presence:event", onEvent);
      socket.emit("dashboard:leave", { guildId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [guildId, enabled]);
}
