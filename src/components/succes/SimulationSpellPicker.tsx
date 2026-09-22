"use client";

/**
 * Sélecteur de SORT de la simulation tactique — **source unique** des deux modes.
 *
 * 🎯 Retour user (21/09/2026, verbatim) : « inutile d'afficher dans le dropdown de sort les sorts
 * qui ne font pas de dégâts · dropdown moche à revoir avec ses icônes, compatible white/dark mode ».
 *
 * 🔍 Cause racine mesurée : le mode « fiche » montait un `<select>` **natif** (liste blanche du
 * système, aucune icône, aucun accord avec le thème) et le mode « vue de jeu » recopiait un menu
 * custom en `zinc-900` — deux rendus, deux palettes, et les sorts utilitaires (soins, états, +PO)
 * noyaient les sorts qui tapent.
 *
 * Ce composant remplace **les deux** : mêmes entrées, mêmes icônes, mêmes jetons. Le filtre
 * « sorts avec dégâts » est **actif par défaut** ; les sorts sans dégâts restent accessibles en un
 * clic sur le pied du menu (on masque du bruit, on ne retire aucune capacité de simulation).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ListFilter, Move, Search, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { damageLinesFromEffects, formatDamageRange, type SpellElementKey } from "@/lib/dofus-spells";
import { DOFUS_STAT_ASSET_BASE, STAT_THEMES, dofusStatHex } from "@/lib/dofus-stats-theme";

/** Entrée minimale dont le sélecteur a besoin (structurellement compatible avec `SpellData`). */
export interface SimulationSpellOption {
    id: number;
    name: string;
    nameEn?: string;
    imageUrl?: string;
    apCost?: number;
    minRange?: number;
    range?: number;
    /** Effets structurés : seule source des jets affichés (jamais un parsing de texte). */
    effectDetails?:
        | { damage?: { element: string; min: number; max: number } | null; pushDistance?: number | null }[]
        | null;
}

interface SimulationSpellPickerProps {
    spells: SimulationSpellOption[];
    activeSpellId?: number | null;
    onSelect: (spell: SimulationSpellOption) => void;
    /**
     * `board` = chrome sombre posée **sur le plateau** (vue de jeu : palette de jeu volontaire) ;
     * `page` = surface **thémée** (fiche / landing), lisible en thème clair **comme** en sombre.
     */
    variant?: "board" | "page";
    /** Largeur du déclencheur (le panneau s'aligne sur lui). */
    className?: string;
    /** Le bloc d'identité (mode fiche) porte déjà la grande icône du sort. */
    showTriggerIcon?: boolean;
    /** Nom accessible du déclencheur (passé en `aria-label` — verrouillé par test). */
    "aria-label"?: string;
}

/** Élément → entrée du thème de stats (icône locale + couleur du jeu). */
const ELEMENT_STAT_KEY: Record<SpellElementKey, keyof typeof STAT_THEMES> = {
    terre: "earthDamage",
    feu: "fireDamage",
    eau: "waterDamage",
    air: "airDamage",
    neutre: "neutralDamage",
};

/** Ordre d'affichage des éléments (feu · terre · eau · air · neutre = ordre des fiches Dofus). */
const ELEMENT_ORDER: SpellElementKey[] = ["feu", "terre", "eau", "air", "neutre"];

