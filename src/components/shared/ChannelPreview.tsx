"use client";

import { useEffect, useState } from "react";
import { Hash, Loader2, AlertTriangle } from "lucide-react";
import { getDiscordChannelInfo, getGuildChannelsAction } from "@/server/actions/discord-actions";

const SNOWFLAKE_RE = /^\d{17,20}$/;
const DEBOUNCE_MS = 300;
const LIST_TTL_MS = 5 * 60 * 1000;
const NAME_TTL_MS = 5 * 60 * 1000;

type ChannelInfo = { id: string; name: string; type: number };

const guildChannelsCache = new Map<string, { channels: ChannelInfo[]; expiresAt: number }>();
const nameCache = new Map<string, { name: string; expiresAt: number }>();
const guildChannelsInFlight: Map<string, Promise<ChannelInfo[]>> = new Map();

function getCachedList(guildId: string): ChannelInfo[] | null {
    const entry = guildChannelsCache.get(guildId);
    if (entry && Date.now() < entry.expiresAt) return entry.channels;
    if (entry) guildChannelsCache.delete(guildId);
    return null;
}

async function loadGuildChannels(guildId: string): Promise<ChannelInfo[]> {
    const cached = getCachedList(guildId);
    if (cached) return cached;

    const inFlight = guildChannelsInFlight.get(guildId);
    if (inFlight) return inFlight;

    const promise = (async () => {
        const res = await getGuildChannelsAction(guildId);
        const channels = res.success && res.data ? res.data : [];
        guildChannelsCache.set(guildId, { channels, expiresAt: Date.now() + LIST_TTL_MS });
        return channels;
    })().finally(() => {
        guildChannelsInFlight.delete(guildId);
    });

    guildChannelsInFlight.set(guildId, promise);
    return promise;
}

function resolveTextColor(color: string): string {
    switch (color) {
        case "amber": return "text-warning/80";
        case "rose": return "text-danger/80";
        case "emerald": return "text-success/80";
        case "indigo": return "text-info/80";
        case "pink": return "text-pink-400/80";
        case "purple": return "text-info/80";
        default: return "text-info/80";
    }
}

/**
 * Preview d'un salon Discord depuis son channelId.
 * - vide ou ID incomplet -> rien (pas d'appel pendant la frappe)
 * - ID valide -> résolution via liste pré-chargée (cachée), fallback getDiscordChannelInfo
 * - Salon introuvable / hors guilde -> "Salon introuvable"
 */
export function ChannelPreview({
    guildId,
    channelId,
    color = "cyan",
    className = "",
}: {
    guildId: string;
    channelId: string;
    color?: string;
    className?: string;
}) {
    const [state, setState] = useState<{ status: "idle" | "loading" | "ok" | "error"; name?: string }>({ status: "idle" });

    useEffect(() => {
        const trimmed = channelId.trim();

        if (!trimmed || !SNOWFLAKE_RE.test(trimmed)) {
            setState({ status: "idle" });
            return;
        }

        let cancelled = false;

        (async () => {
            const channels = await loadGuildChannels(guildId);
            if (cancelled) return;

            const match = channels.find(c => c.id === trimmed);
            if (match) {
                setState({ status: "ok", name: match.name });
                return;
            }

            const cachedName = nameCache.get(trimmed);
            if (cachedName && Date.now() < cachedName.expiresAt) {
                setState({ status: "ok", name: cachedName.name });
                return;
            }

            setState({ status: "loading" });
            const timer = setTimeout(() => {
                getDiscordChannelInfo(guildId, trimmed).then(res => {
                    if (cancelled) return;
                    if (res.success && res.data) {
                        nameCache.set(trimmed, { name: res.data.name, expiresAt: Date.now() + NAME_TTL_MS });
                        setState({ status: "ok", name: res.data.name });
                    } else {
                        setState({ status: "error" });
                    }
                });
            }, DEBOUNCE_MS);

            const cleanup = () => {
                cancelled = true;
                clearTimeout(timer);
            };
            return cleanup;
        })();

        return () => { cancelled = true; };
    }, [guildId, channelId]);

    const textColor = resolveTextColor(color);

    if (state.status === "idle") return null;

    if (state.status === "loading") {
        return (
            <div className={`flex items-center gap-1.5 text-caption font-bold ${textColor} opacity-70 ${className}`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Résolution du salon…</span>
            </div>
        );
    }

    if (state.status === "error") {
        return (
            <div className={`flex items-center gap-1.5 text-caption font-bold text-danger/90 ${className}`}>
                <AlertTriangle className="w-3 h-3 text-danger/80" />
                <span>Salon introuvable</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1.5 text-caption font-bold ${textColor} ${className}`}>
            <Hash className="w-3 h-3" />
            <span>#{state.name}</span>
        </div>
    );
}