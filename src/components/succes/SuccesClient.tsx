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

/** Les 4 types de fiches sont regroupés derrière un seul onglet « Fiches » (sous-sélecteur). */
type FicheTab = "boss" | "anomalies" | "bounties" | "titans";
type View = "moi" | "guilde" | "fiches" | "quetes" | "defi";

const FICHE_TABS: { id: FicheTab; label: string; sub: string; icon: string }[] = [
    { id: "boss", label: "Boss", sub: "Sorts, statistiques & combat", icon: "/assets/dofus/icons/boss.png" },
    { id: "anomalies", label: "Anomalies", sub: "Gardiens des anomalies temporelles", icon: "/assets/dofus/icons/hourglass.png" },
    { id: "bounties", label: "Avis de recherche", sub: "Chasse & primes", icon: "/assets/avis/avitons.png" },
    { id: "titans", label: "Titans", sub: "Événements Krosmiques", icon: "/assets/dofus/game-icons/crown.png" },
];

/** `?view=boss|anomalies|bounties|titans` reste valide (liens profonds et tutoriel). */
function isFicheTab(value: string | null): value is FicheTab {
    return value === "boss" || value === "anomalies" || value === "bounties" || value === "titans";
}

export function SuccesClient({
    guildId,
    canEditOwnSucces,
    canViewGuildSucces,
}: SuccesClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawView = searchParams.get("view");

    const activeFiche: FicheTab = isFicheTab(rawView) ? rawView : "boss";
    const view: View =
        rawView === "guilde" ? "guilde"
        : rawView === "quetes" ? "quetes"
        : rawView === "defi" ? "defi"
        : rawView === "fiches" || isFicheTab(rawView) ? "fiches"
        : "moi";

    const replaceView = useCallback(
        (next: string, keepDungeon: boolean) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("view", next);
            if (!keepDungeon) params.delete("dungeon");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    const setView = useCallback(
        (next: View) => replaceView(next === "fiches" ? activeFiche : next, next === "guilde" ? false : true),
        [activeFiche, replaceView]
    );

    const views = useMemo(
        () => [
            { id: "moi" as const, label: "Mes Succès", sub: "Ma progression", icon: "/assets/dofus/icons/success.png", disabled: !canEditOwnSucces },
            { id: "guilde" as const, label: "Succès Commun", sub: "Qui a quoi", icon: "/assets/dofus/icons/guild.png", disabled: !canViewGuildSucces },
            { id: "fiches" as const, label: "Fiches", sub: "Boss, anomalies, avis de recherche, titans", icon: "/assets/dofus/icons/boss.png", disabled: false },
            { id: "quetes" as const, label: "Quêtes & Succès", sub: "Quêtes de donjons", icon: "/assets/dofus/icons/quests.png", disabled: false },
            { id: "defi" as const, label: "Défi", sub: "Événements & one-shot", icon: "/assets/dofus/icons/challenges.png", disabled: false },
        ],
        [canEditOwnSucces, canViewGuildSucces]
    );

    const viewTourId: Record<string, string | undefined> = {
        guilde: "succes-view-commun",
        fiches: "succes-view-fiches",
        quetes: "succes-view-quetes",
        defi: "succes-view-defi",
    };

    return (
        <div className="space-y-5">
            {/* Sélecteur de vue principal — 5 entrées, les 4 types de fiches sont regroupés */}
            <div className="flex items-center gap-1.5 p-1 bg-surface/80 rounded-2xl border border-border overflow-x-auto no-scrollbar" data-tour="succes-views">
                {views.map((v) => {
                    const active = view === v.id;
                    return (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => !v.disabled && setView(v.id)}
                            disabled={v.disabled}
                            data-tour={viewTourId[v.id]}
                            aria-current={active ? "page" : undefined}
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

            {/* Sous-sélecteur des fiches — un seul onglet « Fiches », quatre sous-vues */}
            {view === "fiches" && (
                <div
                    role="tablist"
                    aria-label="Type de fiche"
                    className="flex items-center gap-1 p-1 bg-background/50 border border-border rounded-2xl overflow-x-auto no-scrollbar"
                >
                    {FICHE_TABS.map((f) => {
                        const active = activeFiche === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                data-tour={`succes-view-${f.id}`}
                                title={f.sub}
                                onClick={() => replaceView(f.id, false)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 shrink-0",
                                    active
                                        ? "bg-info/15 text-info border border-info/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-elevated/60 border border-transparent"
                                )}
                            >
                                <AssetIcon src={f.icon} className={cn("w-3.5 h-3.5", active ? "text-info" : "text-muted-foreground")} />
                                <span>{f.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {view === "moi" ? (
                <SuccesTracker guildId={guildId} canEdit={canEditOwnSucces} />
            ) : view === "fiches" && activeFiche === "boss" ? (
                <SuccesBossGuide guildId={guildId} />
            ) : view === "fiches" && activeFiche === "anomalies" ? (
                <SuccesBossGuide guildId={guildId} anomalyOnly />
            ) : view === "fiches" && activeFiche === "bounties" ? (
                <SuccesAvisTab guildId={guildId} />
            ) : view === "fiches" && activeFiche === "titans" ? (
                <SuccesTitanTab guildId={guildId} canEdit={canEditOwnSucces} />
            ) : view === "quetes" ? (
                <SuccesQuestsTab guildId={guildId} />
            ) : view === "defi" ? (
                <SuccesDefiTab guildId={guildId} canEdit={canEditOwnSucces} />
            ) : (
                <SuccesDirectory guildId={guildId} />
            )}
        </div>
    );
}
