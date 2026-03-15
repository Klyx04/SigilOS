"use client";

import { useState, useEffect } from "react";
import { getClassName, processDofusbookRawData, type DofusbookPreviewData } from "@/lib/dofusbook-utils";
import { ExternalLink, Users, Loader2, Zap, Move, Eye, Heart, Shield } from "lucide-react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { DO_TAGS } from "@/lib/dofus-tags";
import { getClassColor } from "@/components/shared/class-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DofusbookItem } from "@/lib/dofusbook-utils";

// Mini-popover showing a panoplie's equipped items with DofusDB links
type ClothData = { name: string; count: number; total: number; clothItems?: DofusbookItem[] };

function ClothBadge({ cloth }: { cloth: ClothData }) {
    const hasItems = cloth.clothItems && cloth.clothItems.length > 0;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="px-3 py-2 bg-zinc-900 border border-white/5 rounded-xl flex items-center gap-3 group/cloth hover:border-emerald-500/30 hover:bg-zinc-800/50 transition-all cursor-pointer text-left">
                    <span className="text-[11px] font-bold text-zinc-300 group-hover/cloth:text-emerald-400 transition-colors uppercase">{cloth.name}</span>
                    <div className="px-1.5 py-0.5 bg-black/40 rounded text-[9px] font-black text-zinc-500">
                        {cloth.count}<span className="text-zinc-700">/{cloth.total}</span>
                    </div>
                </button>
            </PopoverTrigger>
            {hasItems && (
                <PopoverContent className="w-64 bg-zinc-950 border-white/10 rounded-2xl p-3 shadow-2xl" side="top" align="start">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{cloth.name}</p>
                    <div className="flex flex-col gap-1.5">
                        {cloth.clothItems!.map(item => (
                            <a
                                key={item.id}
                                href={`https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition-colors group/item"
                            >
                                <div className="w-8 h-8 bg-zinc-900 rounded-lg border border-white/5 flex-shrink-0 overflow-hidden">
                                    <NextImage
                                        src={item.picture ? `https://api.dofusdb.fr/img/items/${item.picture}.png` : `/assets/dofus/placeholder.png`}
                                        alt={item.name}
                                        width={32}
                                        height={32}
                                        className="object-contain w-full h-full"
                                        unoptimized
                                    />
                                </div>
                                <span className="text-[11px] font-semibold text-zinc-400 group-hover/item:text-white transition-colors truncate flex-1">{item.name}</span>
                                <ExternalLink className="w-3 h-3 text-zinc-700 group-hover/item:text-emerald-400 transition-colors flex-shrink-0" />
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
    initialData?: DofusbookPreviewData; // New prop for cached data
}

const getIconId = (id: number) => id === 19 ? 20 : id;

export function DofusbookPreview({ url, title, className, tags = [], classId, initialData }: DofusbookPreviewProps) {
    const [data, setData] = useState<DofusbookPreviewData | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);

    const idMatch = url.match(/(?:equipement\/(?:[a-z]+\/)?([\d]+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
    const buildId = idMatch ? (idMatch[1] || idMatch[2]) : null;

    useEffect(() => {
        if (initialData || !buildId) { setLoading(false); return; }

        setLoading(true);
        fetch(`/api/dofusbook/proxy/${buildId}`)
            .then(res => res.ok ? res.json() : null)
            .then(raw => {
                if (raw) setData(processDofusbookRawData(buildId, raw));
            })
            .catch(() => { /* silent — clean fallback shown */ })
            .finally(() => setLoading(false));
    }, [buildId, initialData]);

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center bg-zinc-900/50 rounded-[2.5rem] border border-white/5 min-h-[300px]", className)}>
                <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
            </div>
        );
    }

    const hasData = !!data;

    // Robust Class Detection for Fallback
    const searchString = `${title} ${url.split('/').pop()} ${tags.join(' ')}`.toLowerCase();
    const classesMap: Record<string, number> = {
        "feca": 1, "osamodas": 2, "osa": 2, "enutrof": 3, "enu": 3, "sram": 4, "xelor": 5, "xel": 5,
        "ecaflip": 6, "eca": 6, "eniripsa": 7, "eni": 7, "iop": 8, "cra": 9, "sadida": 10, "sadi": 10,
        "sacrieur": 11, "sacri": 11, "pandawa": 12, "panda": 12, "roublard": 13, "roub": 13,
        "zobal": 14, "steamer": 15, "steam": 15, "eliotrope": 16, "elio": 16,
        "huppermage": 17, "hupper": 17, "ouginak": 18, "ougi": 18, "forgelance": 19, "forg": 19
    };

    let guessedClassId = classId || data?.classId || 0;
    if (!guessedClassId) {
        for (const [key, id] of Object.entries(classesMap)) {
            if (searchString.includes(key)) {
                guessedClassId = id;
                break;
            }
        }
    }

    // Guess glow color from tags
    const tagColors: Record<string, string> = {
        "feu": "#ef4444", "eau": "#3b82f6", "terre": "#16a34a", "air": "#34d399", "multi": "#d946ef"
    };
    const firstElementTag = tags.find(t => tagColors[t]);
    const glowColor = firstElementTag ? tagColors[firstElementTag] : "#10b981";

    const cardContent = (
        <div className={cn("group w-full max-w-[320px] mx-auto relative overflow-hidden bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 sm:p-6 transition-all hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.1)] cursor-pointer", className)}>
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: `${glowColor}33` }} />

            <div className="flex flex-col gap-6 relative z-10 h-full">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 shrink-0 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                        <div
                            className="absolute inset-0 opacity-20 blur-md"
                            style={{ backgroundColor: getClassColor((data?.className || getClassName(guessedClassId) || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")) }}
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
                            <Users className="w-6 h-6 text-zinc-700 relative z-10" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-[14px] text-white truncate uppercase tracking-tight leading-tight" title={title || data?.name}>{title || data?.name || "Build Dofusbook"}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-zinc-400 uppercase tracking-tighter">
                                Lvl {data?.level || "???"}
                            </span>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{data?.className || getClassName(guessedClassId) || "Classe inconnue"}</p>
                        </div>
                    </div>
                </div>

                {/* Equipment Grid or Fallback UI */}
                <div className="relative aspect-square w-full bg-black/40 p-3 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        {(data?.classId || guessedClassId) > 0 && (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <div
                                    className="absolute w-24 h-24 rounded-full blur-[40px] opacity-20"
                                    style={{ backgroundColor: getClassColor((data?.className || getClassName(guessedClassId) || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")) }}
                                />
                                <NextImage
                                    src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                    alt="Class Icon"
                                    width={110}
                                    height={110}
                                    className="object-contain opacity-20 group-hover:opacity-30 transition-all duration-500"
                                />
                            </div>
                        )}
                    </div>

                    {hasData && data ? (
                        <div className="grid grid-cols-6 grid-rows-5 gap-1.5 relative z-10">
                            {[
                                { s: 'am', c: 1, r: 1 }, { s: 'a1', c: 1, r: 2 }, { s: 'a2', c: 1, r: 3 }, { s: 'br', c: 1, r: 4 },
                                { s: 'ch', c: 6, r: 1 }, { s: 'ca', c: 6, r: 2 }, { s: 'ce', c: 6, r: 3 }, { s: 'bo', c: 6, r: 4 },
                                { s: 'ar', c: 3, r: 4 }, { s: 'fa', c: 4, r: 4 },
                                { s: 'd1', c: 1, r: 5 }, { s: 'd2', c: 2, r: 5 }, { s: 'd3', c: 3, r: 5 },
                                { s: 'd4', c: 4, r: 5 }, { s: 'd5', c: 5, r: 5 }, { s: 'd6', c: 6, r: 5 },
                            ].map((slot) => {
                                const item = slot.s === 'fa' ? (data.items?.['fa'] || data.items?.['mo']) : data.items?.[slot.s];
                                return (
                                    <div
                                        key={slot.s}
                                        className={cn(
                                            "w-[34px] h-[34px] rounded-lg flex items-center justify-center p-1 relative",
                                            item ? "bg-zinc-800 border border-white/10" : "bg-white/[0.03] border border-white/5 opacity-40"
                                        )}
                                        style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                    >
                                        {item && (
                                            <NextImage
                                                src={item.picture ? `https://api.dofusdb.fr/img/items/${item.picture}.png` : `https://www.dofusbook.net/static/dist/items/105-70.webp`}
                                                alt={item.name}
                                                width={32}
                                                height={32}
                                                className="object-contain"
                                                unoptimized
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* No cached data — show class art as clean placeholder, no error message */
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
                                    {tagDef.text}
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
            <DialogTrigger asChild>
                {cardContent}
            </DialogTrigger>
            <DialogContent className="max-w-4xl bg-zinc-950 border-white/10 p-0 overflow-hidden rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                <div className="relative p-6 sm:p-12 flex flex-col md:flex-row gap-12">
                    {/* Background Class Glow */}
                    <div
                        className="absolute inset-x-0 top-0 h-96 opacity-10 blur-[120px] pointer-events-none transition-all duration-1000"
                        style={{ backgroundColor: getClassColor((data?.className || getClassName(guessedClassId) || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")) }}
                    />

                    {/* Left: Large Visual & Stats */}
                    <div className="w-full md:w-[360px] flex flex-col gap-8 relative z-10">
                        <div className="relative aspect-square w-full rounded-[3rem] bg-black/60 border border-white/5 flex items-center justify-center p-8 overflow-hidden shadow-inner">
                            <NextImage
                                src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                alt={data?.className || "Class"}
                                fill
                                className="object-contain opacity-5 p-16"
                            />

                            {data ? (
                                <div className="grid grid-cols-6 grid-rows-5 gap-3.5 relative z-10">
                                    {[
                                        { s: 'am', c: 1, r: 1 }, { s: 'a1', c: 1, r: 2 }, { s: 'a2', c: 1, r: 3 }, { s: 'br', c: 1, r: 4 },
                                        { s: 'ch', c: 6, r: 1 }, { s: 'ca', c: 6, r: 2 }, { s: 'ce', c: 6, r: 3 }, { s: 'bo', c: 6, r: 4 },
                                        { s: 'ar', c: 3, r: 4 }, { s: 'fa', c: 4, r: 4 },
                                        { s: 'd1', c: 1, r: 5 }, { s: 'd2', c: 2, r: 5 }, { s: 'd3', c: 3, r: 5 },
                                        { s: 'd4', c: 4, r: 5 }, { s: 'd5', c: 5, r: 5 }, { s: 'd6', c: 6, r: 5 },
                                    ].map((slot) => {
                                        const item = slot.s === 'fa' ? (data.items?.['fa'] || data.items?.['mo']) : data.items?.[slot.s];
                                        return (
                                            <a
                                                key={slot.s}
                                                href={item ? `https://dofusdb.fr/fr/database/items?q=${encodeURIComponent(item.name)}` : "#"}
                                                target={item ? "_blank" : undefined}
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "w-[50px] h-[50px] rounded-2xl flex items-center justify-center p-2 relative transition-all duration-500 group/modal-slot",
                                                    item ? "bg-zinc-800/80 border border-white/20 shadow-2xl hover:border-emerald-500/50 hover:bg-zinc-700 hover:scale-110" : "bg-white/[0.02] border border-white/5 opacity-30 cursor-default"
                                                )}
                                                style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                                onClick={(e) => !item && e.preventDefault()}
                                            >
                                                {item && (
                                                    <>
                                                        <NextImage
                                                            src={item.picture ? `https://api.dofusdb.fr/img/items/${item.picture}.png` : `https://www.dofusbook.net/static/dist/items/105-70.webp`}
                                                            alt={item.name}
                                                            width={44}
                                                            height={44}
                                                            className="object-contain drop-shadow-xl"
                                                            unoptimized
                                                        />
                                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-black text-white opacity-0 group-hover/modal-slot:opacity-100 transition-all scale-75 group-hover/modal-slot:scale-100 shadow-2xl z-50 whitespace-nowrap pointer-events-none">
                                                            {item.name} <span className="text-emerald-400 ml-1">→ DofusDB</span>
                                                        </div>
                                                    </>
                                                )}
                                            </a>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* No item data — show class art as hero visual using guessedClassId */
                                <div className="absolute inset-0 flex items-center justify-center p-8">
                                    {guessedClassId > 0 && (
                                        <NextImage
                                            src={`/assets/dofus/classes/${getIconId(guessedClassId)}.png`}
                                            alt="Classe"
                                            fill
                                            className="object-contain opacity-20 p-12"
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Elements Summary */}
                        {data && (
                            <div className="grid grid-cols-5 gap-2 px-2">
                                {Object.entries(data.resists).map(([res, val]) => (
                                    <div key={res} className="flex flex-col items-center gap-1">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", {
                                            "bg-zinc-400": res === "neutre",
                                            "bg-green-500": res === "terre",
                                            "bg-red-500": res === "feu",
                                            "bg-blue-500": res === "eau",
                                            "bg-emerald-400": res === "air",
                                        })} />
                                        <span className="text-[10px] font-black text-white">{val}%</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Info & Stats */}
                    <div className="flex-1 flex flex-col h-full relative z-10">
                        <DialogHeader className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded uppercase">Lvl {data?.level || "1-200"}</span>
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{data?.className || getClassName(guessedClassId)}</span>
                            </div>
                            <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight">{title || data?.name || "Sans nom"}</DialogTitle>
                            <DialogDescription asChild>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {tags.map(tagId => {
                                        const tagDef = DO_TAGS.find(t => t.id === tagId);
                                        return tagDef ? (
                                            <span key={tagId} className={cn("px-2 py-0.5 text-[9px] rounded font-black uppercase tracking-tighter", tagDef.className)}>
                                                {tagDef.text}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </DialogDescription>
                        </DialogHeader>

                        {data ? (
                            <>
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    {/* Primary Stats */}
                                    <div className="grid grid-cols-2 gap-2 bg-white/5 p-4 rounded-3xl border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/20">
                                                <Zap className="w-3.5 h-3.5 text-blue-400" />
                                            </div>
                                            <span className="text-sm font-black text-blue-400">{data.stats.pa}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/20">
                                                <Move className="w-3.5 h-3.5 text-red-400" />
                                            </div>
                                            <span className="text-sm font-black text-red-400">{data.stats.pm}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/20">
                                                <Eye className="w-3.5 h-3.5 text-green-400" />
                                            </div>
                                            <span className="text-sm font-black text-green-400">{data.stats.po}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="w-7 h-7 bg-pink-500/20 rounded-lg flex items-center justify-center border border-pink-500/20">
                                                <Heart className="w-3.5 h-3.5 text-pink-400" />
                                            </div>
                                            <span className="text-sm font-black text-pink-400">{data.stats.vit}</span>
                                        </div>
                                    </div>

                                    {/* Element Stats (Fo / In / Ch / Ag / Sa) */}
                                    <div className="flex flex-col gap-1.5 bg-white/5 p-4 rounded-3xl border border-white/5 justify-center">
                                        {data.elements && ([
                                            { key: 'fo' as const, label: 'Force',        color: 'text-yellow-400' },
                                            { key: 'in' as const, label: 'Intelligence', color: 'text-orange-400' },
                                            { key: 'ch' as const, label: 'Chance',       color: 'text-sky-400'    },
                                            { key: 'ag' as const, label: 'Agilité',      color: 'text-green-400'  },
                                            { key: 'sa' as const, label: 'Sagesse',      color: 'text-purple-400' },
                                        ]).map(({ key, label, color }) => (
                                            data.elements[key] > 0 ? (
                                                <div key={key} className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
                                                    <span>{label}</span>
                                                    <span className={`font-black ${color}`}>{data.elements[key]}</span>
                                                </div>
                                            ) : null
                                        ))}
                                    </div>
                                </div>

                                {/* Associated Sets — clickable */}
                                {data.cloths && data.cloths.length > 0 && (
                                    <div className="mt-auto">
                                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Shield className="w-3 h-3 text-emerald-500" /> Panoplies Associées
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {data.cloths.map((cloth, i) => (
                                                <ClothBadge key={i} cloth={cloth} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* No stats data — clean external link CTA, no error language */
                            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/[0.02] rounded-[2rem] border border-white/5 text-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <ExternalLink className="w-6 h-6 text-zinc-500" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase mb-1">Voir le build complet</h4>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed max-w-[200px]">
                                        Ouvre ce stuff directement sur Dofusbook pour voir les détails et statistiques.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex gap-3">
                            <a
                                href={url}
                                target="_blank"
                                className="flex-1 px-6 py-3 bg-white text-black rounded-2xl text-center text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                            >
                                Ouvrir sur Dofusbook <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
