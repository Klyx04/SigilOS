"use client";

/**
 * Fiche d'un **monstre normal** — rendu UNIQUE, partagé par la fiche publique
 * (`/bestiaire/<slug>`) et l'onglet « Monstres » du module Succès : le monstre se lit
 * donc exactement pareil partout, et une correction ne se fait qu'une fois.
 *
 * Parité des onglets : la LISTE vient de la **source unique** `@/lib/boss-fiche-tabs`
 * (mêmes règles de masquage que les fiches boss / avis) — un monstre a donc bien son
 * onglet **Butin** et son onglet **Simulation** (`SpellRangeGrid`, le même que les fiches
 * boss), plus Rangs & Paliers, Sorts, et Stratégie quand un passif est décrit.
 *
 * Aucune donnée n'est reconstruite ici : tout vient de `getMonsterFicheBySegment`
 * (lecture **locale** du siphon puis du bestiaire du client). Le rendu ne déclenche
 * aucune requête réseau — les images passent par le proxy d'assets interne.
 */
import { useEffect, useState } from "react";
import { Coins, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuccesBossEncyclo } from "@/components/succes/SuccesBossEncyclo";
import { MonsterImage } from "@/components/succes/BountyFicheView";
import { SpellRangeGrid } from "@/components/succes/SpellRangeGrid";
import { resolveSpellIconUrl } from "@/lib/dofus-image-url";
import { buildBossFicheTabs, type BossFicheTabId } from "@/lib/boss-fiche-tabs";
import {
    parseInvocationId,
    resolveInvocationLabel,
    scaleUnityDamageLine,
} from "@/lib/monster-spell-levels";
import { cleanDofusText, isRenderableDofusEffectLine } from "@/lib/dofus-spells";
import {
    getMonsterSpellLevels,
    resolveMonsterNames,
    type MonsterSpellLevelsData,
} from "@/server/actions/monster-spell-actions";

export interface MonsterFichePayload {
    monsterId: number;
    name: string;
    /** `siphon` = ligne `MonsterStat` · `unity` = bestiaire local du client. */
    source: "siphon" | "unity";
    data: any;
}

