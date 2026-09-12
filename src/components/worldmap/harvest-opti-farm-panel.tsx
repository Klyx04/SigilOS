"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Compass, X, Sparkles, Check, ChevronRight, ChevronDown, ChevronUp,
    Layers, Sliders, MapPin, Eye, EyeOff, RotateCcw, CheckSquare, Square
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface HarvestSpot {
    x: number;
    y: number;
    count: number;
    subAreaId: number;
    worldId?: number;
}

export interface OptiFarmCircuit {
    zaapId: number;
    zaapName: string;
    zaapCoord: [number, number];
    zoneName?: string;
    subAreaId?: number;
    worldId?: number;
    totalResources: number;
    mapCount: number;
    path: { x: number; y: number; count?: number }[];
}

export interface HarvestResource {
    id: number;
    name: string;
    level: number;
    iconId: number;
    img: string;
    totalSpots: number;
    spots: HarvestSpot[];
    circuits?: OptiFarmCircuit[];
}

export interface HarvestJob {
    id: number;
    name: string;
    iconId: number;
    icon?: string;
    img: string;
    resources: HarvestResource[];
}

export interface HarvestOptiFarmPanelProps {
    jobsData: HarvestJob[];
    selectedJobId: number;
    onSelectJobId: (jobId: number) => void;
    selectedResourceIds: Set<number>;
    onToggleResource: (resId: number) => void;
    onSelectAllUpToLevel: (level: number) => void;
    onClearResources: () => void;
    activeCircuit: OptiFarmCircuit | null;
    onSelectCircuit: (circuit: OptiFarmCircuit | null) => void;
    showZaaps: boolean;
    onToggleShowZaaps: () => void;
    isOpen: boolean;
    onClose: () => void;
    activeWorldId?: number;
    onSelectWorld?: (worldId: number) => void;
    worlds?: Array<{ id: number; name: any }>;
}

