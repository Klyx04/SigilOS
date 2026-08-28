"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { getClassName, processDofusbookRawData, type DofusbookPreviewData, type DofusbookItem } from "@/lib/dofusbook-utils";
import { ExternalLink, Users, Loader2, Zap, Move, Eye, Heart, Shield, Sparkles, RefreshCw, Copy, ShieldAlert, Check } from "lucide-react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { DO_TAGS } from "@/lib/dofus-tags";
import { getClassColor } from "@/components/shared/class-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DofusSpellsTab } from "@/components/dofus/dofus-spells-tab";
import type { BuildStatsForSpells } from "@/lib/dofus-spells";

type ClothData = { name: string; count: number; total: number; clothItems?: DofusbookItem[]; bonuses?: Record<string, number> };

const statLabelMapping: Record<string, string> = {
    "pa": "PA", "pm": "PM", "po": "PO", "vi": "Vitalité", "vit": "Vitalité",
    "fo": "Force", "in": "Intelligence", "ch": "Chance", "ag": "Agilité",
    "sa": "Sagesse", "pu": "Puissance", "rnp": "% Ré Neutre", "rtp": "% Ré Terre",
    "rfp": "% Ré Feu", "rep": "% Ré Eau", "rap": "% Ré Air", "ini": "Initiative",
    "cc": "% Critique", "pp": "Prospection", "invo": "Invocation", "so": "Soin",
    "dnf": "Do Neutre", "dtf": "Do Terre", "dff": "Do Feu", "def": "Do Eau",
    "daf": "Do Air", "df": "Dommages", "dc": "Do Crit.", "dp": "Do Pous.",
    "da": "% Do Armes", "ds": "% Do Sorts", "dm": "% Do Mêlée", "di": "% Do Dist.", "dd": "% Do Dist."
};

interface DofusbookPreviewProps {
    url: string;
    title?: string;
    className?: string;
    tags?: string[];
    classId?: number;
    initialData?: DofusbookPreviewData;
}

const parseDofusbookSmithmagic = (smithmagic: any, items: any) => {
    if (!smithmagic || typeof smithmagic !== "object") return [];
    
    const entries: Array<{
        stat: string;
        value: number;
        slotKey: string;
        itemName: string;
        itemImage: string;
    }> = [];
    
    const slotMapping: Record<string, string> = {
        "1": "coiffe", "2": "cape", "3": "amulette", "4": "anneau1",
        "5": "anneau2", "6": "ceinture", "7": "bottes", "8": "corps-a-corps",
        "9": "bouclier", "15": "familier"
    };
    
    for (const [slotKey, fmStats] of Object.entries(smithmagic)) {
        if (!fmStats || typeof fmStats !== "object") continue;
        
        const resolvedSlot = slotMapping[slotKey] || slotKey;
        const item = items?.[slotKey];
        if (!item) continue;
        
        for (const [statKey, val] of Object.entries(fmStats as Record<string, any>)) {
            const numVal = Number(val);
            if (!numVal || numVal === 0) continue;
            
            entries.push({
                stat: statLabelMapping[statKey] || statKey,
                value: numVal,
                slotKey: resolvedSlot,
                itemName: item.name || "Équipement",
                itemImage: item.picture ? `https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp` : ""
            });
        }
    }
    
    return entries;
};

const getIconId = (id: number) => id === 19 ? 20 : id;

/** Convertit un `DofusbookPreviewData` en stats exploitables par `computeSpellDamage`. */
function spellsBuild(data: DofusbookPreviewData): BuildStatsForSpells {
    return {
        elements: {
            fo: data.elements?.fo ?? 0,
            in: data.elements?.in ?? 0,
            ch: data.elements?.ch ?? 0,
            ag: data.elements?.ag ?? 0,
            sa: data.elements?.sa ?? 0,
            pu: data.elements?.pu ?? 0,
        },
        damages: {
            neutre: data.damages?.neutre ?? 0,
            terre: data.damages?.terre ?? 0,
            feu: data.damages?.feu ?? 0,
            eau: data.damages?.eau ?? 0,
            air: data.damages?.air ?? 0,
            general: data.damages?.general ?? 0,
            critique: data.damages?.critique ?? 0,
            poussee: data.damages?.poussee ?? 0,
            armes: data.damages?.armes ?? 0,
            sorts: data.damages?.sorts ?? 0,
            melee: data.damages?.melee ?? 0,
            distance: data.damages?.distance ?? 0,
        },
    };
}

const SLOT_LABELS: Record<string, string> = {
    am: "Amulette", ca: "Cape", ch: "Coiffe", ce: "Ceinture", bo: "Bottes",
    a1: "Anneau 1", a2: "Anneau 2", ar: "Arme", fa: "Familier", mo: "Monture",
    br: "Bouclier", d1: "Dofus 1", d2: "Dofus 2", d3: "Dofus 3", d4: "Dofus 4", d5: "Dofus 5", d6: "Dofus 6",
};

