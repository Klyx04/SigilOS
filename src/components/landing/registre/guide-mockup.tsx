"use client";

import {
    Search,
    Sun,
    Box,
    Eye,
    Bug,
    MoreVertical,
    BookOpen,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Lightbulb,
    MapPin,
    Copy,
    Check,
    Users,
    Bookmark,
    Info,
    CheckCircle2,
    Circle,
    Maximize2,
    X,
    Layers,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/**
 * GuideMockup — Reproduction fidèle au pixel près de la fenêtre Overlay « Rush Sylvestre » de SigilOS.
 */
export function GuideMockup() {
    const { t } = useI18n();
    const m = t.landing.guideMockup;
    const [copiedCoords, setCopiedCoords] = useState<string | null>(null);

    const handleCopy = (coords: string) => {
        setCopiedCoords(coords);
        setTimeout(() => setCopiedCoords(null), 2000);
    };

    return (
        <div className="w-full max-w-xl mx-auto rounded-2xl border border-[#262c3b] bg-[#0c0e14] text-zinc-100 font-sans shadow-2xl overflow-hidden text-xs select-none">
            {/* 1. Barre de fenêtre d'overlay (titre d'application détachée) */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#1b202c] bg-[#11141e]/90 text-[11px] text-zinc-400 font-mono">
                <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-zinc-300">{m.appTitle}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-bold uppercase">
                        {m.overlayBadge}
                    </span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-500">
                    <Maximize2 className="w-3 h-3 hover:text-zinc-300 transition-colors cursor-pointer" />
                    <X className="w-3.5 h-3.5 hover:text-zinc-300 transition-colors cursor-pointer" />
                </div>
            </div>

            <div className="p-3.5 sm:p-4 space-y-3.5">
                {/* 2. En-tête du Rush : Titre + progression globale + actions rapides + Oeuf Sylvestre */}
                <div>
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                                {m.rushTitle}
                            </h3>
                            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                <span className="text-zinc-200 font-semibold">11</span> / 377 {m.stepsRatio} ·{" "}
                                <span className="text-emerald-400 font-semibold">3%</span>
                            </p>
                        </div>

                        {/* Barre d'outils overlay + Asset Dofus Sylvestre */}
                        <div className="flex items-center gap-1.5">
                            <div className="hidden sm:flex items-center gap-1 bg-[#151924] border border-[#232838] rounded-lg p-0.5 text-zinc-400">
                                <button type="button" aria-label="Thème" className="p-1 hover:text-white transition-colors">
                                    <Sun className="w-3 h-3" />
                                </button>
                                <button type="button" aria-label="Mode 3D" className="p-1 hover:text-white transition-colors">
                                    <Box className="w-3 h-3" />
                                </button>
                                <button type="button" aria-label="Visibilité" className="p-1 hover:text-white transition-colors">
                                    <Eye className="w-3 h-3" />
                                </button>
                                <button type="button" aria-label="Signalement" className="p-1 hover:text-white transition-colors">
                                    <Bug className="w-3 h-3" />
                                </button>
                                <button type="button" aria-label="Options" className="p-1 hover:text-white transition-colors">
                                    <MoreVertical className="w-3 h-3" />
                                </button>
                            </div>

                            <div className="w-9 h-9 rounded-lg bg-[#151924] border border-[#262c3e] flex items-center justify-center p-0.5 shrink-0 shadow-inner">
                                <Image
                                    src="/module-dofus/Dofus_Sylvestre.png"
                                    alt="Dofus Sylvestre"
                                    width={32}
                                    height={32}
                                    className="object-contain"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Jauge globale 3% */}
                    <div className="w-full h-1 bg-[#191e2b] rounded-full overflow-hidden mt-2.5">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: "3%" }} />
                    </div>
                </div>

                {/* 3. Recherche quête / zone / donjon */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                        type="text"
                        readOnly
                        placeholder={m.searchPlaceholder}
                        className="w-full pl-9 pr-8 py-2 text-xs bg-[#131620] border border-[#212635] rounded-xl text-zinc-200 placeholder:text-zinc-500 cursor-default focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-[#1b202d] border border-[#2a3042] rounded">
                        /
                    </span>
                </div>

                {/* 4. Sélecteur de chapitre */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-[#131620] border border-[#212635] flex items-center justify-between gap-2 text-zinc-200 font-medium">
                    <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate text-[11px] sm:text-xs">
                            {m.chapterTitle}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-zinc-400">
                        <span>1/18</span>
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                </div>

                {/* Chapitre sub-progress */}
                <div className="space-y-1 px-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                        <span className="font-bold text-zinc-300">{m.chapterLabel}</span>
                        <span>1/18 · 6%</span>
                    </div>
                    <div className="w-full h-1 bg-[#191e2b] rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: "6%" }} />
                    </div>
                </div>

                {/* 5. Carte Dorée « À FAIRE MAINTENANT » */}
                <div className="rounded-xl border border-amber-500/40 bg-gradient-to-b from-[#1c170d] to-[#12141c] p-3 sm:p-3.5 space-y-2.5 shadow-lg relative">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-amber-400 font-black text-[11px] uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{m.actionableNow}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium truncate max-w-[150px]">
                            <span className="truncate">{m.chapterTitle}</span>
                            <ChevronUp className="w-3 h-3 text-zinc-500 shrink-0" />
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-white">{m.tipTitle}</h4>
                        <div className="mt-1.5 p-2 rounded-lg bg-[#0e1017]/80 border border-amber-500/20 flex items-start gap-2">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-zinc-300 leading-snug">
                                {m.tipContent}
                            </p>
                        </div>
                    </div>

                    {/* Coordonnée copiable */}
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => handleCopy("1, 1")}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c202d] hover:bg-[#252b3d] border border-[#2b3347] text-zinc-200 font-mono text-[11px] transition-all cursor-pointer"
                        >
                            <MapPin className="w-3 h-3 text-rose-400" />
                            <span className="font-bold">1, 1</span>
                            {copiedCoords === "1, 1" ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                                <Copy className="w-3 h-3 text-zinc-400" />
                            )}
                        </button>
                        {copiedCoords === "1, 1" && (
                            <span className="text-[10px] font-mono text-emerald-400">{m.travelCopied}</span>
                        )}
                    </div>
                </div>

                {/* 6. Membres sur ce chapitre */}
                <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-zinc-400">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                        {m.onThisChapter}
                    </span>
                    <div className="flex -space-x-1.5">
                        <div className="w-5 h-5 rounded-full ring-2 ring-[#0c0e14] bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-[9px] font-bold text-white">
                            S
                        </div>
                        <div className="w-5 h-5 rounded-full ring-2 ring-[#0c0e14] bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center text-[9px] font-bold text-white">
                            K
                        </div>
                    </div>
                    <span className="text-[10px] text-zinc-500">{m.membersCount}</span>
                </div>

                {/* 7. Checklist d'étapes */}
                <div className="space-y-1.5">
                    {/* Étape active */}
                    <div className="p-2.5 rounded-xl bg-[#131620] border border-[#222736] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <div className="min-w-0">
                                <span className="font-bold text-zinc-200 truncate block">
                                    {m.step1Title}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400 inline-flex items-center gap-1">
                                    [1, 1] <Copy className="w-2.5 h-2.5 text-zinc-500" />
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                            <Bookmark className="w-3 h-3 hover:text-zinc-300 cursor-pointer" />
                            <Info className="w-3 h-3 hover:text-zinc-300 cursor-pointer" />
                        </div>
                    </div>

                    {/* Étape terminée */}
                    <div className="p-2.5 rounded-xl bg-[#11131b] border border-[#1b202c] flex items-center justify-between gap-2 opacity-75">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                                <span className="font-medium text-zinc-500 line-through truncate block">
                                    {m.step2Title}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-600 inline-flex items-center gap-1">
                                    [-2, -3] <Copy className="w-2.5 h-2.5 text-zinc-600" />
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-600">
                            <Bookmark className="w-3 h-3" />
                            <Info className="w-3 h-3" />
                        </div>
                    </div>

                    {/* Étape suivante */}
                    <div className="p-2.5 rounded-xl bg-[#131620] border border-[#222736] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <div className="min-w-0">
                                <span className="font-medium text-zinc-300 truncate block">
                                    {m.step3Title}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400 inline-flex items-center gap-1">
                                    [2, -3] <Copy className="w-2.5 h-2.5 text-zinc-500" />
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                            <Bookmark className="w-3 h-3 hover:text-zinc-300 cursor-pointer" />
                            <Info className="w-3 h-3 hover:text-zinc-300 cursor-pointer" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