export function HarvestOptiFarmPanel({
    jobsData,
    selectedJobId,
    onSelectJobId,
    selectedResourceIds,
    onToggleResource,
    onSelectAllUpToLevel,
    onClearResources,
    activeCircuit,
    onSelectCircuit,
    showZaaps,
    onToggleShowZaaps,
    isOpen,
    onClose,
    activeWorldId = 1,
    onSelectWorld,
    worlds = []
}: HarvestOptiFarmPanelProps) {
    const [levelFilter, setLevelFilter] = useState<number>(200);
    const [searchQuery, setSearchQuery] = useState("");
    const [isResourcesCollapsed, setIsResourcesCollapsed] = useState<boolean>(false);

    const getWorldName = useCallback((worldId: number): string => {
        if (worldId === 1) return "Monde des Douze (Amakna)";
        if (worldId === 2) return "Incarnam";
        const found = worlds.find(w => w.id === worldId);
        if (found) {
            if (typeof found.name === "string") return found.name;
            if (found.name?.fr) return found.name.fr;
        }
        return `Monde #${worldId}`;
    }, [worlds]);

    const currentJob = useMemo(() => {
        return jobsData.find(j => j.id === selectedJobId) || jobsData[0];
    }, [jobsData, selectedJobId]);

    // Compte du nombre de ressources disponibles par métier dans le monde actif
    const jobWorldResourceCounts = useMemo(() => {
        const counts = new Map<number, number>();
        jobsData.forEach(job => {
            const count = job.resources.filter(r => r.spots.some(sp => (sp.worldId || 1) === (activeWorldId || 1))).length;
            counts.set(job.id, count);
        });
        return counts;
    }, [jobsData, activeWorldId]);

    // Filtrer les ressources pour n'afficher QUE celles présentes dans le monde actuel
    const filteredResources = useMemo(() => {
        if (!currentJob) return [];
        return currentJob.resources.filter(r => {
            const hasSpotsInWorld = r.spots.some(sp => (sp.worldId || 1) === (activeWorldId || 1));
            if (!hasSpotsInWorld) return false;

            const matchesLevel = r.level <= levelFilter;
            const matchesSearch = !searchQuery.trim() || r.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
            return matchesLevel && matchesSearch;
        });
    }, [currentJob, levelFilter, searchQuery, activeWorldId]);

    // Ressources correspondantes à la recherche mais disponibles dans d'autres mondes
    const otherWorldMatches = useMemo(() => {
        if (!searchQuery.trim()) return [];

        const matches: {
            resource: HarvestResource;
            jobName: string;
            jobId: number;
            availableWorlds: { worldId: number; worldName: string; spotCount: number; circuitCount: number }[];
        }[] = [];

        jobsData.forEach(job => {
            job.resources.forEach(res => {
                const matchesSearch = res.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
                if (!matchesSearch) return;

                const worldsMap = new Map<number, { spotCount: number; circuitCount: number }>();
                res.spots.forEach(sp => {
                    const wId = sp.worldId || 1;
                    if (wId !== (activeWorldId || 1)) {
                        if (!worldsMap.has(wId)) {
                            worldsMap.set(wId, { spotCount: 0, circuitCount: 0 });
                        }
                        worldsMap.get(wId)!.spotCount += sp.count;
                    }
                });

                (res.circuits || []).forEach(c => {
                    const wId = c.worldId || 1;
                    if (wId !== (activeWorldId || 1) && worldsMap.has(wId)) {
                        worldsMap.get(wId)!.circuitCount += 1;
                    }
                });

                if (worldsMap.size > 0) {
                    const availableWorlds = Array.from(worldsMap.entries()).map(([worldId, data]) => ({
                        worldId,
                        worldName: getWorldName(worldId),
                        spotCount: data.spotCount,
                        circuitCount: data.circuitCount
                    }));

                    matches.push({
                        resource: res,
                        jobName: job.name,
                        jobId: job.id,
                        availableWorlds
                    });
                }
            });
        });

        return matches;
    }, [jobsData, searchQuery, activeWorldId, getWorldName]);

    // Filtrer les circuits selon les ressources cochées ET le monde actif
    const availableCircuits = useMemo(() => {
        const list: { circuit: OptiFarmCircuit; resourceName: string; resourceImg: string }[] = [];
        if (!currentJob) return list;

        currentJob.resources.forEach(res => {
            if (selectedResourceIds.has(res.id) && res.circuits) {
                res.circuits.forEach(c => {
                    if ((c.worldId || 1) === (activeWorldId || 1)) {
                        list.push({
                            circuit: c,
                            resourceName: res.name,
                            resourceImg: res.img
                        });
                    }
                });
            }
        });

        return list.sort((a, b) => b.circuit.totalResources - a.circuit.totalResources);
    }, [currentJob, selectedResourceIds, activeWorldId]);

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 sm:top-20 left-2 sm:left-4 z-[1000] w-[310px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-90px)] flex flex-col bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl overflow-hidden text-xs"
        >
            {/* Header */}
            <div className="p-2.5 sm:p-3 border-b border-border/50 bg-gradient-to-r from-primary/10 via-background/40 to-background flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-inner shrink-0">
                        <Compass className="w-3.5 h-3.5 animate-spin-slow" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-xs font-bold text-foreground truncate">Récolte Opti-Farm</h3>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold border border-emerald-500/30 truncate max-w-[120px]" title={getWorldName(activeWorldId)}>
                                {getWorldName(activeWorldId)}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                            {filteredResources.length} ressource(s) disponibles
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => setIsResourcesCollapsed(prev => !prev)}
                        title={isResourcesCollapsed ? "Afficher les ressources" : "Replier les ressources"}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        {isResourcesCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Helper Banner when on a sub-world (e.g. Château de Harebourg, Incarnam) */}
            {activeWorldId !== 1 && (
                <div className="px-3 py-1.5 bg-sky-500/10 border-b border-sky-500/20 flex items-center justify-between gap-2 text-xs">
                    <span className="text-sky-300 font-medium truncate text-[11px]">
                        Carte secondaire ({getWorldName(activeWorldId)})
                    </span>
                    <button
                        onClick={() => onSelectWorld && onSelectWorld(1)}
                        className="px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/30 font-bold text-[10px] uppercase shrink-0 transition-colors"
                    >
                        🗺️ Monde Principal
                    </button>
                </div>
            )}

            {/* Sélecteur de Métier (Grille compacte 5 colonnes sans débordement avec badges de disponibilité) */}
            <div className="p-2 bg-muted/20 border-b border-border/40 grid grid-cols-5 gap-1">
                {jobsData.map(job => {
                    const isSelected = job.id === selectedJobId;
                    const countInWorld = jobWorldResourceCounts.get(job.id) || 0;
                    const shortName = job.name === "Alchimiste" ? "Alchi" : job.name === "Pêcheur" ? "Pêche" : job.name;
                    return (
                        <button
                            key={job.id}
                            onClick={() => {
                                onSelectJobId(job.id);
                                onClearResources();
                                onSelectCircuit(null);
                            }}
                            className={cn(
                                "flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-bold transition-all border text-center relative",
                                isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                                    : countInWorld === 0
                                        ? "bg-card/30 text-muted-foreground/40 border-border/20 hover:bg-muted/30"
                                        : "bg-card/60 text-muted-foreground border-border/40 hover:bg-muted/60 hover:text-foreground"
                            )}
                            title={`${job.name} (${countInWorld} ressource(s) ici)`}
                        >
                            <span className="text-sm leading-none mb-0.5">{job.icon || "⛏️"}</span>
                            <span className="truncate w-full text-center">{shortName}</span>
                            {countInWorld > 0 && (
                                <span className={cn(
                                    "absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-black flex items-center justify-center border",
                                    isSelected ? "bg-background text-primary border-primary" : "bg-primary/20 text-primary border-primary/40"
                                )}>
                                    {countInWorld}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Filtres & Slider de Niveau + Liste des ressources (Repliable) */}
            {!isResourcesCollapsed && (
                <>
                    <div className="p-3 bg-muted/10 border-b border-border/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        Niveau max : <strong className="text-foreground">{levelFilter}</strong>
                    </span>
                    <button
                        onClick={() => onSelectAllUpToLevel(levelFilter)}
                        className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                    >
                        <CheckSquare className="w-3 h-3" />
                        Cocher tout ≤ {levelFilter}
                    </button>
                </div>

                <div className="relative w-full px-0.5">
                    <input
                        type="range"
                        min="1"
                        max="200"
                        step="10"
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(Number(e.target.value))}
                        className="w-full h-3 cursor-pointer accent-primary"
                        style={{
                            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((levelFilter - 1) / 199) * 100}%, hsl(var(--muted)) ${((levelFilter - 1) / 199) * 100}%, hsl(var(--muted)) 100%)`
                        }}
                    />
                    {/* Tick marks */}
                    <div className="flex justify-between mt-0.5 px-1">
                        {[1,50,100,150,200].map(v => (
                            <span key={v} className={cn(
                                "text-[8px] font-mono transition-colors",
                                levelFilter >= v ? "text-primary" : "text-muted-foreground/50"
                            )}>{v}</span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Rechercher une ressource..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-background/80 border border-border/50 rounded-xl px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                    {selectedResourceIds.size > 0 && (
                        <button
                            onClick={onClearResources}
                            title="Tout désélectionner"
                            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-border/20 max-h-[420px]">
                {filteredResources.length === 0 ? (
                        otherWorldMatches.length > 0 ? (
                            <div className="space-y-2 pt-1">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                                        <Compass className="w-3.5 h-3.5" />
                                        <span>Non disponible sur cette carte</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Cette ressource existe dans un autre sous-monde. Clique pour ouvrir directement sa carte :
                                    </p>
                                </div>

                                {otherWorldMatches.map(({ resource, jobName, jobId, availableWorlds }) => (
                                    <div key={resource.id} className="p-2.5 rounded-xl bg-card/80 border border-border/50 space-y-2 shadow-sm">
                                        <div className="flex items-center gap-2.5">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={resource.img}
                                                alt={resource.name}
                                                className="w-7 h-7 object-contain rounded-md bg-muted/40 p-0.5"
                                            />
                                            <div className="flex-1">
                                                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                                                    <span>{resource.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">Niv.{resource.level}</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    Métier : {jobName}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 pt-1 border-t border-border/30">
                                            {availableWorlds.map(aw => (
                                                <button
                                                    key={aw.worldId}
                                                    onClick={() => {
                                                        onSelectJobId(jobId);
                                                        if (onSelectWorld) onSelectWorld(aw.worldId);
                                                        onToggleResource(resource.id);
                                                        toast.success(`Carte ouverte : ${aw.worldName} (${resource.name})`, { duration: 2000 });
                                                    }}
                                                    className="w-full py-1.5 px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/60 text-xs font-bold text-primary flex items-center justify-between transition-all group"
                                                >
                                                    <span className="flex items-center gap-1.5 truncate">
                                                        <span>🗺️</span>
                                                        <span className="truncate">{aw.worldName}</span>
                                                        <span className="text-[10px] opacity-80 font-normal">({aw.spotCount} spots)</span>
                                                    </span>
                                                    <span className="text-[10px] underline flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                                        Ouvrir 🚀
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-xs text-muted-foreground">
                                Aucune ressource trouvée pour ce filtre.
                            </div>
                        )
                    ) : (
                        <div className="space-y-2 pt-1">
                            <div className="space-y-1.5">
                                {filteredResources.map(res => {
                                    const isChecked = selectedResourceIds.has(res.id);
                                    const worldSpots = res.spots.filter(sp => (sp.worldId || 1) === (activeWorldId || 1)).reduce((acc, s) => acc + s.count, 0);
                                    const displaySpots = worldSpots > 0 ? worldSpots : res.totalSpots;

                                    return (
                                        <div
                                            key={res.id}
                                            onClick={() => onToggleResource(res.id)}
                                            className={cn(
                                                "flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-all",
                                                isChecked
                                                    ? "bg-primary/10 border-primary/40 shadow-sm"
                                                    : "bg-card/50 border-border/30 hover:bg-muted/40"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={res.img}
                                                    alt={res.name}
                                                    className="w-7 h-7 object-contain rounded-md bg-muted/40 p-0.5"
                                                />
                                                <div>
                                                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                        {res.name}
                                                        <span className="text-[10px] text-muted-foreground font-mono">Niv.{res.level}</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {displaySpots} spot{displaySpots > 1 ? "s" : ""}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={cn(
                                                "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                                isChecked 
                                                    ? "bg-primary border-primary text-primary-foreground" 
                                                    : "border-muted-foreground/40 bg-background"
                                            )}>
                                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Section additionnelle si d'autres mondes ont aussi cette ressource */}
                            {otherWorldMatches.length > 0 && (
                                <div className="pt-2 border-t border-border/30 space-y-1.5">
                                    <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                                        <span>🌍</span>
                                        <span>Aussi présent dans d&apos;autres mondes :</span>
                                    </div>
                                    {otherWorldMatches.map(({ resource, jobId, availableWorlds }) => (
                                        <div key={`other-${resource.id}`} className="space-y-1">
                                            {availableWorlds.map(aw => (
                                                <button
                                                    key={aw.worldId}
                                                    onClick={() => {
                                                        onSelectJobId(jobId);
                                                        if (onSelectWorld) onSelectWorld(aw.worldId);
                                                        onToggleResource(resource.id);
                                                        toast.success(`Carte ouverte : ${aw.worldName} (${resource.name})`, { duration: 2000 });
                                                    }}
                                                    className="w-full py-1 px-2 rounded-lg bg-muted/30 hover:bg-primary/10 border border-border/30 hover:border-primary/40 text-[11px] font-semibold text-foreground/80 hover:text-primary flex items-center justify-between transition-all"
                                                >
                                                    <span className="truncate">{aw.worldName} ({aw.spotCount} spots)</span>
                                                    <span className="text-[10px] opacity-75">Ouvrir ↗</span>
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
            </div>
            </>
            )}

            {/* ── Section Circuits Opti-Farm (Routes farm indisponibles selon consigne) ── */}
            {false && availableCircuits.length > 0 && (
                <div className="border-t border-border/40 bg-muted/10">
                    <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                            <Compass className="w-3 h-3" />
                            Circuits Opti-Farm
                            <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[9px] font-black border border-primary/30">
                                {availableCircuits.length}
                            </span>
                        </span>
                        {activeCircuit && (
                            <button
                                onClick={() => onSelectCircuit(null)}
                                className="text-[10px] text-destructive/80 hover:text-destructive flex items-center gap-1 font-bold transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Arrêter
                            </button>
                        )}
                    </div>

                    <div className="px-2 pb-2 space-y-1 max-h-[200px] overflow-y-auto">
                        {availableCircuits.map(({ circuit, resourceName, resourceImg }, idx) => {
                            const isActive = activeCircuit === circuit;
                            return (
                                <button
                                    key={`${circuit.zaapId}-${resourceName}-${idx}`}
                                    onClick={() => onSelectCircuit(isActive ? null : circuit)}
                                    className={cn(
                                        "w-full p-2 rounded-xl border text-left transition-all flex items-center gap-2",
                                        isActive
                                            ? "bg-emerald-500/20 border-emerald-500/50 shadow shadow-emerald-500/10"
                                            : "bg-card/60 border-border/30 hover:bg-muted/40 hover:border-primary/30"
                                    )}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={resourceImg}
                                        alt={resourceName}
                                        className="w-6 h-6 object-contain rounded bg-muted/40 p-0.5 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-semibold text-foreground truncate flex items-center gap-1.5">
                                            <span className="truncate">{resourceName}</span>
                                            {circuit.zoneName && (
                                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30 truncate">
                                                    {circuit.zoneName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                                            <span className="flex items-center gap-0.5">
                                                <MapPin className="w-2.5 h-2.5 text-amber-400" />
                                                Zaap {circuit.zaapName}
                                            </span>
                                            <span className="opacity-50">·</span>
                                            <span>{circuit.mapCount} maps</span>
                                            <span className="opacity-50">·</span>
                                            <span className="text-emerald-400 font-bold">{circuit.totalResources} res.</span>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "shrink-0 px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all shadow-sm",
                                        isActive
                                            ? "bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/30"
                                            : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                    )}>
                                        {isActive ? "✓ En cours" : "▶ Lancer"}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
