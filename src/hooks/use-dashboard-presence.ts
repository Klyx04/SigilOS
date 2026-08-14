"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-utils";

export type DashboardPresenceEvent = {
  type: "join" | "leave";
  profileId: string;
  userName?: string;
  userAvatar?: string;
};

const TOAST_DURATION_MS = 3500;

/**
 * Présence temps réel du Dashboard (chantier #39).
 *
 * - Rejoint la room `guild:<guildId>` via le socket partagé.
 * - Écoute `dashboard:presence:event` (broadcast serveur vers les AUTRES
 *   membres de la guilde — pas de notif « toi »).
 * - Affiche un toast quand un membre se connecte ou quitte le Dashboard.
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
      const name = e.userName || "Un membre";
      if (e.type === "join") {
        toast(`${name} est arrivé(e) sur le dashboard`, { duration: TOAST_DURATION_MS });
      } else {
        toast(`${name} a quitté le dashboard`, { duration: TOAST_DURATION_MS });
      }
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
