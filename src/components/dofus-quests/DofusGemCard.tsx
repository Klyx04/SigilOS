"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Gem, Lock, Sparkles } from "lucide-react";
import { DofusProgressRing } from "./DofusProgressRing";
import { DofusIcon } from "./DofusIcon";
import { toggleDofusObtained } from "@/server/actions/dofus-quest-actions";
import type { DofusItemWithProgress } from "@/server/actions/dofus-quest-actions";

interface DofusGemCardProps {
    dofus: DofusItemWithProgress;
    guildId: string;
    selectedCharacter?: string;
}

export function DofusGemCard({ dofus, guildId, selectedCharacter = "PRINCIPAL" }: DofusGemCardProps) {
    const [isObtained, setIsObtained] = useState(dofus.isObtained);
    const [isPending, startTransition] = useTransition();

    const color = dofus.color || "#6366f1";
    const hasChain = dofus.totalQuests > 0;
    const isLocked = !hasChain; // No quest data yet

    function handleToggleObtained(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (isPending) return;

        const newVal = !isObtained;
        setIsObtained(newVal);
        startTransition(async () => {
            await toggleDofusObtained(guildId, dofus.id, newVal, selectedCharacter);
        });
    }

    return (
        <Link
            href={`/dashboard/${guildId}/quetes-dofus/${dofus.slug}${selectedCharacter !== "PRINCIPAL" ? `?character=${selectedCharacter}` : ""}`}
            className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
            style={{
                background: `linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${isObtained ? color + "66" : "rgba(255,255,255,0.08)"}`,
                boxShadow: isObtained
                    ? `0 0 20px ${color}22, 0 4px 24px rgba(0,0,0,0.4)`
                    : `0 4px 24px rgba(0,0,0,0.3)`,
            }}
        >
            {/* Glow overlay on hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${color}18 0%, transparent 70%)`,
                }}
            />

            {/* Tags Section */}
            <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 max-w-[85%]">
                {/* Main Dynamic Tag (The one you edit in God Mode) */}
                {dofus.rarity && (
                    <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm border"
                        style={{
                            background: `${color}15`,
                            color,
                            borderColor: `${color}30`,
                        }}
                    >
                        {dofus.rarity}
                    </span>
                )}

                {/* Functional Icons (Discrete indicators) */}
                {dofus.isPrimordial && (
                    <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm" title="Dofus Primordial">
                        <Crown className="w-3 h-3" />
                    </div>
                )}
                {dofus.isMeta && (
                    <div className="w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm" title="Dofus Méta">
                        <Sparkles className="w-3 h-3" />
                    </div>
                )}
                {dofus.isSylvestreReq && (
                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm" title="Requis pour le Sylvestre">
                        <Gem className="w-3 h-3" />
                    </div>
                )}
            </div>

            {/* Obtained toggle button */}
            <button
                onClick={handleToggleObtained}
                disabled={isPending}
                className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{
                    background: isObtained ? color : "rgba(255,255,255,0.08)",
                    border: `1px solid ${isObtained ? color : "rgba(255,255,255,0.15)"}`,
                    boxShadow: isObtained ? `0 0 10px ${color}66` : "none",
                }}
                title={isObtained ? "Marquer comme non obtenu" : "Marquer comme obtenu"}
                aria-label={isObtained ? "Dofus obtenu — cliquer pour annuler" : "Marquer comme obtenu"}
            >
                {isObtained ? (
                    <span className="text-sm text-black font-bold">✓</span>
                ) : (
                    <span className="text-sm text-white/40">○</span>
                )}
            </button>

            {/* Image + Ring */}
            <div className="flex flex-col items-center pt-10 pb-4 px-4">
                <div className="relative">
                    <DofusProgressRing
                        percent={dofus.progressPercent}
                        size={90}
                        strokeWidth={5}
                        color={color}
                        isObtained={isObtained}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                            {dofus.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={dofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : dofus.imageUrl.replace(/^\/public/, "")}
                                    alt={dofus.nameShort}
                                    width={56}
                                    height={56}
                                    className="object-contain"
                                    style={{
                                        filter: isObtained
                                            ? `drop-shadow(0 0 10px ${color}aa)`
                                            : `drop-shadow(0 0 4px ${color}44)`,
                                    }}
                                />
                            ) : dofus.nameShort ? (
                                <DofusIcon
                                    name={dofus.nameShort}
                                    size={56}
                                    color={color}
                                    isObtained={isObtained}
                                />
                            ) : (
                                <Gem className="w-8 h-8 opacity-40" style={{ color }} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="flex flex-col px-4 pb-4 gap-1">
                <h3
                    className="text-sm font-bold text-center leading-tight"
                    style={{ color: isObtained ? color : "white" }}
                >
                    {dofus.nameShort}
                </h3>

                {hasChain ? (
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                        <div
                            className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${dofus.progressPercent}%`,
                                    background: isObtained
                                        ? `linear-gradient(90deg, ${color}, #fbbf24)`
                                        : color,
                                }}
                            />
                        </div>
                        <span className="text-[10px] tabular-nums font-black" style={{ color: dofus.progressPercent > 0 ? color : "rgba(255,255,255,0.2)" }}>
                            {dofus.progressPercent}%
                        </span>
                        <span className="text-[10px] tabular-nums text-white/20 whitespace-nowrap">
                            ({dofus.completedQuests}/{dofus.totalQuests})
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-1 mt-1">
                        <Lock className="w-3 h-3 text-white/25" />
                        <span className="text-[10px] text-white/25">Guide à venir</span>
                    </div>
                )}

                {dofus.levelRecommended > 0 && (
                    <p className="text-[10px] text-white/30 text-center mt-0.5">
                        Niveau {dofus.levelRecommended}+
                    </p>
                )}
            </div>

            {/* Bottom accent line */}
            <div
                className="h-0.5 w-full transition-all duration-300"
                style={{
                    background: isObtained
                        ? `linear-gradient(90deg, transparent, ${color}, transparent)`
                        : `linear-gradient(90deg, transparent, ${color}44, transparent)`,
                    opacity: isObtained ? 1 : 0.5,
                }}
            />
        </Link>
    );
}
