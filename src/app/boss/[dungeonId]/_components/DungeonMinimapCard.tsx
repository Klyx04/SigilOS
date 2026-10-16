"use client";

/**
 * Encart « Localisation du donjon » — grille 5×3 de tuiles statiques (<img>,
 * pas de Leaflet) CENTRÉE sur l'entrée, avec le marqueur donjon de la
 * worldmap. En-tête titré, puis UN SEUL lien : l’image, le nom du donjon et
 * « Voir la carte → » ouvrent tous la carte publique. Se masque seul si les
 * coordonnées sont inconnues, hors grille ou si la tuile centrale échoue.
 *
 * Le rendu (tuiles + repère) vit dans `MinimapGrid` — le même composant que la « capture de zone »
 * d'un post DJ : un seul endroit décide comment ça se dessine.
 */
import { useEffect, useState } from "react";
import { MAP_OCEAN_TONE } from "@/lib/worldmap-tiles";
import { resolveMinimapLandscape, type MinimapGrid, type MinimapWorld } from "@/lib/dungeon-minimap";
import { MinimapGrid as MinimapGridView } from "@/components/worldmap/minimap-grid";

interface DungeonMinimapCardProps {
    x: number;
    y: number;
    worldMapId?: number | null;
    title: string;
    placeName: string;
    openLabel: string;
}

type State = { status: "loading" } | { status: "ready"; grid: MinimapGrid } | { status: "hidden" };

export function DungeonMinimapCard({ x, y, worldMapId, title, placeName, openLabel }: DungeonMinimapCardProps) {
    const [state, setState] = useState<State>({ status: "loading" });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/game-data/worlds.json", { cache: "force-cache" });
                if (!res.ok) return;
                const worlds = (await res.json()) as Array<MinimapWorld & { _id?: string; name?: unknown }>;
                const worldId = worldMapId === -1 ? 1 : (worldMapId ?? 1);
                const world = worlds.find((w) => w.id === worldId);
                if (!world) return;
                const grid = resolveMinimapLandscape(world, x, y);
                if (!cancelled) setState(grid ? { status: "ready", grid } : { status: "hidden" });
            } catch {
                if (!cancelled) setState({ status: "hidden" });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [x, y, worldMapId]);

    if (state.status === "hidden") return null;
    if (state.status === "loading") {
        return (
            <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
                <div className="border-b border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground">{title}</div>
                <div className="aspect-[5/3] w-full animate-pulse" style={{ backgroundColor: MAP_OCEAN_TONE }} />
            </div>
        );
    }

    return (
        <div className="group overflow-hidden rounded-xl border border-border bg-surface/60">
            <div className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">{title}</div>
            <a
                href={state.grid.mapHref}
                className="block"
                title={openLabel}
            >
                <MinimapGridView
                    grid={state.grid}
                    markerSrc="/assets/worldmap/dungeon-boss.png"
                    markerAlt="Donjon"
                    onCenterFail={() => setState({ status: "hidden" })}
                />
                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-sm">
                    <span className="truncate font-medium text-foreground/90">{placeName}</span>
                    <span className="shrink-0 font-semibold text-amber-500 transition-colors group-hover:text-amber-400">
                        {openLabel} →
                    </span>
                </div>
            </a>
        </div>
    );
}
