"use client";

/**
 * Encart « Localisation du donjon » — grille 5×3 de tuiles statiques (<img>,
 * pas de Leaflet) CENTRÉE sur l'entrée, avec le marqueur donjon de la
 * worldmap. En-tête titré, puis UN SEUL lien : l’image, le nom du donjon et
 * « Voir la carte → » ouvrent tous la carte publique. Se masque seul si les
 * coordonnées sont inconnues, hors grille ou si la tuile centrale échoue.
 */
import { useEffect, useState } from "react";
import { MAP_OCEAN_TONE } from "@/lib/worldmap-tiles";
import { resolveMinimapLandscape, type MinimapGrid, type MinimapWorld } from "@/lib/dungeon-minimap";
import { cn } from "@/lib/utils";

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
    const [failedTiles, setFailedTiles] = useState<ReadonlySet<number>>(new Set());

    useEffect(() => {
        let cancelled = false;
        setFailedTiles(new Set());
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

    const centerIndex = Math.floor(state.grid.tiles.length / 2);
    const markTileFailed = (index: number) =>
        setFailedTiles((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));

    return (
        <div className="group overflow-hidden rounded-xl border border-border bg-surface/60">
            <div className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">{title}</div>
            <a
                href={state.grid.mapHref}
                className="block"
                title={openLabel}
            >
                <div className="relative aspect-[5/3] w-full overflow-hidden">
                    <div
                        className="grid h-full w-full"
                        style={{ gridTemplateColumns: `repeat(${state.grid.cols}, minmax(0, 1fr))` }}
                    >
                        {state.grid.tiles.map((tile, index) => (
                            <div
                                key={`${tile.col}-${tile.row}`}
                                className="relative h-full w-full overflow-hidden"
                                style={{ backgroundColor: MAP_OCEAN_TONE }}
                            >
                                {tile.tileUrl && !failedTiles.has(index) && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={tile.tileUrl}
                                        alt=""
                                        loading="lazy"
                                        draggable={false}
                                        onError={() => {
                                            if (index === centerIndex) setState({ status: "hidden" });
                                            else markTileFailed(index);
                                        }}
                                        className={cn("h-full w-full object-cover", index !== centerIndex && "opacity-95")}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    {/* Même marqueur que sur la worldmap (icône donjon, ancre centrée). */}
                    <div
                        className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-125"
                        style={{ left: `${state.grid.leftPct}%`, top: `${state.grid.topPct}%` }}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-500/80 bg-surface/90">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/worldmap/dungeon-boss.png"
                                alt="Donjon"
                                draggable={false}
                                className="h-6 w-6 object-contain"
                            />
                        </div>
                    </div>
                </div>
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