/** Grille d'équipement détaillée pour l'onglet « Équipement ». */
function EquipmentGrid({ items }: { items?: Record<string, DofusbookItem | null> }) {
    if (!items || Object.keys(items).length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface rounded-[2.5rem] border border-border text-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
                    <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="max-w-xs">
                    <h4 className="text-lg font-black text-foreground uppercase mb-2">Aucun équipement</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Les données d'équipement n'ont pas encore été chargées pour ce build.
                    </p>
                </div>
            </div>
        );
    }

    const entries = Object.entries(items).filter(([, it]) => !!it) as [string, DofusbookItem][];
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {entries.map(([slot, item]) => (
                <a
                    key={slot}
                    href={`https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-surface/40 backdrop-blur-md p-3 rounded-2xl border border-border hover:border-success/40 hover:bg-elevated/50 transition-all group"
                >
                    <div className="w-12 h-12 bg-elevated border border-border rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                        <NextImage
                            src={`https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`}
                            alt={item.name}
                            width={44}
                            height={44}
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{SLOT_LABELS[slot] || slot}</p>
                        <p className="text-label font-bold text-foreground truncate group-hover:text-success transition-colors">{item.name}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-success transition-colors shrink-0" />
                </a>
            ))}
        </div>
    );
}

/** Composant Slot d'équipement interactif */
function GearSlotItem({ slot, item, label }: { slot: string; item: DofusbookItem | null | undefined; label: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <a
                    href={item ? `https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}` : "#"}
                    target={item ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={cn(
                        "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center p-1.5 relative transition-all duration-200 group/slot",
                        item
                            ? "bg-surface/90 border border-border/80 shadow-lg hover:border-success/50 hover:bg-elevated hover:scale-105"
                            : "bg-surface/30 border border-border/30 opacity-30 cursor-default"
                    )}
                    onClick={(e) => !item && e.preventDefault()}
                >
                    {item ? (
                        <NextImage
                            src={`https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`}
                            alt={item.name}
                            width={48}
                            height={48}
                            className="object-contain drop-shadow-md"
                            unoptimized
                        />
                    ) : (
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-50">
                            {slot}
                        </span>
                    )}
                </a>
            </TooltipTrigger>
            {item && (
                <TooltipContent className="bg-background border border-border text-foreground p-2.5 rounded-xl shadow-2xl max-w-[220px] text-center" side="top">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
                    <p className="font-black text-body-sm text-foreground">{item.name}</p>
                    <span className="text-[10px] text-success font-semibold block mt-1">→ Ouvrir sur DofusDB</span>
                </TooltipContent>
            )}
        </Tooltip>
    );
}

export const DofusbookPreview = memo(function DofusbookPreview({ url, title, className, tags = [], classId, initialData }: DofusbookPreviewProps) {
    const [data, setData] = useState<DofusbookPreviewData | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [lastRefresh, setLastRefresh] = useState(0);
    const [activeTab, setActiveTab] = useState<"build" | "sorts" | "equipement">("build");

    const idMatch = url.match(/(?:equipement\/(?:[a-z]+\/)?([\d]+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
    const buildId = idMatch ? (idMatch[1] || idMatch[2]) : null;

    const fetchBuild = async (force: boolean = false) => {
        if (!buildId) return;

        if (force) {
            const now = Date.now();
            const cooldown = 30000; // 30s
            if (now - lastRefresh < cooldown) {
                const remaining = Math.ceil((cooldown - (now - lastRefresh)) / 1000);
                toast.error(`Veuillez attendre ${remaining}s avant de rafraîchir à nouveau`);
                return;
            }
            setLastRefresh(now);
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/dofusbook/proxy/${buildId}`, {
                headers: force ? { "Cache-Control": "no-cache" } : {}
            });
            
            if (response.headers.get("X-Throttled") === "true") {
                toast.info("Données déjà à jour (cache récent)");
            }

            if (response.ok) {
                const raw = await response.json();
                if (raw) {
                    setData(processDofusbookRawData(buildId, raw));
                    if (force && response.headers.get("X-Throttled") !== "true") {
                        toast.success("Données actualisées");
                    }
                }
            } else if (force) {
                toast.error(`Erreur ${response.status} lors de l'actualisation`);
            }
        } catch (err) {
            if (force) toast.error("Erreur réseau");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialData || !buildId) { setLoading(false); return; }
        fetchBuild(false);
    }, [buildId, initialData]);

    const hasData = !!data;

    const { guessedClassId, glowColor } = useMemo(() => {
        const searchString = `${title} ${url.split('/').pop()} ${tags.join(' ')}`.toLowerCase();
        const classesMap: Record<string, number> = {
            "feca": 1, "osamodas": 2, "osa": 2, "enutrof": 3, "enu": 3, "sram": 4, "xelor": 5, "xel": 5,
            "ecaflip": 6, "eca": 6, "eniripsa": 7, "eni": 7, "iop": 8, "cra": 9, "sadida": 10, "sadi": 10,
            "sacrieur": 11, "sacri": 11, "pandawa": 12, "panda": 12, "roublard": 13, "roub": 13,
            "zobal": 14, "steamer": 15, "steam": 15, "eliotrope": 16, "elio": 16,
            "huppermage": 17, "hupper": 17, "ouginak": 18, "ougi": 18, "forgelance": 19, "forg": 19
        };

        let gId = classId || data?.classId || 0;
        if (!gId) {
            for (const [key, id] of Object.entries(classesMap)) {
                if (searchString.includes(key)) {
                    gId = id;
                    break;
                }
            }
        }

        const tagColors: Record<string, string> = {
            "feu": "#ef4444", "eau": "#3b82f6", "terre": "#16a34a", "air": "#34d399", "multi": "#d946ef"
        };
        const firstElementTag = tags.find(t => tagColors[t]);
        const gColor = firstElementTag ? tagColors[firstElementTag] : "#10b981";

        return { guessedClassId: gId, glowColor: gColor };
    }, [title, url, tags, classId, data?.classId]);

    const resolvedClassName = data?.className && data.className !== "Inconnu"
        ? data.className
        : (getClassName(guessedClassId) || "Classe inconnue");

    const classArtColor = useMemo(() => {
        const name = resolvedClassName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return getClassColor(name);
    }, [resolvedClassName]);

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center bg-surface/50 rounded-[2.5rem] border border-border min-h-[300px]", className)}>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const cardContent = (
        <div className={cn("group w-full max-w-[320px] mx-auto relative overflow-hidden bg-background/80 backdrop-blur-2xl border border-border rounded-[2.5rem] p-5 sm:p-6 transition-all hover:border-success/50 cursor-pointer shadow-lg", className)}>
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-300" style={{ backgroundColor: `${glowColor}33` }} />

            <div className="flex flex-col gap-4 relative z-10 h-full">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 shrink-0 bg-surface rounded-2xl border border-border flex items-center justify-center overflow-hidden shadow-sm">
                        <div
                            className="absolute inset-0 opacity-20 blur-md"
                            style={{ backgroundColor: classArtColor }}
                        />
                        {(data?.classId || guessedClassId) > 0 ? (
                            <NextImage
                                src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                alt={data?.className || "Class"}
                                width={38}
                                height={38}
                                className="object-contain p-0.5 relative z-10"
                            />
                        ) : (
                            <Users className="w-5 h-5 text-muted-foreground relative z-10" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-body-sm text-foreground truncate uppercase tracking-tight leading-tight" title={title || data?.name}>{title || data?.name || "Build Dofusbook"}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded-md bg-elevated border border-border text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                                Lvl {data?.level || "???"}
                            </span>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">{resolvedClassName}</p>
                        </div>
                    </div>
                </div>

                {/* Mini Equipment Grid Preview avec icône rehaussée sur piédestal */}
                <div className="relative aspect-square w-full bg-surface/90 p-2.5 rounded-[2.2rem] border border-border flex items-center justify-center shadow-md">
                    <div className="absolute inset-0 overflow-hidden rounded-[2.2rem] flex items-center justify-center pointer-events-none z-0">
                        {(data?.classId || guessedClassId) > 0 && (
                            <div className="absolute w-28 h-28 rounded-full blur-[40px] opacity-25" style={{ backgroundColor: classArtColor }} />
                        )}
                    </div>

                    <TooltipProvider>
                        {hasData && data ? (
                            <div className="grid grid-cols-6 grid-rows-5 gap-1.5 relative z-10 w-full h-full p-1">
                                {/* Icône de classe centrale rehaussée sur piédestal (comme Duffus) */}
                                {(data?.classId || guessedClassId) > 0 && (
                                    <div className="absolute top-1 inset-x-0 bottom-11 flex items-center justify-center pointer-events-none z-0">
                                        <div className="w-20 h-20 rounded-full bg-elevated/40 border border-border/50 flex items-center justify-center relative shadow-inner">
                                            <NextImage
                                                src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                                alt={data?.className || "Class"}
                                                width={58}
                                                height={58}
                                                className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.25)] opacity-90 group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </div>
                                    </div>
                                )}
                                {[
                                    { s: 'ch', c: 1, r: 1 }, { s: 'ca', c: 1, r: 2 }, { s: 'ce', c: 1, r: 3 }, { s: 'bo', c: 1, r: 4 },
                                    { s: 'am', c: 6, r: 1 }, { s: 'a1', c: 6, r: 2 }, { s: 'a2', c: 6, r: 3 }, { s: 'br', c: 6, r: 4 },
                                    { s: 'ar', c: 3, r: 4 }, { s: 'fa', c: 4, r: 4 },
                                    { s: 'd1', c: 1, r: 5 }, { s: 'd2', c: 2, r: 5 }, { s: 'd3', c: 3, r: 5 },
                                    { s: 'd4', c: 4, r: 5 }, { s: 'd5', c: 5, r: 5 }, { s: 'd6', c: 6, r: 5 },
                                ].map((slot) => {
                                    const item = slot.s === 'fa' ? (data.items?.['fa'] || data.items?.['mo']) : data.items?.[slot.s];
                                    return (
                                        <Tooltip key={slot.s}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        "w-[33px] h-[33px] rounded-lg flex items-center justify-center p-1 relative group/mini-slot",
                                                        item ? "bg-elevated border border-border hover:bg-muted hover:border-success/30 transition-colors cursor-pointer" : "bg-surface border border-border opacity-40"
                                                    )}
                                                    style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                                >
                                                    {item && (
                                                        <NextImage
                                                            src={`https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`}
                                                            alt={item.name}
                                                            width={30}
                                                            height={30}
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            {item && (
                                                <TooltipContent className="bg-background border-border text-foreground p-2 rounded-xl text-caption font-bold shadow-2xl max-w-[200px]">
                                                    {item.name}
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <ExternalLink className="w-5 h-5 text-muted-foreground opacity-60" />
                            </div>
                        )}
                    </TooltipProvider>
                </div>

                {/* Bandeau Stats Clés (⭐ PA · 🛹 PM · 👁️ PO) sous la grille */}
                {hasData && data && (
                    <div className="flex items-center justify-center gap-2.5 py-1 px-3 bg-surface/70 border border-border rounded-xl text-caption font-black tabular-nums shadow-sm">
                        <span className="flex items-center gap-1 text-[#008cfc]">
                            <span className="text-xs">⭐</span> {data.stats?.pa ?? 0}
                        </span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="flex items-center gap-1 text-[#2cb14b]">
                            <span className="text-xs">🛹</span> {data.stats?.pm ?? 0}
                        </span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="flex items-center gap-1 text-[#389f81]">
                            <span className="text-xs">👁️</span> {data.stats?.po ?? 0}
                        </span>
                        {(data.stats?.cc ?? 0) > 0 && (
                            <>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="flex items-center gap-1 text-[#f24254]">
                                    <span className="text-xs">🎯</span> {data.stats?.cc}%
                                </span>
                            </>
                        )}
                    </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 4).map(tagId => {
                            const tagDef = DO_TAGS.find(t => t.id === tagId);
                            return tagDef ? (
                                <span key={tagId} className={cn("px-1.5 py-0.5 text-caption rounded font-black uppercase tracking-tighter", tagDef.className)}>
                                    {tagDef.label}
                                </span>
                            ) : null;
                        })}
                        {tags.length > 4 && (
                            <span className="px-1.5 py-0.5 text-caption rounded font-black uppercase tracking-tighter bg-surface text-muted-foreground border border-border">
                                +{tags.length - 4}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Dialog>
            <DialogTrigger asChild>
                {cardContent}
            </DialogTrigger>
            <DialogContent className="max-w-[1600px] w-[96vw] max-h-[96vh] bg-background/95 backdrop-blur-2xl border-border p-0 overflow-y-auto custom-scrollbar rounded-[2rem] md:rounded-[2.5rem] shadow-2xl">
                <TooltipProvider>
                    <div className="relative p-5 sm:p-6 lg:p-8 flex flex-col gap-6">
                        {/* Background Class Ambient Glow */}
                        <div
                            className="absolute inset-x-0 top-0 h-[400px] opacity-15 blur-[120px] pointer-events-none transition-all duration-300"
                            style={{ backgroundColor: classArtColor }}
                        />

                        {/* Navigation des Onglets : Build / Sorts / Équipement */}
                        <div className="relative z-10 w-full flex items-center justify-between gap-3 bg-surface/60 backdrop-blur-md p-1.5 rounded-2xl border border-border">
                            <div className="flex items-center gap-1.5 flex-1 max-w-xl">
                                {([
                                    { id: "build", label: "Build", icon: "⚔️" },
                                    { id: "sorts", label: "Sorts", icon: "✨" },
                                    { id: "equipement", label: "Équipement", icon: "🎒" },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-label font-bold uppercase tracking-wider transition-all cursor-pointer",
                                            activeTab === tab.id
                                                ? "bg-elevated text-foreground border border-border shadow-sm font-black"
                                                : "text-muted-foreground hover:text-foreground hover:bg-elevated/40"
                                        )}
                                    >
                                        <span className="text-base leading-none">{tab.icon}</span>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        fetchBuild(true);
                                    }}
                                    disabled={loading}
                                    className="bg-surface/80 border-border hover:bg-elevated text-muted-foreground hover:text-foreground rounded-xl h-9 px-3 text-caption font-bold"
                                >
                                    <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
                                    Actualiser
                                </Button>
                            </div>
                        </div>

                        {/* Contenu de l'onglet actif */}
                        <div className="relative z-10 w-full">
                            {activeTab === "build" && data ? (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    
                                    {/* ─── COLONNE GAUCHE (4 cols) : Caractéristiques & Éléments & Résistances ─── */}
                                    <div className="lg:col-span-4 flex flex-col gap-4">
                                        
                                        {/* 1. Éléments Primaires (Badges stylisés à la Dofus / Duffus) */}
                                        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-2">
                                            {[
                                                { label: "Vitalité", val: data.stats?.vit ?? 0, icon: "❤️", color: "text-[#ff4d4d]", bg: "bg-[#ff4d4d]/10", border: "border-[#ff4d4d]/20" },
                                                { label: "Sagesse", val: data.elements?.sa ?? 0, icon: "🔮", color: "text-[#c084fc]", bg: "bg-[#c084fc]/10", border: "border-[#c084fc]/20" },
                                                { label: "Force", val: data.elements?.fo ?? 0, icon: "🪨", color: "text-[#9D753E]", bg: "bg-[#9D753E]/10", border: "border-[#9D753E]/20" },
                                                { label: "Intelligence", val: data.elements?.in ?? 0, icon: "🔥", color: "text-[#E33E19]", bg: "bg-[#E33E19]/10", border: "border-[#E33E19]/20" },
                                                { label: "Chance", val: data.elements?.ch ?? 0, icon: "💧", color: "text-[#5AC2FF]", bg: "bg-[#5AC2FF]/10", border: "border-[#5AC2FF]/20" },
                                                { label: "Agilité", val: data.elements?.ag ?? 0, icon: "🍃", color: "text-[#88C72B]", bg: "bg-[#88C72B]/10", border: "border-[#88C72B]/20" },
                                            ].map((el) => (
                                                <div key={el.label} className={cn("flex flex-col p-2.5 rounded-2xl border backdrop-blur-md", el.bg, el.border)}>
                                                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        <span>{el.label}</span>
                                                        <span>{el.icon}</span>
                                                    </div>
                                                    <span className={cn("text-lg font-black tabular-nums mt-0.5", el.color)}>
                                                        {el.val}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* 2. Tableau des Caractéristiques de Combat */}
                                        <div className="bg-surface/40 backdrop-blur-md p-4 sm:p-5 rounded-[2rem] border border-border flex flex-col gap-3">
                                            <div className="flex items-center justify-between border-b border-border pb-2">
                                                <h4 className="text-caption font-black text-foreground/80 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Move className="w-3.5 h-3.5 text-success" /> Statistiques Générales
                                                </h4>
                                                <span className="text-caption font-bold text-muted-foreground">
                                                    Puissance <strong className="text-foreground font-black tabular-nums">+{data.elements?.pu ?? 0}</strong>
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
                                                {[
                                                    { label: "Points d'Action (PA)", val: data.stats?.pa ?? 0, icon: "⭐", color: "text-[#008cfc]" },
                                                    { label: "Points de Mouvement", val: data.stats?.pm ?? 0, icon: "🛹", color: "text-[#2cb14b]" },
                                                    { label: "Portée (PO)", val: data.stats?.po ?? 0, icon: "👁️", color: "text-[#389f81]" },
                                                    { label: "% Coup Critique", val: `${data.stats?.cc ?? 0}%`, icon: "🎯", color: "text-[#f24254]" },
                                                    { label: "Invocations", val: data.stats?.invo ?? 0, icon: "🦊", color: "text-[#f59f0f]" },
                                                    { label: "Soins", val: data.stats?.so ?? 0, icon: "➕", color: "text-[#ef3f3f]" },
                                                    { label: "Initiative", val: data.stats?.ini ?? 0, icon: "⚡", color: "text-foreground" },
                                                    { label: "Prospection", val: data.stats?.pp ?? 0, icon: "🔎", color: "text-[#5AC2FF]" },
                                                    { label: "Fuite", val: data.stats?.fuite ?? 0, icon: "💨", color: "text-[#5AC2FF]" },
                                                    { label: "Tacle", val: data.stats?.tacle ?? 0, icon: "🛡️", color: "text-success" },
                                                    { label: "Retrait PA / PM", val: `${data.stats?.retpa ?? 0} / ${data.stats?.retpm ?? 0}`, icon: "⌛", color: "text-warning" },
                                                    { label: "Do Critique", val: data.damages?.critique ?? 0, icon: "💥", color: "text-[#f24254]" },
                                                ].map((s) => (
                                                    <div key={s.label} className="flex items-center justify-between py-1 border-b border-border/40 hover:border-border transition-colors">
                                                        <span className="text-muted-foreground truncate">{s.label}</span>
                                                        <span className={cn("font-black tabular-nums whitespace-nowrap ml-2", s.color)}>{s.val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 3. Dommages Fixes & % Dommages */}
                                        <div className="bg-surface/40 backdrop-blur-md p-4 sm:p-5 rounded-[2rem] border border-border flex flex-col gap-3">
                                            <h4 className="text-caption font-black text-foreground/80 uppercase tracking-widest flex items-center gap-1.5 border-b border-border pb-2">
                                                <Zap className="w-3.5 h-3.5 text-warning" /> Dommages Fixes & %
                                            </h4>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                                                {[
                                                    { label: "Do Terre", val: data.damages?.terre ?? 0, color: "text-[#9D753E]" },
                                                    { label: "Do Feu", val: data.damages?.feu ?? 0, color: "text-[#E33E19]" },
                                                    { label: "Do Eau", val: data.damages?.eau ?? 0, color: "text-[#5AC2FF]" },
                                                    { label: "Do Air", val: data.damages?.air ?? 0, color: "text-[#88C72B]" },
                                                    { label: "Do Neutre", val: data.damages?.neutre ?? 0, color: "text-[#E2E2E2]" },
                                                    { label: "Do Généraux", val: data.damages?.general ?? 0, color: "text-foreground" },
                                                ].map((d) => (
                                                    <div key={d.label} className="flex items-center justify-between py-0.5 border-b border-border/40">
                                                        <span className="text-muted-foreground font-medium">{d.label}</span>
                                                        <span className={cn("font-black tabular-nums", d.color)}>+{d.val}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                                                {[
                                                    { label: "% Do Sorts", val: data.damages?.sorts ?? 0 },
                                                    { label: "% Do Mêlée", val: data.damages?.melee ?? 0 },
                                                    { label: "% Do Dist.", val: data.damages?.distance ?? 0 },
                                                    { label: "% Do Armes", val: data.damages?.armes ?? 0 },
                                                ].map((p) => (
                                                    <div key={p.label} className="flex flex-col items-center bg-surface/60 px-2 py-1.5 rounded-xl border border-border">
                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">{p.label}</span>
                                                        <span className="font-black text-foreground text-caption tabular-nums">+{p.val}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 4. Résistances élémentaires */}
                                        <div className="bg-surface/40 backdrop-blur-md p-3.5 rounded-2xl border border-border flex items-center justify-between gap-1.5">
                                            {[
                                                { label: "Neutre", val: data.resists?.neutre ?? 0, color: "text-[#E2E2E2]", bg: "bg-[#E2E2E2]/15" },
                                                { label: "Terre", val: data.resists?.terre ?? 0, color: "text-[#9D753E]", bg: "bg-[#9D753E]/15" },
                                                { label: "Feu", val: data.resists?.feu ?? 0, color: "text-[#E33E19]", bg: "bg-[#E33E19]/15" },
                                                { label: "Eau", val: data.resists?.eau ?? 0, color: "text-[#5AC2FF]", bg: "bg-[#5AC2FF]/15" },
                                                { label: "Air", val: data.resists?.air ?? 0, color: "text-[#88C72B]", bg: "bg-[#88C72B]/15" },
                                            ].map((r) => (
                                                <div key={r.label} className={cn("flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl border border-border/60", r.bg)}>
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase">{r.label}</span>
                                                    <span className={cn("font-black text-caption tabular-nums mt-0.5", r.color)}>
                                                        {r.val}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                    </div>

                                    {/* ─── COLONNE CENTRALE (4 cols) : Personnage, Slots Symétriques & Vitals ─── */}
                                    <div className="lg:col-span-4 flex flex-col items-center justify-center gap-4 bg-surface/30 backdrop-blur-md p-6 rounded-[2.5rem] border border-border shadow-xl relative overflow-hidden">
                                        
                                        {/* Podium Glow Background */}
                                        <div
                                            className="absolute w-72 h-72 rounded-full blur-[90px] opacity-25 pointer-events-none"
                                            style={{ backgroundColor: classArtColor }}
                                        />

                                        {/* Titre & Classe Centrés */}
                                        <div className="text-center z-10">
                                            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-surface border border-border text-caption font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                                <span>{resolvedClassName}</span>
                                                <span>•</span>
                                                <span className="text-foreground font-black">Niv. {data.level}</span>
                                            </div>
                                            <h3 className="text-2xl font-black text-foreground uppercase tracking-tight line-clamp-1">
                                                {title || data.name}
                                            </h3>
                                        </div>

                                        {/* Grille Symétrique Équipement & Personnage (Style Duffus / DofusDB) */}
                                        <div className="relative w-full max-w-[340px] aspect-[4/3.8] flex items-center justify-center my-2 z-10">
                                            
                                            {/* Illustration centrale de la classe */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                                <div className="w-36 h-36 rounded-full bg-elevated/40 border border-border/50 flex items-center justify-center shadow-inner relative">
                                                    {(data?.classId || guessedClassId) > 0 && (
                                                        <NextImage
                                                            src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                                            alt={data?.className || "Class"}
                                                            width={90}
                                                            height={90}
                                                            className="object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] opacity-80"
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Disposition des 8 slots principaux autour du personnage */}
                                            <div className="w-full h-full flex justify-between items-center relative z-10 px-2">
                                                {/* Colonne Gauche (4 slots) */}
                                                <div className="flex flex-col gap-2.5">
                                                    <GearSlotItem slot="ch" item={data.items?.['ch']} label="Coiffe" />
                                                    <GearSlotItem slot="ca" item={data.items?.['ca']} label="Cape" />
                                                    <GearSlotItem slot="ce" item={data.items?.['ce']} label="Ceinture" />
                                                    <GearSlotItem slot="bo" item={data.items?.['bo']} label="Bottes" />
                                                </div>

                                                {/* Colonne Droite (4 slots) */}
                                                <div className="flex flex-col gap-2.5">
                                                    <GearSlotItem slot="am" item={data.items?.['am']} label="Amulette" />
                                                    <GearSlotItem slot="a1" item={data.items?.['a1']} label="Anneau 1" />
                                                    <GearSlotItem slot="a2" item={data.items?.['a2']} label="Anneau 2" />
                                                    <GearSlotItem slot="br" item={data.items?.['br']} label="Bouclier" />
                                                </div>
                                            </div>

                                            {/* Slots Arme & Familier (Au centre, sous le personnage) */}
                                            <div className="absolute bottom-1 flex items-center gap-3 z-10">
                                                <GearSlotItem slot="ar" item={data.items?.['ar']} label="Arme" />
                                                <GearSlotItem slot="fa" item={data.items?.['fa'] || data.items?.['mo']} label="Familier / Monture" />
                                            </div>
                                        </div>

                                        {/* Bandeau Vitals Proéminent (❤️ PdV · ⭐ PA · 🛹 PM · 👁️ PO · 🎯 Crit) */}
                                        <div className="flex flex-wrap items-center justify-center gap-2 bg-surface/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-border shadow-lg z-10">
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated rounded-xl">
                                                <span className="text-sm">❤️</span>
                                                <span className="font-black text-body-sm text-foreground tabular-nums">{data.stats?.vit ?? 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#008cfc]/10 border border-[#008cfc]/20 rounded-xl">
                                                <span className="text-sm">⭐</span>
                                                <span className="font-black text-body-sm text-[#008cfc] tabular-nums">{data.stats?.pa ?? 0} PA</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2cb14b]/10 border border-[#2cb14b]/20 rounded-xl">
                                                <span className="text-sm">🛹</span>
                                                <span className="font-black text-body-sm text-[#2cb14b] tabular-nums">{data.stats?.pm ?? 0} PM</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#389f81]/10 border border-[#389f81]/20 rounded-xl">
                                                <span className="text-sm">👁️</span>
                                                <span className="font-black text-body-sm text-[#389f81] tabular-nums">{data.stats?.po ?? 0} PO</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f24254]/10 border border-[#f24254]/20 rounded-xl">
                                                <span className="text-sm">🎯</span>
                                                <span className="font-black text-body-sm text-[#f24254] tabular-nums">{data.stats?.cc ?? 0}%</span>
                                            </div>
                                        </div>

                                        {/* Rangée des 6 Dofus / Trophées */}
                                        <div className="w-full flex items-center justify-center gap-2 pt-2 border-t border-border/50 z-10">
                                            {['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((slot, idx) => (
                                                <GearSlotItem
                                                    key={slot}
                                                    slot={slot}
                                                    item={data.items?.[slot]}
                                                    label={`Dofus / Trophée ${idx + 1}`}
                                                />
                                            ))}
                                        </div>

                                    </div>

                                    {/* ─── COLONNE DROITE (4 cols) : Panoplies, Forgemagie & Actions ─── */}
                                    <div className="lg:col-span-4 flex flex-col gap-4">
                                        
                                        {/* 1. Carte Panoplies & Bonus de sets */}
                                        <div className="bg-surface/40 backdrop-blur-md p-5 rounded-[2rem] border border-border flex flex-col gap-3 shadow-lg">
                                            <h4 className="text-caption font-black text-foreground/80 uppercase tracking-widest flex items-center gap-1.5 border-b border-border pb-2">
                                                <Shield className="w-3.5 h-3.5 text-success" /> Bonus de Panoplie(s)
                                            </h4>

                                            {data.cloths && data.cloths.length > 0 ? (
                                                <div className="flex flex-col gap-3.5">
                                                    {data.cloths.map((cloth, idx) => (
                                                        <div key={idx} className="flex flex-col gap-2 p-3 bg-surface/60 rounded-2xl border border-border">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-label font-bold text-foreground truncate">{cloth.name}</span>
                                                                <span className="px-2 py-0.5 rounded-md bg-elevated text-caption font-black text-success tabular-nums">
                                                                    {cloth.count}/{cloth.total}
                                                                </span>
                                                            </div>

                                                            {/* Miniatures des items portés */}
                                                            {cloth.clothItems && cloth.clothItems.length > 0 && (
                                                                <div className="flex items-center gap-1.5">
                                                                    {cloth.clothItems.map((item) => (
                                                                        <div key={item.id} className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center overflow-hidden" title={item.name}>
                                                                            <NextImage
                                                                                src={`https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`}
                                                                                alt={item.name}
                                                                                width={28}
                                                                                height={28}
                                                                                className="object-contain"
                                                                                unoptimized
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Liste des stats conférées par la panoplie */}
                                                            {cloth.bonuses && Object.keys(cloth.bonuses).length > 0 && (
                                                                <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                                                                    {Object.entries(cloth.bonuses).map(([stat, val]) => (
                                                                        <span key={stat} className="px-2 py-0.5 bg-background/60 rounded-md text-[11px] font-bold text-success/90 tabular-nums">
                                                                            {val > 0 ? `+${val}` : val} {statLabelMapping[stat] || stat}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-caption text-muted-foreground italic py-3 text-center">
                                                    Aucun bonus de panoplie actif.
                                                </p>
                                            )}
                                        </div>

                                        {/* 2. Carte Forgemagie (Exo / Over) */}
                                        <div className="bg-surface/40 backdrop-blur-md p-5 rounded-[2rem] border border-border flex flex-col gap-3 shadow-lg">
                                            <h4 className="text-caption font-black text-foreground/80 uppercase tracking-widest flex items-center gap-1.5 border-b border-border pb-2">
                                                <Sparkles className="w-3.5 h-3.5 text-warning" /> Forgemagie (Exo / Over)
                                            </h4>

                                            {(() => {
                                                const fmEntries = parseDofusbookSmithmagic(data.smithmagic, data.items);
                                                if (fmEntries.length === 0) {
                                                    return (
                                                        <p className="text-caption text-muted-foreground italic py-2 text-center">
                                                            Aucune forgemagie (Exo/Over) détectée.
                                                        </p>
                                                    );
                                                }

                                                return (
                                                    <div className="flex flex-col gap-2">
                                                        {fmEntries.map((fm, idx) => {
                                                            const isExo = ["PA", "PM", "PO"].includes(fm.stat);
                                                            return (
                                                                <div key={idx} className={cn(
                                                                    "flex items-center gap-2.5 p-2 rounded-xl border transition-all",
                                                                    isExo ? "bg-warning/10 border-warning/30" : "bg-surface/60 border-border"
                                                                )}>
                                                                    {fm.itemImage && (
                                                                        <div className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                                                                            <NextImage
                                                                                src={fm.itemImage}
                                                                                alt={fm.itemName}
                                                                                width={24}
                                                                                height={24}
                                                                                className="object-contain"
                                                                                unoptimized
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-caption font-bold text-foreground truncate">{fm.itemName}</p>
                                                                        <p className="text-[10px] text-muted-foreground uppercase">{fm.slotKey}</p>
                                                                    </div>
                                                                    <span className={cn("px-2 py-0.5 text-caption rounded-md font-black tabular-nums shrink-0", isExo ? "text-warning bg-warning/20" : "text-success bg-success/15")}>
                                                                        {fm.value > 0 ? `+${fm.value}` : fm.value} {fm.stat}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* 3. Boutons d'Action */}
                                        <div className="flex flex-col gap-2 pt-1">
                                            <Button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Lien copié !");
                                                }}
                                                className="w-full h-11 rounded-xl text-label font-bold gap-2 flex items-center justify-center shadow-md cursor-pointer"
                                            >
                                                <Copy className="w-4 h-4" /> Copier le lien du build
                                            </Button>
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full h-11 bg-surface/80 text-foreground hover:bg-elevated rounded-xl text-center text-label font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-border shadow-sm"
                                            >
                                                Ouvrir sur Dofusbook <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                            </a>
                                        </div>

                                    </div>

                                </div>
                            ) : activeTab === "sorts" ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-border pb-4">
                                        <div>
                                            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Sorts de classe & Variantes</h3>
                                            <p className="text-caption text-muted-foreground">
                                                Dégâts réels calculés selon les statistiques élémentaires, la puissance et les dommages fixes du stuff.
                                            </p>
                                        </div>
                                    </div>
                                    <DofusSpellsTab
                                        classId={data?.classId || guessedClassId}
                                        level={data?.level || 200}
                                        build={spellsBuild(data!)}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-border pb-4">
                                        <div>
                                            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Inventaire d'équipement</h3>
                                            <p className="text-caption text-muted-foreground">
                                                Détail de tous les équipements et liens directs vers l'encyclopédie DofusDB.
                                            </p>
                                        </div>
                                    </div>
                                    <EquipmentGrid items={data?.items} />
                                </div>
                            )}
                        </div>

                    </div>
                </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
});
