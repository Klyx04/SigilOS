"use client";
// dark-locked — module volontairement sombre (worldmap V2) : ne PAS utiliser les tokens thème-aware ici.

/**
 * Modale « Archimonstres » de la carte du monde (public + interne).
 *
 * Recherche texte **et** filtres (archimonstres / boss / monstres / Quête Ocre) sur
 * les entités géolocalisées, puis un clic **ouvre la zone** de la cible : le
 * comportement de carte (recentrage, encadrement, icône clignotante) est délégué à
 * l'appelant via `onSelect` — aucune logique de carte n'est dupliquée ici, donc le
 * panneau « Avis de recherche » et cette modale se comportent exactement pareil.
 */
import { useEffect, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
    getArchimonstresByFilter,
    searchArchimonstresForMap,
    type MapSearchFilter,
} from "@/server/actions/game-data-actions";

export interface ArchimonsterMapEntry {
    id: string;
    name: string;
    type: string;
    isOcre: boolean;
    imageUrl: string | null;
    level: number;
    zoneName: string | null;
    subAreaIds: number[];
    centerX: number | null;
    centerY: number | null;
    worldMapId: number;
}

interface ArchimonsterMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (entry: ArchimonsterMapEntry) => void;
    /** Monde affiché : sert uniquement à signaler les cibles d'un autre monde. */
    currentWorldId?: number;
}

/** Filtres proposés — « tout » et « zones » n'ont pas de sens pour une entité. */
const FILTERS: { id: MapSearchFilter; label: string; icon: string }[] = [
    { id: "archis", label: "Archimonstres", icon: "/assets/nav/archimonster.png" },
    { id: "boss", label: "Boss", icon: "/assets/dofus/game-icons/crown.png" },
    { id: "mobs", label: "Monstres", icon: "/assets/dofus/game-icons/crossed-swords.png" },
    { id: "ocre", label: "Quête Ocre", icon: "/assets/icons/ocre.png" },
];

export function ArchimonsterMapModal({ isOpen, onClose, onSelect, currentWorldId }: ArchimonsterMapModalProps) {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<MapSearchFilter>("archis");
    const [results, setResults] = useState<ArchimonsterMapEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const term = query.trim();
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = term.length >= 2
                    ? await searchArchimonstresForMap(term, filter)
                    : await getArchimonstresByFilter(filter);
                if (!cancelled) setResults(res.success && res.data ? (res.data as ArchimonsterMapEntry[]) : []);
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, term.length >= 2 ? 300 : 0);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [isOpen, query, filter]);


    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                showCloseButton={false}
                className="w-[95vw] max-w-2xl bg-[#080a10] border border-white/10 rounded-3xl p-0 overflow-hidden text-foreground shadow-[0_40px_80px_rgba(0,0,0,0.85)]"
            >
                <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/nav/archimonster.png" alt="" className="h-5 w-5 object-contain" />
                    <DialogTitle className="text-xs font-black uppercase tracking-widest text-foreground/85">
                        Archimonstres
                    </DialogTitle>
                    <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-foreground/60">
                        {results.length}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Fermer"
                        className="rounded-lg border border-white/10 px-2 py-0.5 text-foreground/50 transition-colors hover:bg-white/10 hover:text-foreground"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-2.5 border-b border-white/10 px-5 py-3">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        {loading && (
                            <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                        <input
                            type="text"
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Rechercher un archimonstre, un boss, un monstre…"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {FILTERS.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFilter(f.id)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors",
                                    filter === f.id
                                        ? "border-primary/40 bg-primary/15 text-foreground"
                                        : "border-white/10 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={f.icon} alt="" className="h-3 w-3 object-contain" />
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground/70">
                        Un clic ouvre la zone de la cible sur la carte (encadrée, avec son icône clignotante).
                    </p>
                </div>


                <div className="max-h-[55vh] divide-y divide-white/5 overflow-y-auto">
                    {results.length === 0 ? (
                        <p className="px-5 py-10 text-center text-[11px] uppercase italic tracking-wider text-muted-foreground/60">
                            {loading ? "Chargement…" : "Aucune cible géolocalisée pour cette recherche"}
                        </p>
                    ) : (
                        results.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => { onSelect(entry); onClose(); }}
                                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                            >
                                {entry.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={entry.imageUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded object-contain" />
                                ) : (
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/5">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/assets/nav/archimonster.png" alt="" className="h-4 w-4 object-contain opacity-70" />
                                    </span>
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-bold uppercase italic text-foreground/90">
                                        {entry.name}
                                    </span>
                                    <span className="block truncate text-[10px] text-muted-foreground">
                                        {entry.zoneName || "Zone inconnue"}
                                        {entry.level > 0 ? ` · niv. ${entry.level}` : ""}
                                    </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-0.5">
                                    {entry.isOcre && (
                                        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400">
                                            Ocre
                                        </span>
                                    )}
                                    {entry.worldMapId > 0 && currentWorldId !== undefined && entry.worldMapId !== currentWorldId && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-info/80">
                                            <MapPin size={9} /> Monde {entry.worldMapId}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
