"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import InteractiveMap to avoid SSR issues with Leaflet interacting with `window`
const MapWithNoSSR = dynamic(
    () => import('./interactive-map'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-[#111] rounded-xl border border-white/10">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            </div>
        )
    }
);

export function MapViewer() {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMapData() {
            try {
                // Fetch the generated json from public folder
                const res = await fetch('/game-data/worldmap.json');
                if (!res.ok) throw new Error("Could not load map data");
                const jsonData = await res.json();
                setData(jsonData);
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
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                Erreur de chargement de la carte : {error}
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="w-full h-[70vh] flex flex-col items-center justify-center bg-[#111] rounded-xl border border-white/10">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-4" />
                <p className="text-zinc-400 text-sm">Chargement du Monde des Douze...</p>
            </div>
        );
    }

    return (
        <MapWithNoSSR data={data} />
    );
}
