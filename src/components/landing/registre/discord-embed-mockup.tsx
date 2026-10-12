"use client";

import Image from "next/image";
import {
    Swords,
    DoorOpen,
    ExternalLink,
    MapPin,
    Calendar,
    Trophy,
    Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * DiscordEmbedMockup — Reproduction fidèle au pixel près de l'annonce de donjon générée par le bot SigilOS.
 */
export function DiscordEmbedMockup() {
    const { t } = useI18n();
    const d = t.landing.discordEmbedMockup;

    return (
        <div className="w-full max-w-[500px] mx-auto rounded-xl border border-[#1e1f22] bg-[#313338] text-[#dbdee1] font-sans overflow-hidden shadow-2xl p-4 text-xs select-none">
            {/* 1. Fil / Titre Discord */}
            <div className="flex items-center gap-2 pb-2.5 border-b border-[#3f4147] text-[#949ba4]">
                <span className="text-base">💬</span>
                <span className="font-bold text-white text-sm tracking-tight">
                    {d.threadTitle}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#232428] text-[#b5bac1] uppercase tracking-wider">
                    {d.categoryDimension}
                </span>
            </div>

            {/* Date line */}
            <div className="relative my-3 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#3f4147]"></div>
                </div>
                <span className="relative bg-[#313338] px-2 text-[10px] font-semibold text-[#f23f43]">
                    {d.dateSeparator}
                </span>
            </div>

            {/* 2. Message Bot */}
            <div className="flex items-start gap-3">
                {/* Avatar SigilOS Bot */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-700 via-indigo-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow">
                    <span className="font-mono">S</span>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                    {/* Bot Header */}
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-sm hover:underline cursor-pointer">
                            SigilOS Beta
                        </span>
                        <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 py-0.2 rounded uppercase">
                            {d.botApp}
                        </span>
                        <span className="text-[11px] text-[#949ba4] font-medium ml-1">
                            16/09/2026 22:29
                        </span>
                    </div>

                    {/* Mentions */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <span className="bg-[#5865f2]/20 text-[#c9cdfb] px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-[#5865f2]/30">
                            @Ardamire
                        </span>
                        <span className="bg-[#f59e0b]/20 text-[#fcd34d] px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-[#f59e0b]/30">
                            @💫 MEMBRES 💫
                        </span>
                        <span className="text-[10px] text-[#949ba4]">{d.modified}</span>
                    </div>

                    {/* 3. Embed Discord */}
                    <div className="rounded-r-lg border-l-4 border-[#5865f2] bg-[#2b2d31] p-3.5 space-y-3 shadow-md">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[#5865f2] font-black text-xs uppercase tracking-wide">
                                    <Swords className="w-3.5 h-3.5" />
                                    <span>{d.searchDungeon}</span>
                                </div>
                                <p className="text-xs text-white font-semibold flex items-center gap-1">
                                    <span className="text-[#949ba4]">👤</span> {d.lookingForCompanions}
                                </p>
                            </div>

                            {/* Vignette Boss Vortex (Véritable personnage de Vortex) */}
                            <div className="w-20 h-20 shrink-0 relative flex items-center justify-center">
                                <Image
                                    src="/images/songes-bosses/3835_Vortex.png"
                                    alt="Vortex"
                                    width={76}
                                    height={76}
                                    className="w-full h-full object-contain drop-shadow-md"
                                />
                            </div>
                        </div>

                        {/* Citation blockquote */}
                        <div className="border-l-4 border-[#4e5058] pl-2.5 py-0.5 text-xs text-[#dbdee1] italic leading-relaxed">
                            {d.quote}
                        </div>

                        <p className="text-xs text-[#dbdee1]">
                            {d.subQuote}
                        </p>

                        {/* Grille des champs */}
                        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                            {/* Donjon */}
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 font-bold text-white text-[11px]">
                                    <MapPin className="w-3 h-3 text-rose-400" />
                                    <span>{d.labelDungeon}</span>
                                </div>
                                <p className="font-bold text-white text-xs">{d.dungeonName}</p>
                                <p className="text-[11px] text-[#949ba4] italic">{d.level200}</p>
                            </div>

                            {/* Date */}
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 font-bold text-white text-[11px]">
                                    <Calendar className="w-3 h-3 text-amber-400" />
                                    <span>{d.labelDate}</span>
                                </div>
                                <p className="font-semibold text-white text-xs">{d.dateTime}</p>
                                <p className="text-[11px] text-[#949ba4]">{d.inDays}</p>
                            </div>

                            {/* Succès visés */}
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 font-bold text-white text-[11px]">
                                    <Trophy className="w-3 h-3 text-amber-400" />
                                    <span>{d.labelAchievements}</span>
                                </div>
                                <p className="text-xs text-[#dbdee1]">{d.achievementName}</p>
                            </div>

                            {/* Membres */}
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 font-bold text-white text-[11px]">
                                    <Users className="w-3 h-3 text-sky-400" />
                                    <span>{d.labelMembers}</span>
                                </div>
                                <p className="text-xs text-white font-semibold">Ardamire</p>
                                <p className="text-[11px] text-[#dbdee1]">• Chaudsept ({d.roleStaff}) <span className="italic text-[#949ba4]">(Eliotrope)</span></p>
                            </div>
                        </div>

                        {/* Footer embed */}
                        <div className="pt-2 border-t border-[#383a40] text-[10px] text-[#949ba4] font-medium">
                            {d.embedFooter}
                        </div>
                    </div>

                    {/* 4. Boutons interactifs Discord */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                            type="button"
                            className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow"
                        >
                            <Swords className="w-3.5 h-3.5" />
                            <span>{d.btnRegister}</span>
                        </button>

                        <button
                            type="button"
                            className="px-3 py-1.5 rounded bg-[#da373c] hover:bg-[#a1282c] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow"
                        >
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>{d.btnUnregister}</span>
                        </button>

                        <button
                            type="button"
                            className="px-3 py-1.5 rounded bg-[#4e5058] hover:bg-[#6d6f78] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow"
                        >
                            <span>{d.btnViewSite}</span>
                            <ExternalLink className="w-3 h-3 text-[#b5bac1]" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
