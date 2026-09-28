"use client";

/**
 * Encart « Localisation » — la zone d'une cible (avis de recherche, boss,
 * donjon) encadrée sur les tuiles statiques, SANS Leaflet :
 * - tracé officiel de la sous-zone, le MÊME que le bouton « Zones » de la carte,
 * - icône de la cible qui clignote au centre de la zone,
 * - un seul lien : l'image et le libellé ouvrent la carte du monde recentrée
 *   sur la zone, dans le bon monde.
 *
 * Les données viennent de la worldmap déjà chargée par l'appelant (carte du
 * monde, modal de zone) ou de `/api/worldmap/location` (fiches publiques et
 * éditeurs admin). Aucun tracé exploitable → l'encart se masque seul.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MAP_OCEAN_TONE } from "@/lib/worldmap-tiles";
import { resolveZoneMinimap, type ZoneMinimap } from "@/lib/zone-minimap";
import type { MinimapWorld } from "@/lib/dungeon-minimap";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

export interface ZoneLocationInput {
    id: number;
    name?: string;
    shape?: number[] | null;
}

interface ZoneLocationCardProps {
    /** Sous-zones de la cible (avis de recherche). */
    subareaIds?: number[];
    /** Map précise de la cible (donjon) : sa sous-zone est résolue côté serveur. */
    mapId?: number | null;
    /** Monde cible (défaut : 1, le monde des avis de recherche). */
    worldId?: number;
    /** Zones et monde déjà chargés (carte du monde, modal de zone) : aucun fetch. */
    subareas?: ZoneLocationInput[] | null;
    world?: MinimapWorld | null;
    /** Lien profond prioritaire (entrée exacte du donjon). */
    mapHref?: string | null;
    title: string;
    /** Libellé affiché sous l'encart (nom de la zone ou de la cible). */
    placeName?: string;
    openLabel: string;
    /** Icône de la cible, affichée en clignotant au centre de la zone. */
    markerIcon?: string | null;
    /** Contenu de repli quand aucune zone n'est exploitable (ex. carte de l'entrée seule). */
    fallback?: ReactNode;
    className?: string;
}

type State =
    | { status: "loading" }
    | { status: "ready"; world: MinimapWorld; zones: ZoneLocationInput[] }
    | { status: "hidden" };

/** Toute valeur > 1000 sépare deux tracés : concaténer suffit à faire l'union. */
const SHAPE_SEPARATOR = 2000;

function hasShape(zone: ZoneLocationInput): boolean {
    return Array.isArray(zone.shape) && (zone.shape as number[]).length >= 6;
}

function mergeShapes(zones: ZoneLocationInput[]): number[] {
    const merged: number[] = [];
    for (const zone of zones) {
        if (!hasShape(zone)) continue;
        if (merged.length > 0) merged.push(SHAPE_SEPARATOR, SHAPE_SEPARATOR);
        merged.push(...(zone.shape as number[]));
    }
    return merged;
}

