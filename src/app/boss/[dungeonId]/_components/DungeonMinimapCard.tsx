"use client";

/**
 * Encart « où est le donjon » — UNE tuile statique (<img>, pas de Leaflet)
 * avec le repère d'entrée, cliquable vers la carte du monde publique.
 * Se masque seul si les coordonnées sont inconnues, hors grille ou si la
 * tuile ne charge pas (bonus d'affichage, jamais bloquant).
 */
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { MAP_OCEAN_TONE } from "@/lib/worldmap-tiles";
import { resolveMinimapTile, type MinimapTile, type MinimapWorld } from "@/lib/dungeon-minimap";

interface DungeonMinimapCardProps {
    x: number;
    y: number;
    worldMapId?: number | null;
    title: string;
    openLabel: string;
}

type State = { status: "loading" } | { status: "ready"; tile: MinimapTile } | { status: "hidden" };

export function DungeonMinimapCard({ x, y, worldMapId, title, openLabel }: DungeonMinimapCardProps) {
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
                const tile = resolveMinimapTile(world, x, y);
                if (!cancelled) setState(tile ? { status: "ready", tile } : { status: "hidden" });
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
                <div className="px-3 pt-2.5 text-xs font-semibold text-muted-foreground">{title}</div>
                <div className="m-3 mt-2 aspect-square animate-pulse rounded-lg" style={{ backgroundColor: MAP_OCEAN_TONE }} />
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
            <div className="px-3 pt-2.5 text-xs font-semibold text-foreground">{title}</div>
            <a
                href={state.tile.mapHref}
                className="group relative m-3 mt-2 block aspect-square overflow-hidden rounded-lg transition-shadow hover:shadow-lg hover:ring-1 hover:ring-border-strong"
                title={openLabel}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={state.tile.tileUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onError={() => setState({ status: "hidden" })}
                    className="h-full w-full object-cover"
                    style={{ backgroundColor: MAP_OCEAN_TONE }}
                />
                <MapPin
                    className="absolute h-6 w-6 -translate-x-1/2 -translate-y-full text-sky-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-110"
                    style={{ left: `${state.tile.leftPct}%`, top: `${state.tile.topPct}%` }}
                    fill="currentColor"
                />
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    {openLabel} ↗
                </span>
            </a>
        </div>
    );
}
