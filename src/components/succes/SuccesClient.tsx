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
        <div className="space-y-5">
            {/* Sélecteur de vue (onglets épurés et professionnels) */}
            <div className="flex items-center gap-1.5 p-1 bg-surface/80 rounded-2xl border border-border overflow-x-auto no-scrollbar" data-tour="succes-views">
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
                            title={v.disabled ? "Accès non autorisé par les permissions" : `${v.label} — ${v.sub}`}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 shrink-0",
                                active
                                    ? "bg-warning/15 text-warning border border-warning/30 shadow-xs"
                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated/70 border border-transparent",
                                v.disabled && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <Icon className={cn("w-4 h-4 shrink-0", active ? "text-warning" : "text-muted-foreground")} />
                            <span>{v.label}</span>
                        </button>
                    );
                })}
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
