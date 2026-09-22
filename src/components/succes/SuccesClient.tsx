"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuccesTracker } from "./SuccesTracker";
import { SuccesDirectory } from "./SuccesDirectory";
import { SuccesBossGuide } from "./SuccesBossGuide";
import { SuccesDefiTab } from "./SuccesDefiTab";
import { SuccesTitanTab } from "./SuccesTitanTab";
import { SuccesAvisTab } from "./SuccesAvisTab";

interface SuccesClientProps {
    guildId: string;
    currentProfileId?: string;
    canEditOwnSucces: boolean;
    canViewGuildSucces: boolean;
}

/** Les 4 types de fiches sont regroupés derrière un seul bloc « Fiches » (sous-sélecteur). */
type FicheTab = "boss" | "anomalies" | "bounties" | "titans";
type View = "menu" | "moi" | "guilde" | "fiches" | "defi";

/**
 * Assets distinctifs par type (les mêmes que partout ailleurs dans l'app :
 * `ano1` = anomalie, `avitons` = avis, `titan` = titan). Rendus **bruts**
 * (jamais en mask monochrome : le mask aplatit les assets couleur et les
 * rend indistinguables en 14 px).
 */
const FICHE_TABS: { id: FicheTab; label: string; sub: string; icon: string }[] = [
    { id: "boss", label: "Boss", sub: "Sorts, statistiques & combat", icon: "/assets/dofus/icons/boss.png" },
    { id: "anomalies", label: "Anomalies", sub: "Gardiens des anomalies temporelles", icon: "/assets/missions/ano1.png" },
    { id: "bounties", label: "Avis de recherche", sub: "Chasse & primes", icon: "/assets/avis/avitons.png" },
    { id: "titans", label: "Titans", sub: "Événements Krosmiques", icon: "/assets/dofus/icons/titan.png" },
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

    // Ancienne vue globale `?view=quetes` (supprimée) : les quêtes vivent désormais
    // dans l'onglet « Quêtes » de chaque fiche boss / titan.
    useEffect(() => {
        if (rawView === "quetes") {
            const params = new URLSearchParams(searchParams.toString());
            params.set("view", "boss");
            params.set("onglet", "quetes");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        }
    }, [rawView, router, searchParams]);

    const activeFiche: FicheTab = isFicheTab(rawView) ? rawView : "boss";
    const view: View =
        rawView === "guilde" ? "guilde"
        : rawView === "defi" ? "defi"
        : rawView === "moi" ? "moi"
        : rawView === "fiches" || isFicheTab(rawView) || rawView === "quetes" ? "fiches"
        : "menu";

    const replaceView = useCallback(
        (next: string, keepDungeon: boolean) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("view", next);
            if (next !== "boss") params.delete("onglet");
            if (!keepDungeon) params.delete("dungeon");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    const goMenu = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("view");
        params.delete("dungeon");
        params.delete("onglet");
        const qs = params.toString();
        router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }, [router, searchParams]);

    // Hub premium : cartes neutres (aucune pastille teintée), l'immersion vient
    // des assets du jeu rendus nus, pas d'un remplissage coloré.
    const cards = useMemo(
        () => [
            { id: "moi" as const, label: "Mes Succès", eyebrow: "Progression", desc: "Ta progression, donjon par donjon — là où tu coches.", cta: "Ouvrir mes succès", icon: "/assets/dofus/icons/success.png", tour: "succes-menu-moi", disabled: !canEditOwnSucces },
            { id: "guilde" as const, label: "Succès Commun", eyebrow: "Guilde", desc: "Qui dans la guilde a validé quoi — pour monter ton groupe.", cta: "Voir la guilde", icon: "/assets/dofus/icons/guild.png", tour: "succes-view-commun", disabled: !canViewGuildSucces },
            { id: "fiches" as const, label: "Fiches", eyebrow: "Encyclopédie", desc: "Boss, anomalies, avis de recherche, titans — sorts, quêtes et simulation.", cta: "Ouvrir les fiches", icon: "/assets/dofus/icons/boss.png", tour: "succes-view-fiches", disabled: false },
            { id: "defi" as const, label: "Défi", eyebrow: "Communauté", desc: "Événements & one-shot communautaires.", cta: "Voir les défis", icon: "/assets/dofus/icons/challenges.png", tour: "succes-view-defi", disabled: false },
        ],
        [canEditOwnSucces, canViewGuildSucces]
    );

    return (
        <div className="space-y-5">
            {view !== "menu" && (
                <div>
                    <button
                        type="button"
                        onClick={goMenu}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-elevated text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Retour au menu Succès</span>
                    </button>
                </div>
            )}

            {view === "menu" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" data-tour="succes-views">
                    {cards.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            disabled={c.disabled}
                            data-tour={c.tour}
                            title={c.disabled ? "Accès non autorisé par les permissions" : `${c.label} — ${c.desc}`}
                            onClick={() => !c.disabled && replaceView(c.id === "fiches" ? activeFiche : c.id, true)}
                            className={cn(
                                "group relative flex flex-col justify-between p-6 min-h-[240px] rounded-2xl border border-border bg-surface hover:bg-elevated hover:border-border-strong transition-colors duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                c.disabled && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-background border border-border p-2">
                                        <img src={c.icon} alt="" className="w-12 h-12 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                    </div>
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{c.eyebrow}</span>
                                </div>
                                <div>
                                    <h3 className="text-title font-bold text-foreground mb-1">{c.label}</h3>
                                    <p className="text-body-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                                </div>
                            </div>
                            <div className="space-y-3 pt-6 border-t border-border">
                                <span className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg border border-border bg-background text-caption font-bold text-foreground group-hover:bg-elevated transition-colors">
                                    {c.cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Sous-sélecteur des fiches — un seul bloc « Fiches », quatre sous-vues */}
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
                                    "flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 shrink-0",
                                    active
                                        ? "bg-info/15 text-info border border-info/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-elevated/60 border border-transparent"
                                )}
                            >
                                <img
                                    src={f.icon}
                                    alt=""
                                    aria-hidden
                                    className="w-5 h-5 object-contain shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
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
            ) : view === "defi" ? (
                <SuccesDefiTab guildId={guildId} canEdit={canEditOwnSucces} />
            ) : view === "guilde" ? (
                <SuccesDirectory guildId={guildId} />
            ) : null}
        </div>
    );
}
