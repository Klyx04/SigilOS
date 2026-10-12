"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Gem, Lock, Sparkles, RefreshCw } from "lucide-react";
import { DofusProgressRing } from "./DofusProgressRing";
import { DofusIcon } from "./DofusIcon";
import { toggleDofusObtained } from "@/server/actions/dofus-quest-actions";
import type { DofusItemWithProgress } from "@/server/actions/dofus-quest-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DofusGemCardProps {
    dofus: DofusItemWithProgress;
    guildId: string;
    selectedCharacter?: string;
}

function getContrastTextColor(hexColor: string): string {
    const hex = hexColor.replace("#", "");
    if (hex.length < 6) return "#ffffff";
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? "#090d16" : "#ffffff";
}

export function DofusGemCard({ dofus, guildId, selectedCharacter = "PRINCIPAL" }: DofusGemCardProps) {
    const [isObtained, setIsObtained] = useState(dofus.isObtained);
    const [isPending, startTransition] = useTransition();
    const [syncAllMules, setSyncAllMules] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("dofus-sync-all-mules") === "true";
        }
        return false;
    });

    useEffect(() => {
        setIsObtained(dofus.isObtained);
    }, [dofus.isObtained, selectedCharacter]);

    useEffect(() => {
        const handleSyncChange = () => {
            setSyncAllMules(localStorage.getItem("dofus-sync-all-mules") === "true");
        };
        window.addEventListener("dofus-sync-all-mules-changed", handleSyncChange);
        return () => window.removeEventListener("dofus-sync-all-mules-changed", handleSyncChange);
    }, []);

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
            const res = await toggleDofusObtained(guildId, dofus.id, newVal, selectedCharacter, syncAllMules);
            if (res.success) {
                if (syncAllMules) {
                    toast.success(`Dofus ${newVal ? "obtenu" : "retiré"} sur tous vos personnages !`);
                } else {
                    toast.success(`Dofus ${newVal ? "obtenu" : "retiré"} pour ${selectedCharacter === "PRINCIPAL" ? "votre personnage principal" : selectedCharacter}.`);
                }
            } else {
                toast.error(res.error || "Erreur de mise à jour");
                setIsObtained(!newVal); // rollback
            }
        });
    }

    return (
        <Link
            href={
                dofus.slug === "ocre"
                    ? `/dashboard/${guildId}/quete-ocre`
                    : `/dashboard/${guildId}/quetes-dofus/${dofus.slug}${selectedCharacter !== "PRINCIPAL" ? `?character=${selectedCharacter}` : ""}`
            }
            className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 will-change-transform"
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
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-caption font-black uppercase tracking-wider shadow-sm border"
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
                    <div className="w-5 h-5 rounded-md bg-warning/10 border border-warning/30 flex items-center justify-center text-warning shadow-sm" title="Dofus Primordial">
                        <Crown className="w-3 h-3" />
                    </div>
                )}
                {dofus.isMeta && (
                    <div className="w-5 h-5 rounded-md bg-info/10 border border-info/30 flex items-center justify-center text-info shadow-sm" title="Dofus Méta">
                        <Sparkles className="w-3 h-3" />
                    </div>
                )}
                {dofus.isSylvestreReq && (
                    <div className="w-5 h-5 rounded-md bg-success/10 border border-success/30 flex items-center justify-center text-success shadow-sm" title="Requis pour le Sylvestre">
                        <Gem className="w-3 h-3" />
                    </div>
                )}
            </div>
            {/* Sync all mules toggle */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const nextVal = !syncAllMules;
                    setSyncAllMules(nextVal);
                    localStorage.setItem("dofus-sync-all-mules", String(nextVal));
                    window.dispatchEvent(new Event("dofus-sync-all-mules-changed"));
                }}
                className={`absolute top-2.5 right-24 sm:right-28 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 border ${
                    syncAllMules ? "bg-info/10 border-info/30 text-info" : "bg-surface/80 border-border text-muted-foreground hover:text-info-foreground"
                }`}
                style={{
                    borderColor: syncAllMules ? `${color}66` : undefined,
                    color: syncAllMules ? color : undefined,
                    boxShadow: syncAllMules ? `0 0 8px ${color}33` : undefined,
                }}
                title={syncAllMules ? "Sync multi-personnages ACTIVE (Appliquer à tous)" : "Sync multi-personnages INACTIVE (Seulement ce perso)"}
            >
                <RefreshCw className="w-3 h-3" />
            </button>

            {/* Obtained toggle button (badge avec contraste garanti et lueur maîtrisée) */}
            <button
                onClick={handleToggleObtained}
                disabled={isPending}
                className={cn(
                    "absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-200 border shadow-sm",
                    isObtained
                        ? "shadow-md hover:scale-105"
                        : "bg-surface/90 border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-elevated"
                )}
                style={isObtained ? {
                    background: color,
                    borderColor: `${color}cc`,
                    color: getContrastTextColor(color),
                    boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 0 6px ${color}40`,
                } : undefined}
                title={isObtained ? "Dofus obtenu (cliquer pour retirer)" : "Marquer ce Dofus comme obtenu"}
                aria-label={isObtained ? "Dofus obtenu — cliquer pour annuler" : "Marquer comme obtenu"}
            >
                {isPending ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                ) : isObtained ? (
                    <>
                        <span className="text-xs font-black">✓</span>
                        <span className="hidden sm:inline">Obtenu</span>
                    </>
                ) : (
                    <>
                        <span className="text-[10px] opacity-70">○</span>
                        <span className="hidden sm:inline">À valider</span>
                    </>
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
                        showText={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative flex items-center justify-center transition-all duration-300 group- will-change-transform">
                            {dofus.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={dofus.slug === "dofoozbz" ? "/module-dofus/Dofus_Dofoozbz.png" : dofus.imageUrl.replace(/^\/public/, "")}
                                    alt={dofus.nameShort}
                                    width={56}
                                    height={56}
                                    className="object-contain"
                                    style={{
                                        filter: isObtained
                                            ? `drop-shadow(0 0 8px ${color}88)`
                                            : `drop-shadow(0 0 3px ${color}22)`,
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
                    className={cn(
                        "text-sm font-bold text-center leading-tight transition-colors",
                        isObtained ? "" : "text-foreground"
                    )}
                    style={isObtained ? { color } : undefined}
                >
                    {dofus.nameShort}
                </h3>

                {hasChain ? (
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                        <div
                            className="flex-1 h-1 rounded-full overflow-hidden bg-muted/60"
                        >
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${dofus.progressPercent}%`,
                                    background: isObtained
                                        ? `linear-gradient(90deg, ${color}, #fbbf24)`
                                        : color,
                                }}
                            />
                        </div>
                        <span 
                            className="text-caption tabular-nums font-black" 
                            style={{ color: dofus.progressPercent > 0 ? color : undefined }}
                        >
                            {dofus.progressPercent}%
                        </span>
                        <span className="text-caption tabular-nums text-muted-foreground whitespace-nowrap">
                            ({dofus.completedQuests}/{dofus.totalQuests})
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-1 mt-1">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-caption text-muted-foreground">Guide à venir</span>
                    </div>
                )}

                {dofus.levelRecommended > 0 && (
                    <p className="text-caption text-muted-foreground text-center mt-0.5">
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
