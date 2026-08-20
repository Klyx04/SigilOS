"use client";

import { useEffect, useState } from "react";
import { getMonsterStats } from "@/server/actions/game-data-actions";
import { SpellRangeGrid, type SpellData } from "@/components/succes/SpellRangeGrid";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import {
    getDofensiveSpells,
    type DofensiveDungeonInfo,
} from "@/server/actions/dofensive-actions";

interface MonsterStatsLite {
    id?: number;
    name?: string;
    imageUrl?: string;
    spells?: SpellData[];
}

/**
 * Démo — enveloppe client pour la page /demo/boss-sim.
 * Charge les sorts via DofusDB (images/descriptions) PUIS fusionne les données de
 * combat Dofensive (AP/portée/LoS/cooldown/zone) pour des prévisus justes sur la map.
 */
export function BossMapSimClient({ dungeon }: { dungeon: DofensiveDungeonInfo }) {
    const [stats, setStats] = useState<MonsterStatsLite | null>(null);
    const [error, setError] = useState<string | null>(null);

    const bossName =
        dungeon.monsters.find((m) => m.id === dungeon.bossMonsterId)?.name ??
        dungeon.monsters[0]?.name ??
        dungeon.dungeonName;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await getMonsterStats(bossName, dungeon.dungeonName);
            if (cancelled) return;
            if (!res.success || !res.data) {
                if (!cancelled) setError(res.error ?? "Impossible de charger les sorts du boss (DofusDB)");
                return;
            }
            const base = res.data as MonsterStatsLite;
            let spells = base.spells ?? [];
            if (dungeon.bossMonsterId) {
                const dRes = await getDofensiveSpells(dungeon.bossMonsterId);
                if (!cancelled && dRes.success && dRes.data) {
                    spells = mergeDofensiveSpells(spells, dRes.data);
                }
            }
            if (cancelled) return;
            setStats({ ...base, spells });
        })().catch(() => {
            if (!cancelled) setError("Erreur réseau lors du chargement des sorts");
        });
        return () => {
            cancelled = true;
        };
    }, [bossName, dungeon.dungeonName]);

    if (error && !stats) {
        return (
            <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {!stats ? (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center text-muted-foreground">
                    Chargement des sorts du boss…
                </div>
            ) : (
                <SpellRangeGrid
                    spells={stats.spells ?? []}
                    bossName={bossName}
                    bossImageUrl={stats.imageUrl}
                    dungeonMaps={dungeon.maps}
                    dungeonName={dungeon.dungeonName}
                />
            )}
        </div>
    );
}
