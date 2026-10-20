"use client";

/**
 * Fiche d'un avis de recherche — **rendu UNIQUE**, partagé par le module Succès
 * (onglet « Fiches Avis ») et la carte du monde (fiche de zone, onglet « Avis de
 * recherche »). Un seul rendu ⇒ une seule mise à jour, et l'avis se lit exactement
 * pareil partout : identité, paliers/encyclopédie, sorts, simulation, stratégie, butin.
 *
 * Aucune donnée n'est reconstruite ici : tout vient de `getBountyFiche` (lecture
 * locale du siphon). Le rendu ne déclenche aucune requête réseau.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Compass,
    ExternalLink,
    Info,
    Loader2,
    MapPin,
    Shield,
    Sparkles,
    Swords,
    Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BountyFichePayload } from "@/server/actions/bounty-actions";
import { SuccesBossEncyclo } from "@/components/succes/SuccesBossEncyclo";
import { SpellRangeGrid } from "@/components/succes/SpellRangeGrid";
import { BountyRewardCard } from "@/components/succes/BountyRewardCard";
import { DocContent } from "@/components/doc/doc-content";
import { useBossOverlay } from "@/hooks/use-boss-overlay";
import { buildBossFicheTabs, type BossFicheTabId } from "@/lib/boss-fiche-tabs";

/** Icône de monstre via le proxy d'assets (jamais de 404 : placeholder interne sinon). */
export function MonsterImage({ src, alt = "", className = "", monsterId }: { src?: string | null; alt?: string; className?: string; monsterId?: number | string }) {
    const target = monsterId;
    const initialSrc = target ? `/api/assets-dofus/monsters/${target}${src ? `?url=${encodeURIComponent(src)}` : ""}` : src || null;
    const [currentSrc, setCurrentSrc] = useState<string | null>(initialSrc);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        setCurrentSrc(target ? `/api/assets-dofus/monsters/${target}${src ? `?url=${encodeURIComponent(src)}` : ""}` : src || null);
        setFailed(false);
    }, [src, target]);
    if (!currentSrc || failed) {
        return (
            <span className={cn("inline-flex items-center justify-center bg-elevated text-muted-foreground/40", className)}>
                <Swords className="w-1/2 h-1/2 max-w-6 max-h-6" />
            </span>
        );
    }
    return <img src={currentSrc} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}


