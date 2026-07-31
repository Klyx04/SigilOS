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
                <MapPin className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Donjon sur la carte</span>
                {selectedName && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-black">
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
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
            />

            {loading ? (
                <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement de la carte...
                </div>
            ) : error ? (
                <div className="py-2 text-rose-400 text-xs">{error}</div>
            ) : filtered.length === 0 ? (
                <div className="py-4 text-slate-600 text-xs italic text-center">Aucun donjon trouvé.</div>
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
                                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                        : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-amber-500/30 hover:bg-slate-800"
                                }`}
                                title={`map #${mapId}`}
                            >
                                <MapPin className="w-3 h-3 shrink-0 opacity-60" />
                                <span className="truncate">{name}</span>
                                <span className="ml-auto text-[9px] font-mono text-slate-600 shrink-0">#{mapId}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}