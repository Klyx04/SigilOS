"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { LogIn, UserPlus, Archive, Ban, UserCheck, X, LogOut } from "lucide-react";
import type { ActivityType } from "@/server/actions/activity-actions";
import { subscribeDashboardPresence } from "@/lib/dashboard-presence-bus";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
// "LEAVE" n'existe pas côté SSE (activity-actions) : il est ajouté par la
// présence temps réel WS (dashboard:presence:event, type "leave").
type LocalActivityType = ActivityType | "LEAVE";

interface ActivityEvent {
    id: string;
    type: LocalActivityType;
    actorName: string;
    actorImage: string | null;
    meta: Record<string, string> | null;
    createdAt: string;
}

interface PopupItem extends ActivityEvent {
    entering: boolean;
    leaving: boolean;
}

interface GuildActivityStreamProps {
    guildId: string;
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const TYPE_CONFIG: Record<LocalActivityType, {
    icon: React.ElementType;
    label: string;
    accent: string;
    bg: string;
    border: string;
    barColor: string;
}> = {
    LOGIN: { icon: LogIn, label: "vient de se connecter", accent: "text-info", bg: "bg-info/10", border: "border-info/25", barColor: "#22d3ee" },
    LEAVE: { icon: LogOut, label: "a quitté le dashboard", accent: "text-danger", bg: "bg-danger/10", border: "border-danger/25", barColor: "#fb7185" },
    NEW_MEMBER: { icon: UserPlus, label: "a rejoint la plateforme 🎉", accent: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25", barColor: "#a78bfa" },
    ARCHIVED: { icon: Archive, label: "a été archivé", accent: "text-warning", bg: "bg-warning/10", border: "border-warning/25", barColor: "#fbbf24" },
    BANNED: { icon: Ban, label: "a été banni", accent: "text-danger", bg: "bg-danger/10", border: "border-danger/25", barColor: "#fb7185" },
    UNARCHIVED: { icon: UserCheck, label: "a été réactivé", accent: "text-success", bg: "bg-success/10", border: "border-success/25", barColor: "#34d399" },
};

// Dedup côté client — LOGIN/LEAVE (même personne) dans une fenêtre courte.
const DEDUPE_MS = 2 * 60 * 1000;    // LOGIN (reconnexion socket)
const DEDUPE_LEAVE_MS = 10 * 1000;  // LEAVE (connect/disconnect rapide)
const DEDUPED_TYPES: LocalActivityType[] = ["LOGIN", "LEAVE"];

// ─────────────────────────────────────────────
// KEYFRAMES (inserted once)
// ─────────────────────────────────────────────
const KEYFRAMES = `
@keyframes slideIn {
    from { opacity: 0; transform: translateX(100%) scale(0.92); }
    to   { opacity: 1; transform: translateX(0)   scale(1); }
}
@keyframes slideOut {
    from { opacity: 1; transform: translateX(0)   scale(1); }
    to   { opacity: 0; transform: translateX(110%) scale(0.92); }
}
@keyframes progressBar {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
}
`;

// ─────────────────────────────────────────────
// POPUP CARD
// ─────────────────────────────────────────────
function PopupCard({ popup, onDismiss }: { popup: PopupItem; onDismiss: (id: string) => void }) {
    const cfg = TYPE_CONFIG[popup.type];
    const Icon = cfg.icon;

    useEffect(() => {
        const t = setTimeout(() => onDismiss(popup.id), 4500);
        return () => clearTimeout(t);
    }, [popup.id, onDismiss]);

    return (
        <div
            style={{
                animation: popup.leaving
                    ? "slideOut 0.45s cubic-bezier(0.4,0,1,1) forwards"
                    : "slideIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
            }}
            className={`relative flex items-center gap-3 w-72
                bg-surface/95 border ${cfg.border} rounded-2xl px-3.5 py-3
                shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden`}
        >
            {/* Left color bar */}
            <div className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl" style={{ backgroundColor: cfg.barColor }} />

            {/* Icon badge */}
            <div className={`w-7 h-7 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.accent}`} />
            </div>

            {/* Avatar */}
            {popup.actorImage ? (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-white/10">
                    <Image src={popup.actorImage} alt={popup.actorName} width={32} height={32} className="object-cover" unoptimized />
                </div>
            ) : (
                <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-sm font-black ${cfg.accent}`}>{popup.actorName.slice(0, 2).toUpperCase()}</span>
                </div>
            )}

            {/* Text */}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-foreground leading-tight truncate">{popup.actorName}</p>
                <p className={`text-caption font-semibold ${cfg.accent} leading-tight mt-0.5`}>{cfg.label}</p>
                {popup.meta?.reason && (
                    <p className="text-caption text-muted-foreground mt-0.5 truncate">"{popup.meta.reason}"</p>
                )}
            </div>

            {/* Close */}
            <button
                onClick={() => onDismiss(popup.id)}
                className="shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors"
                aria-label="Fermer"
            >
                <X className="w-3.5 h-3.5" />
            </button>

            {/* Progress bar */}
            <div
                className="absolute bottom-0 left-0 right-0 h-[2px] origin-left"
                style={{
                    backgroundColor: cfg.barColor,
                    opacity: 0.4,
                    animation: "progressBar 4.5s linear forwards",
                }}
            />
        </div>
    );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export function GuildActivityStream({ guildId }: GuildActivityStreamProps) {
    const [popups, setPopups] = useState<PopupItem[]>([]);
    const esRef = useRef<EventSource | null>(null);
    const recentRef = useRef<Map<string, number>>(new Map());

    // Inject CSS keyframes once — must be in useEffect (not render body)
    useEffect(() => {
        if (document.getElementById("gas-keyframes")) return;
        const style = document.createElement("style");
        style.id = "gas-keyframes";
        style.textContent = KEYFRAMES;
        document.head.appendChild(style);
    }, []);

    const dismiss = useCallback((id: string) => {
        // Trigger leave animation
        setPopups(prev => prev.map(p => p.id === id ? { ...p, leaving: true } : p));
        // Remove from DOM after animation
        setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 500);
    }, []);

    const addEvent = useCallback((evt: ActivityEvent) => {
        // Dedup par type + nom (LOGIN: reçoit la reconnexion socket, LEAVE: connect/disconnect rapide)
        if (DEDUPED_TYPES.includes(evt.type)) {
            const windowMs = evt.type === "LEAVE" ? DEDUPE_LEAVE_MS : DEDUPE_MS;
            const key = `${evt.type}:${evt.actorName}`;
            const lastSeen = recentRef.current.get(key) ?? 0;
            if (Date.now() - lastSeen < windowMs) return;
            recentRef.current.set(key, Date.now());
        }

        const popup: PopupItem = { ...evt, entering: true, leaving: false };

        setPopups(prev => {
            // Dismiss oldest if already at max 3
            const next = prev.length >= 3 ? prev.slice(-2) : prev;
            return [...next, popup];
        });
    }, []);

    useEffect(() => {
        // No ?silent needed — server-side dedup in emitGuildActivity handles duplicates
        const es = new EventSource(`/api/${guildId}/stream`);
        esRef.current = es;

        es.onmessage = (e) => {
            try {
                const evt: ActivityEvent = JSON.parse(e.data);
                addEvent(evt);
            } catch { /* ping keep-alive */ }
        };

        es.onerror = () => { es.close(); };

        return () => { es.close(); esRef.current = null; };
    }, [guildId, addEvent]);

    // Présence temps réel WS (dashboard:presence:event) → popups « X est arrivé / a quitté ».
    useEffect(() => {
        return subscribeDashboardPresence((e) => {
            addEvent({
                id: `presence-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                type: e.type === "leave" ? "LEAVE" : "LOGIN",
                actorName: e.userName || "Un membre",
                actorImage: e.userAvatar ?? null,
                meta: null,
                createdAt: new Date().toISOString(),
            });
        });
    }, [addEvent]);

    // Render nothing if no popups
    if (popups.length === 0) return null;

    return (
        <div
            className="fixed bottom-24 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
            aria-live="polite"
        >
            {popups.map(p => (
                <div key={p.id} className="pointer-events-auto">
                    <PopupCard popup={p} onDismiss={dismiss} />
                </div>
            ))}
        </div>
    );
}
