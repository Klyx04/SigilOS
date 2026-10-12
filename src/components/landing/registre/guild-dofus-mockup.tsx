"use client";

import {
    Gem,
    TrendingUp,
    Crown,
    Search,
    ChevronDown,
} from "lucide-react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/client";

/**
 * GuildDofusMockup — Reproduction fidèle au pixel près du module « Progression & Entraide Guilde ».
 */

interface DofusItem {
    name: string;
    categoryKey: "primordial" | "quest" | "meta" | "other";
    image: string;
    obtained: number;
    total: number;
    rate: number;
    inProgressCount: number;
}

const DOFUS_DATA: DofusItem[] = [
    {
        name: "Dokille",
        categoryKey: "other",
        image: "/module-dofus/Dokille.png",
        obtained: 7,
        total: 117,
        rate: 6,
        inProgressCount: 1,
    },
    {
        name: "Émeraude",
        categoryKey: "primordial",
        image: "/module-dofus/Dofus_Emeraude.png",
        obtained: 46,
        total: 117,
        rate: 39,
        inProgressCount: 3,
    },
    {
        name: "Turquoise",
        categoryKey: "primordial",
        image: "/module-dofus/Dofus_Turquoise.png",
        obtained: 47,
        total: 117,
        rate: 40,
        inProgressCount: 0,
    },
    {
        name: "Ivoire",
        categoryKey: "primordial",
        image: "/module-dofus/Dofus_Ivoire.png",
        obtained: 29,
        total: 117,
        rate: 25,
        inProgressCount: 2,
    },
    {
        name: "Ébène",
        categoryKey: "primordial",
        image: "/module-dofus/Dofus_Ebene.png",
        obtained: 29,
        total: 117,
        rate: 25,
        inProgressCount: 3,
    },
    {
        name: "Ocre",
        categoryKey: "primordial",
        image: "/module-dofus/Dofus_Ocre.png",
        obtained: 41,
        total: 117,
        rate: 35,
        inProgressCount: 0,
    },
    {
        name: "Pourpre",
        categoryKey: "primordial",
        image: "/module-dofus/Dofus_Pourpre.png",
        obtained: 46,
        total: 117,
        rate: 39,
        inProgressCount: 0,
    },
    {
        name: "Vulbis",
        categoryKey: "quest",
        image: "/module-dofus/Dofus_Vulbis.png",
        obtained: 28,
        total: 117,
        rate: 24,
        inProgressCount: 5,
    },
    {
        name: "Abyssal",
        categoryKey: "quest",
        image: "/module-dofus/Dofus_Abyssal.png",
        obtained: 29,
        total: 117,
        rate: 25,
        inProgressCount: 1,
    },
    {
        name: "Sylvestre",
        categoryKey: "meta",
        image: "/module-dofus/Dofus_Sylvestre.png",
        obtained: 20,
        total: 117,
        rate: 17,
        inProgressCount: 2,
    },
    {
        name: "Cawotte",
        categoryKey: "quest",
        image: "/module-dofus/Dofus_Cawotte.png",
        obtained: 42,
        total: 117,
        rate: 36,
        inProgressCount: 0,
    },
    {
        name: "Dom de Pin",
        categoryKey: "quest",
        image: "/module-dofus/Dom_De_Pin.png",
        obtained: 21,
        total: 117,
        rate: 18,
        inProgressCount: 2,
    },
    {
        name: "Glaces",
        categoryKey: "quest",
        image: "/module-dofus/Dofus_Des_Glaces.png",
        obtained: 38,
        total: 117,
        rate: 32,
        inProgressCount: 3,
    },
    {
        name: "Nébuleux",
        categoryKey: "quest",
        image: "/module-dofus/Dofus_Nebuleux.png",
        obtained: 28,
        total: 117,
        rate: 24,
        inProgressCount: 3,
    },
    {
        name: "Dokoko",
        categoryKey: "quest",
        image: "/module-dofus/Dofus_Dokoko.png",
        obtained: 43,
        total: 117,
        rate: 37,
        inProgressCount: 0,
    },
];

export function GuildDofusMockup() {
    const { t } = useI18n();
    const m = t.landing.guildDofusMockup;

    return (
        <div className="w-full rounded-2xl border border-[#232733] bg-[#0d0f14] text-foreground font-sans overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4">
            {/* Header + Filtres */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c202b] pb-4">
                <div className="flex items-center gap-2.5">
                    <Gem className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <h3 className="text-sm sm:text-base font-black text-zinc-100 uppercase tracking-wide">
                        {m.title}
                    </h3>
                </div>

                <div className="flex items-center gap-2.5">
                    <div className="relative flex-1 sm:w-52">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input
                            type="text"
                            readOnly
                            placeholder={m.searchPlaceholder}
                            className="w-full pl-9 pr-3 py-1.5 text-xs font-medium bg-[#141720] border border-[#232734] rounded-lg text-zinc-200 placeholder:text-zinc-500 cursor-default focus:outline-none"
                        />
                    </div>

                    <div className="h-8 px-3.5 bg-[#141720] border border-[#232734] text-xs font-semibold text-zinc-200 rounded-lg flex items-center gap-2 cursor-default shrink-0">
                        <span>{m.filterAll}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                </div>
            </div>

            {/* 3 KPIs Résumé */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="p-3 sm:p-3.5 rounded-xl bg-[#12151e] border border-[#1e2330] flex items-center gap-3">
                    <Gem className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                            {m.kpiObtained}
                        </p>
                        <p className="text-xs sm:text-sm font-extrabold text-white tabular-nums">
                            26 <span className="text-[11px] text-zinc-500 font-normal">/ 26</span>
                        </p>
                    </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-[#12151e] border border-[#1e2330] flex items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                            {m.kpiRate}
                        </p>
                        <p className="text-xs sm:text-sm font-extrabold text-emerald-400 tabular-nums">
                            26%
                        </p>
                    </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-[#12151e] border border-[#1e2330] flex items-center gap-3">
                    <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                            {m.kpiAdvanced}
                        </p>
                        <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                            Turquoise
                        </p>
                    </div>
                </div>
            </div>

            {/* Grille des 15 Cartes Dofus réelles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {DOFUS_DATA.map((dofus) => {
                    const categoryLabel = m.categories[dofus.categoryKey];
                    const inProgressText = dofus.inProgressCount > 0 ? `${dofus.inProgressCount} ${m.inProgress}` : "—";

                    return (
                        <div
                            key={dofus.name}
                            className="p-3 rounded-xl bg-[#12151e] border border-[#1e2330] hover:border-[#2e364a] transition-all flex flex-col justify-between gap-2.5"
                        >
                            {/* Haut : Image du Dofus + Nom & Catégorie + Ratio */}
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#0a0c10] border border-[#1f2433] flex items-center justify-center flex-shrink-0 p-1">
                                    <Image
                                        src={dofus.image}
                                        alt={dofus.name}
                                        width={36}
                                        height={36}
                                        className="w-full h-full object-contain"
                                    />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-bold text-white truncate">
                                            {dofus.name}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            {dofus.obtained}/{dofus.total}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 font-medium truncate uppercase tracking-wider">
                                        {categoryLabel}
                                    </p>
                                </div>
                            </div>

                            {/* Jauge de progression */}
                            <div className="space-y-1">
                                <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-400 rounded-full"
                                        style={{ width: `${dofus.rate}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-medium text-zinc-400">
                                    <span>{dofus.rate}% {m.guildSuffix}</span>
                                    <span className={dofus.inProgressCount > 0 ? "text-zinc-200 font-semibold" : "text-zinc-600"}>
                                        {inProgressText}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
