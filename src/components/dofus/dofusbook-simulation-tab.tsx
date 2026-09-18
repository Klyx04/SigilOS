"use client";

import { useEffect, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { SpellRangeGrid, type SpellData } from "@/components/succes/SpellRangeGrid";
import { getClassSpells } from "@/server/actions/dofus-spells-actions";
import { getClassName } from "@/lib/dofusbook-utils";
import { spellZoneFromDamages } from "@/lib/dofus-spells";

interface SimulationTabProps {
    classId: number;
    level: number;
    /** Nom du build (lanceur) affiché sur la grille. */
    casterName?: string;
    /** Icône de classe locale (ex. `/assets/dofus/classes/17.png`). */
    casterIcon?: string;
}

/**
 * Onglet « Simulation » d'une fiche stuff : grille isométrique 17×17 (map vide)
 * avec les sorts de la classe au grade du personnage (portée, zone, relance).
 * Aucune dépendance externe côté client (sorts via action serveur cachée 24 h,
 * icônes via le proxy interne d'assets).
 */
export function DofusbookSimulationTab({ classId, level, casterName, casterIcon }: SimulationTabProps) {
    const [spells, setSpells] = useState<SpellData[] | null>(null);
    const [error, setError] = useState<string | null>(null);

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
                        };
                    })
                );
            })
            .catch(() => !cancelled && setError("Impossible de charger les sorts."))
        ;
        return () => {
            cancelled = true;
        };
    }, [classId, level]);

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
            <SpellRangeGrid
                spells={spells}
                bossName={casterName || getClassName(classId)}
                bossImageUrl={casterIcon}
                allowFreeCasterMove
                entityScale={0.6}
                hideAllies
                enemyIconUrl="/assets/icons/poutch.png"
                maxEnemies={4}
            />
        </div>
    );
}
