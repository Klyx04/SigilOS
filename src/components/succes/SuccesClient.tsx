"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SuccesTracker } from "./SuccesTracker";
import { SuccesDirectory } from "./SuccesDirectory";
import { SuccesBossGuide } from "./SuccesBossGuide";
import { SuccesQuestsTab } from "./SuccesQuestsTab";
import { SuccesDefiTab } from "./SuccesDefiTab";
import { SuccesTitanTab } from "./SuccesTitanTab";
import { SuccesAvisTab } from "./SuccesAvisTab";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

/** Icône asset (glyphe monochrome blanc Dofus) teintée via mask-image pour suivre la couleur du texte. */
function AssetIcon({ src, className }: { src: string; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-block shrink-0 bg-current [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]",
                className
            )}
            style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
        />
    );
}

interface SuccesClientProps {
    guildId: string;
    currentProfileId?: string;
    canEditOwnSucces: boolean;
    canViewGuildSucces: boolean;
}

export function SuccesClient({
    guildId,
    canEditOwnSucces,
    canViewGuildSucces,
}: SuccesClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawView = searchParams.get("view");
    const view: "moi" | "guilde" | "boss" | "anomalies" | "bounties" | "quetes" | "defi" | "titans" =
        rawView === "guilde" ? "guilde" : rawView === "boss" ? "boss" : rawView === "anomalies" ? "anomalies" : rawView === "bounties" ? "bounties" : rawView === "quetes" ? "quetes" : rawView === "defi" ? "defi" : rawView === "titans" ? "titans" : "moi";

    const setView = useCallback(
        (next: "moi" | "guilde" | "boss" | "anomalies" | "bounties" | "quetes" | "defi" | "titans") => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("view", next);
            if (next === "guilde") params.delete("dungeon");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    const views = useMemo(
        () => [
            { id: "moi" as const, label: "Mes Succès", sub: "Ma progression", icon: "/assets/dofus/icons/success.png", disabled: !canEditOwnSucces },
            { id: "guilde" as const, label: "Succès Commun", sub: "Qui a quoi", icon: "/assets/dofus/icons/guild.png", disabled: !canViewGuildSucces },
            { id: "boss" as const, label: "Fiches Boss", sub: "Sorts & combat", icon: "/assets/dofus/icons/boss.png", disabled: false },
            { id: "anomalies" as const, label: "Fiches Anomalies", sub: "Gardiens des anomalies", icon: "/assets/dofus/icons/hourglass.png", disabled: false },
            { id: "bounties" as const, label: "Fiches Avis de recherche", sub: "Chasse & primes", icon: "/assets/avis/avitons.png", disabled: false },
            { id: "titans" as const, label: "Fiches Titans", sub: "Événements Krosmiques", icon: "/assets/dofus/game-icons/crown.png", disabled: false },
            { id: "quetes" as const, label: "Quêtes & Succès", sub: "Quêtes de donjons", icon: "/assets/dofus/icons/quests.png", disabled: false },
            { id: "defi" as const, label: "Défi", sub: "Événements & one-shot", icon: "/assets/dofus/icons/challenges.png", disabled: false },
        ],
        [canEditOwnSucces, canViewGuildSucces]
    );

    return (
        <div className="space-y-5">
            {/* Sélecteur de vue (onglets épurés et professionnels) */}
            <div className="flex items-center gap-1.5 p-1 bg-surface/80 rounded-2xl border border-border overflow-x-auto no-scrollbar" data-tour="succes-views">
                {views.map((v) => {
                    const active = view === v.id;
                    return (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => !v.disabled && setView(v.id)}
                            disabled={v.disabled}
                            data-tour={
                                v.id === "guilde"
                                    ? "succes-view-commun"
                                    : v.id === "boss"
                                    ? "succes-view-boss"
                                    : v.id === "anomalies"
                                    ? "succes-view-anomalies"
                                    : v.id === "bounties"
                                    ? "succes-view-bounties"
                                    : v.id === "quetes"
                                    ? "succes-view-quetes"
                                    : v.id === "defi"
                                    ? "succes-view-defi"
                                    : v.id === "titans"
                                    ? "succes-view-titans"
                                    : undefined
                            }
                            title={v.disabled ? "Accès non autorisé par les permissions" : `${v.label} — ${v.sub}`}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 shrink-0",
                                active
                                    ? "bg-warning/15 text-warning border border-warning/30 shadow-xs"
                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated/70 border border-transparent",
                                v.disabled && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <AssetIcon src={v.icon} className={cn("w-4 h-4", active ? "text-warning" : "text-muted-foreground")} />
                            <span>{v.label}</span>
                        </button>
                    );
                })}
            </div>

            {view === "moi" ? (
                <SuccesTracker guildId={guildId} canEdit={canEditOwnSucces} />
            ) : view === "boss" ? (
                <SuccesBossGuide guildId={guildId} />
            ) : view === "anomalies" ? (
                <SuccesBossGuide guildId={guildId} anomalyOnly />
            ) : view === "bounties" ? (
                <SuccesAvisTab guildId={guildId} />
            ) : view === "quetes" ? (
                <SuccesQuestsTab guildId={guildId} />
            ) : view === "defi" ? (
                <SuccesDefiTab guildId={guildId} canEdit={canEditOwnSucces} />
            ) : view === "titans" ? (
                <SuccesTitanTab guildId={guildId} canEdit={canEditOwnSucces} />
            ) : (
                <SuccesDirectory guildId={guildId} />
            )}
        </div>
    );
}