/** Icône de sort par l'**espace d'icône** du proxy (`sort_<iconId>`) — jamais de 404. */
function SpellIcon({ iconId }: { iconId?: number | string | null }) {
    const [failed, setFailed] = useState(false);
    const src = iconId === null || iconId === undefined || iconId === "" ? null : resolveSpellIconUrl(iconId as number);
    if (failed || !src) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt=""
            className="h-8 w-8 shrink-0 object-contain"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

export function MonsterFicheView({
    fiche,
    loading = false,
    locale = "fr",
    /** Message affiché quand aucune fiche n'est sélectionnée (onglet interne). */
    emptyLabel,
    className = "",
}: {
    fiche: MonsterFichePayload | null;
    loading?: boolean;
    locale?: "fr" | "en";
    emptyLabel?: string;
    className?: string;
}) {
    const fr = locale !== "en";
    const [detailTab, setDetailTab] = useState<BossFicheTabId>("grades");
    const [activeGradeIndex, setActiveGradeIndex] = useState(0);
    const [activeSpellId, setActiveSpellId] = useState<number | undefined>(undefined);

    const data = fiche?.data ?? null;
    const grades: any[] = Array.isArray(data?.grades) ? data.grades : [];
    const spells: any[] = Array.isArray(data?.spells) ? data.spells : [];
    const drops: any[] = Array.isArray(data?.drops) ? data.drops : [];
    const passive = data?.passive?.description ? data.passive : null;
    const zoneName = data?.encyclo?.names?.zoneName ?? null;
    const ficheKey = fiche?.monsterId ?? null;

    // Lot 6 — enrichissement sorts (niveaux DofusDB : conditions + noms
    // d'invocations). Lazy + fail-soft : en échec, le rendu local reste tel quel.
    const [spellLevels, setSpellLevels] = useState<MonsterSpellLevelsData | null>(null);
    const [summonNames, setSummonNames] = useState<Record<number, string>>({});
    useEffect(() => {
        setSpellLevels(null);
        setSummonNames({});
        const mid = Number(fiche?.monsterId);
        if (!Number.isFinite(mid) || mid <= 0) return;
        let cancelled = false;
        getMonsterSpellLevels(mid)
            .then((res) => {
                if (!cancelled && res.success && res.data) setSpellLevels(res.data);
            })
            .catch(() => {});
        const invocationIds = ((Array.isArray(fiche?.data?.spells) ? fiche.data.spells : []) as any[])
            .flatMap((s: any) => [
                ...(Array.isArray(s?.effects) ? s.effects : []),
                ...(Array.isArray(s?.unityEffects) ? s.unityEffects : []),
            ])
            .map((label: unknown) => parseInvocationId(String(label ?? "")))
            .filter((n): n is number => n !== null);
        if (invocationIds.length > 0) {
            resolveMonsterNames(invocationIds)
                .then((res) => {
                    if (!cancelled && res.success && res.data) setSummonNames(res.data);
                })
                .catch(() => {});
        }
        return () => {
            cancelled = true;
        };
    }, [ficheKey]);

    // Une fiche = un contexte neuf : onglet, palier et sort reviennent au départ.
    useEffect(() => {
        setDetailTab("grades");
        setActiveGradeIndex(0);
        setActiveSpellId(undefined);
    }, [ficheKey]);

    // Onglets : **source unique** partagée (mêmes règles que les fiches boss / avis).
    const tabs = buildBossFicheTabs({
        entity: "monster",
        counts: { grades: grades.length, roomMonsters: 0, monsters: 0, quests: 0, achievements: 0 },
        hasMechanics: !!passive,
        locale,
    });

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground", className)}>
                <Loader2 className="h-4 w-4 animate-spin" />
                {fr ? "Chargement de la fiche…" : "Loading…"}
            </div>
        );
    }

    if (!fiche || !data) {
        return (
            <div className={cn("py-16 text-center text-xs text-muted-foreground", className)}>
                {emptyLabel ?? (fr ? "Aucune fiche à afficher." : "Nothing to display.")}
            </div>
        );
    }

    return (
        <section className={cn("space-y-4 rounded-2xl border border-border bg-surface/50 p-4", className)}>
            <header className="flex items-start gap-3">
                <MonsterImage
                    src={data.imageUrl}
                    monsterId={fiche.monsterId}
                    alt={fiche.name}
                    className="h-16 w-16 shrink-0 rounded-xl border border-border bg-background/60 object-contain p-1"
                />
                <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{fiche.name}</h1>
                    {zoneName ? <p className="mt-0.5 text-xs text-muted-foreground">{zoneName}</p> : null}
                </div>
            </header>

            {/* Onglets : source unique partagée (même jeu et même ordre que les fiches boss). */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border no-scrollbar">
                {tabs.map((tab) => {
                    const active = detailTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDetailTab(tab.id)}
                            className={cn(
                                "flex cursor-pointer items-center gap-2 border-b-2 -mb-px px-3 py-2 text-xs whitespace-nowrap transition-colors",
                                active
                                    ? "border-foreground/60 text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tab.icon} alt="" className={cn("h-3.5 w-3.5 object-contain", !active && "opacity-60")} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {detailTab === "grades" && (
                <SuccesBossEncyclo
                    level={grades[activeGradeIndex]?.level ?? grades[0]?.level ?? 0}
                    grades={grades}
                    encyclo={data.encyclo ?? null}
                    activeGradeIndex={activeGradeIndex}
                    onGradeChange={(idx) => setActiveGradeIndex(idx)}
                />
            )}

            {detailTab === "sorts" && (
                <div className="space-y-2">
                    {spells.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                            {fr ? "Aucun sort référencé pour ce monstre." : "No spell referenced for this monster."}
                        </p>
                    ) : (
                        spells.map((spell: any, index: number) => {
                            const rawEffects: string[] = spell.effects?.length ? spell.effects : (spell.unityEffects ?? []);
                            const description = spell.description || spell.unityDescription || "";
                            // Lot 6 — dégâts calculés (dés × stats du palier actif) + noms
                            // d'invocations résolus. À défaut : libellé brut d'origine.
                            const gradeStats = grades[activeGradeIndex] ?? grades[0] ?? {};
                            const carac = (gradeStats as any)?.carac ?? gradeStats;
                            const dmgStats = {
                                earth: carac?.strength,
                                fire: carac?.intelligence,
                                water: carac?.chance,
                                air: carac?.agility,
                            };
                            const lookup = (id: number): string | null => summonNames[id] ?? null;
                            // Mesure du 20/10/2026 : `unity-bestiary.json` contient **4 380** lignes
                            // d'effet réduites à un id client nu (« 24515 ») et **5 351** lignes portant
                            // des balises `{{~ps}}` / `{{~zs}}`. La règle de nettoyage existait déjà
                            // (`cleanDofusText`, utilisée par la fiche boss, l'overlay et Succès) mais
                            // **pas ici** : le monstre était la seule surface publique à afficher le brut.
                            const renderedEffects = rawEffects
                                .map((effect) => cleanDofusText(String(effect)))
                                .filter((effect) => isRenderableDofusEffectLine(effect))
                                .map((effect) => scaleUnityDamageLine(resolveInvocationLabel(effect, lookup), dmgStats));
                            const enriched = (spellLevels?.spells ?? []).find((s) => s.spellId === Number(spell.id));
                            return (
                                <div key={`${spell.id}-${index}`} className="flex items-start gap-2.5 rounded-xl border border-border bg-background/40 p-3">
                                    <SpellIcon iconId={spell.unityIconId ?? spell.iconId} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-semibold text-foreground">{spell.name}</span>
                                            {spell.apCost !== undefined ? <span className="font-mono text-[10px] text-muted-foreground">{spell.apCost} PA</span> : null}
                                            {spell.range !== undefined ? <span className="font-mono text-[10px] text-muted-foreground">{spell.range} PO</span> : null}
                                        </div>
                                        {enriched && enriched.conditions.length > 0 ? (
                                            <p className="mt-1 text-[10px] text-muted-foreground">{enriched.conditions.join(" · ")}</p>
                                        ) : null}
                                        {renderedEffects.length > 0 ? (
                                            <ul className="mt-1 space-y-0.5">
                                                {renderedEffects.map((effect, i) => (
                                                    <li key={i} className="text-[11px] text-muted-foreground">{effect}</li>
                                                ))}
                                            </ul>
                                        ) : description ? (
                                            <p className="mt-1 text-[11px] italic text-muted-foreground">{description}</p>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Passif de début de combat (texte officiel du client, jamais deviné). */}
            {detailTab === "strategy" && passive && (
                <div className="rounded-xl border border-border bg-background/40 p-4">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        {passive.name || (fr ? "Passif de combat" : "Combat passive")}
                    </h2>
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {passive.description}
                    </p>
                </div>
            )}

            {/* Simulation : le MÊME composant que les fiches boss / avis (portées, LdV, grille). */}
            {detailTab === "sim" && (
                spells.length > 0 ? (
                    <SpellRangeGrid
                        spells={spells}
                        activeSpellId={activeSpellId}
                        onSelectSpell={(s) => setActiveSpellId(s.id)}
                        bossName={fiche.name}
                        bossImageUrl={data.imageUrl ?? undefined}
                        bossId={fiche.monsterId}
                        grades={grades.map((g: any) => ({ level: g.level }))}
                        activeGradeIndex={activeGradeIndex}
                        onGradeChange={(idx) => setActiveGradeIndex(idx)}
                        monsters={[]}
                        allowFreeCasterMove
                    />
                ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                        {fr ? "Aucun sort disponible pour la simulation." : "No spell available for the simulation."}
                    </p>
                )
            )}

            {/* Butin — vide tant que le siphon n'est pas passé (aucune table inventée). */}
            {detailTab === "loot" && (
                drops.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                        {fr ? "Butin non renseigné pour ce monstre." : "No loot referenced for this monster."}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {drops.some((d: any) => Array.isArray(d.percentByGrade)) && (
                            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Coins className="h-3.5 w-3.5" />
                                {fr
                                    ? `Taux du rang ${activeGradeIndex + 1} (voir l'onglet Rangs & Paliers)`
                                    : `Rank ${activeGradeIndex + 1} rates (see the Ranks & Levels tab)`}
                            </p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                            {drops.map((drop: any) => (
                                <div key={`${drop.objectId}-${drop.name ?? ""}`} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 p-2.5">
                                    {drop.objectId ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={`/api/assets-dofus/items/${drop.objectId}`}
                                            alt=""
                                            className="h-9 w-9 shrink-0 object-contain"
                                            loading="lazy"
                                            onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                                        />
                                    ) : null}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs text-foreground">{drop.name ?? `Objet #${drop.objectId}`}</span>
                                        <span className="block font-mono text-[10px] text-muted-foreground">
                                            {Number(drop.percentByGrade?.[activeGradeIndex] ?? drop.percent ?? 0).toFixed(2)} %
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            )}
        </section>
    );
}
