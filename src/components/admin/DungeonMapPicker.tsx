"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, Check } from "lucide-react";

type WMapDungeon = {
    id: number;
    mapId?: number;
    entranceMapId?: number;
    name: any;
};

/**
 * Sélecteur de donjon de la carte du monde (worldmap.json).
 * Permet de lier un donjon admin (Game Data) à sa position sur la carte
 * (remplit `mapId`) en cliquant simplement sur le bon donjon dans une grille.
 * Plus fiable qu'un numéro tapé à la main ou un croisement par nom exact.
 */
export function DungeonMapPicker({
    value,
    onSelect,
}: {
    value: number | null;
    onSelect: (mapId: number, dungeonName: string) => void;
}) {
    const [dungeons, setDungeons] = useState<WMapDungeon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/game-data/worldmap.json");
                if (!res.ok) throw new Error("worldmap.json introuvable");
                const data = await res.json();
                if (!cancelled) setDungeons(data.dungeons || []);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Erreur chargement");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const normalize = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    const filtered = dungeons.filter(d => {
        const name = typeof d.name === "string" ? d.name : (d.name?.fr || "");
        if (name.toLowerCase().includes("expédition")) return false;
        if (!search.trim()) return true;
        return normalize(name).includes(normalize(search));
    });

    const selectedName = value != null
        ? (() => {
            const d = dungeons.find(x => (x.mapId || x.entranceMapId) === value);
            if (!d) return null;
            return typeof d.name === "string" ? d.name : (d.name?.fr || "");
        })()
        : null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-warning" />
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Donjon sur la carte</span>
                {selectedName && (
                    <span className="px-2 py-0.5 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-black">
                        <Check className="inline w-3 h-3 mr-1" />
                        {selectedName} (#{value})
                    </span>
                )}
            </div>

            <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un donjon sur la carte..."
                className="w-full h-10 bg-background border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-warning/50 focus:ring-2 focus:ring-warning/10"
            />

            {loading ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement de la carte...
                </div>
            ) : error ? (
                <div className="py-2 text-danger text-xs">{error}</div>
            ) : filtered.length === 0 ? (
                <div className="py-4 text-muted-foreground text-xs italic text-center">Aucun donjon trouvé.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {filtered.map(d => {
                        const mapId = d.mapId || d.entranceMapId;
                        if (mapId == null) return null;
                        const name = typeof d.name === "string" ? d.name : (d.name?.fr || "Donjon");
                        const isSelected = value === mapId;
                        return (
                            <button
                                key={`${d.id}-${mapId}`}
                                type="button"
                                onClick={() => onSelect(mapId, name)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs font-bold transition-all ${
                                    isSelected
                                        ? "bg-warning/15 border-warning/40 text-warning"
                                        : "bg-surface/60 border-border text-foreground hover:border-warning/30 hover:bg-elevated"
                                }`}
                                title={`map #${mapId}`}
                            >
                                <MapPin className="w-3 h-3 shrink-0 opacity-60" />
                                <span className="truncate">{name}</span>
                                <span className="ml-auto text-caption font-mono text-muted-foreground shrink-0">#{mapId}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}