"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Zap, Sword, Target, Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClassSpells, type ClassSpellDamage } from "@/server/actions/dofus-spells-actions";
import { computeSpellDamage, type BuildStatsForSpells, type SpellElementKey } from "@/lib/dofus-spells";
import { getClassName } from "@/lib/dofusbook-utils";

const frNumber = new Intl.NumberFormat("fr-FR");

/**
 * Libellé + icône + token couleur par élément.
 * Icônes = `/assets/module-succes/*` (vraies icônes Dofus, même mapping que
 * `SuccesBossGuide`) ; couleurs = tokens sémantiques (cohérents fiche boss :
 * Terre→warning, Feu→danger, Eau→info, Air→success).
 */
const ELEMENT_META: Record<SpellElementKey, { label: string; icon: string; text: string }> = {
    terre: { label: "Terre", icon: "/assets/module-succes/terre.png", text: "text-warning" },
    feu: { label: "Feu", icon: "/assets/module-succes/Intelligence.png", text: "text-danger" },
    eau: { label: "Eau", icon: "/assets/module-succes/eau.png", text: "text-info" },
    air: { label: "Air", icon: "/assets/module-succes/Agility.png", text: "text-success" },
    neutre: { label: "Neutre", icon: "/assets/module-succes/neutre.png", text: "text-foreground" },
};

const KIND_LABEL: Record<string, string> = { sorts: "% Do Sorts", melee: "% Do Mêlée", distance: "% Do Dist." };

interface SpellsTabProps {
    classId: number;
    level: number;
    build: BuildStatsForSpells;
}

type VariantFilter = "all" | "base" | "variant";
type ElementFilter = "all" | SpellElementKey | "utility";

/**
 * Onglet « Sorts » : affiche tous les sorts de classe (sorts de base & variantes)
 * avec leurs dégâts théoriques calculés (non-crit / critique) appliqués aux stats réelles du build.
 */
