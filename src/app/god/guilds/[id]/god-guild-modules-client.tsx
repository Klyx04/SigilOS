"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Lock, LockOpen, Puzzle } from "lucide-react";
import { toast } from "sonner";
import { setModuleGodLock } from "@/server/actions/module-actions";
import { GUILD_MODULE_LABELS } from "@/lib/permissions";
import type { GuildModulesState, ModuleKey } from "@/lib/module-types";
import { GodCard, GodSectionHeader, GodBadge } from "../../ui";

const ORDER: ModuleKey[] = [
    "missions", "songes", "ocre", "ladder", "donjons", "quests", "worldmap",
    "resources", "services", "marche", "calendar", "polls", "minigames", "succes",
    "gallery", "roster", "profile", "presentation", "docs",
    "availability", "logs", "reactionRoles", "tickets", "commandes",
    "ladderSync", "manualLadderSync", "scheduledPolls",
];

/**
 * Vignettes **réelles** du jeu (mêmes assets que la navbar client, §8.1 du plan).
 * Un module sans asset vérifié garde l'icône `Puzzle` : on n'invente pas un chemin.
 */
const MODULE_ASSETS: Partial<Record<ModuleKey, string>> = {
    missions: "/assets/nav/quests.png",
    songes: "/assets/nav/infinite.png",
    ocre: "/assets/nav/archimonster.png",
    ladder: "/assets/nav/trophy.png",
    donjons: "/assets/nav/boss.png",
    quests: "/assets/nav/sylvestre-white.png",
    worldmap: "/assets/nav/map.png",
    resources: "/assets/nav/resources.png",
    services: "/assets/nav/exchange.png",
    marche: "/assets/dofus/modules/kamas.png",
    calendar: "/assets/nav/calendar.png",
    polls: "/assets/nav/chat.png",
    scheduledPolls: "/assets/nav/chat.png",
    minigames: "/assets/nav/dice.png",
    succes: "/assets/nav/success.png",
    gallery: "/assets/nav/panoplie.png",
    roster: "/assets/nav/genealogy.png",
    profile: "/assets/dofus/modules/character.png",
    presentation: "/assets/nav/guild.png",
    availability: "/assets/nav/hourglass.png",
    commandes: "/assets/nav/cog.png",
    ladderSync: "/assets/nav/trophy.png",
    manualLadderSync: "/assets/nav/trophy.png",
};

export function GodGuildModulesClient({
    discordGuildId,
    initialModules,
    initialLocks,
}: {
    discordGuildId: string;
    initialModules: GuildModulesState;
    initialLocks: string[];
}) {
    const [locks, setLocks] = useState<string[]>(initialLocks);
    const [pending, setPending] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const toggleLock = (key: ModuleKey, lock: boolean) => {
        setPending(key);
        startTransition(async () => {
            const res = await setModuleGodLock(discordGuildId, key, lock);
            if (res.success) {
                setLocks((prev) => (lock ? [...prev, key] : prev.filter((k) => k !== key)));
                toast.success(lock ? `Module ${key} verrouillé (OFF effectif)` : `Module ${key} déverrouillé`);
            } else {
                toast.error(res.error || "Échec du verrou");
            }
            setPending(null);
        });
    };

    return (
        <GodCard>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
                <GodSectionHeader
                    title="Modules de la guilde"
                    description="Verrouiller éteint le module pour la guilde, quel que soit son réglage. Le choix de la guilde est conservé et revient au déverrouillage."
                />
                <GodBadge variant={locks.length > 0 ? "warning" : "success"}>
                    {locks.length > 0 ? `${locks.length} verrou${locks.length > 1 ? "s" : ""}` : "Aucun verrou"}
                </GodBadge>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {ORDER.map((key) => {
                    const locked = locks.includes(key);
                    const effective = locked ? false : !!initialModules[key];
                    const busy = isPending && pending === key;
                    const label = GUILD_MODULE_LABELS[key] ?? "Module";
                    const asset = MODULE_ASSETS[key];
                    const stateLabel = locked
                        ? "Verrouillé — OFF effectif"
                        : effective
                            ? "Actif"
                            : "Inactif côté guilde";

                    return (
                        <div
                            key={key}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/10 p-3"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                {asset ? (
                                    <Image src={asset} alt="" width={20} height={20} className="h-5 w-5 shrink-0" />
                                ) : (
                                    <Puzzle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">{label}</p>
                                    <p className="text-xs text-muted-foreground">{stateLabel}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => toggleLock(key, !locked)}
                                aria-label={locked ? `Déverrouiller ${label}` : `Verrouiller ${label}`}
                                title={locked ? "Déverrouiller" : "Verrouiller (OFF effectif)"}
                                className={
                                    locked
                                        ? "shrink-0 rounded-lg border border-info/30 bg-info/15 p-2 text-info hover:bg-info/25 disabled:opacity-50"
                                        : "shrink-0 rounded-lg border border-border bg-elevated p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                                }
                            >
                                {locked ? <LockOpen className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </GodCard>
    );
}
