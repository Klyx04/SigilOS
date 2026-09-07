"use client";

import { useEffect, useState } from "react";
import { Hash, Loader2 } from "lucide-react";
import { getGuildChannelsAction } from "@/server/actions/discord-actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Salons textuels (0) + annonces (5) par défaut. Vocaux, catégories et threads exclus. */
export const DISCORD_TEXT_CHANNEL_TYPES = [0, 5];
/** + forums (15) pour les modules qui créent des fils (ex. galeries). */
export const DISCORD_FORUM_CHANNEL_TYPES = [0, 5, 15];

type ChannelOption = { id: string; name: string | null; type: number };

const LIST_TTL_MS = 5 * 60 * 1000;
const listCache = new Map<string, { channels: ChannelOption[]; expiresAt: number }>();
const listInFlight = new Map<string, Promise<ChannelOption[]>>();

function loadChannels(guildId: string): Promise<ChannelOption[]> {
    const cached = listCache.get(guildId);
    if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.channels);
    if (cached) listCache.delete(guildId);
    const inFlight = listInFlight.get(guildId);
    if (inFlight) return inFlight;
    const promise = (async () => {
        try {
            const res = await getGuildChannelsAction(guildId);
            const channels = res.success && Array.isArray(res.data) ? res.data : [];
            listCache.set(guildId, { channels, expiresAt: Date.now() + LIST_TTL_MS });
            return channels;
        } catch {
            return [];
        }
    })().finally(() => {
        listInFlight.delete(guildId);
    });
    listInFlight.set(guildId, promise);
    return promise;
}

/**
 * Sélecteur de salon Discord (remplace les saisies d'ID en texte libre).
 * - Liste les salons textuels/annonces de la guilde (cachée 5 min, rate-limit
 *   côté action) ; la valeur hors-liste reste sélectionnable (salon supprimé).
 * - Repli saisie manuelle si la liste est injoignable : on ne bloque jamais
 *   une config sur un appel Discord (les actions serveur valident le format).
 */
export function DiscordChannelPicker({
    guildId,
    value,
    onChange,
    placeholder = "Choisir un salon…",
    allowEmptyLabel = "Aucun (désactivé)",
    allowedTypes = DISCORD_TEXT_CHANNEL_TYPES,
    className = "",
}: {
    guildId: string;
    value: string;
    onChange: (channelId: string) => void;
    placeholder?: string;
    allowEmptyLabel?: string | null;
    /** Types Discord acceptés (défaut : textuels + annonces). */
    allowedTypes?: number[];
    className?: string;
}) {
    const [channels, setChannels] = useState<ChannelOption[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadChannels(guildId).then((list) => {
            if (!cancelled) setChannels(list);
        });
        return () => {
            cancelled = true;
        };
    }, [guildId]);

    const allowed = new Set(allowedTypes);
    const textChannels = (channels || []).filter((c) => allowed.has(c.type));
    const valueKnown = !value || textChannels.some((c) => c.id === value);

    // Liste injoignable ou vide : repli saisie manuelle (comportement historique).
    if (channels !== null && textChannels.length === 0 && !value) {
        return (
            <div className={cn("relative", className)}>
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Ex: 123456789012345678"
                    inputMode="numeric"
                    className="w-full h-11 bg-surface/60 border border-border rounded-xl pl-10 pr-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50"
                />
                <p className="text-caption text-muted-foreground mt-1.5">
                    Liste des salons injoignable — saisie manuelle de l&apos;ID.
                </p>
            </div>
        );
    }

    return (
        <div className={cn("relative", className)}>
            {channels === null ? (
                <div className="w-full h-11 rounded-xl border border-border bg-surface/60 flex items-center gap-2 pl-3 pr-4 text-sm text-muted-foreground">
                    <Hash className="w-4 h-4 shrink-0" />
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement des salons…
                </div>
            ) : (
                <Select value={valueKnown ? value || "__none__" : value} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-border bg-surface/60 pl-3 text-sm text-foreground hover:border-border-strong [&>svg]:text-muted-foreground">
                        <span className="flex items-center gap-2 truncate">
                            <Hash className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <SelectValue placeholder={placeholder} />
                        </span>
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px] bg-elevated border-border">
                        <SelectItem value="__none__" className="text-muted-foreground">
                            {allowEmptyLabel || placeholder}
                        </SelectItem>
                        {textChannels.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                <span className="inline-flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="font-medium">{c.name || "Salon masqué"}</span>
                                </span>
                            </SelectItem>
                        ))}
                        {!valueKnown && (
                            <SelectItem value={value}>
                                <span className="text-warning">ID {value} (introuvable)</span>
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
            )}
        </div>
    );
}
