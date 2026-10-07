"use client";

import { useState } from "react";
import { DungeonTactical } from "@/components/dungeons/dungeon-tactical";
import { servitudeTactical } from "@/lib/dungeons/fers-tyrannie";
import { solarTactical } from "@/lib/dungeons/tour-solar";
import { tactical as talkashaTactical } from "@/lib/dungeons/tal-kasha";
import { tactical as sentenceTactical } from "@/lib/dungeons/sentence-balance";
import { tactical as troneTactical } from "@/lib/dungeons/trone-sang";
import { gargaTactical } from "@/lib/dungeons/gargandyas";
import type { TacticalDungeon } from "@/lib/dungeons/tactical-dungeon";

const DUNGEONS: TacticalDungeon[] = [
    servitudeTactical,
    solarTactical,
    talkashaTactical,
    sentenceTactical,
    troneTactical,
    gargaTactical,
];
const TAB_KEY = "sigilos_dungeon_tab";

/**
 * Onglets des donjons simulés (1 remontage par donjon → états isolés,
 * stockages locaux séparés). Le donjon actif est mémorisé en local.
 */
export function DungeonTabs() {
    const [key, setKey] = useState<string>(() => {
        if (typeof window === "undefined") return DUNGEONS[0].key;
        return window.localStorage.getItem(TAB_KEY) ?? DUNGEONS[0].key;
    });
    const active = DUNGEONS.find((d) => d.key === key) ?? DUNGEONS[0];
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Donjons">
                {DUNGEONS.map((d) => (
                    <button
                        key={d.key}
                        role="tab"
                        aria-selected={d.key === active.key}
                        onClick={() => {
                            setKey(d.key);
                            try {
                                window.localStorage.setItem(TAB_KEY, d.key);
                            } catch {
                                // Stockage indisponible : onglet non persisté, rien de bloquant.
                            }
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                            d.key === active.key
                                ? "border-info bg-info/15 text-foreground"
                                : "border-border bg-surface text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {d.dungeonName}
                        <span className="ml-2 text-xs font-medium opacity-70">
                            {d.rooms.length} salles
                        </span>
                    </button>
                ))}
            </div>
            <DungeonTactical key={active.key} dungeon={active} />
        </div>
    );
}