export function ZoneLocationCard({
    subareaIds,
    mapId,
    worldId = 1,
    subareas,
    world: worldProp,
    mapHref,
    title,
    placeName,
    openLabel,
    markerIcon,
    fallback,
    className,
}: ZoneLocationCardProps) {
    const [state, setState] = useState<State>({ status: "loading" });
    const [failedTiles, setFailedTiles] = useState<ReadonlySet<number>>(new Set());
    const provided = subareas ?? [];
    const zoneIdsKey = (subareaIds ?? []).join(",");
    const providedKey = provided.map((zone) => zone.id).join(",");

    useEffect(() => {
        let cancelled = false;
        setFailedTiles(new Set());
        const loaded = subareas ?? [];

        if (worldProp && loaded.length > 0 && loaded.every(hasShape)) {
            setState({ status: "ready", world: worldProp, zones: loaded });
            return;
        }

        const ids = new Set<number>([...(subareaIds ?? []), ...loaded.map((zone) => zone.id)]);
        const wantsMap = Number.isInteger(mapId) && (mapId as number) > 0;
        if (ids.size === 0 && !wantsMap) {
            setState({ status: "hidden" });
            return;
        }

        const query = new URLSearchParams();
        if (ids.size > 0) query.set("zone", [...ids].join(","));
        if (wantsMap) query.set("map", String(mapId));
        query.set("world", String(worldId));

        (async () => {
            try {
                const res = await fetch(`/api/worldmap/location?${query.toString()}`, { cache: "force-cache" });
                if (!res.ok) {
                    if (!cancelled) setState({ status: "hidden" });
                    return;
                }
                const payload = await res.json();
                if (cancelled) return;
                const data = payload?.success ? payload.data : null;
                const zones: ZoneLocationInput[] = (data?.zones ?? []).filter((zone: ZoneLocationInput) => hasShape(zone));
                if (!data?.world || zones.length === 0) {
                    setState({ status: "hidden" });
                    return;
                }
                setState({ status: "ready", world: data.world, zones });
            } catch {
                if (!cancelled) setState({ status: "hidden" });
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoneIdsKey, providedKey, mapId, worldId, worldProp]);

    const minimap: ZoneMinimap | null = useMemo(() => {
        if (state.status !== "ready") return null;
        return resolveZoneMinimap(state.world, mergeShapes(state.zones));
    }, [state]);

    if (state.status === "hidden" || (state.status === "ready" && !minimap)) {
        return fallback ? <>{fallback}</> : null;
    }

    const grid = minimap;
    const centerIndex = grid ? Math.floor(grid.tiles.length / 2) : 0;
    const markTileFailed = (index: number) =>
        setFailedTiles((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));

    return (
        <div className={cn("group overflow-hidden rounded-xl border border-border bg-surface/60", className)}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
                <MapPin size={14} className="text-amber-500" />
                {title}
            </div>
            {grid ? (
                <a href={mapHref || grid.mapHref} className="block" title={openLabel}>
                    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${grid.cols} / ${grid.rows}` }}>
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
                        {/* Tracé officiel de la zone — même rendu que le bouton « Zones ». */}
                        <svg
                            className="pointer-events-none absolute inset-0 h-full w-full"
                            viewBox={`0 0 ${grid.widthPx} ${grid.heightPx}`}
                            preserveAspectRatio="none"
                            aria-hidden="true"
                        >
                            {grid.polygons.map((points, index) => (
                                <polygon
                                    key={index}
                                    points={points}
                                    fill="rgba(251, 146, 60, 0.30)"
                                    stroke="rgba(251, 146, 60, 0.95)"
                                    strokeWidth={2}
                                    strokeLinejoin="round"
                                />
                            ))}
                        </svg>
                        {/* Icône de la cible, clignotante, au milieu de la zone. */}
                        <div
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${grid.focusLeftPct}%`, top: `${grid.focusTopPct}%` }}
                        >
                            <span className="relative flex h-10 w-10 items-center justify-center">
                                <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/40" />
                                {markerIcon ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={markerIcon}
                                        alt=""
                                        draggable={false}
                                        className="relative h-9 w-9 animate-pulse object-contain drop-shadow-[0_0_8px_rgba(251,146,60,0.9)]"
                                    />
                                ) : (
                                    <span className="relative h-5 w-5 animate-pulse rounded-full border-2 border-amber-400 bg-amber-500/60" />
                                )}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-sm">
                        <span className="truncate font-medium text-foreground/90">{placeName || title}</span>
                        <span className="shrink-0 font-semibold text-amber-500 transition-colors group-hover:text-amber-400">
                            {openLabel} →
                        </span>
                    </div>
                </a>
            ) : (
                <div className="aspect-[5/3] w-full animate-pulse" style={{ backgroundColor: MAP_OCEAN_TONE }} />
            )}
        </div>
    );
}
