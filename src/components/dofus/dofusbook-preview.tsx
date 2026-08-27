"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { getClassName, processDofusbookRawData, type DofusbookPreviewData } from "@/lib/dofusbook-utils";
import { ExternalLink, Users, Loader2, Zap, Move, Eye, Heart, Shield, Sparkles, RefreshCw, Copy } from "lucide-react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { DO_TAGS } from "@/lib/dofus-tags";
import { getClassColor } from "@/components/shared/class-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { DofusbookItem } from "@/lib/dofusbook-utils";
import { toast } from "sonner";

// Mini-popover showing a panoplie's equipped items with DofusDB links
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

function ClothBadge({ cloth }: { cloth: ClothData }) {
    const hasItems = cloth.clothItems && cloth.clothItems.length > 0;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="px-3 py-2 bg-surface border border-border rounded-xl flex items-center gap-3 group/cloth hover:border-success/30 hover:bg-elevated/50 transition-all cursor-pointer text-left">
                    <span className="text-caption font-bold text-foreground group-hover/cloth:text-success transition-colors uppercase">{cloth.name}</span>
                    <div className="px-1.5 py-0.5 bg-muted/40 rounded text-caption font-black text-muted-foreground">
                        {cloth.count}<span className="text-muted-foreground">/{cloth.total}</span>
                    </div>
                </button>
            </PopoverTrigger>
            {hasItems && (
                <PopoverContent className="w-64 bg-background border-border rounded-2xl p-3 shadow-2xl" side="top" align="start">
                    <p className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-2">{cloth.name}</p>
                    
                    {cloth.bonuses && Object.keys(cloth.bonuses).length > 0 && (
                        <div className="mb-3 pb-3 border-b border-border">
                            <p className="text-caption font-bold text-success/80 mb-1.5 uppercase">Bonus de panoplie</p>
                            <div className="flex flex-col gap-0.5">
                                {Object.entries(cloth.bonuses).map(([stat, val]) => (
                                    <span key={stat} className="text-caption text-foreground font-medium">
                                        {val > 0 ? `+${val}` : val} {statLabelMapping[stat] || stat}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        {cloth.clothItems!.map(item => (
                            <a
                                key={item.id}
                                href={`https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-surface transition-colors group/item"
                            >
                                <div className="w-8 h-8 bg-surface rounded-lg border border-border flex-shrink-0 overflow-hidden">
                                    <NextImage
                                        src={`https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`}
                                        alt={item.name}
                                        width={32}
                                        height={32}
                                        className="object-contain w-full h-full"
                                        unoptimized
                                    />
                                </div>
                                <span className="text-caption font-semibold text-muted-foreground group-hover/item:text-foreground transition-colors truncate flex-1">{item.name}</span>
                                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover/item:text-success transition-colors flex-shrink-0" />
                            </a>
                        ))}
                    </div>
                </PopoverContent>
            )}
        </Popover>
    );
}

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
        "1": "coiffe",
        "2": "cape",
        "3": "amulette",
        "4": "anneau1",
        "5": "anneau2",
        "6": "ceinture",
        "7": "bottes",
        "8": "corps-a-corps",
        "9": "bouclier",
        "15": "familier"
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

export const DofusbookPreview = memo(function DofusbookPreview({ url, title, className, tags = [], classId, initialData }: DofusbookPreviewProps) {
    const [data, setData] = useState<DofusbookPreviewData | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [lastRefresh, setLastRefresh] = useState(0);

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

    // Never let a stale/missing Dofusbook className ("Inconnu") shadow a
    // resolvable classId (selected by the user or guessed from name/URL).
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
        <div className={cn("group w-full max-w-[320px] mx-auto relative overflow-hidden bg-background/80 backdrop-blur-2xl border border-border rounded-[2.5rem] p-5 sm:p-6 transition-all hover:border-success/50  cursor-pointer", className)}>
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-300" style={{ backgroundColor: `${glowColor}33` }} />

            <div className="flex flex-col gap-6 relative z-10 h-full">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 shrink-0 bg-surface rounded-2xl border border-border flex items-center justify-center overflow-hidden shadow-sm">
                        <div
                            className="absolute inset-0 opacity-20 blur-md"
                            style={{ backgroundColor: classArtColor }}
                        />
                        {(data?.classId || guessedClassId) > 0 ? (
                            <NextImage
                                src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                alt={data?.className || "Class"}
                                width={44}
                                height={44}
                                className="object-contain p-1 relative z-10"
                            />
                        ) : (
                            <Users className="w-6 h-6 text-muted-foreground relative z-10" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-body text-foreground truncate uppercase tracking-tight leading-tight" title={title || data?.name}>{title || data?.name || "Build Dofusbook"}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded-md bg-elevated border border-border text-caption font-black text-muted-foreground uppercase tracking-tighter">
                                Lvl {data?.level || "???"}
                            </span>
                            <p className="text-caption font-bold text-muted-foreground uppercase tracking-widest truncate">{resolvedClassName}</p>
                        </div>
                    </div>
                </div>

                {/* Equipment Grid or Fallback UI */}
                <div className="relative aspect-square w-full bg-surface/90 p-3 rounded-[2.5rem] border border-border flex items-center justify-center shadow-lg">
                    <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] flex items-center justify-center pointer-events-none z-0">
                        {(data?.classId || guessedClassId) > 0 && (
                            <div className="absolute w-24 h-24 rounded-full blur-[40px] opacity-25" style={{ backgroundColor: classArtColor }} />
                        )}
                    </div>

                    <TooltipProvider>
                        {hasData && data ? (
                            <div className="grid grid-cols-6 grid-rows-5 gap-1.5 relative z-10 w-full h-full p-1.5">
                                {(data?.classId || guessedClassId) > 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                        <NextImage
                                            src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                            alt={data?.className || "Class"}
                                            width={75}
                                            height={75}
                                            className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] opacity-85 group- transition-transform duration-300"
                                        />
                                    </div>
                                )}
                                {[
                                    { s: 'am', c: 1, r: 1 }, { s: 'a1', c: 1, r: 2 }, { s: 'a2', c: 1, r: 3 }, { s: 'br', c: 1, r: 4 },
                                    { s: 'ch', c: 6, r: 1 }, { s: 'ca', c: 6, r: 2 }, { s: 'ce', c: 6, r: 3 }, { s: 'bo', c: 6, r: 4 },
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
                                                        "w-[34px] h-[34px] rounded-lg flex items-center justify-center p-1 relative group/mini-slot",
                                                        item ? "bg-elevated border border-border hover:bg-muted hover:border-success/30 transition-colors cursor-pointer" : "bg-surface border border-border opacity-40"
                                                    )}
                                                    style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                                >
                                                    {item && (
                                                        <NextImage
                                                            src={`https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`}
                                                            alt={item.name}
                                                            width={32}
                                                            height={32}
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

                {/* Tags — limités à 4 pour ne pas surcharger la carte */}
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
            <DialogContent className="max-w-[1250px] w-[95vw] max-h-[95vh] bg-background border-border p-0 overflow-y-auto custom-scrollbar rounded-[2.5rem] md:rounded-[3.5rem] ">
                <TooltipProvider>
                    <div className="relative p-6 sm:p-8 lg:p-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
                        {/* Background Class Glow */}
                        <div
                            className="absolute inset-x-0 top-0 h-[450px] opacity-15 blur-[130px] pointer-events-none transition-all duration-300"
                            style={{ backgroundColor: classArtColor }}
                        />

                        {/* Left: Large Visual & Resists */}
                        <div className="w-full lg:w-[380px] flex flex-col gap-6 lg:gap-8 relative z-10">
                            <div className="relative aspect-square w-full rounded-[2.5rem] md:rounded-[3.5rem] bg-black/50 border border-border flex items-center justify-center p-4 sm:p-8 overflow-hidden shadow-inner">
                                {data && (data?.classId || guessedClassId) > 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                        <NextImage
                                            src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                            alt={data?.className || "Class"}
                                            width={100}
                                            height={100}
                                            className="object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] opacity-40 scale-110"
                                        />
                                    </div>
                                )}

                                {data ? (
                                    <div className="grid grid-cols-6 grid-rows-5 gap-2.5 sm:gap-4 relative z-10 w-full h-full">
                                        {[
                                            { s: 'am', c: 1, r: 1 }, { s: 'a1', c: 1, r: 2 }, { s: 'a2', c: 1, r: 3 }, { s: 'br', c: 1, r: 4 },
                                            { s: 'ch', c: 6, r: 1 }, { s: 'ca', c: 6, r: 2 }, { s: 'ce', c: 6, r: 3 }, { s: 'bo', c: 6, r: 4 },
                                            { s: 'ar', c: 3, r: 4 }, { s: 'fa', c: 4, r: 4 },
                                            { s: 'd1', c: 1, r: 5 }, { s: 'd2', c: 2, r: 5 }, { s: 'd3', c: 3, r: 5 },
                                            { s: 'd4', c: 4, r: 5 }, { s: 'd5', c: 5, r: 5 }, { s: 'd6', c: 6, r: 5 },
                                        ].map((slot) => {
                                            const item = slot.s === 'fa' ? (data.items?.['fa'] || data.items?.['mo']) : data.items?.[slot.s];
                                            return (
                                                <Tooltip key={slot.s}>
                                                    <TooltipTrigger asChild>
                                                        <a
                                                            href={item ? `https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}` : "#"}
                                                            target={item ? "_blank" : undefined}
                                                            rel="noopener noreferrer"
                                                            className={cn(
                                                                "w-[42px] h-[42px] sm:w-[54px] sm:h-[54px] rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 sm:p-2.5 relative transition-all duration-300 group/modal-slot",
                                                                item ? "bg-surface/90 border border-border shadow-2xl hover:border-success/50 hover:bg-elevated " : "bg-surface border border-border opacity-20 cursor-default"
                                                            )}
                                                            style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                                            onClick={(e) => !item && e.preventDefault()}
                                                        >
                                                            {item && (
                                                                <NextImage
                                                                    src={`https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`}
                                                                    alt={item.name}
                                                                    width={48}
                                                                    height={48}
                                                                    className="object-contain drop-shadow-xl"
                                                                    unoptimized
                                                                />
                                                            )}
                                                        </a>
                                                    </TooltipTrigger>
                                                    {item && (
                                                        <TooltipContent className="bg-background border border-border text-foreground p-3 rounded-xl shadow-2xl max-w-[240px] text-center" side="top">
                                                            <p className="font-bold text-xs">{item.name}</p>
                                                            <span className="text-caption text-success font-semibold block mt-1">→ Ouvrir dans DofusDB</span>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center p-8">
                                        {guessedClassId > 0 && (
                                            <NextImage
                                                src={`/assets/dofus/classes/${getIconId(guessedClassId)}.png`}
                                                alt="Classe"
                                                fill
                                                className="object-contain opacity-25 p-12"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {data && (
                                <div className="flex flex-col gap-2.5 bg-surface/40 backdrop-blur-md p-6 rounded-[2rem] border border-border shadow-xl">
                                    <h4 className="text-caption font-black text-foreground/40 uppercase tracking-wider mb-2 flex items-center gap-2"><Shield className="w-3.5 h-3.5"/> RÉSISTANCES</h4>
                                    {[
                                        { res: 'neutre', val: data.resists?.neutre ?? 0, label: 'Neutre', icon: (
                                            <svg viewBox="0 0 24 24" fill="none" className="w-[14px] h-[14px] drop-shadow-md">
                                                <circle cx="12" cy="12" r="11" fill="#E2E2E2" stroke="#000" strokeWidth="1" />
                                                <path d="M12 1A11 11 0 0 0 12 23A5.5 5.5 0 0 1 12 12A5.5 5.5 0 0 0 12 1Z" fill="#111" />
                                                <circle cx="12" cy="6.5" r="2" fill="#111" />
                                                <circle cx="12" cy="17.5" r="2" fill="#E2E2E2" />
                                            </svg>
                                        ), barColor: "bg-[#E2E2E2]" },
                                        { res: 'terre', val: data.resists?.terre ?? 0, label: 'Terre', icon: (
                                            <svg viewBox="0 0 24 24" fill="#9D753E" className="w-[14px] h-[14px] drop-shadow-md">
                                               <path d="M12 24L5 12H9V0H15V12H19L12 24Z" />
                                            </svg>
                                        ), barColor: "bg-[#9D753E]" },
                                        { res: 'feu', val: data.resists?.feu ?? 0, label: 'Feu', icon: (
                                            <svg viewBox="0 0 24 24" fill="#E33E19" className="w-[14px] h-[14px] drop-shadow-md">
                                               <path d="M12 0C12 0 3 8 3 15C3 20 7 24 12 24C17 24 21 20 21 15C21 8 12 0 12 0ZM12 20C10 20 8 18 8 16C8 14 12 10 12 10C12 10 16 14 16 16C16 18 14 20 12 20Z" />
                                            </svg>
                                        ), barColor: "bg-[#E33E19]" },
                                        { res: 'eau', val: data.resists?.eau ?? 0, label: 'Eau', icon: (
                                            <svg viewBox="0 0 24 24" fill="#5AC2FF" className="w-[14px] h-[14px] drop-shadow-md">
                                               <path d="M12 0C12 0 4 10 4 16C4 20.418 7.582 24 12 24C16.418 24 20 20.418 20 16C20 10 12 0 12 0Z" />
                                            </svg>
                                        ), barColor: "bg-[#5AC2FF]" },
                                        { res: 'air', val: data.resists?.air ?? 0, label: 'Air', icon: (
                                            <svg viewBox="0 0 24 24" fill="#88C72B" className="w-[14px] h-[14px] drop-shadow-md">
                                               <path d="M17 19C19.761 19 22 16.761 22 14C22 11.239 19.761 9 17 9C16.5 6 14 3 11 3C7 3 4 6 4 10C1.79 10 0 11.79 0 14C0 16.21 1.79 18 4 18H17Z" />
                                            </svg>
                                        ), barColor: "bg-[#88C72B]" },
                                    ].map(({ res, val, icon, label, barColor }) => {
                                        const pct = Math.min(100, Math.max(0, (val / 50) * 100));
                                        return (
                                            <div key={res} className="flex flex-col gap-1 bg-surface/60 px-3 py-2 rounded-xl border border-border">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-4 h-4">{icon}</span>
                                                        <span className="text-muted-foreground text-caption font-bold tracking-wide leading-none">{label}</span>
                                                    </div>
                                                    <span className="font-black text-foreground text-body-sm">{val}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-background rounded-full overflow-hidden mt-1">
                                                    <div className={cn("h-full rounded-full transition-all duration-300", barColor)} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right: Info & Stats Grid */}
                        <div className="flex-1 flex flex-col relative z-10">
                            <DialogHeader className="mb-6 lg:mb-8 text-left">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-2.5 py-0.5 bg-success/20 text-success text-caption font-black rounded-lg uppercase">Lvl {data?.level || "200"}</span>
                                            <span className="text-muted-foreground text-caption font-bold uppercase tracking-widest">{resolvedClassName}</span>
                                        </div>
                                        <DialogTitle className="text-2xl sm:text-4xl font-black text-foreground uppercase tracking-tight">{title || data?.name || "Sans nom"}</DialogTitle>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            fetchBuild(true);
                                        }}
                                        disabled={loading}
                                        className="bg-surface border-border hover:bg-elevated text-muted-foreground hover:text-foreground rounded-xl h-10 px-4"
                                    >
                                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                                        Actualiser
                                    </Button>
                                </div>
                                <DialogDescription className="flex flex-wrap gap-2 mt-3">
                                        {tags.map(tagId => {
                                            const tagDef = DO_TAGS.find(t => t.id === tagId);
                                            return tagDef ? (
                                                <span key={tagId} className={cn("px-2 py-0.5 text-caption rounded font-black uppercase tracking-tighter", tagDef.className)}>
                                                    {tagDef.label}
                                                </span>
                                            ) : null;
                                        })}
                                </DialogDescription>
                            </DialogHeader>

                            {data ? (
                                <div className="flex flex-col gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {/* Bloc 1: Caractéristiques */}
                                        <div className="bg-surface/30 backdrop-blur-md p-6 rounded-[2rem] border border-border shadow-xl flex flex-col h-full">
                                            <h4 className="text-caption font-black text-foreground/70 uppercase tracking-widest mb-4 flex items-center gap-2"><Move className="w-3.5 h-3.5"/> CARACTÉRISTIQUES</h4>
                                            <div className="grid grid-cols-2 gap-2 my-auto">
                                                {[
                                                    { val: data.stats?.vit ?? 0, icon: "❤️", label: "PdV", color: "text-foreground" },
                                                    { val: data.stats?.pa ?? 0, icon: "⭐", label: "PA", color: "text-[#008cfc]" },
                                                    { val: data.stats?.pm ?? 0, icon: "🛹", label: "PM", color: "text-[#2cb14b]" },
                                                    { val: data.stats?.po ?? 0, icon: "👁️", label: "PO", color: "text-[#389f81]" },
                                                    { val: data.stats?.pp ?? 0, icon: "🔎", label: "Pros.", color: "text-[#5AC2FF]" },
                                                    { val: data.stats?.cc ?? 0, icon: "🎯", label: "Crit.", color: "text-[#f24254]" },
                                                    { val: data.stats?.invo ?? 0, icon: "🦊", label: "Invo.", color: "text-[#f59f0f]" },
                                                    { val: data.stats?.so ?? 0, icon: "➕", label: "Soin", color: "text-[#ef3f3f]" },
                                                ].map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-surface/60 px-2.5 py-2.5 rounded-xl border border-border gap-1 hover:bg-surface transition-colors">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-label opacity-70 shrink-0">{s.icon}</span>
                                                            <span className="text-muted-foreground text-caption font-black uppercase tracking-tighter whitespace-nowrap">{s.label}</span>
                                                        </div>
                                                        <span className={cn("font-black text-body-sm shrink-0", s.color)}>{s.val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Bloc 2: Éléments */}
                                        <div className="bg-surface/30 backdrop-blur-md p-6 rounded-[2rem] border border-border shadow-xl flex flex-col h-full">
                                            <h4 className="text-caption font-black text-foreground/70 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap className="w-3.5 h-3.5"/> ÉLÉMENTS</h4>
                                            <div className="flex flex-col gap-2.5 my-auto">
                                                {[
                                                    { key: 'fo' as const, label: 'Force',        color: 'text-[#9D753E]', barColor: 'bg-[#9D753E]', max: 1200 },
                                                    { key: 'in' as const, label: 'Intelligence', color: 'text-[#E33E19]', barColor: 'bg-[#E33E19]', max: 1200 },
                                                    { key: 'ch' as const, label: 'Chance',       color: 'text-[#5AC2FF]', barColor: 'bg-[#5AC2FF]', max: 1200 },
                                                    { key: 'ag' as const, label: 'Agilité',      color: 'text-[#88C72B]', barColor: 'bg-[#88C72B]', max: 1200 },
                                                    { key: 'sa' as const, label: 'Sagesse',      color: 'text-[#a560df]', barColor: 'bg-[#a560df]', max: 600 },
                                                    { key: 'pu' as const, label: 'Puissance',    color: 'text-[#f59f0f]', barColor: 'bg-[#f59f0f]', max: 500 },
                                                ].map(({ key, label, color, barColor, max }) => {
                                                    const val = data.elements?.[key] || 0;
                                                    const pct = Math.min(100, Math.max(0, (val / max) * 100));
                                                    return (
                                                        <div key={key} className="flex flex-col gap-1.5 bg-surface/60 px-3 py-2 rounded-xl border border-border">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-muted-foreground text-caption font-bold uppercase tracking-wider">{label}</span>
                                                                <span className={cn("font-black text-body", color)}>{val}</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                                                                <div className={cn("h-full rounded-full transition-all duration-300", barColor)} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        
                                        {/* Bloc 3: Dommages */}
                                        <div className="bg-surface/30 backdrop-blur-md p-6 rounded-[2rem] border border-border shadow-xl md:col-span-2 xl:col-span-1 flex flex-col h-full">
                                            <h4 className="text-caption font-black text-foreground/70 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap className="w-3.5 h-3.5 fill-current"/> DOMMAGES FIXES & %</h4>
                                            <div className="flex flex-col gap-4 my-auto">
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                                    {[
                                                        { label: 'Neutre', k: "neutre" as const, c: 'text-[#E2E2E2]' },
                                                        { label: 'Terre', k: "terre" as const, c: 'text-[#9D753E]' },
                                                        { label: 'Feu', k: "feu" as const, c: 'text-[#E33E19]' },
                                                        { label: 'Eau', k: "eau" as const, c: 'text-[#5AC2FF]' },
                                                        { label: 'Air', k: "air" as const, c: 'text-[#88C72B]' },
                                                        { label: 'Généraux', k: "general" as const, c: 'text-foreground' },
                                                        { label: 'Crit.', k: "critique" as const, c: 'text-[#f24254]' },
                                                        { label: 'Poussée', k: "poussee" as const, c: 'text-muted-foreground' },
                                                    ].map(d => (
                                                        <div key={d.k} className="flex justify-between items-center text-label border-b border-border pb-1 hover:border-border transition-colors">
                                                            <span className="text-muted-foreground font-medium">{d.label}</span>
                                                            <span className={cn("font-black", d.c)}>{data.damages?.[d.k] || 0}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* % Section */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { label: '% Mêlée', k: "melee" as const },
                                                        { label: '% Dist.', k: "distance" as const },
                                                        { label: '% Armes', k: "armes" as const },
                                                        { label: '% Sorts', k: "sorts" as const },
                                                    ].map(p => (
                                                        <div key={p.k} className="flex justify-between items-center text-caption bg-black/30 px-2.5 py-2 rounded-xl border border-border">
                                                            <span className="text-muted-foreground font-bold uppercase tracking-tight">{p.label}</span>
                                                            <span className="font-black text-success text-label">{data.damages?.[p.k] || 0}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Panoplies */}
                                    {data.cloths && data.cloths.length > 0 && (
                                        <div className="pt-5 border-t border-border">
                                            <h4 className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Shield className="w-3.5 h-3.5 text-success" /> PANOPLIES ASSOCIÉES
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {data.cloths.map((cloth, i) => (
                                                    <ClothBadge key={i} cloth={cloth} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Forgemagie section */}
                                    {data.smithmagic && (
                                        (() => {
                                            const fmEntries = parseDofusbookSmithmagic(data.smithmagic, data.items);
                                            return (
                                                <div className="pt-5 border-t border-border">
                                                    <h4 className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Sparkles className="w-3.5 h-3.5 text-success" /> FORGEMAGIE (EXO / OVER)
                                                    </h4>
                                                    {fmEntries.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                            {fmEntries.map((fm, idx) => {
                                                                const isExo = ["PA", "PM", "PO"].includes(fm.stat);
                                                                const badgeStyle = isExo 
                                                                    ? "bg-warning/10 border-warning/30 text-warning font-extrabold animate-pulse "
                                                                    : "bg-success/10 border-success/20 text-success font-bold";
                                                                return (
                                                                    <div key={idx} className={cn(
                                                                        "flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300",
                                                                        isExo ? "bg-warning/20 border-warning/20 hover:border-warning/40" : "bg-surface/50 border-border hover:border-success/20"
                                                                    )}>
                                                                        {fm.itemImage && (
                                                                            <div className="w-8 h-8 bg-background rounded-lg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
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
                                                                            <p className="text-caption font-bold text-foreground truncate uppercase leading-tight" title={fm.itemName}>
                                                                                {fm.itemName}
                                                                            </p>
                                                                            <span className="text-caption text-muted-foreground uppercase tracking-wider block mt-0.5">
                                                                                {fm.slotKey}
                                                                            </span>
                                                                        </div>
                                                                        <span className={cn("px-2.5 py-1 text-caption rounded-lg shrink-0 border", badgeStyle)}>
                                                                            {fm.value > 0 ? `+${fm.value}` : fm.value} {fm.stat}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-caption text-muted-foreground italic">Aucune forgemagie (Exo/Over) détectée dans ce build.</p>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface rounded-[3rem] border border-border text-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
                                        <ExternalLink className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <div className="max-w-xs">
                                        <h4 className="text-lg font-black text-foreground uppercase mb-2">Build Dofusbook</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Ce build n'a pas pu être chargé dynamiquement sur le dashboard.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <Button
                                    onClick={() => {
                                        navigator.clipboard.writeText(url);
                                        toast.success("Lien copié !");
                                    }}
                                    className="w-full sm:w-auto inline-flex px-6 py-3 rounded-2xl text-center text-label font-bold gap-2 items-center justify-center"
                                >
                                    <Copy className="w-4 h-4" /> Copier le lien
                                </Button>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full sm:w-auto inline-flex px-6 py-3 bg-background text-foreground rounded-2xl text-center text-label font-bold uppercase tracking-wider hover:bg-surface transition-all items-center justify-center gap-2 border border-border"
                                >
                                    Ouvrir sur Dofusbook <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
});
