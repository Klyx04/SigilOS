"use client";

import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { encycloProperties } from "@/lib/dofus-encyclo";
import { dofusStatAssetUrl, resolveDofusStatTheme } from "@/lib/dofus-stats-theme";

/**
 * Picto officiel d'une stat (source unique : `dofus-stats-theme`, les mêmes
 * assets que le module stuff DofusBook — Force = terre, Intelligence = feu,
 * Chance = eau, Agilité = air). `undefined` si aucun thème (ex. XP).
 */
function statThemeIcon(label: string): string | undefined {
    const theme = resolveDofusStatTheme(undefined, undefined, undefined, label);
    return theme ? dofusStatAssetUrl(theme.asset) : undefined;
}

interface EncycloGradeView {
    level?: number | null;
    lifePoints?: number | null;
    actionPoints?: number | null;
    movementPoints?: number | null;
    resists?: {
        neutral?: number | null;
        earth?: number | null;
        fire?: number | null;
        water?: number | null;
        air?: number | null;
    } | null;
    carac?: {
        wisdom?: number | null;
        strength?: number | null;
        intelligence?: number | null;
        chance?: number | null;
        agility?: number | null;
        paDodge?: number | null;
        pmDodge?: number | null;
        gradeXp?: number | null;
    } | null;
}

interface EncycloView {
    raceId?: number | null;
    subareaIds?: number[] | null;
    aggressiveZoneSize?: number | null;
    aggressiveLevelDiff?: number | null;
    canTackle?: boolean | null;
    canBePushed?: boolean | null;
    canSwitchPos?: boolean | null;
    canSwitchPosOnTarget?: boolean | null;
    canBeCarried?: boolean | null;
    canUsePortal?: boolean | null;
    soulCaptureForbidden?: boolean | null;
    names?: { raceName?: string | null; superRaceName?: string | null; zoneName?: string | null } | null;
}

const fmt = (v: number | null | undefined): string =>
    typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("fr-FR") : "—";

function StatCell({ icon, label, value }: { icon?: string; label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5 py-0.5 min-w-0" title={label}>
            {icon ? (
                <img src={icon} alt="" className="w-4 h-4 object-contain shrink-0" />
            ) : (
                <span aria-hidden className="w-4 shrink-0" />
            )}
            <span className="text-xs font-bold text-foreground tabular-nums">{value}</span>
            <span className="text-[11px] text-muted-foreground truncate">{label}</span>
        </div>
    );
}

/**
 * Section encyclopédique d'une fiche boss (façon encyclopédie Dofus) :
 * identité (race, zone), sélecteur de RANG, caractéristiques du grade actif,
 * résistances et propriétés. Tout champ absent est masqué — jamais inventé.
 * Les fiches non resynchronisées affichent le tableau réduit + une note.
 */
