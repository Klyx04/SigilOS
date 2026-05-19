"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { ExternalLink, Loader2, Shield, AlertCircle, RefreshCw, Layers, Move, Zap, Sparkles } from "lucide-react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { DO_TAGS } from "@/lib/dofus-tags";
import { getClassColor } from "@/components/shared/class-icon";
import { getClassName } from "@/lib/dofusbook-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DofusroomBuildData, DofusroomSet } from "@/app/api/dofusroom/proxy/[id]/route";

// ─── Types (re-exported for consumers) ───────────────────────────────────────

export type { DofusroomBuildData };

// Legacy alias so baked previewData still works if stored in old format
export type DofusroomPreviewData = DofusroomBuildData;

interface DofusroomPreviewProps {
    url: string;
    title?: string;
    className?: string;
    tags?: string[];
    classId?: number;
    initialData?: DofusroomBuildData | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getIconId = (id: number) => id === 19 ? 20 : id;

function extractDofusroomId(url: string): string | null {
    const m = url.match(/(?:build\/show\/|\/b-)(\d+)/);
    return m ? m[1] : null;
}

function translateSetBonus(bonus: string): string {
    let text = bonus;
    
    const translations: [RegExp, string][] = [
        [/\bStrength\b/gi, "Force"],
        [/\bIntelligence\b/gi, "Intelligence"],
        [/\bChance\b/gi, "Chance"],
        [/\bAgility\b/gi, "Agilité"],
        [/\bWisdom\b/gi, "Sagesse"],
        [/\bProspecting\b/gi, "Prospection"],
        [/\bCritical Hits?\b/gi, "Critique"],
        [/\bCritical Hit\b/gi, "Critique"],
        [/\bInitiative\b/gi, "Initiative"],
        [/\bInvocations?\b/gi, "Invocation"],
        [/\bHeal\b/gi, "Soin"],
        [/\bHeals\b/gi, "Soins"],
        [/\bVitality\b/gi, "Vitalité"],
        
        [/\bAP\b/g, "PA"],
        [/\bMP\b/g, "PM"],
        [/\bRange\b/gi, "Portée"],
        [/\bPO\b/gi, "Portée"],
        
        [/\bMP Parry\b/gi, "Esquive PM"],
        [/\bAP Parry\b/gi, "Esquive PA"],
        [/\bMP Reduction\b/gi, "Retrait PM"],
        [/\bAP Reduction\b/gi, "Retrait PA"],
        [/\bDodge\b/gi, "Fuite"],
        [/\bLock\b/gi, "Tacle"],
        
        [/\bPower\b/gi, "Puissance"],
        [/\bNeutral Damage\b/gi, "Dommages Neutre"],
        [/\bEarth Damage\b/gi, "Dommages Terre"],
        [/\bFire Damage\b/gi, "Dommages Feu"],
        [/\bWater Damage\b/gi, "Dommages Eau"],
        [/\bAir Damage\b/gi, "Dommages Air"],
        [/\bCritical Damage\b/gi, "Dommages Critique"],
        [/\bPushback Damage\b/gi, "Dommages Poussée"],
        [/\bDamage\b/gi, "Dommages"],
        
        [/\bNeutral Resistance\b/gi, "Résistance Neutre"],
        [/\bEarth Resistance\b/gi, "Résistance Terre"],
        [/\bFire Resistance\b/gi, "Résistance Feu"],
        [/\bWater Resistance\b/gi, "Résistance Eau"],
        [/\bAir Resistance\b/gi, "Résistance Air"],
        [/\bCritical Resistance\b/gi, "Résistance Critique"],
        [/\bPushback Resistance\b/gi, "Résistance Poussée"],
        [/\b% Neutral Resistance\b/gi, "% Résistance Neutre"],
        [/\b% Earth Resistance\b/gi, "% Résistance Terre"],
        [/\b% Fire Resistance\b/gi, "% Résistance Feu"],
        [/\b% Water Resistance\b/gi, "% Résistance Eau"],
        [/\b% Air Resistance\b/gi, "% Résistance Air"],
    ];
    
    for (const [pattern, repl] of translations) {
        text = text.replace(pattern, repl);
    }
    
    return text;
}

/** Flatten the last (active) bonus tier into a simple label[] list in French */
function flattenSetBonus(set: DofusroomSet): string[] {
    const lastTier = set.bonus?.[0];
    if (!lastTier) return [];
    return Object.entries(lastTier)
        .map(([key, v]) => {
            if (!v || typeof v.is !== "number") return "";
            const prefix = v.is > 0 ? "+" : "";
            const label = v.statLabel || key;
            if (label.startsWith("%")) {
                const cleanedLabel = label.replace(/^%\s*/, "").trim();
                return `${prefix}${v.is}% ${cleanedLabel}`;
            }
            return `${prefix}${v.is} ${label}`;
        })
        .filter(Boolean);
}

function parseSmithmagic(smithmagic: any, items: any) {
    if (!smithmagic || typeof smithmagic !== "object") return [];
    
    const entries: Array<{
        stat: string;
        value: number;
        slotKey: string;
        itemName: string;
        itemImage: string;
    }> = [];
    
    const slotMapping: Record<string, string> = {
        "hat": "coiffe",
        "cape": "cape",
        "amulet": "amulette",
        "ring.top": "anneau1",
        "ring.bottom": "anneau2",
        "belt": "ceinture",
        "boots": "bottes",
        "weapon": "corps-a-corps",
        "shield": "bouclier"
    };

    const statLabelMapping: Record<string, string> = {
        "pa": "PA",
        "pm": "PM",
        "po": "PO",
        "portee": "PO",
        "force-bonus": "Force",
        "vitalite-bonus": "Vitalité",
        "dommages-aux-sorts": "% Do Sorts",
        "dommages-distance": "% Do Dist.",
        "dommages-melee": "% Do Mêlée",
        "dommages-aux-armes": "% Do Armes"
    };
    
    const addEntry = (statKey: string, rawVal: any) => {
        if (!rawVal || typeof rawVal !== "object") return;
        const val = rawVal.value;
        const rawSlot = rawVal.slot;
        if (typeof val !== "number" || !rawSlot) return;
        
        const slotKey = slotMapping[rawSlot] || rawSlot;
        const item = items?.[slotKey];
        
        entries.push({
            stat: statLabelMapping[statKey] || statKey,
            value: val,
            slotKey,
            itemName: item?.name || "Équipement",
            itemImage: item?.image ? `/api/dofusroom/proxy-image?image=${item.image}` : ""
        });
    };
    
    for (const [statKey, statVal] of Object.entries(smithmagic)) {
        if (Array.isArray(statVal)) {
            for (const item of statVal) {
                addEntry(statKey, item);
            }
        } else if (statVal && typeof statVal === "object") {
            for (const item of Object.values(statVal)) {
                addEntry(statKey, item);
            }
        }
    }
    
    // Sort FM entries: PA first, PM second, PO third, then others alphabetically by stat name
    const sorted = [...entries].sort((a, b) => {
        const getPriority = (stat: string) => {
            if (stat === "PA") return 1;
            if (stat === "PM") return 2;
            if (stat === "PO") return 3;
            return 4;
        };
        const pA = getPriority(a.stat);
        const pB = getPriority(b.stat);
        if (pA !== pB) return pA - pB;
        return a.stat.localeCompare(b.stat);
    });
    
    return sorted;
}

// ─── Set Badge with Popover (used in modal, perfectly identical to Dofusbook) ────

type EquippedItemType = { name: string; image: string };

function SetBadge({ name, set, equippedItems }: { name: string; set: DofusroomSet; equippedItems: EquippedItemType[] }) {
    const bonuses = flattenSetBonus(set);
    const hasItems = equippedItems && equippedItems.length > 0;
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="px-3 py-2 bg-zinc-900 border border-white/5 rounded-xl flex items-center gap-3 group/cloth hover:border-sky-500/30 hover:bg-zinc-800/50 transition-all cursor-pointer text-left">
                    <span className="text-[11px] font-bold text-zinc-300 group-hover/cloth:text-sky-400 transition-colors uppercase truncate max-w-[120px]">{name}</span>
                    <div className="px-1.5 py-0.5 bg-black/40 rounded text-[9px] font-black text-zinc-500 shrink-0">
                        {equippedItems.length}<span className="text-zinc-700">/{set.items.length}</span>
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-zinc-950 border-white/10 rounded-2xl p-4 shadow-2xl z-[100]" side="top" align="start">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">{name}</p>
                    <span className="text-[9px] text-zinc-600 font-bold shrink-0">Niveau {set.level}</span>
                </div>
                
                {/* List items inside set */}
                {hasItems && (
                    <div className="flex flex-col gap-1.5 mb-3 border-b border-white/5 pb-3">
                        {equippedItems.map(item => (
                            <a
                                key={item.name}
                                href={`https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition-colors group/item"
                            >
                                <div className="w-8 h-8 bg-zinc-900 rounded-lg border border-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                    <NextImage
                                        src={`/api/dofusroom/proxy-image?image=${item.image}`}
                                        alt={item.name}
                                        width={32}
                                        height={32}
                                        className="object-contain w-full h-full"
                                        unoptimized
                                    />
                                </div>
                                <span className="text-[11px] font-semibold text-zinc-400 group-hover/item:text-white transition-colors truncate flex-1">{item.name}</span>
                                <ExternalLink className="w-3 h-3 text-zinc-700 group-hover/item:text-sky-400 transition-colors flex-shrink-0" />
                            </a>
                        ))}
                    </div>
                )}
                
                {/* Display translated bonuses */}
                <div className="flex flex-col gap-1">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-wider mb-1">Bonus de panoplie ({equippedItems.length} équipés)</p>
                    {bonuses.length > 0 ? (
                        bonuses.map((b, i) => (
                            <span key={i} className="text-[10px] text-zinc-300 font-semibold leading-tight">
                                • {b}
                            </span>
                        ))
                    ) : (
                        <span className="text-[10px] text-zinc-600 italic">Aucun bonus actif</span>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DofusroomPreview = memo(function DofusroomPreview({
    url, title, className, tags = [], classId, initialData
}: DofusroomPreviewProps) {
    const [data, setData] = useState<DofusroomBuildData | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [lastRefresh, setLastRefresh] = useState(0);

    const buildId = useMemo(() => extractDofusroomId(url), [url]);

    const fetchBuild = async (force = false) => {
        if (!buildId) return;
        if (force) {
            const now = Date.now();
            const cooldown = 30_000;
            if (now - lastRefresh < cooldown) {
                const remaining = Math.ceil((cooldown - (now - lastRefresh)) / 1000);
                toast.error(`Veuillez attendre ${remaining}s avant de rafraîchir à nouveau`);
                return;
            }
            setLastRefresh(now);
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/dofusroom/proxy/${buildId}`, {
                headers: force ? { "Cache-Control": "no-cache" } : {},
            });
            if (res.ok) {
                const json = await res.json();
                setData(json);
                if (force) toast.success("Données actualisées");
            } else if (force) {
                toast.error(`Erreur ${res.status} lors de l'actualisation`);
            }
        } catch {
            if (force) toast.error("Erreur réseau");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // If initialData is in the old format (pre-rewrite, missing 'sets'), discard it and re-fetch
        const isLegacyData = initialData && !("sets" in initialData);
        if (initialData && !isLegacyData) { setLoading(false); return; }
        if (!buildId) { setLoading(false); return; }
        fetchBuild(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildId, initialData]);

    // Glow color from tags
    const glowColor = useMemo(() => {
        const tagColors: Record<string, string> = {
            "feu": "#ef4444", "eau": "#3b82f6", "terre": "#16a34a", "air": "#34d399", "multi": "#d946ef"
        };
        const first = tags.find(t => tagColors[t]);
        return first ? tagColors[first] : "#0ea5e9";
    }, [tags]);

    const resolvedClassId = data?.classId || classId || 0;
    const resolvedClassName = data?.className || getClassName(resolvedClassId) || "";
    const classArtColor = useMemo(() => {
        const name = resolvedClassName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return getClassColor(name);
    }, [resolvedClassName]);

    const displayTitle = title || data?.name || "Build DofusRoom";
    const setsList = Object.entries(data?.sets || {});
    const hasRealData = data && setsList.length > 0;

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center bg-zinc-900/50 rounded-[2.5rem] border border-white/5 min-h-[300px]", className)}>
                <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
            </div>
        );
    }

    // ── Thumbnail card ────────────────────────────────────────────────────────
    const cardContent = (
        <div className={cn(
            "group w-full max-w-[320px] mx-auto relative overflow-hidden bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 sm:p-6 transition-all hover:border-sky-500/50 hover:shadow-[0_0_40px_rgba(14,165,233,0.1)] cursor-pointer",
            className
        )}>
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none" style={{ backgroundColor: `${glowColor}33` }} />

            {/* DofusRoom badge */}
            <div className="absolute top-3 left-3 px-2 py-0.5 bg-sky-500/20 border border-sky-500/30 rounded-full text-[8px] font-black text-sky-400 uppercase tracking-widest z-10">
                DofusRoom
            </div>

            <div className="flex flex-col gap-4 relative z-10 h-full">
                {/* Header: class icon + title */}
                <div className="flex items-center gap-4 mt-3">
                    <div className="relative w-12 h-12 shrink-0 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                        <div className="absolute inset-0 opacity-20 blur-md" style={{ backgroundColor: classArtColor }} />
                        {resolvedClassId > 0 ? (
                            <NextImage
                                src={`/assets/dofus/classes/${getIconId(resolvedClassId)}.png`}
                                alt={resolvedClassName}
                                width={44}
                                height={44}
                                className="object-contain p-1 relative z-10"
                            />
                        ) : (
                            <ExternalLink className="w-6 h-6 text-zinc-700 relative z-10" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-[14px] text-white truncate uppercase tracking-tight leading-tight" title={displayTitle}>
                            {displayTitle}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-zinc-400 uppercase tracking-tighter">
                                Lvl {data?.level ?? 200}
                            </span>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                                {resolvedClassName || "Classe inconnue"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Equipment Grid or Fallback UI */}
                <div className="relative aspect-square w-full bg-black/40 p-3 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl">
                    {/* Ambient glow in background */}
                    <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] flex items-center justify-center pointer-events-none z-0">
                        {resolvedClassId > 0 && (
                            <div className="absolute w-24 h-24 rounded-full blur-[40px] opacity-25" style={{ backgroundColor: classArtColor }} />
                        )}
                    </div>

                    {hasRealData ? (
                        <div className="grid grid-cols-6 grid-rows-5 gap-1.5 relative z-10 w-full h-full p-1.5">
                            {/* Class art in the center of the grid, highly visible in foreground */}
                            {resolvedClassId > 0 && (
                                <div className="absolute flex items-center justify-center pointer-events-none z-0" style={{ gridColumn: '2 / 6', gridRow: '1 / 4', width: '100%', height: '100%' }}>
                                    <NextImage
                                        src={`/assets/dofus/classes/${getIconId(resolvedClassId)}.png`}
                                        alt={resolvedClassName}
                                        width={75}
                                        height={75}
                                        className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] opacity-85 group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            )}

                            {[
                                { s: 'amulette', c: 1, r: 1 }, { s: 'anneau1', c: 1, r: 2 }, { s: 'anneau2', c: 1, r: 3 }, { s: 'bouclier', c: 1, r: 4 },
                                { s: 'coiffe', c: 6, r: 1 }, { s: 'cape', c: 6, r: 2 }, { s: 'ceinture', c: 6, r: 3 }, { s: 'bottes', c: 6, r: 4 },
                                { s: 'corps-a-corps', c: 3, r: 4 }, { s: 'familier', c: 4, r: 4 },
                                { s: 'dofus1', c: 1, r: 5 }, { s: 'dofus2', c: 2, r: 5 }, { s: 'dofus3', c: 3, r: 5 },
                                { s: 'dofus4', c: 4, r: 5 }, { s: 'dofus5', c: 5, r: 5 }, { s: 'dofus6', c: 6, r: 5 },
                            ].map((slot) => {
                                const item = data.items?.[slot.s];
                                
                                return (
                                    <div
                                        key={slot.s}
                                        className={cn(
                                            "w-[34px] h-[34px] rounded-lg flex items-center justify-center p-1 relative group/mini-slot z-10",
                                            item?.image ? "bg-zinc-800 border border-white/10 hover:bg-zinc-700 hover:border-sky-500/30 transition-colors" : "bg-white/[0.03] border border-white/5 opacity-40"
                                        )}
                                        style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                    >
                                        {item?.image && (
                                            <>
                                                <NextImage
                                                    src={`/api/dofusroom/proxy-image?image=${item.image}`}
                                                    alt={item.name}
                                                    width={32}
                                                    height={32}
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-2 py-1 rounded-md text-[9px] font-bold text-white opacity-0 group-hover/mini-slot:opacity-100 transition-all shadow-xl z-50 whitespace-nowrap pointer-events-none">
                                                    {item.name}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <ExternalLink className="w-5 h-5 text-zinc-600 opacity-60" />
                        </div>
                    )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {tags.map(tagId => {
                            const tagDef = DO_TAGS.find(t => t.id === tagId);
                            return tagDef ? (
                                <span key={tagId} className={cn("px-1.5 py-0.5 text-[8px] rounded font-black uppercase tracking-tighter", tagDef.className)}>
                                    {tagDef.label}
                                </span>
                            ) : null;
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Dialog>
            <DialogTrigger asChild>{cardContent}</DialogTrigger>
            <DialogContent className="max-w-[1200px] w-[95vw] max-h-[95vh] bg-zinc-950 border-white/10 p-0 overflow-y-auto custom-scrollbar rounded-[2rem] md:rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                <div className="relative p-5 sm:p-8 lg:p-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
                    {/* Background glow */}
                    <div className="absolute inset-x-0 top-0 h-96 opacity-10 blur-[120px] pointer-events-none" style={{ backgroundColor: classArtColor }} />

                    {/* Left: Class art & Resists */}
                    <div className="w-full lg:w-[360px] flex flex-col gap-6 lg:gap-8 relative z-10 shrink-0">
                        <div className="relative aspect-square w-full rounded-[2rem] md:rounded-[3rem] bg-black/60 border border-white/5 flex items-center justify-center p-4 sm:p-8 overflow-hidden shadow-inner">
                            {/* Class art in the center of the grid, highly visible in foreground */}
                            {hasRealData && resolvedClassId > 0 && (
                                <div className="absolute flex items-center justify-center pointer-events-none z-0" style={{ gridColumn: '2 / 6', gridRow: '1 / 4', width: '100%', height: '100%' }}>
                                    <NextImage
                                        src={`/assets/dofus/classes/${getIconId(resolvedClassId)}.png`}
                                        alt={resolvedClassName}
                                        width={90}
                                        height={90}
                                        className="object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] opacity-85 scale-105"
                                    />
                                </div>
                            )}

                            {hasRealData ? (
                                <div className="grid grid-cols-6 grid-rows-5 gap-2 sm:gap-3.5 relative z-10 w-full h-full">
                                    {[
                                        { s: 'amulette', c: 1, r: 1 }, { s: 'anneau1', c: 1, r: 2 }, { s: 'anneau2', c: 1, r: 3 }, { s: 'bouclier', c: 1, r: 4 },
                                        { s: 'coiffe', c: 6, r: 1 }, { s: 'cape', c: 6, r: 2 }, { s: 'ceinture', c: 6, r: 3 }, { s: 'bottes', c: 6, r: 4 },
                                        { s: 'corps-a-corps', c: 3, r: 4 }, { s: 'familier', c: 4, r: 4 },
                                        { s: 'dofus1', c: 1, r: 5 }, { s: 'dofus2', c: 2, r: 5 }, { s: 'dofus3', c: 3, r: 5 },
                                        { s: 'dofus4', c: 4, r: 5 }, { s: 'dofus5', c: 5, r: 5 }, { s: 'dofus6', c: 6, r: 5 },
                                    ].map((slot) => {
                                        const item = data.items?.[slot.s];
                                        
                                        return (
                                            <a
                                                key={slot.s}
                                                href={item ? `https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}` : "#"}
                                                target={item ? "_blank" : undefined}
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 sm:p-2 relative transition-all duration-500 group/modal-slot z-10",
                                                    item?.image ? "bg-zinc-800/80 border border-white/20 shadow-2xl hover:border-sky-500/50 hover:bg-zinc-700 hover:scale-110" : "bg-white/[0.02] border border-white/5 opacity-30 cursor-default"
                                                )}
                                                style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                                onClick={(e) => !item?.image && e.preventDefault()}
                                            >
                                                {item?.image && (
                                                    <>
                                                        <NextImage
                                                            src={`/api/dofusroom/proxy-image?image=${item.image}`}
                                                            alt={item.name}
                                                            width={44}
                                                            height={44}
                                                            className="object-contain drop-shadow-xl"
                                                            unoptimized
                                                        />
                                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-black text-white opacity-0 group-hover/modal-slot:opacity-100 transition-all scale-75 group-hover/modal-slot:scale-100 shadow-2xl z-50 whitespace-nowrap pointer-events-none">
                                                            {item.name} <span className="text-sky-400 ml-1">→ DofusDB</span>
                                                        </div>
                                                    </>
                                                )}
                                            </a>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                                    {resolvedClassId > 0 && (
                                        <NextImage
                                            src={`/assets/dofus/classes/${getIconId(resolvedClassId)}.png`}
                                            alt={resolvedClassName}
                                            width={110}
                                            height={110}
                                            className="object-contain drop-shadow-2xl"
                                        />
                                    )}
                                    <div className="px-3 py-1.5 bg-sky-500/20 border border-sky-500/30 rounded-xl">
                                        <span className="text-xs font-black text-sky-400 uppercase tracking-widest">DofusRoom</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Resistances panel */}
                        {data?.calculatedResists && (
                            <div className="flex flex-col gap-2 bg-black/30 p-5 rounded-3xl border border-white/5">
                                {[
                                    { res: 'neutre', val: data.calculatedResists.neutre, label: 'Neutre', icon: (
                                        <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px] drop-shadow-md">
                                            <circle cx="12" cy="12" r="11" fill="#E2E2E2" stroke="#000" strokeWidth="1" />
                                            <path d="M12 1A11 11 0 0 0 12 23A5.5 5.5 0 0 1 12 12A5.5 5.5 0 0 0 12 1Z" fill="#111" />
                                            <circle cx="12" cy="6.5" r="2" fill="#111" />
                                            <circle cx="12" cy="17.5" r="2" fill="#E2E2E2" />
                                        </svg>
                                    ) },
                                    { res: 'terre', val: data.calculatedResists.terre, label: 'Terre', icon: (
                                        <svg viewBox="0 0 24 24" fill="#9D753E" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M12 24L5 12H9V0H15V12H19L12 24Z" />
                                        </svg>
                                    ) },
                                    { res: 'feu', val: data.calculatedResists.feu, label: 'Feu', icon: (
                                        <svg viewBox="0 0 24 24" fill="#E33E19" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M12 0C12 0 3 8 3 15C3 20 7 24 12 24C17 24 21 20 21 15C21 8 12 0 12 0ZM12 20C10 20 8 18 8 16C8 14 12 10 12 10C12 10 16 14 16 16C16 18 14 20 12 20Z" />
                                        </svg>
                                    ) },
                                    { res: 'eau', val: data.calculatedResists.eau, label: 'Eau', icon: (
                                        <svg viewBox="0 0 24 24" fill="#5AC2FF" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M12 0C12 0 4 10 4 16C4 20.418 7.582 24 12 24C16.418 24 20 20.418 20 16C20 10 12 0 12 0Z" />
                                        </svg>
                                    ) },
                                    { res: 'air', val: data.calculatedResists.air, label: 'Air', icon: (
                                        <svg viewBox="0 0 24 24" fill="#88C72B" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M17 19C19.761 19 22 16.761 22 14C22 11.239 19.761 9 17 9C16.5 6 14 3 11 3C7 3 4 6 4 10C1.79 10 0 11.79 0 14C0 16.21 1.79 18 4 18H17Z" />
                                        </svg>
                                    ) },
                                ].map(({ res, val, icon, label }) => (
                                    <div key={res} className="flex items-center gap-3">
                                        <span className="w-8 text-right font-black text-white text-[15px]" style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}>{val}</span>
                                        <span className="flex items-center justify-center w-5 h-5">{icon}</span>
                                        <span className="text-sky-300/80 text-[14px] font-semibold tracking-wide leading-none" style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}>% Ré {label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Build info + panoplies */}
                    <div className="flex-1 flex flex-col relative z-10 min-w-0">
                        <DialogHeader className="mb-6 text-left">
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 text-[10px] font-black rounded uppercase">
                                            Lvl {data?.level ?? 200}
                                        </span>
                                        <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                                            {resolvedClassName}
                                        </span>
                                    </div>
                                    <DialogTitle className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                                        {displayTitle}
                                    </DialogTitle>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); fetchBuild(true); }}
                                    disabled={loading}
                                    className="bg-zinc-900 border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl h-10 px-4"
                                >
                                    <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                                    Actualiser
                                </Button>
                            </div>
                            <DialogDescription asChild>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {tags.map(tagId => {
                                        const tagDef = DO_TAGS.find(t => t.id === tagId);
                                        return tagDef ? (
                                            <span key={tagId} className={cn("px-2 py-0.5 text-[9px] rounded font-black uppercase tracking-tighter", tagDef.className)}>
                                                {tagDef.label}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </DialogDescription>
                        </DialogHeader>

                        {data ? (
                            <div className="flex flex-col gap-6">
                                {/* Gorgeous 3-column stats panel */}
                                {data.calculatedStats && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {/* Bloc 1: Stats Primaires */}
                                        <div className="bg-[#2B2925] p-5 rounded-3xl border border-[#3B3831] shadow-inner flex flex-col h-full">
                                            <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Move className="w-3.5 h-3.5"/> Caractéristiques
                                            </h4>
                                            <div className="grid grid-cols-2 gap-2 my-auto">
                                                {[
                                                    { val: data.calculatedStats.vit, icon: "❤️", label: "PdV", color: "text-white" },
                                                    { val: data.calculatedStats.pa, icon: "⭐", label: "PA", color: "text-[#008cfc]" },
                                                    { val: data.calculatedStats.pm, icon: "🛹", label: "PM", color: "text-[#2cb14b]" },
                                                    { val: data.calculatedStats.po, icon: "👁️", label: "PO", color: "text-[#389f81]" },
                                                    { val: data.calculatedStats.pp, icon: "🔎", label: "Pros.", color: "text-[#5AC2FF]" },
                                                    { val: data.calculatedStats.cc, icon: "🎯", label: "Crit.", color: "text-[#f24254]" },
                                                    { val: data.calculatedStats.invo, icon: "🦊", label: "Invo.", color: "text-[#f59f0f]" },
                                                    { val: data.calculatedStats.so, icon: "➕", label: "Soin", color: "text-[#ef3f3f]" },
                                                ].map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-black/30 px-2 py-2 rounded-xl border border-white/[0.05] gap-1">
                                                        <div className="flex items-center gap-0.5">
                                                            <span className="text-[12px] opacity-60 shrink-0">{s.icon}</span>
                                                            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap">{s.label}</span>
                                                        </div>
                                                        <span className={cn("font-black text-[13px] shrink-0", s.color)}>{s.val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Bloc 2: Éléments */}
                                        <div className="bg-[#2B2925] p-5 rounded-3xl border border-[#3B3831] shadow-inner flex flex-col h-full">
                                            <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Zap className="w-3.5 h-3.5"/> Éléments
                                            </h4>
                                            <div className="flex flex-col gap-2 my-auto">
                                                {[
                                                    { val: data.calculatedElements.force, label: 'Force',        color: 'text-[#9D753E]' },
                                                    { val: data.calculatedElements.intelligence, label: 'Intelligence', color: 'text-[#E33E19]' },
                                                    { val: data.calculatedElements.chance, label: 'Chance',       color: 'text-[#5AC2FF]' },
                                                    { val: data.calculatedElements.agilite, label: 'Agilité',      color: 'text-[#88C72B]' },
                                                    { val: data.calculatedStats.sagesse, label: 'Sagesse',      color: 'text-[#a560df]' },
                                                    { val: data.calculatedElements.puissance, label: 'Puissance',    color: 'text-[#f59f0f]' },
                                                ].map((e, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-xl border border-white/[0.02]">
                                                        <span className="text-zinc-400 text-[12px] font-medium">{e.label}</span>
                                                        <span className={cn("font-black text-[15px]", e.color)}>{e.val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Bloc 3: Dommages */}
                                        <div className="bg-[#2B2925] p-5 rounded-3xl border border-[#3B3831] shadow-inner flex flex-col h-full">
                                            <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Zap className="w-3.5 h-3.5 fill-current"/> Dommages Fixes & %
                                            </h4>
                                            <div className="flex flex-col gap-4 my-auto">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                                                    {[
                                                        { label: 'Neutre', val: data.calculatedDamages.neutre, c: 'text-[#E2E2E2]' },
                                                        { label: 'Terre', val: data.calculatedDamages.terre, c: 'text-[#9D753E]' },
                                                        { label: 'Feu', val: data.calculatedDamages.feu, c: 'text-[#E33E19]' },
                                                        { label: 'Eau', val: data.calculatedDamages.eau, c: 'text-[#5AC2FF]' },
                                                        { label: 'Air', val: data.calculatedDamages.air, c: 'text-[#88C72B]' },
                                                        { label: 'Généraux', val: data.calculatedDamages.general, c: 'text-white' },
                                                        { label: 'Crit.', val: data.calculatedDamages.critique, c: 'text-[#f24254]' },
                                                        { label: 'Poussée', val: data.calculatedDamages.poussee, c: 'text-zinc-400' },
                                                    ].map((d, idx) => (
                                                        <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-1">
                                                            <span className="text-zinc-500 font-medium">{d.label}</span>
                                                            <span className={cn("font-black", d.c)}>{d.val}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* % Section */}
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {[
                                                        { label: '% Mêlée', val: data.calculatedDamages.melee },
                                                        { label: '% Dist.', val: data.calculatedDamages.distance },
                                                        { label: '% Armes', val: data.calculatedDamages.armes },
                                                        { label: '% Sorts', val: data.calculatedDamages.sorts },
                                                    ].map((p, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-[11px] bg-black/40 px-2 py-1.5 rounded-xl border border-white/5">
                                                            <span className="text-zinc-500">{p.label}</span>
                                                            <span className="font-black text-sky-400 text-[12px]">{p.val}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Panoplies section */}
                                {setsList.length > 0 ? (
                                    <div className="pt-4 border-t border-white/5">
                                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-sky-400" /> Panoplies Associées
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {setsList.map(([setId, set]) => {
                                                // Find equipped items in this set
                                                const equippedItems = Object.values(data.items || {}).filter(item => 
                                                    item.id && set.items.includes(item.id.toString())
                                                );
                                                return (
                                                    <SetBadge
                                                        key={setId}
                                                        name={set.name}
                                                        set={set}
                                                        equippedItems={equippedItems}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[11px] text-zinc-600">Aucune panoplie détectée dans ce build.</p>
                                    </div>
                                )}

                                {/* Forgemagie section */}
                                {data.smithmagic && (
                                    (() => {
                                        const fmEntries = parseSmithmagic(data.smithmagic, data.items);
                                        return (
                                            <div className="pt-4 border-t border-white/5">
                                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Forgemagie (Exo / Over)
                                                </h4>
                                                {fmEntries.length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                                        {fmEntries.map((fm, idx) => (
                                                            <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-900/50 border border-white/5 rounded-xl hover:border-emerald-500/20 transition-all">
                                                                {fm.itemImage && (
                                                                    <div className="w-8 h-8 bg-zinc-950 rounded-lg border border-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                                        <NextImage
                                                                            src={fm.itemImage}
                                                                            alt={fm.itemName}
                                                                            width={28}
                                                                            height={28}
                                                                            className="object-contain"
                                                                            unoptimized
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] font-bold text-zinc-400 truncate uppercase leading-tight" title={fm.itemName}>
                                                                        {fm.itemName}
                                                                    </p>
                                                                    <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-tighter">
                                                                        {fm.slotKey}
                                                                    </span>
                                                                </div>
                                                                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg shrink-0">
                                                                    {fm.value > 0 ? `+${fm.value}` : fm.value} {fm.stat}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-zinc-600 italic">Aucune forgemagie (Exo/Over) détectée dans ce build.</p>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}

                                {/* Source note */}
                                <div className="p-4 bg-sky-500/5 border border-sky-500/15 rounded-2xl">
                                    <p className="text-[11px] text-sky-400/70 font-medium leading-relaxed">
                                        Ce build provient de <span className="font-black text-sky-400">DofusRoom</span>.
                                        Les statistiques complètes (PA, PM, caractéristiques, dommages, résistances) ont été calculées dynamiquement à partir des équipements équipés sur le build !
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white/[0.02] rounded-[3rem] border border-white/5 text-center gap-5">
                                <AlertCircle className="w-12 h-12 text-zinc-600" />
                                <div className="max-w-xs">
                                    <h4 className="text-lg font-black text-white uppercase mb-2">Données non chargées</h4>
                                    <p className="text-sm text-zinc-500 leading-relaxed">
                                        Impossible de récupérer les données de ce build DofusRoom.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-6">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:w-auto inline-flex px-8 py-4 bg-sky-500 text-white rounded-2xl text-center text-[12px] font-black uppercase tracking-widest hover:bg-sky-400 transition-all items-center justify-center gap-3 shadow-xl shadow-sky-500/20"
                            >
                                Ouvrir sur DofusRoom <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});
