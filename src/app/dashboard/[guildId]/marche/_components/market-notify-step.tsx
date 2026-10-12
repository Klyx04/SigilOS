"use client";

/**
 * Module « Marché » — **étape 5 « Notification Discord »** (décision user 18/09/2026).
 *
 * Objectif : sortir le choix des rôles à mentionner de l'étape « Publication »
 * (où il était noyé) et en faire une **page dédiée**, lisible, avec un **aperçu
 * en direct** du nombre de membres qui seront réellement pingés :
 * - compteur **serveur** (`estimateMarketPingAudience`) : dédupliqué par membre,
 *   bots exclus, jamais de liste de membres affichée (§13.7) ;
 * - détail **par rôle** coché pour comprendre d'où vient le chiffre ;
 * - cas particuliers explicites : aucun rôle configuré (admin), aucun rôle coché
 *   (« personne ne sera notifié »), Discord injoignable (estimation masquée, la
 *   publication reste possible).
 */

import { useEffect, useState } from "react";
import { BellOff, BellRing, Hash, Loader2, MessageSquare, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { estimateMarketPingAudience } from "@/server/actions/market-actions";
import type { MarketPublishContext } from "./market-publish-step";

export interface MarketNotifyStepProps {
    guildId: string;
    context: MarketPublishContext | null;
    roles: { id: string; name: string }[];
    selectedPingIds: string[];
    onTogglePing: (roleId: string) => void;
    /** « Ne mentionner personne » : vide la sélection d'un coup. */
    onClearPing: () => void;
    /** Libellé de l'annonce (rappel avant le dernier clic). */
    listingLabel: string;
    /** 🧺 Lot multiple : nombre de messages Discord qui seront créés. */
    bundleMessageCount?: number;
    forumMode?: boolean;
    channelName?: string;
}

type Audience = {
    count: number;
    approximate: boolean;
    available: boolean;
    perRole: Record<string, number>;
};

export function MarketNotifyStep({
    guildId,
    context,
    roles,
    selectedPingIds,
    onTogglePing,
    onClearPing,
    listingLabel,
    bundleMessageCount = 0,
    forumMode = false,
    channelName = "",
}: MarketNotifyStepProps) {
    const pingableRoles = roles.filter((role) => (context?.allowedPingRoleIds ?? []).includes(role.id));
    const [audience, setAudience] = useState<Audience | null>(null);
    const [loading, setLoading] = useState(false);
    const pingKey = selectedPingIds.join(",");

    useEffect(() => {
        if (!guildId || selectedPingIds.length === 0) {
            setAudience(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        estimateMarketPingAudience(guildId, selectedPingIds)
            .then((result) => {
                if (cancelled) return;
                setAudience(
                    result.success && result.data
                        ? {
                              count: result.data.count,
                              approximate: result.data.approximate,
                              available: result.data.available,
                              perRole: result.data.perRole ?? {},
                          }
                        : null
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // `pingKey` résume la sélection (identité stable entre deux rendus).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guildId, pingKey]);

    return (
        <div className="space-y-5" data-tour="marche-notify">
            {/* En-tête d'étape : le vendeur doit comprendre CE QUE fait la notification */}
            <div className="rounded-2xl border border-border bg-surface/60 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <BellRing className="h-5 w-5 text-gold" />
                    Étape 5 — Qui veux-tu prévenir ?
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                    La notification mentionne un <strong>rôle Discord</strong> (jamais un pseudo) dans le message de
                    l&apos;annonce. Seuls les rôles autorisés par un administrateur peuvent être mentionnés — sinon, la
                    publication reste silencieuse.
                </p>
            </div>

            {/* Sélection des rôles */}
            <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Rôles à mentionner
                </p>

                {pingableRoles.length === 0 ? (
                    <p className="mt-3 flex items-start gap-2 text-[11px] text-warning">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Aucun rôle notifiable configuré — la publication ne notifiera personne. Un administrateur doit
                        les définir dans Réglages → Marché → « Rôles que le créateur peut mentionner ».
                    </p>
                ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onClearPing}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors",
                                selectedPingIds.length === 0
                                    ? "border-gold/40 bg-gold/10 text-gold"
                                    : "border-border text-muted-foreground hover:border-border-strong"
                            )}
                        >
                            <BellOff className="h-3.5 w-3.5" />
                            Ne mentionner personne
                        </button>
                        {pingableRoles.map((role) => {
                            const selected = selectedPingIds.includes(role.id);
                            const roleCount = audience?.perRole?.[role.id];
                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => onTogglePing(role.id)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors",
                                        selected
                                            ? "border-gold/40 bg-gold/10 text-gold"
                                            : "border-border text-muted-foreground hover:border-border-strong"
                                    )}
                                >
                                    @{role.name}
                                    {selected && typeof roleCount === "number" && (
                                        <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] font-black tabular-nums">
                                            {roleCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* APERÇU — le cœur de l'étape */}
            <div
                className={cn(
                    "rounded-2xl border px-5 py-4",
                    selectedPingIds.length === 0 ? "border-border bg-surface/40" : "border-gold/30 bg-gold/5"
                )}
            >
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Aperçu de la notification
                </p>

                {selectedPingIds.length === 0 ? (
                    <div className="mt-2 flex items-center gap-2">
                        <BellOff className="h-5 w-5 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">
                            Personne ne sera notifié
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                l&apos;annonce sera publiée sans mention.
                            </span>
                        </p>
                    </div>
                ) : loading ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Estimation de l&apos;audience…
                    </p>
                ) : audience && audience.available ? (
                    <div className="mt-2 space-y-2">
                        <p className="flex items-baseline gap-2">
                            <Users className="h-5 w-5 translate-y-0.5 text-gold" />
                            <span className="text-2xl font-black tabular-nums text-foreground">
                                {audience.count}
                                {audience.approximate ? "+" : ""}
                            </span>
                            <span className="text-sm font-semibold text-foreground">membre(s) seront notifiés</span>
                        </p>
                        <ul className="space-y-1 text-[11px] text-muted-foreground">
                            {selectedPingIds.map((roleId) => {
                                const role = roles.find((entry) => entry.id === roleId);
                                return (
                                    <li key={roleId} className="flex items-center gap-1.5">
                                        <span className="h-1 w-1 rounded-full bg-gold/60" />@{role?.name ?? roleId} :{" "}
                                        <strong className="text-foreground tabular-nums">
                                            {audience.perRole?.[roleId] ?? 0}
                                        </strong>{" "}
                                        membre(s)
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="text-[11px] text-muted-foreground">
                            Compteur dédupliqué (un membre portant plusieurs rôles cochés n&apos;est compté
                            qu&apos;une fois) et hors bots. Aucun pseudo n&apos;est publié.
                            {audience.approximate ? " Estimation haute (serveur > 1000 membres)." : ""}
                        </p>
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                        Estimation indisponible (Discord injoignable) — la publication reste possible.
                    </p>
                )}
            </div>

            {/* Récap avant le dernier clic */}
            <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Ce qui sera publié dans un instant
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                    {forumMode ? (
                        <MessageSquare className="h-4 w-4 text-info" />
                    ) : (
                        <Hash className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold">
                        {context?.channelConfigured
                            ? `#${channelName || "salon configuré"}`
                            : "Salon Discord non configuré"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {forumMode ? "(forum : un post par annonce)" : "(salon texte)"} · {listingLabel}
                        {bundleMessageCount > 0 ? ` · ${bundleMessageCount} message(s), un par objet` : ""}
                    </span>
                </p>
            </div>
        </div>
    );
}
