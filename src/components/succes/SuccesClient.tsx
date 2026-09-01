"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScrollText, Swords, User, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuccesTracker } from "./SuccesTracker";
import { SuccesDirectory } from "./SuccesDirectory";
import { SuccesBossGuide } from "./SuccesBossGuide";
import { SuccesQuestsTab } from "./SuccesQuestsTab";
import { SuccesDefiTab } from "./SuccesDefiTab";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

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
    const view: "moi" | "guilde" | "boss" | "quetes" | "defi" =
        rawView === "guilde" ? "guilde" : rawView === "boss" ? "boss" : rawView === "quetes" ? "quetes" : rawView === "defi" ? "defi" : "moi";

    const setView = useCallback(
        (next: "moi" | "guilde" | "boss" | "quetes" | "defi") => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("view", next);
            if (next === "guilde") params.delete("dungeon");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    const views = useMemo(
        () => [
            { id: "moi" as const, label: "Mes Succès", sub: "Ma progression", icon: User, disabled: !canEditOwnSucces },
            { id: "guilde" as const, label: "Succès Commun", sub: "Qui a quoi", icon: Users, disabled: !canViewGuildSucces },
            { id: "boss" as const, label: "Fiches Boss", sub: "Sorts & combat", icon: Swords, disabled: false },
            { id: "quetes" as const, label: "Quêtes & Succès", sub: "Quêtes de donjons", icon: ScrollText, disabled: false },
            { id: "defi" as const, label: "Défi", sub: "Événements & one-shot", icon: Zap, disabled: false },
        ],
        [canEditOwnSucces, canViewGuildSucces]
    );

    return (
        <div className="space-y-6">
            {/* Sélecteur de vue (4 vues majeures du module) */}
            <div className="flex flex-wrap items-center justify-between gap-3" data-tour="succes-views">
                <div className="flex flex-wrap items-center gap-3">
                    {views.map((v) => {
                        const Icon = v.icon;
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
                                        : v.id === "quetes"
                                        ? "succes-view-quetes"
                                        : v.id === "defi"
                                        ? "succes-view-defi"
                                        : undefined
                                }
                                title={v.disabled ? "Accès non autorisé par les permissions" : v.label}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-2.5 min-h-11 rounded-2xl border transition-colors",
                                    active
                                        ? "bg-elevated/90 border-warning/50 text-foreground"
                                        : "bg-surface/70 border-border text-muted-foreground hover:bg-elevated/70",
                                    v.disabled && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0",
                                        active ? "bg-warning/15 border-warning/30 text-warning" : "bg-surface border-border text-muted-foreground"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className={cn("text-xs font-bold uppercase tracking-widest", active && "text-foreground")}>
                                        {v.label}
                                    </p>
                                    <p className="text-caption font-semibold mt-0.5 text-muted-foreground">{v.sub}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {view === "moi" ? (
                <SuccesTracker guildId={guildId} canEdit={canEditOwnSucces} />
            ) : view === "boss" ? (
                <SuccesBossGuide guildId={guildId} />
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
