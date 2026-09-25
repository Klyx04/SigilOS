"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen, Puzzle } from "lucide-react";
import { toast } from "sonner";
import { setModuleGodLock } from "@/server/actions/module-actions";
import type { GuildModulesState, ModuleKey } from "@/lib/module-types";
import { GodCard, GodSectionHeader, GodBadge } from "../../ui";

const ORDER: ModuleKey[] = [
    "missions", "songes", "ocre", "ladder", "donjons", "quests", "worldmap",
    "resources", "services", "marche", "calendar", "polls", "minigames", "succes",
    "gallery", "roster", "stats", "profile", "presentation", "docs",
    "availability", "logs", "reactionRoles", "tickets", "commandes",
    "ladderSync", "manualLadderSync",
];

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
        <GodCard className="p-1 shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-white/5 flex flex-wrap items-start justify-between gap-4">
                <GodSectionHeader
                    title="Modules — super-gestion"
                    description="Verrouiller = OFF effectif quel que soit le toggle de la guilde (conservé). La RBAC associée est masquée de la matrice (mappings conservés)."
                />
                <GodBadge variant={locks.length > 0 ? "warning" : "success"}>
                    {locks.length > 0 ? `${locks.length} verrou(s)` : "aucun verrou"}
                </GodBadge>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ORDER.map((key) => {
                    const locked = locks.includes(key);
                    const effective = locked ? false : !!initialModules[key];
                    const busy = isPending && pending === key;
                    return (
                        <div
                            key={key}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-black/20"
                        >
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{key}</p>
                                <p className="text-caption text-zinc-500">
                                    {locked ? "🔒 Verrouillé (OFF)" : effective ? "Actif" : "Inactif (guilde)"}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => toggleLock(key, !locked)}
                                className={
                                    locked
                                        ? "p-2 rounded-lg bg-info/15 text-info border border-info/30 hover:bg-info/25 shrink-0"
                                        : "p-2 rounded-lg bg-white/5 text-zinc-500 border border-white/10 hover:text-white hover:border-white/20 shrink-0"
                                }
                                title={locked ? "Déverrouiller" : "Verrouiller (OFF effectif)"}
                            >
                                {locked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </GodCard>
    );
}
