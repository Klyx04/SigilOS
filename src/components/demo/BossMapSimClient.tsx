"use client";

import { useEffect, useState } from "react";
import { getMonsterStats } from "@/server/actions/game-data-actions";
import { SpellRangeGrid, type SpellData } from "@/components/succes/SpellRangeGrid";
import type { DofensiveDungeonInfo } from "@/server/actions/dofensive-actions";

interface MonsterStatsLite {
    id?: number;
    name?: string;
    imageUrl?: string;
    spells?: SpellData[];
}

/**
 * Démo — enveloppe client pour la page /demo/boss-sim.
 * Charge les sorts du boss via DofusDB (getMonsterStats) et affiche le simulateur
 * avec le sélecteur de map (salles réelles du donjon, source Dofensive).
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
        getMonsterStats(bossName, dungeon.dungeonName)
            .then((res) => {
                if (cancelled) return;
                if (res.success && res.data) setStats(res.data as MonsterStatsLite);
                else setError(res.error ?? "Impossible de charger les sorts du boss (DofusDB)");
            })
            .catch(() => {
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
