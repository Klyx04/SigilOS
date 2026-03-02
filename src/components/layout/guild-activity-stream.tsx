"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { LogIn, UserPlus, Archive, Ban, UserCheck, X } from "lucide-react";
import type { ActivityType } from "@/server/actions/activity-actions";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface ActivityEvent {
    id: string;
    type: ActivityType;
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
const TYPE_CONFIG: Record<ActivityType, {
    icon: React.ElementType;
    label: string;
    accent: string;
    bg: string;
    border: string;
    barColor: string;
}> = {
    LOGIN: { icon: LogIn, label: "vient de se connecter", accent: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/25", barColor: "#22d3ee" },
    NEW_MEMBER: { icon: UserPlus, label: "a rejoint la plateforme 🎉", accent: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25", barColor: "#a78bfa" },
    ARCHIVED: { icon: Archive, label: "a été archivé", accent: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", barColor: "#fbbf24" },
    BANNED: { icon: Ban, label: "a été banni", accent: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/25", barColor: "#fb7185" },
    UNARCHIVED: { icon: UserCheck, label: "a été réactivé", accent: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", barColor: "#34d399" },
};

// Dedup LOGIN events client-side — same person within 2 minutes
const DEDUPE_MS = 2 * 60 * 1000;
const DEDUPED_TYPES: ActivityType[] = ["LOGIN"];

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
                bg-zinc-900/95 border ${cfg.border} rounded-2xl px-3.5 py-3
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
                <p className="text-xs font-black text-white leading-tight truncate">{popup.actorName}</p>
                <p className={`text-[10px] font-semibold ${cfg.accent} leading-tight mt-0.5`}>{cfg.label}</p>
                {popup.meta?.reason && (
                    <p className="text-[9px] text-zinc-600 mt-0.5 truncate">"{popup.meta.reason}"</p>
                )}
            </div>

            {/* Close */}
            <button
                onClick={() => onDismiss(popup.id)}
                className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors"
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
        // Dedup LOGIN by actorName within window
        if (DEDUPED_TYPES.includes(evt.type)) {
            const lastSeen = recentRef.current.get(evt.actorName) ?? 0;
            if (Date.now() - lastSeen < DEDUPE_MS) return;
        }
        recentRef.current.set(evt.actorName, Date.now());

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

    // Render nothing if no popups
    if (popups.length === 0) return null;

    return (
        <div
            className="fixed bottom-6 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
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
