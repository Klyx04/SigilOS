"use client";
// dark-locked — module volontairement sombre (worldmap V2) : ne PAS utiliser les tokens thème-aware ici.

/**
 * Panneau latéral « Avis de recherche » de la carte du monde (public + interne).
 *
 * Liste les avis (`getBountiesForMap`) avec recherche locale ; un clic recentre
 * la carte sur la zone de traque, l'encadre (rendu du bouton « Zones ») et fait
 * clignoter l'icône de l'avis au milieu de la zone.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BountyMapEntry {
    id: string;
    name: string;
    imageUrl: string | null;
    level: number;
    zoneName: string | null;
    subAreaIds: number[];
    centerX: number | null;
    centerY: number | null;
    worldMapId: number;
    dpnlUrl: string | null;
}

interface BountyMapPanelProps {
    isOpen: boolean;
    onClose: () => void;
    bounties: BountyMapEntry[];
    loading: boolean;
    query: string;
    onQueryChange: (value: string) => void;
    activeBountyId: string | null;
    onSelect: (bounty: BountyMapEntry) => void;
}

export function BountyMapPanel({
    isOpen,
    onClose,
    bounties,
    loading,
    query,
    onQueryChange,
    activeBountyId,
    onSelect,
}: BountyMapPanelProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.15 }}
                    className="fixed left-2 top-16 z-[1000] flex max-h-[calc(100vh-90px)] w-[310px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-primary/20 bg-card/95 text-xs shadow-2xl backdrop-blur-xl sm:left-4 sm:top-20"
                >
                    <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/nav/archimonster.png" alt="" className="h-4 w-4 object-contain" />
                        <span className="text-[10px] font-black uppercase italic tracking-widest text-foreground/80">
                            Avis de recherche
                        </span>
                        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                            {bounties.length}
                        </span>
                        <button
                            onClick={onClose}
                            title="Fermer le panneau"
                            className="rounded-lg border border-border/60 p-1 text-foreground/50 transition-colors hover:bg-elevated hover:text-foreground"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    <div className="border-b border-border/40 px-3 py-2">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={query}
                                onChange={(event) => onQueryChange(event.target.value)}
                                placeholder="Rechercher un avis..."
                                className="w-full rounded-xl border border-border/60 bg-background/60 py-2 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
                            />
                            {loading && (
                                <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                            )}
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/70">
                            Un clic recentre la carte sur la zone de traque et encadre la zone.
                        </p>
                    </div>

                    <div className="flex-1 divide-y divide-border/20 overflow-y-auto">
                        {bounties.length === 0 ? (
                            <p className="px-3 py-6 text-center text-[10px] uppercase italic tracking-wider text-muted-foreground/60">
                                {loading ? "Chargement des avis..." : "Aucun avis de recherche"}
                            </p>
                        ) : (
                            bounties.map((bounty) => (
                                <button
                                    key={bounty.id}
                                    onClick={() => onSelect(bounty)}
                                    title={bounty.zoneName || bounty.name}
                                    className={cn(
                                        "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-primary/5",
                                        activeBountyId === bounty.id && "bg-primary/10"
                                    )}
                                >
                                    {bounty.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={bounty.imageUrl}
                                            alt=""
                                            loading="lazy"
                                            className="h-8 w-8 shrink-0 rounded object-contain"
                                        />
                                    ) : (
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
                                            <Target size={14} className="text-primary/70" />
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-bold uppercase italic text-foreground/90">
                                            {bounty.name}
                                        </span>
                                        <span className="block truncate text-[10px] text-muted-foreground">
                                            {bounty.zoneName || "Zone inconnue"}
                                        </span>
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