export function SuccesBossEncyclo({
    level,
    grades,
    encyclo,
    activeGradeIndex,
    onGradeChange,
    dungeonName,
}: {
    level: number;
    grades: EncycloGradeView[];
    encyclo?: EncycloView | null;
    activeGradeIndex: number | null;
    onGradeChange: (idx: number) => void;
    /** Nom du donjon (donnée locale) — ligne « Donjons » façon DofusDB. */
    dungeonName?: string | null;
}) {
    const idx = activeGradeIndex ?? (grades.length > 0 ? grades.length - 1 : 0);
    const g = grades[idx] ?? null;
    const carac = g?.carac ?? null;
    const names = encyclo?.names ?? null;
    const properties = encyclo
        ? encycloProperties(encyclo as any, g?.level ?? level)
        : [];
    // Règle métier existante : 5 grades ⇒ paliers de butin 4..8.
    const is5Grades = grades.length === 5;

    return (
        <div className="space-y-3 rounded-xl border border-border bg-surface/40 px-3 py-2.5">
            {/* Identité — race, zone (siphonnés, jamais saisis) + donjon local */}
            {(names?.raceName || names?.zoneName || dungeonName) && (
                <div className="space-y-0.5">
                    {names?.raceName && (
                        <p className="text-xs text-muted-foreground">
                            {names.raceName}
                            {names.superRaceName ? ` - ${names.superRaceName}` : ""}
                        </p>
                    )}
                    {names?.zoneName && (
                        <p className="text-xs font-bold text-foreground">{names.zoneName}</p>
                    )}
                    {dungeonName && (
                        <p className="text-xs text-muted-foreground">
                            Donjons: <span className="font-bold text-foreground">{dungeonName}</span>
                        </p>
                    )}
                </div>
            )}

            {/* Rangs — sélecteur de grade global (simulation + sorts suivent) */}
            {grades.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Rang :
                    </span>
                    {grades.map((gr, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onGradeChange(i)}
                            aria-pressed={idx === i}
                            title={is5Grades ? `Rang ${i + 1} — Butin ${4 + i}` : `Rang ${i + 1} — Niv. ${gr.level ?? "—"}`}
                            className={cn(
                                "min-w-7 h-7 px-2 rounded-lg border text-xs font-bold tabular-nums transition-colors",
                                idx === i
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
                            )}
                        >
                            {i + 1}
                        </button>
                    ))}
                    {is5Grades && (
                        <span className="text-[11px] text-muted-foreground ml-1">
                            Butin {4 + idx}
                        </span>
                    )}
                </div>
            )}

            {/* Caractéristiques du grade actif — grille dense façon DofusDB.
                Les 5 stats sans picto dédié (Force, Intelligence, Chance,
                Agilité, XP) restent en label texte : aucun détournement d'asset. */}
            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Caractéristiques
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-5">
                    <StatCell icon="/assets/dofus/stats/pv.png" label="PV" value={fmt(g?.lifePoints)} />
                    <StatCell icon="/assets/dofus/stats/pa.png" label="PA" value={fmt(g?.actionPoints)} />
                    <StatCell icon="/assets/dofus/stats/pm.png" label="PM" value={fmt(g?.movementPoints)} />
                    <StatCell icon="/assets/dofus/stats/sagesse.png" label="Sagesse" value={fmt(carac?.wisdom)} />
                    <StatCell icon={statThemeIcon("Force")} label="Force" value={fmt(carac?.strength)} />
                    <StatCell icon={statThemeIcon("Intelligence")} label="Intelligence" value={fmt(carac?.intelligence)} />
                    <StatCell icon={statThemeIcon("Chance")} label="Chance" value={fmt(carac?.chance)} />
                    <StatCell icon={statThemeIcon("Agilité")} label="Agilité" value={fmt(carac?.agility)} />
                    <StatCell icon="/assets/dofus/stats/esquivePA.png" label="Esquive PA" value={fmt(carac?.paDodge)} />
                    <StatCell icon="/assets/dofus/stats/esquivePM.png" label="Esquive PM" value={fmt(carac?.pmDodge)} />
                    <StatCell label="XP" value={carac?.gradeXp != null ? `${fmt(carac.gradeXp)} XP` : "—"} />
                </div>
                {!carac && grades.length > 0 && (
                    <p className="text-[11px] text-muted-foreground italic mt-1">
                        Caractéristiques détaillées en cours de synchronisation — PV, PA, PM et résistances ci-dessous sont à jour.
                    </p>
                )}
            </div>

            {/* Résistances */}
            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Résistances
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {(
                        [
                            { key: "neutral", label: "Neutre", icon: "/assets/dofus/stats/resNeutre.png" },
                            { key: "earth", label: "Terre", icon: "/assets/dofus/stats/resTerre.png" },
                            { key: "fire", label: "Feu", icon: "/assets/dofus/stats/resFeu.png" },
                            { key: "water", label: "Eau", icon: "/assets/dofus/stats/resEau.png" },
                            { key: "air", label: "Air", icon: "/assets/dofus/stats/resAir.png" },
                        ] as const
                    ).map(({ key, label, icon }) => {
                        const value = g?.resists?.[key] ?? null;
                        return (
                            <span key={key} className="inline-flex items-center gap-1.5" title={`Résistance ${label}`}>
                                <img src={icon} alt="" className="w-4 h-4 object-contain" />
                                <span className={cn("font-mono text-[13px] tabular-nums", typeof value === "number" && value < 0 ? "text-danger" : "text-foreground/85")}>
                                    {typeof value === "number" ? `${value}%` : "—"}
                                </span>
                                <span className="hidden text-[11px] text-muted-foreground sm:inline">{label}</span>
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Propriétés (agression + restrictions, façon DofusDB) */}
            {properties.length > 0 && (
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                        <ScrollText className="w-3.5 h-3.5" /> Propriétés
                    </p>
                    <ul className="space-y-0.5">
                        {properties.map((line) => (
                            <li key={line} className="text-xs text-foreground/90">
                                {line}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
