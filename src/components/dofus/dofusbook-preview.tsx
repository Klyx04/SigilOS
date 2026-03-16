"use client";

import { useState, useEffect, useMemo, memo } from "react";
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

export const DofusbookPreview = memo(function DofusbookPreview({ url, title, className, tags = [], classId, initialData }: DofusbookPreviewProps) {
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

    // Memoize guessed class and color to avoid recalculating on every scroll/hover
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

    const classArtColor = useMemo(() => {
        const name = (data?.className || getClassName(guessedClassId) || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return getClassColor(name);
    }, [data?.className, guessedClassId]);

    const cardContent = (
        <div className={cn("group w-full max-w-[320px] mx-auto relative overflow-hidden bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 sm:p-6 transition-all hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.1)] cursor-pointer", className)}>
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: `${glowColor}33` }} />

            <div className="flex flex-col gap-6 relative z-10 h-full">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 shrink-0 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
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
                <div className="relative aspect-square w-full bg-black/40 p-3 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl">
                    <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] flex items-center justify-center pointer-events-none z-0">
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
                                            "w-[34px] h-[34px] rounded-lg flex items-center justify-center p-1 relative group/mini-slot",
                                            item ? "bg-zinc-800 border border-white/10 hover:bg-zinc-700 hover:border-emerald-500/30 transition-colors" : "bg-white/[0.03] border border-white/5 opacity-40"
                                        )}
                                        style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                    >
                                        {item && (
                                            <>
                                                <NextImage
                                                    src={item.picture ? `https://api.dofusdb.fr/img/items/${item.picture}.png` : `https://www.dofusbook.net/static/dist/items/105-70.webp`}
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
            <DialogContent className="max-w-[1200px] w-[95vw] max-h-[95vh] bg-zinc-950 border-white/10 p-0 overflow-y-auto custom-scrollbar rounded-[2rem] md:rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                <div className="relative p-5 sm:p-8 lg:p-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
                    {/* Background Class Glow */}
                    <div
                        className="absolute inset-x-0 top-0 h-96 opacity-10 blur-[120px] pointer-events-none transition-all duration-1000"
                        style={{ backgroundColor: classArtColor }}
                    />

                    {/* Left: Large Visual & Resists */}
                    <div className="w-full lg:w-[360px] flex flex-col gap-6 lg:gap-8 relative z-10">
                        <div className="relative aspect-square w-full rounded-[2rem] md:rounded-[3rem] bg-black/60 border border-white/5 flex items-center justify-center p-4 sm:p-8 overflow-hidden shadow-inner">
                            <NextImage
                                src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                alt={data?.className || "Class"}
                                fill
                                className="object-contain opacity-5 p-8 sm:p-16"
                            />

                            {data ? (
                                <div className="grid grid-cols-6 grid-rows-5 gap-2 sm:gap-3.5 relative z-10">
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
                                                    "w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 sm:p-2 relative transition-all duration-500 group/modal-slot",
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

                        {data && (
                            <div className="flex flex-col gap-2 bg-black/30 p-5 rounded-3xl border border-white/5">
                                {[
                                    { res: 'neutre', val: data.resists.neutre, label: 'Neutre', icon: (
                                        <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px] drop-shadow-md">
                                            <circle cx="12" cy="12" r="11" fill="#E2E2E2" stroke="#000" strokeWidth="1" />
                                            <path d="M12 1A11 11 0 0 0 12 23A5.5 5.5 0 0 1 12 12A5.5 5.5 0 0 0 12 1Z" fill="#111" />
                                            <circle cx="12" cy="6.5" r="2" fill="#111" />
                                            <circle cx="12" cy="17.5" r="2" fill="#E2E2E2" />
                                        </svg>
                                    ) },
                                    { res: 'terre', val: data.resists.terre, label: 'Terre', icon: (
                                        <svg viewBox="0 0 24 24" fill="#9D753E" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M12 24L5 12H9V0H15V12H19L12 24Z" />
                                        </svg>
                                    ) },
                                    { res: 'feu', val: data.resists.feu, label: 'Feu', icon: (
                                        <svg viewBox="0 0 24 24" fill="#E33E19" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M12 0C12 0 3 8 3 15C3 20 7 24 12 24C17 24 21 20 21 15C21 8 12 0 12 0ZM12 20C10 20 8 18 8 16C8 14 12 10 12 10C12 10 16 14 16 16C16 18 14 20 12 20Z" />
                                        </svg>
                                    ) },
                                    { res: 'eau', val: data.resists.eau, label: 'Eau', icon: (
                                        <svg viewBox="0 0 24 24" fill="#5AC2FF" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M12 0C12 0 4 10 4 16C4 20.418 7.582 24 12 24C16.418 24 20 20.418 20 16C20 10 12 0 12 0Z" />
                                        </svg>
                                    ) },
                                    { res: 'air', val: data.resists.air, label: 'Air', icon: (
                                        <svg viewBox="0 0 24 24" fill="#88C72B" className="w-[15px] h-[15px] drop-shadow-md">
                                           <path d="M17 19C19.761 19 22 16.761 22 14C22 11.239 19.761 9 17 9C16.5 6 14 3 11 3C7 3 4 6 4 10C1.79 10 0 11.79 0 14C0 16.21 1.79 18 4 18H17Z" />
                                        </svg>
                                    ) },
                                ].map(({ res, val, icon, label }) => (
                                    <div key={res} className="flex items-center gap-3">
                                        <span className="w-8 text-right font-black text-white text-[15px]" style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}>{val}</span>
                                        <span className="flex items-center justify-center w-5 h-5">{icon}</span>
                                        <span className="text-blue-300 text-[14px] font-semibold tracking-wide leading-none" style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}>% Ré {label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Info & Stats Grid */}
                    <div className="flex-1 flex flex-col relative z-10">
                        <DialogHeader className="mb-6 lg:mb-8 text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded uppercase">Lvl {data?.level || "200"}</span>
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{data?.className || getClassName(guessedClassId)}</span>
                            </div>
                            <DialogTitle className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">{title || data?.name || "Sans nom"}</DialogTitle>
                            <DialogDescription asChild>
                                <div className="flex flex-wrap gap-2 mt-3">
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
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {/* Bloc 1: Stats Primaires */}
                                    <div className="bg-[#2B2925] p-6 rounded-3xl border border-[#3B3831] shadow-inner flex flex-col h-full">
                                        <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6 flex items-center gap-2"><Move className="w-3.5 h-3.5"/> Caractéristiques</h4>
                                        <div className="grid grid-cols-2 gap-2 my-auto">
                                            {[
                                                { val: data.stats.vit, icon: "❤️", label: "PdV", color: "text-white" },
                                                { val: data.stats.pa, icon: "⭐", label: "PA", color: "text-[#008cfc]" },
                                                { val: data.stats.pm, icon: "🛹", label: "PM", color: "text-[#2cb14b]" },
                                                { val: data.stats.po, icon: "👁️", label: "PO", color: "text-[#389f81]" },
                                                { val: data.stats.pp, icon: "🔎", label: "Pros.", color: "text-[#5AC2FF]" },
                                                { val: data.stats.cc, icon: "🎯", label: "Crit.", color: "text-[#f24254]" },
                                                { val: data.stats.invo, icon: "🦊", label: "Invo.", color: "text-[#f59f0f]" },
                                                { val: data.stats.so, icon: "➕", label: "Soin", color: "text-[#ef3f3f]" },
                                            ].map((s, i) => (
                                                <div key={i} className="flex items-center justify-between bg-black/30 px-2.5 py-2.5 rounded-xl border border-white/[0.05] gap-1">
                                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                                        <span className="text-[12px] opacity-60 shrink-0">{s.icon}</span>
                                                        <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-tight hidden lg:inline truncate">{s.label}</span>
                                                    </div>
                                                    <span className={cn("font-black text-[13px] shrink-0", s.color)}>{s.val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Bloc 2: Éléments */}
                                    <div className="bg-[#2B2925] p-6 rounded-3xl border border-[#3B3831] shadow-inner flex flex-col h-full">
                                        <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6 flex items-center gap-2"><Zap className="w-3.5 h-3.5"/> Éléments</h4>
                                        <div className="flex flex-col gap-2 my-auto">
                                            {[
                                                { key: 'fo' as const, label: 'Force',        color: 'text-[#9D753E]' },
                                                { key: 'in' as const, label: 'Intelligence', color: 'text-[#E33E19]' },
                                                { key: 'ch' as const, label: 'Chance',       color: 'text-[#5AC2FF]' },
                                                { key: 'ag' as const, label: 'Agilité',      color: 'text-[#88C72B]' },
                                                { key: 'sa' as const, label: 'Sagesse',      color: 'text-[#a560df]' },
                                                { key: 'pu' as const, label: 'Puissance',    color: 'text-[#f59f0f]' },
                                            ].map(({ key, label, color }) => (
                                                <div key={key} className="flex justify-between items-center bg-black/20 px-3 py-2.5 rounded-xl border border-white/[0.02]">
                                                    <span className="text-zinc-400 text-[13px] font-medium">{label}</span>
                                                    <span className={cn("font-black text-[16px]", color)}>{data.elements[key] || 0}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Bloc 3: Dommages */}
                                    <div className="bg-[#2B2925] p-6 rounded-3xl border border-[#3B3831] shadow-inner md:col-span-2 xl:col-span-1 flex flex-col h-full">
                                        <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6 flex items-center gap-2"><Zap className="w-3.5 h-3.5 fill-current"/> Dommages Fixes & %</h4>
                                        <div className="flex flex-col gap-4 my-auto">
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                                                {[
                                                    { label: 'Neutre', k: "neutre" as const, c: 'text-[#E2E2E2]' },
                                                    { label: 'Terre', k: "terre" as const, c: 'text-[#9D753E]' },
                                                    { label: 'Feu', k: "feu" as const, c: 'text-[#E33E19]' },
                                                    { label: 'Eau', k: "eau" as const, c: 'text-[#5AC2FF]' },
                                                    { label: 'Air', k: "air" as const, c: 'text-[#88C72B]' },
                                                    { label: 'Généraux', k: "general" as const, c: 'text-white' },
                                                    { label: 'Crit.', k: "critique" as const, c: 'text-[#f24254]' },
                                                    { label: 'Poussée', k: "poussee" as const, c: 'text-zinc-400' },
                                                ].map(d => (
                                                    <div key={d.k} className="flex justify-between items-center text-[13px] border-b border-white/5 pb-1.5">
                                                        <span className="text-zinc-500 font-medium">{d.label}</span>
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
                                                    <div key={p.k} className="flex justify-between items-center text-[12px] bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                                                        <span className="text-zinc-500">{p.label}</span>
                                                        <span className="font-black text-emerald-400 text-[13px]">{data.damages?.[p.k] || 0}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Panoplies */}
                                {data.cloths && data.cloths.length > 0 && (
                                    <div className="pt-4 border-t border-white/5">
                                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-emerald-500" /> Panoplies Associées
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {data.cloths.map((cloth, i) => (
                                                <ClothBadge key={i} cloth={cloth} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white/[0.02] rounded-[3rem] border border-white/5 text-center gap-5">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <ExternalLink className="w-8 h-8 text-zinc-500" />
                                </div>
                                <div className="max-w-xs">
                                    <h4 className="text-lg font-black text-white uppercase mb-2">Build Dofusbook</h4>
                                    <p className="text-sm text-zinc-500 leading-relaxed">
                                        Ce build n'a pas pu être chargé dynamiquement sur le dashboard.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-8">
                            <a
                                href={url}
                                target="_blank"
                                className="w-full sm:w-auto inline-flex px-8 py-4 bg-white text-black rounded-2xl text-center text-[12px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all items-center justify-center gap-3 shadow-xl shadow-white/5"
                            >
                                Ouvrir sur Dofusbook <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});