export function BountyFicheView({
    fiche,
    guildId,
    loading = false,
    /** Image de secours (liste d'origine) quand le siphon n'a pas d'illustration. */
    fallbackImageUrl = null,
    /** Texte de l'état vide (aucune fiche sélectionnée / indisponible). */
    emptyTitle = "Aucun avis à afficher",
    emptyHint = "Lancez le siphon (God → Données de jeu) pour peupler les avis de recherche.",
    showOverlayAction = true,
}: {
    fiche: BountyFichePayload | null;
    guildId: string;
    loading?: boolean;
    fallbackImageUrl?: string | null;
    emptyTitle?: string;
    emptyHint?: string;
    /** Action « Overlay » (PiP Bestiaire) : masquée sur les surfaces publiques. */
    showOverlayAction?: boolean;
}) {
    const [detailTab, setDetailTab] = useState<BossFicheTabId>("grades");
    const [activeGradeIndex, setActiveGradeIndex] = useState(0);
    const [activeSpellId, setActiveSpellId] = useState<number | undefined>(undefined);
    const { openBossOverlay } = useBossOverlay(guildId);

    const stats: any = (fiche as any)?.monsterStats ?? null;
    const grades: any[] = Array.isArray(stats?.grades) ? stats.grades : [];
    const spells: any[] = Array.isArray(stats?.spells) ? stats.spells : [];
    const drops: any[] = Array.isArray(stats?.drops) ? stats.drops : [];

    // Une fiche = un contexte neuf : onglet, palier et sort reviennent au départ.
    const ficheKey = (fiche as any)?.meta?.dofusdbId ?? (fiche as any)?.dungeon?.id ?? null;
    useEffect(() => {
        setDetailTab("grades");
        setActiveGradeIndex(0);
        setActiveSpellId(undefined);
    }, [ficheKey]);

    // Onglets de la fiche : **source unique** partagée avec la fiche publique et la
    // fiche donjon interne (`@/lib/boss-fiche-tabs`).
    const tabs = buildBossFicheTabs({
        entity: "bounty",
        counts: { grades: grades.length, roomMonsters: 0, quests: 0, achievements: 0 },
        hasMechanics: !!(fiche as any)?.meta?.mechanics,
    });

    if (loading) {
        return (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-border bg-surface/50">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!fiche) {
        return (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border bg-surface/50 p-8 text-center">
                <Target className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">{emptyHint}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-2xl border border-border bg-surface/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <MonsterImage
                        src={stats?.imageUrl ?? fallbackImageUrl}
                        monsterId={(fiche as any).meta.dofusdbId ?? undefined}
                        className="h-16 w-16 shrink-0 rounded-xl border border-border bg-background/60 object-contain p-1"
                    />
                    <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-semibold normal-case text-foreground">
                                {(fiche as any).meta.raceName}
                            </span>
                            <span className="font-mono normal-case">niv. {(fiche as any).dungeon.level}</span>
                            {(fiche as any).stale && <span className="normal-case text-muted-foreground">données datées</span>}
                        </p>
                        <h2 className="mt-0.5 truncate text-xl font-semibold text-foreground">{(fiche as any).dungeon.bossName}</h2>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Compass className="h-3.5 w-3.5 opacity-70" /> Zone de traque :{" "}
                            <span className="text-foreground/90">{(fiche as any).meta.zone ?? "non documentée"}</span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {showOverlayAction && (
                        <button
                            type="button"
                            onClick={() => openBossOverlay({ monsterName: (fiche as any).dungeon.bossName, dungeonName: (fiche as any).dungeon.name })}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/90 px-3 py-2 text-[11px] font-semibold text-background transition-colors hover:bg-foreground"
                        >
                            <Sparkles className="h-3.5 w-3.5" /> Overlay
                        </button>
                    )}
                    <Link
                        href={`/boss/${(fiche as any).dungeon.slug ?? (fiche as any).dungeon.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ExternalLink className="h-3.5 w-3.5" /> Fiche publique
                    </Link>
                </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-border bg-background/40 p-3 text-[11px] sm:grid-cols-2">
                {(fiche as any).meta.travelCommand && (
                    <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText((fiche as any).meta.travelCommand as string)}
                        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2 py-0.5 font-mono text-muted-foreground transition-colors hover:text-foreground"
                        title="Copier la commande de trajet"
                    >
                        <MapPin className="h-3 w-3" /> {(fiche as any).meta.travelCommand}
                    </button>
                )}
                {(fiche as any).meta.rewards.length > 0 && (
                    <BountyRewardCard rewards={(fiche as any).meta.rewards} />
                )}
                {(fiche as any).meta.milice && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Shield className="h-3.5 w-3.5 opacity-70" /> {(fiche as any).meta.milice}
                    </span>
                )}
                {(fiche as any).meta.battleMapLabel && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Info className="h-3.5 w-3.5" /> Simulation : {(fiche as any).meta.battleMapLabel}
                    </span>
                )}
                {(fiche as any).meta.criteria.length > 0 && (
                    <p className="text-muted-foreground sm:col-span-2">
                        <span className="text-foreground/70">Critères de chasse :</span> {(fiche as any).meta.criteria.join(" · ")}
                    </p>
                )}
            </div>

            {/* Onglets : source unique partagée (même jeu et même ordre que la fiche publique). */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border no-scrollbar">
                {tabs.map((t) => {
                    const active = detailTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setDetailTab(t.id)}
                            className={cn(
                                "flex items-center gap-2 border-b-2 -mb-px px-3 py-2 text-xs transition-colors whitespace-nowrap",
                                active ? "border-foreground/60 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={t.icon} alt="" className={cn("h-3.5 w-3.5 object-contain", !active && "opacity-60")} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {detailTab === "grades" && (
                <SuccesBossEncyclo
                    level={(fiche as any).dungeon.level}
                    grades={grades}
                    encyclo={stats?.encyclo ?? null}
                    activeGradeIndex={activeGradeIndex}
                    onGradeChange={(idx) => setActiveGradeIndex(idx)}
                />
            )}

            {detailTab === "sorts" && (
                <div className="space-y-2">
                    {spells.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                            Aucun sort référencé pour cet avis (certains, comme « Ronce », n&apos;en lancent aucun).
                        </p>
                    ) : (
                        spells.map((s: any) => (
                            <div key={s.id} className="rounded-xl border border-border bg-background/40 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-foreground">{s.name}</span>
                                    {s.apCost !== undefined && (
                                        <span className="font-mono text-[10px] text-muted-foreground">{s.apCost} PA</span>
                                    )}
                                    {s.range !== undefined && (
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            {s.minRange && s.minRange !== s.range ? `${s.minRange}-${s.range}` : s.range} PO
                                        </span>
                                    )}
                                    {s.castTestLos === false && <span className="text-[10px] text-emerald-400/80">sans LdV</span>}
                                </div>
                                {s.description && (
                                    <p className="mt-1 text-[11px] italic text-muted-foreground">{s.description}</p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {detailTab === "sim" && (
                spells.length > 0 ? (
                    <SpellRangeGrid
                        spells={spells}
                        activeSpellId={activeSpellId}
                        onSelectSpell={(s) => setActiveSpellId(s.id)}
                        bossName={(fiche as any).dungeon.bossName}
                        bossImageUrl={stats?.imageUrl ?? (fiche as any).dungeon.imageUrl ?? undefined}
                        bossId={stats?.id ?? undefined}
                        dungeonMaps={(fiche as any).dungeonMaps?.maps ?? undefined}
                        dungeonName={(fiche as any).dungeonMaps?.dungeonName}
                        grades={grades.map((g: any) => ({ level: g.level }))}
                        activeGradeIndex={activeGradeIndex}
                        onGradeChange={(idx) => setActiveGradeIndex(idx)}
                        monsters={[]}
                        allowFreeCasterMove
                    />
                ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                        Aucun sort disponible pour la simulation.
                    </p>
                )
            )}

            {detailTab === "strategy" && (fiche as any).meta.mechanics && (
                <div className="rounded-xl border border-border bg-background/40 p-4">
                    <DocContent content={(fiche as any).meta.mechanics} />
                </div>
            )}

            {detailTab === "loot" && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {drops.map((d: any) => (
                        <div key={`${d.objectId}-${d.name ?? ""}`} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 p-2.5">
                            {d.objectId ? (
                                <img
                                    src={`/api/assets-dofus/items/${d.objectId}`}
                                    alt=""
                                    className="h-9 w-9 shrink-0 object-contain"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                                />
                            ) : null}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs text-foreground">{d.name ?? `Objet #${d.objectId}`}</span>
                                {Array.isArray(d.percentByGrade) && d.percentByGrade.length > 0 && (
                                    <span className="block font-mono text-[10px] text-muted-foreground">
                                        {d.percentByGrade[activeGradeIndex] ?? d.percentByGrade[0]} %
                                    </span>
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

