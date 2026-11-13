"use client";

/**
 * Grille de tuiles d'un encart « où est X » + **repère** — présentation PURE : aucun fetch,
 * aucune règle. La grille vient de `resolveMinimap*` (`@/lib/dungeon-minimap`) et le repère est
 * posé en pourcentage, exactement comme sur la carte interactive (mêmes tuiles, même cadrage).
 *
 * Partagée par l'encart de la fiche donjon (`DungeonMinimapCard`) et par la « capture de zone »
 * d'une quête dans le détail d'un post DJ — un seul endroit décide comment ça se dessine.
 *
 * 🐛 Leçon du 11/10/2026 (encart donjon) : la tuile CENTRALE qui échoue masque l'encart entier
 * (`onCenterFail`) au lieu d'afficher un trou au milieu de la zone ; une tuile de bord en échec
 * laisse simplement la teinte océan dessous.
 */
import { useState, type ReactNode } from "react";

import type { MinimapGrid as MinimapGridData } from "@/lib/dungeon-minimap";
import { MAP_OCEAN_TONE } from "@/lib/worldmap-tiles";
import { cn } from "@/lib/utils";

export function MinimapGrid({
    grid,
    marker,
    markerSrc,
    markerAlt,
    className,
    onCenterFail,
}: {
    grid: MinimapGridData;
    /** Repère libre (ex. une pastille CSS pour une quête) — prioritaire sur l'icône. */
    marker?: ReactNode;
    /** Icône du repère (`/assets/worldmap/…`) — jamais une URL externe. */
    markerSrc?: string;
    markerAlt?: string;
    /** Classes du conteneur de tuiles (aspect/arrondi) ; le repère suit le même cadre. */
    className?: string;
    /** Appelé quand la tuile centrale échoue : l'appelant masque alors tout l'encart. */
    onCenterFail?: () => void;
}) {
    const [failedTiles, setFailedTiles] = useState<ReadonlySet<number>>(new Set());
    const centerIndex = Math.floor(grid.tiles.length / 2);

    return (
        <div
            className={cn("relative w-full overflow-hidden", className)}
            style={{ aspectRatio: `${grid.cols} / ${grid.rows}` }}
        >
            <div
                className="grid h-full w-full"
                style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}
            >
                {grid.tiles.map((tile, index) => (
                    <div
                        key={`${tile.col}-${tile.row}`}
                        className="relative h-full w-full overflow-hidden"
                        style={{ backgroundColor: MAP_OCEAN_TONE }}
                    >
                        {!failedTiles.has(index) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={tile.tileUrl}
                                alt=""
                                loading="lazy"
                                draggable={false}
                                onError={() => {
                                    if (index === centerIndex) {
                                        onCenterFail?.();
                                        return;
                                    }
                                    setFailedTiles((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
                                }}
                                className={cn("h-full w-full object-cover", index !== centerIndex && "opacity-95")}
                            />
                        )}
                    </div>
                ))}
            </div>
            {/* Même marqueur que sur la worldmap (ancre centrée, grossit au survol du parent). */}
            <div
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-125"
                style={{ left: `${grid.leftPct}%`, top: `${grid.topPct}%` }}
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-500/80 bg-surface/90">
                    {marker ?? (markerSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={markerSrc} alt={markerAlt ?? ""} draggable={false} className="h-6 w-6 object-contain" />
                    ) : null)}
                </div>
            </div>
        </div>
    );
}