export function SimulationSpellPicker({
    spells,
    activeSpellId,
    onSelect,
    variant = "page",
    className,
    showTriggerIcon = true,
    "aria-label": ariaLabel,
}: SimulationSpellPickerProps) {
    const { t, locale } = useI18n();
    const simT = t.tacticalSim;
    const isBoard = variant === "board";

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [showAll, setShowAll] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Fermeture au clic extérieur + Échap : le panneau vit au-dessus du plateau, il ne doit jamais
    // rester ouvert pendant qu'on manipule la carte.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const displayName = (spell: SimulationSpellOption) =>
        locale === "en" ? spell.nameEn || spell.name : spell.name;

    /** Jets par élément d'un sort (données serveur) — sert au filtre ET aux chips du menu. */
    const damagesOf = (spell: SimulationSpellOption) => damageLinesFromEffects(spell.effectDetails);

    const activeSpell = spells.find((s) => s.id === activeSpellId) ?? null;

    /**
     * Filtre « sorts qui tapent », actif par défaut. Repli sûr documenté : si **aucun** sort de la
     * famille ne porte de jet exploitable (payload sans `effectDetails`, ex. sorts DofusDB seuls),
     * on montre tous les sorts plutôt qu'une liste vide.
     */
    const visibleSpells = useMemo(() => {
        const withDamage = spells.filter((s) => damageLinesFromEffects(s.effectDetails).lines.length > 0);
        if (showAll || withDamage.length === 0) return spells;
        return withDamage;
    }, [spells, showAll]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return visibleSpells;
        return visibleSpells.filter(
            (s) => s.name.toLowerCase().includes(q) || (s.nameEn ?? "").toLowerCase().includes(q)
        );
    }, [visibleSpells, query]);

    const rangeLabel = (spell: SimulationSpellOption) => {
        const min = spell.minRange ?? 0;
        const max = spell.range ?? 0;
        return min === max ? `${max} PO` : `${min} à ${max} PO`;
    };

    /**
     * Chips de dégâts d'une ligne du menu : icône **locale** de l'élément + jet réel, colorés avec
     * la palette **réelle du jeu** (`dofusStatHex`) — identique en thème clair et sombre, comme
     * dans les fiches. La poussée éventuelle est affichée telle quelle (jamais convertie).
     */
    const damageChips = (spell: SimulationSpellOption) => {
        const { lines, push } = damagesOf(spell);
        if (lines.length === 0 && push === null) return null;
        return (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {ELEMENT_ORDER.filter((el) => lines.some((l) => l.element === el)).map((el) => {
                    const line = lines.find((l) => l.element === el);
                    if (!line) return null;
                    const theme = STAT_THEMES[ELEMENT_STAT_KEY[el]];
                    return (
                        <span
                            key={el}
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums"
                            style={{ color: dofusStatHex(theme.asset) }}
                            title={theme.label}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`${DOFUS_STAT_ASSET_BASE}/${theme.asset}`}
                                alt=""
                                className="h-3 w-3 shrink-0 object-contain"
                            />
                            {formatDamageRange(line.min, line.max)}
                        </span>
                    );
                })}
                {push !== null && (
                    <span
                        className={cn(
                            "inline-flex items-center gap-0.5 text-[10px] font-bold",
                            isBoard ? "text-zinc-400" : "text-muted-foreground"
                        )}
                    >
                        <Move className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {push}
                    </span>
                )}
            </span>
        );
    };

    return (
        <div ref={rootRef} className={cn("relative min-w-0", className)}>
            <button
                type="button"
                aria-label={ariaLabel ?? simT.selectSpell}
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen((v) => !v)}
                title={
                    activeSpell
                        ? `${displayName(activeSpell)} (${activeSpell.apCost ?? 0} PA · ${rangeLabel(activeSpell)})`
                        : simT.selectSpell
                }
                className={cn(
                    "flex w-full cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
                    isBoard
                        ? cn(
                              "text-[11px] font-bold",
                              open
                                  ? "border-white/25 bg-white/[0.10] text-white"
                                  : "border-white/10 bg-[#121218]/95 text-zinc-200 hover:border-white/20 hover:bg-zinc-800"
                          )
                        : cn(
                              "text-[13px] font-bold",
                              open
                                  ? "border-accent/40 bg-accent/10 text-foreground"
                                  : "border-border bg-surface text-foreground hover:border-accent/30 hover:bg-elevated"
                          )
                )}
            >
                {showTriggerIcon &&
                    (activeSpell?.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={activeSpell.imageUrl}
                            alt=""
                            className="h-4 w-4 shrink-0 rounded object-contain"
                            onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                if (!el.dataset.fb && activeSpell.imageUrl) {
                                    el.dataset.fb = "1";
                                    el.src = `/api/assets-dofus/spells/${activeSpell.id}?url=${encodeURIComponent(activeSpell.imageUrl)}`;
                                } else {
                                    el.style.display = "none";
                                }
                            }}
                        />
                    ) : (
                        <Zap
                            className={cn("h-4 w-4 shrink-0", isBoard ? "text-zinc-400" : "text-warning")}
                            aria-hidden="true"
                        />
                    ))}
                <span className="truncate">{activeSpell ? displayName(activeSpell) : simT.selectSpell}</span>
                {activeSpell && (
                    <span
                        className={cn(
                            "shrink-0 text-[10px] font-black tabular-nums",
                            isBoard ? "text-zinc-400" : "text-muted-foreground"
                        )}
                    >
                        {activeSpell.apCost ?? 0} PA · {rangeLabel(activeSpell)}
                    </span>
                )}
                <ChevronDown
                    className={cn(
                        "ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                        isBoard ? "text-zinc-400" : "text-muted-foreground",
                        open && "rotate-180"
                    )}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div
                    data-no-drag
                    role="listbox"
                    className={cn(
                        "absolute left-0 top-full z-50 mt-1 w-full min-w-[17rem] rounded-xl border p-1 shadow-2xl",
                        isBoard ? "border-white/15 bg-[#121218]/97 backdrop-blur-md" : "border-border bg-popover"
                    )}
                >
                    <div className="flex items-center gap-1.5 px-1 pb-1">
                        <Search
                            className={cn("h-3.5 w-3.5 shrink-0", isBoard ? "text-zinc-500" : "text-muted-foreground")}
                            aria-hidden="true"
                        />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={simT.spellPickerSearch}
                            aria-label={simT.spellPickerSearch}
                            className={cn(
                                "min-w-0 flex-1 rounded-md border px-1.5 py-1 text-[11px] focus:outline-none",
                                isBoard
                                    ? "border-white/10 bg-white/[0.06] text-white placeholder:text-zinc-500"
                                    : "border-border bg-surface text-foreground placeholder:text-muted-foreground"
                            )}
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                aria-label={simT.spellPickerClear}
                                className={cn(
                                    "cursor-pointer p-0.5",
                                    isBoard ? "text-zinc-400 hover:text-white" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    <div className="max-h-[min(50vh,16rem)] overflow-y-auto [scrollbar-width:thin]">
                        {filtered.length === 0 && (
                            <p
                                className={cn(
                                    "px-2 py-3 text-center text-[11px]",
                                    isBoard ? "text-zinc-500" : "text-muted-foreground"
                                )}
                            >
                                {simT.spellPickerEmpty}
                            </p>
                        )}
                        {filtered.map((spell) => {
                            const isSelected = spell.id === activeSpellId;
                            return (
                                <button
                                    key={spell.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onSelect(spell);
                                        setOpen(false);
                                        setQuery("");
                                    }}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                                        isBoard
                                            ? cn(
                                                  "text-[11px]",
                                                  isSelected
                                                      ? "bg-white/[0.10] text-white"
                                                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                                              )
                                            : cn(
                                                  "text-xs",
                                                  isSelected
                                                      ? "bg-accent/10 text-foreground"
                                                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                                              )
                                    )}
                                >
                                    {spell.imageUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={spell.imageUrl}
                                            alt=""
                                            loading="lazy"
                                            className={cn("shrink-0 rounded object-contain", isBoard ? "h-3.5 w-3.5" : "h-5 w-5")}
                                            onError={(e) => {
                                                const el = e.target as HTMLImageElement;
                                                if (!el.dataset.fb) {
                                                    el.dataset.fb = "1";
                                                    el.src = `/api/assets-dofus/spells/${spell.id}?url=${encodeURIComponent(spell.imageUrl as string)}`;
                                                } else {
                                                    el.style.display = "none";
                                                }
                                            }}
                                        />
                                    ) : (
                                        <Zap
                                            className={cn("h-3.5 w-3.5 shrink-0", isBoard ? "text-zinc-500" : "text-muted-foreground")}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="min-w-0 flex-1 truncate font-semibold">{displayName(spell)}</span>
                                    <span
                                        className={cn(
                                            "shrink-0 text-[10px] font-black tabular-nums",
                                            isBoard ? "text-zinc-400" : "text-muted-foreground"
                                        )}
                                    >
                                        {spell.apCost ?? 0} PA · {rangeLabel(spell)}
                                    </span>
                                    {damageChips(spell)}
                                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Filtre assumé : les sorts SANS dégâts sont masqués par défaut (retour user),
                        mais restent à un clic — aucune capacité de simulation n'est retirée. */}
                    <button
                        type="button"
                        aria-pressed={showAll}
                        onClick={() => setShowAll((v) => !v)}
                        className={cn(
                            "mt-1 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors",
                            isBoard
                                ? "border-white/10 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                                : "border-border text-muted-foreground hover:bg-surface hover:text-foreground"
                        )}
                    >
                        <ListFilter className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {showAll ? simT.spellPickerDamageOnly : simT.spellPickerShowAll}
                        <span className="ml-auto tabular-nums">
                            {simT.spellPickerCount.replace("{count}", String(filtered.length))}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

