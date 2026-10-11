"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import InteractiveMap to avoid SSR issues with Leaflet interacting with `window`
const MapWithNoSSR = dynamic<any>(
    () => import('./interactive-map-v2'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-[#111] rounded-xl border border-border">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            </div>
        )
    }
);
export function MapViewer({ 
    initialLadder, 
    initialTab, 
    gameStatuses,
    initialX,
    initialY,
    initialZoom,
    initialWorldId,
    initialZoneIds,
    hideUI,
    userName,
    userAvatar,
    isAdmin,
    interactive,
    startFullscreen,
    isOverlay,
    isPublic
}: { 
    initialLadder?: any[], 
    initialTab?: 'map' | 'games', 
    gameStatuses?: any[],
    initialX?: number,
    initialY?: number,
    initialZoom?: number,
    initialWorldId?: number,
    /** Sous-zones à activer à l'arrivée (calque « Zones »). */
    initialZoneIds?: number[],
    hideUI?: boolean,
    userName?: string,
    userAvatar?: string,
    isAdmin?: boolean,
    interactive?: boolean,
    startFullscreen?: boolean,
    isOverlay?: boolean,
    /** Mode public : désactive toutes les interactions de guilde. */
    isPublic?: boolean
}) {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMapData() {
            try {
                const [resMap, resWorlds, resHidden] = await Promise.all([
                    // cache:'no-cache' → revalidation systématique via ETag/Last-Modified.
                    // Sans cela (et sans Cache-Control côté Caddy sur /game-data/*), le
                    // navigateur applique un cache heuristique et peut resservir un
                    // worldmap.json PÉRIMÉ (ex: mondes 37/40 absents du sélecteur alors
                    // que les données sont bien déployées sur le VPS).
                    fetch('/game-data/worldmap.json', { cache: 'no-cache' }),
                    fetch('/game-data/worlds.json', { cache: 'no-cache' }),
                    // Libellés de zone retirés à la main depuis God (God → Données de jeu →
                    // Zones). Volontairement tolérant : un fichier absent ou vide ne doit
                    // jamais empêcher la carte de s'afficher.
                    fetch('/game-data/hidden-map-zones.json', { cache: 'no-cache' })
                ]);

                if (!resMap.ok || !resWorlds.ok) throw new Error("Could not load map data");

                const mapData = await resMap.json();
                const worldsData = await resWorlds.json();
                const hiddenData = resHidden.ok ? await resHidden.json() : null;

                setData({
                    ...mapData,
                    worlds: worldsData,
                    hiddenZoneLabels: Array.isArray(hiddenData?.names) ? hiddenData.names : []
                });
            } catch (err: any) {
                setError(err.message || "Failed to load map data");
            } finally {
                setLoading(false);
            }
        }
        fetchMapData();
    }, []);

    if (error) {
        return (
            <div className="p-4 bg-danger/10 border border-danger/50 rounded-lg text-danger text-sm">
                Erreur de chargement de la carte : {error}
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="w-full h-[70vh] flex flex-col items-center justify-center bg-[#111] rounded-xl border border-border">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-4" />
                <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest italic opacity-50">Synchronisation du Monde...</p>
            </div>
        );
    }

    return (
        <MapWithNoSSR 
            worldMap={data} 
            initialLadder={initialLadder} 
            initialTab={initialTab} 
            gameStatuses={gameStatuses} 
            initialX={initialX}
            initialY={initialY}
            initialZoom={initialZoom}
            initialWorldId={initialWorldId}
            initialZoneIds={initialZoneIds}
            hideUI={hideUI}
            userName={userName}
            userAvatar={userAvatar}
            isAdmin={isAdmin}
            interactive={interactive}
            startFullscreen={startFullscreen}
            isOverlay={isOverlay}
            isPublic={isPublic}
        />
    );
}
