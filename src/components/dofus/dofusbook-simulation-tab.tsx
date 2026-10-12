"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { SpellRangeGrid, type SpellData } from "@/components/succes/SpellRangeGrid";
import { SimulationBoostPanel } from "@/components/succes/SimulationBoostPanel";
import { getClassSpells } from "@/server/actions/dofus-spells-actions";
import { getClassName } from "@/lib/dofusbook-utils";
import { spellEffectDetailsFromBuild, spellZoneFromDamages, type BuildStatsForSpells } from "@/lib/dofus-spells";
import { applyBoosts, targetDamageTakenFactor, type DamageBoost } from "@/lib/dofus-boosts";

interface SimulationTabProps {
    classId: number;
    level: number;
    /** Nom du build (lanceur) affiché sur la grille. */
    casterName?: string;
    /** Icône de classe locale (ex. `/assets/dofus/classes/17.png`). */
    casterIcon?: string;
    /**
     * **Stats réelles du build** (éléments, Puissance, dommages fixes/%/critiques) — mêmes valeurs
     * que l'onglet « Sorts » (`spellsBuild` de `dofusbook-preview`). Elles alimentent la prévisu de
     * dégâts de la grille (`computeSpellDamage`) : sans elles, aucune estimation par cible.
     */
    build: BuildStatsForSpells;
}

/**
 * Onglet « Simulation » d'une fiche stuff : grille isométrique 17×17 (map vide)
 * avec les sorts de la classe au grade du personnage (portée, zone, relance) **et la prévisu de
 * dégâts du build** : jets par élément appliqués aux stats du stuff (`computeSpellDamage`), jet
 * **critique** du grade quand DofusDB en publie un, total par cible, dégressivité de zone (règle
 * 3.6) et **boosts/malus** choisis par l'utilisateur — exactement la même source que la simulation
 * des monstres. Aucune dépendance externe côté client (sorts via action serveur cachée 24 h,
 * icônes via le proxy interne d'assets).
 */
export function DofusbookSimulationTab({ classId, level, casterName, casterIcon, build }: SimulationTabProps) {
    const [spells, setSpells] = useState<SpellData[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    /** Boosts sélectionnés (presets mesurés + lignes personnalisées) — état local à l'onglet. */
    const [boosts, setBoosts] = useState<DamageBoost[]>([]);

    // Build **boosté** (jamais le build d'origine muté) et facteur « dommages subis » de la cible :
    // les deux sont mémoïsés pour ne pas relancer le chargement des sorts à chaque rendu.
    const boostedBuild = useMemo(() => applyBoosts(build, boosts), [build, boosts]);
    const damageTakenMultiplier = useMemo(() => targetDamageTakenFactor(boosts), [boosts]);

    useEffect(() => {
        let cancelled = false;
        setSpells(null);
        setError(null);
        if (!classId || classId < 1 || classId > 19) {
            setError("Classe inconnue — impossible de simuler les sorts.");
            return;
        }
        getClassSpells(classId, level || 200)
            .then((res) => {
                if (cancelled) return;
                if (!res.success || !res.data || res.data.spells.length === 0) {
                    setError(res.error || "Aucun sort détecté pour cette classe.");
                    return;
                }
                setSpells(
                    res.data.spells.map((sp): SpellData => {
                        // Zone réelle issue des lignes de dégâts (`zoneDescr` DofusDB) :
                        // le champ `zone` de niveau est quasi toujours vide.
                        const summary = spellZoneFromDamages(sp.damages);
                        // Prévisu de dégâts : jets du grade **appliqués aux stats du build**
                        // (`computeSpellDamage`, même formule que l'onglet Sorts). Le taux appliqué
                        // dépend de la nature du sort (mêlée ≤ 1 PO, sinon distance) — même règle
                        // que l'onglet Sorts, aucune valeur inventée.
                        const kind: "sorts" | "melee" | "distance" = sp.maxRange <= 1 ? "melee" : "distance";
                        // Jet normal ET jet critique du grade (`critDamages` DofusDB) : la prévisu
                        // affiche les deux, comme l'infobulle du jeu.
                        const effectDetails = spellEffectDetailsFromBuild(sp.damages, boostedBuild, {
                            kind,
                            critDamages: sp.critDamages,
                        });
                        return {
                            id: sp.id,
                            name: sp.name,
                            imageUrl: sp.imageUrl,
                            apCost: sp.apCost,
                            minRange: sp.minRange,
                            range: sp.maxRange,
                            criticalChance: sp.criticalChance,
                            maxCastPerTurn: sp.maxCastPerTurn,
                            maxCastPerTarget: sp.maxCastPerTarget,
                            minCastInterval: sp.minCastInterval,
                            castInLine: !!sp.castInLine,
                            castInDiagonal: !!sp.castInDiagonal,
                            castTestLos: sp.castTestLos !== false,
                            grade: sp.grade,
                            zone: summary
                                ? { shape: summary.shape, size: summary.size, range: sp.maxRange }
                                : { shape: "Point", size: 0, range: sp.maxRange },
                            effectDetails,
                        };
                    })
                );
            })
            .catch(() => !cancelled && setError("Impossible de charger les sorts."))
        ;
        return () => {
            cancelled = true;
        };
    }, [classId, level, boostedBuild]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
                <div className="w-12 h-12 rounded-[4px] bg-surface border border-border flex items-center justify-center">
                    <Info className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            </div>
        );
    }

    if (!spells) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
                <Loader2 className="w-8 h-8 animate-spin text-success" />
                <p className="text-body-sm font-medium text-muted-foreground">
                    Préparation de la simulation ({getClassName(classId)})…
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-border pb-4">
                <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">Simulation tactique</h3>
                <p className="text-caption text-muted-foreground">
                    Grille vide 17×17 — déplacez le lanceur librement, choisissez un sort pour voir sa portée, sa zone et sa ligne de vue.
                </p>
            </div>
            <SimulationBoostPanel value={boosts} onChange={setBoosts} />
            <SpellRangeGrid
                spells={spells}
                bossName={casterName || getClassName(classId)}
                bossImageUrl={casterIcon}
                allowFreeCasterMove
                entityScale={0.6}
                hideAllies
                enemyIconUrl="/assets/icons/poutch.png"
                maxEnemies={4}
                damageTakenMultiplier={damageTakenMultiplier}
            />
        </div>
    );
}