export function DofusSpellsTab({ classId, level, build }: SpellsTabProps) {
    const [spells, setSpells] = useState<ClassSpellDamage[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Sélection du grade par sort : { [spellId]: gradeNumber }
    const [gradeSel, setGradeSel] = useState<Record<number, number>>({});

    // Filtres & recherche
    const [searchQuery, setSearchQuery] = useState("");
    const [variantFilter, setVariantFilter] = useState<VariantFilter>("all");
    const [elementFilter, setElementFilter] = useState<ElementFilter>("all");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setSpells(null);

        if (!classId || classId < 1 || classId > 19) {
            setLoading(false);
            setError("Classe inconnue — impossible de lister les sorts. Sélectionnez une classe pour ce build.");
            return;
        }

        getClassSpells(classId, level || 200)
            .then((res) => {
                if (cancelled) return;
                if (!res.success || !res.data || res.data.spells.length === 0) {
                    setError(res.error || "Aucun sort détecté pour cette classe.");
                } else {
                    setSpells(res.data.spells);
                }
            })
            .catch(() => !cancelled && setError("Impossible de charger les sorts."))
            .finally(() => !cancelled && setLoading(false));

        return () => { cancelled = true; };
    }, [classId, level]);

    // Calcul des dégâts et stats par sort selon le grade sélectionné
    const computedSpells = useMemo(() => {
        if (!spells) return [];

        return spells.map((sp) => {
            const gradesList = sp.grades && sp.grades.length > 0 ? [...sp.grades].sort((a, b) => a.grade - b.grade) : null;
            const chosenGrade = gradeSel[sp.id] ?? sp.grade;
            const active = gradesList?.find((g) => g.grade === chosenGrade) ?? null;

            const dmgLines = (active ? active.damages : sp.damages) || [];
            const critLines = active ? active.critDamages : sp.critDamages;
            const gLabel = active ? active.grade : sp.grade;
            const gMinPlayerLevel = active?.minPlayerLevel ?? sp.minPlayerLevel ?? 1;
            const maxRange = active ? active.maxRange : sp.maxRange;
            const minRange = active ? active.minRange : sp.minRange;
            const apCost = active ? active.apCost : sp.apCost;
            const critChance = active ? active.criticalChance : sp.criticalChance;

            const kind: "sorts" | "melee" | "distance" = maxRange <= 1 ? "melee" : "distance";

            const parts = (dmgLines.length > 0 ? dmgLines : []).map((dmg, idx) => {
                const crit = critLines?.[idx];
                return computeSpellDamage(
                    { ...dmg, grade: gLabel },
                    build,
                    kind,
                    sp.critMult || 1.5,
                    crit ? { min: crit.min, max: crit.max } : undefined
                );
            });

            const result = parts.length > 0 ? {
                baseMin: parts.reduce((a, p) => a + p.baseMin, 0),
                baseMax: parts.reduce((a, p) => a + p.baseMax, 0),
                theoMin: parts.reduce((a, p) => a + p.theoMin, 0),
                theoMax: parts.reduce((a, p) => a + p.theoMax, 0),
                critMin: parts.reduce((a, p) => a + p.critMin, 0),
                critMax: parts.reduce((a, p) => a + p.critMax, 0),
                elementStat: parts[0]?.elementStat ?? 0,
                critMult: parts[0]?.critMult ?? 1.5,
                grade: gLabel,
            } : null;

            const primaryElement: SpellElementKey = (dmgLines[0]?.element) ?? "neutre";
            const isUtility = !result;

            return {
                ...sp,
                gradesList,
                activeGrade: active,
                dmgLines,
                gAp: apCost,
                gMin: minRange,
                gMax: maxRange,
                gCrit: critChance,
                gLabel,
                gMinPlayerLevel,
                elements: parts,
                result,
                primaryElement,
                isUtility,
                kind,
            };
        });
    }, [spells, gradeSel, build]);

    // Filtrage des sorts
    const filteredSpells = useMemo(() => {
        return computedSpells.filter((sp) => {
            // Filtre variante
            if (variantFilter === "base" && sp.isVariant) return false;
            if (variantFilter === "variant" && !sp.isVariant) return false;

            // Filtre élément
            if (elementFilter === "utility" && !sp.isUtility) return false;
            if (elementFilter !== "all" && elementFilter !== "utility") {
                if (sp.isUtility) return false;
                const hasElement = sp.dmgLines.some((d) => d.element === elementFilter);
                if (!hasElement) return false;
            }

            // Recherche textuelle
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = sp.name.toLowerCase().includes(q);
                const matchVariant = sp.variantSpellName?.toLowerCase().includes(q);
                if (!matchName && !matchVariant) return false;
            }

            return true;
        });
    }, [computedSpells, variantFilter, elementFilter, searchQuery]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
                <Loader2 className="w-8 h-8 animate-spin text-success" />
                <p className="text-body-sm font-medium text-muted-foreground">
                    Chargement des sorts de {getClassName(classId)}…
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center">
                    <Info className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            </div>
        );
    }

    const [pctSorts, pctMelee, pctDist] = [
        build.damages.sorts || 0,
        build.damages.melee || 0,
        build.damages.distance || 0,
    ];

    const baseCount = computedSpells.filter((s) => !s.isVariant).length;
    const variantCount = computedSpells.filter((s) => s.isVariant).length;

    return (
        <div className="flex flex-col gap-5">
            {/* 1. Bandeau Stats du Build */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface border border-border rounded-2xl">
                <div className="flex flex-wrap items-center gap-2 text-caption">
                    <span className="px-2.5 py-1 bg-surface border border-border rounded-xl font-medium text-muted-foreground">
                        Puissance <span className="text-foreground font-bold tabular-nums">{build.elements.pu || 0}</span>
                    </span>
                    <span className="px-2.5 py-1 bg-surface border border-border rounded-xl font-medium text-muted-foreground">
                        % Do Sorts <span className="text-foreground font-bold tabular-nums">{pctSorts}%</span>
                    </span>
                    <span className="px-2.5 py-1 bg-surface border border-border rounded-xl font-medium text-muted-foreground">
                        % Do Mêlée <span className="text-foreground font-bold tabular-nums">{pctMelee}%</span>
                    </span>
                    <span className="px-2.5 py-1 bg-surface border border-border rounded-xl font-medium text-muted-foreground">
                        % Do Dist. <span className="text-foreground font-bold tabular-nums">{pctDist}%</span>
                    </span>
                    {(build.damages.critique || 0) > 0 && (
                        <span className="px-2.5 py-1 bg-danger/10 border border-danger/30 rounded-xl font-medium text-danger">
                            Do Crit. <span className="font-bold tabular-nums">+{build.damages.critique}</span>
                        </span>
                    )}
                </div>

                <div className="text-caption text-muted-foreground font-bold">
                    {filteredSpells.length} sort(s) affiché(s) sur {computedSpells.length}
                </div>
            </div>

            {/* 2. Barre d'outils : Recherche & Filtres */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Filtre Type (Tous / Base / Variantes) */}
                <div className="flex items-center gap-1 bg-surface/60 border border-border p-1 rounded-xl shrink-0">
                    <button
                        type="button"
                        onClick={() => setVariantFilter("all")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-caption font-bold transition-colors cursor-pointer",
                            variantFilter === "all"
                                ? "bg-elevated text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Tous ({computedSpells.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setVariantFilter("base")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-caption font-bold transition-colors cursor-pointer",
                            variantFilter === "base"
                                ? "bg-elevated text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Base ({baseCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setVariantFilter("variant")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-caption font-bold transition-colors cursor-pointer",
                            variantFilter === "variant"
                                ? "bg-elevated text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Variantes ({variantCount})
                    </button>
                </div>

                {/* Filtre par élément */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                    {(["all", "terre", "feu", "eau", "air", "neutre", "utility"] as const).map((elem) => {
                        const isSelected = elementFilter === elem;
                        const label = elem === "all" ? "Tous" : elem === "utility" ? "Utilitaires" : ELEMENT_META[elem]?.label;
                        const icon = elem === "all" || elem === "utility" ? null : ELEMENT_META[elem]?.icon;
                        const colorClass = elem === "all" || elem === "utility" ? "text-foreground" : ELEMENT_META[elem]?.text;

                        return (
                            <button
                                key={elem}
                                type="button"
                                onClick={() => setElementFilter(elem)}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-caption font-bold uppercase transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5",
                                    isSelected
                                        ? "bg-foreground text-background"
                                        : "bg-surface border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                )}
                            >
                                {icon && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={icon} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain" loading="lazy" />
                                )}
                                <span className={isSelected ? "text-background" : colorClass}>{label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Recherche */}
                <div className="relative min-w-[200px] sm:w-64">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un sort…"
                        className="w-full pl-9 pr-3 py-1.5 bg-surface/60 border border-border rounded-xl text-caption text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50 transition-colors"
                    />
                </div>
            </div>

            {/* 3. Grille des sorts */}
            {filteredSpells.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 bg-surface/20 border border-border rounded-2xl text-center">
                    <Info className="w-6 h-6 text-muted-foreground" />
                    <p className="text-body-sm font-bold text-foreground">Aucun sort ne correspond à ces critères.</p>
                    <p className="text-caption text-muted-foreground">Essayez d'ajuster les filtres ou la recherche.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {filteredSpells.map((sp) => {
                        const meta = ELEMENT_META[sp.primaryElement];
                        const currentGrade = gradeSel[sp.id] ?? sp.gLabel;

                        return (
                            <div
                                key={sp.id}
                                className={cn(
                                    "flex flex-col gap-2.5 bg-surface p-4 rounded-2xl border transition-colors",
                                    sp.isVariant ? "border-border/80 hover:border-info/30" : "border-border hover:border-success/30",
                                    sp.isUtility && "opacity-90"
                                )}
                            >
                                {/* En-tête du sort */}
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-elevated border border-border flex items-center justify-center overflow-hidden shrink-0 relative">
                                        {sp.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={sp.imageUrl} alt={sp.name} className="w-full h-full object-contain p-0.5" loading="lazy" />
                                        ) : (
                                            <Zap className={cn("w-5 h-5", meta?.text ?? "text-muted-foreground")} />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-label font-bold text-foreground truncate" title={sp.name}>
                                                {sp.name}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {sp.isVariant ? (
                                                <span className="px-1.5 py-0.5 bg-info/10 border border-info/20 text-info text-[10px] font-bold rounded uppercase">
                                                    Variante
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 bg-surface border border-border text-muted-foreground text-[10px] font-bold rounded uppercase">
                                                    Base
                                                </span>
                                            )}
                                            <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold uppercase", meta?.text ?? "text-muted-foreground")}>
                                                {!sp.isUtility && meta && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={meta.icon} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain" loading="lazy" />
                                                )}
                                                {sp.isUtility ? "Utilitaire" : meta?.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Sélecteur dynamique de grades : 1, 2, 3 ou 1, 2 */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {sp.gradesList && sp.gradesList.length > 1 ? (
                                            sp.gradesList.map((g) => {
                                                const isCurrent = g.grade === currentGrade;
                                                const isAccessible = (g.minPlayerLevel ?? 1) <= (level || 200);

                                                return (
                                                    <button
                                                        key={g.grade}
                                                        type="button"
                                                        title={`Grade ${g.grade} (Niveau ${g.minPlayerLevel ?? 1})`}
                                                        onClick={() => setGradeSel((prev) => ({ ...prev, [sp.id]: g.grade }))}
                                                        className={cn(
                                                            "min-w-6 h-6 px-1.5 rounded-lg text-[11px] font-bold tabular-nums transition-colors cursor-pointer",
                                                            isCurrent
                                                                ? "bg-foreground text-background"
                                                                : isAccessible
                                                                    ? "bg-surface border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                                                                    : "bg-surface/30 border border-border/40 text-muted-foreground/40 hover:text-muted-foreground"
                                                        )}
                                                    >
                                                        {g.grade}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] font-bold text-muted-foreground tabular-nums">
                                                Niv. {sp.gLabel > 0 ? sp.gLabel : 1}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Caractéristiques : PA / Portée / Crit */}
                                <div className="grid grid-cols-3 gap-1.5 text-center my-0.5">
                                    <div className="bg-surface rounded-xl py-1.5 border border-border/50">
                                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-bold uppercase">
                                            <Zap className="w-3 h-3 text-info" /> AP
                                        </div>
                                        <p className="text-label font-bold text-foreground tabular-nums">{sp.gAp}</p>
                                    </div>
                                    <div className="bg-surface rounded-xl py-1.5 border border-border/50">
                                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-bold uppercase">
                                            <Target className="w-3 h-3 text-success" /> Portée
                                        </div>
                                        <p className="text-label font-bold text-foreground tabular-nums">
                                            {sp.gMax <= 1 ? (sp.gMax === 0 ? "0" : "1 (mêlée)") : `${sp.gMin > 1 ? `${sp.gMin}–` : ""}${sp.gMax}`}
                                        </p>
                                    </div>
                                    <div className="bg-surface rounded-xl py-1.5 border border-border/50">
                                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-bold uppercase">
                                            <Sword className="w-3 h-3 text-danger" /> Crit
                                        </div>
                                        <p className="text-label font-bold text-foreground tabular-nums">{sp.gCrit}%</p>
                                    </div>
                                </div>

                                {/* Section Dégâts */}
                                {sp.result ? (
                                    <div className="flex flex-col gap-1.5 border-t border-border pt-2.5 mt-auto">
                                        {sp.elements && sp.elements.length > 1 ? (
                                            <>
                                                {sp.elements.map((p, idx) => {
                                                    const lineMeta = ELEMENT_META[sp.dmgLines[idx]?.element ?? "neutre"];
                                                    return (
                                                        <div key={idx} className="flex items-baseline justify-between text-caption">
                                                            <span className={cn("inline-flex items-center gap-1.5 font-medium", lineMeta?.text ?? "text-muted-foreground")}>
                                                                {lineMeta && (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={lineMeta.icon} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain" loading="lazy" />
                                                                )}
                                                                {lineMeta?.label} {frNumber.format(p.theoMin)}–{frNumber.format(p.theoMax)}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground italic">
                                                                Base {p.baseMin}–{p.baseMax}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                <div className="flex items-baseline justify-between border-t border-border/50 pt-1.5 mt-0.5">
                                                    <span className="text-caption font-bold text-muted-foreground uppercase">Total par lancer</span>
                                                    <span className={cn("font-bold text-body-sm tabular-nums", meta?.text ?? "text-foreground")}>
                                                        {frNumber.format(sp.result.theoMin)}–{frNumber.format(sp.result.theoMax)}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-caption font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                        Critique
                                                    </span>
                                                    <span className="font-bold text-body-sm tabular-nums text-danger">
                                                        {frNumber.format(sp.result.critMin)}–{frNumber.format(sp.result.critMax)}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-caption text-muted-foreground">
                                                        Base {frNumber.format(sp.result.baseMin)}–{frNumber.format(sp.result.baseMax)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground italic">{KIND_LABEL[sp.kind]}</span>
                                                </div>
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-caption font-bold text-muted-foreground uppercase">Dégâts</span>
                                                    <span className={cn("font-bold text-body-sm tabular-nums", meta?.text ?? "text-foreground")}>
                                                        {frNumber.format(sp.result.theoMin)}–{frNumber.format(sp.result.theoMax)}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-caption font-bold text-muted-foreground uppercase">Critique</span>
                                                    <span className="font-bold text-body-sm tabular-nums text-danger">
                                                        {frNumber.format(sp.result.critMin)}–{frNumber.format(sp.result.critMax)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-auto pt-2 border-t border-border flex items-center justify-between text-caption text-muted-foreground italic">
                                        <span>Sort utilitaire / soutien</span>
                                        <span className="text-[10px] uppercase font-bold not-italic px-1.5 py-0.5 bg-surface rounded">
                                            Niv. req {sp.gMinPlayerLevel}
                                        </span>
                                    </div>
                                )}

                                {/* Variante associée si connue */}
                                {sp.variantSpellName && (
                                    <div className="pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
                                        <span className="truncate">
                                            {sp.isVariant ? "Sort de base :" : "Variante :"} <strong className="text-foreground/80">{sp.variantSpellName}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-caption text-muted-foreground italic mt-2">
                Dégâts théoriques (formule Dofus 2 : base × (1 + (stat + puissance)/100) + dommages fixes, majorés par les % sorts/distance/mêlée).
                Le total cumule les lignes du sort par lancer — comparez les lignes unitaires avec Dofusbook / DofusDB.
            </p>
        </div>
    );
}
