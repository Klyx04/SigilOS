"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { DofusUiIcon, type DofusUiIconName } from "@/components/shared/dofus-ui-icon";
import { cn } from "@/lib/utils";

export interface DjFiltersState {
    search: string;
    mode: string;         // "" | "DONJON" | "QUETE"
    minLevel: number;
    maxLevel: number;
    showClosed: boolean;
    onlyWithAchievement: boolean;
    onlyWithSpots: boolean;
}

export const DEFAULT_FILTERS: DjFiltersState = {
    search: "",
    mode: "",
    minLevel: 1,
    maxLevel: 1000,
    showClosed: false,
    onlyWithAchievement: false,
    onlyWithSpots: false,
};

interface DjFiltersBarProps {
    filters: DjFiltersState;
    onChange: (f: DjFiltersState) => void;
    total: number;
    filtered: number;
    /** Nombre de posts par mode (`""` = tous modes) : on ne clique plus à l'aveugle. */
    modeCounts?: Record<string, number>;
}

const LEVEL_PRESETS = [
    { label: "Tout", min: 1, max: 1000 },
    { label: "1-100", min: 1, max: 100 },
    { label: "100-140", min: 100, max: 140 },
    { label: "140-200", min: 140, max: 200 },
    { label: "200+", min: 200, max: 1000 },
];

/** Segments de mode — pictos Dofus (mêmes fichiers que Succès/Ladder) + compteur. */
const MODE_SEGMENTS: Array<{ value: string; label: string; asset: DofusUiIconName | null }> = [
    { value: "", label: "Tout", asset: null },
    { value: "DONJON", label: "Donjons", asset: "dungeon" },
    { value: "QUETE", label: "Quêtes", asset: "quest" },
    { value: "DEFI", label: "Défi", asset: "challenge" },
    { value: "TITAN", label: "Titans", asset: "titan" },
];

export function DjFiltersBar({ filters, onChange, total, filtered, modeCounts = {} }: DjFiltersBarProps) {
    const searchRef = useRef<HTMLInputElement>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Raccourci « / » : focus la recherche sans voler la frappe d'un champ déjà actif.
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
            const el = document.activeElement as HTMLElement | null;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
            e.preventDefault();
            searchRef.current?.focus();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const hasActiveAdvancedFilters =
        filters.minLevel !== 1 ||
        filters.maxLevel !== 1000 ||
        filters.showClosed ||
        filters.onlyWithAchievement ||
        filters.onlyWithSpots;

    const hasActiveFilters = filters.search !== "" || filters.mode !== "" || hasActiveAdvancedFilters;

    const activePreset = LEVEL_PRESETS.find(
        (p) => p.min === filters.minLevel && p.max === filters.maxLevel
    );

    return (
        <div className="space-y-3" data-tour="donjons-filters">
            {/* Row 1: Essential Search + Mode + Filter Toggle */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                {/* Recherche — « / » fait gagner un clic quand le champ est vide */}
                <div className="relative group flex-1 min-w-0">
                    <Search className={cn(
                        "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                        filters.search ? "text-foreground" : "text-muted-foreground group-focus-within:text-foreground"
                    )} />
                    <input
                        ref={searchRef}
                        type="text"
                        value={filters.search}
                        onChange={(e) => onChange({ ...filters, search: e.target.value })}
                        placeholder="Rechercher un donjon, boss, quête…"
                        aria-label="Rechercher un donjon, un boss ou une quête"
                        className="h-11 w-full rounded-xl border border-border bg-surface/60 pl-10 pr-10 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-border-strong focus:bg-surface"
                    />
                    {filters.search ? (
                        <button
                            onClick={() => onChange({ ...filters, search: "" })}
                            title="Effacer la recherche"
                            aria-label="Effacer la recherche"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    ) : (
                        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground md:block">
                            /
                        </kbd>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Segments de mode — état actif neutre : l'accent reste réservé aux statuts */}
                    <div
                        className="flex items-center gap-1 p-1 h-11 rounded-xl border border-border bg-surface/50 shrink-0 overflow-x-auto custom-scrollbar"
                        role="group"
                        aria-label="Type de post"
                    >
                        {MODE_SEGMENTS.map(({ value, label, asset }) => {
                            const isActive = filters.mode === value;
                            const count = modeCounts[value] ?? 0;
                            return (
                                <button
                                    key={value || "all"}
                                    onClick={() => onChange({ ...filters, mode: value })}
                                    aria-pressed={isActive}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 h-9 rounded-lg border text-caption font-bold whitespace-nowrap transition-colors",
                                        isActive
                                            ? "bg-elevated border-border-strong text-foreground shadow-sm"
                                            : "border-transparent text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                                    )}
                                >
                                    {asset
                                        ? <DofusUiIcon name={asset} size={13} />
                                        : <LayoutGrid className="w-3.5 h-3.5 shrink-0" />}
                                    <span>{label}</span>
                                    {count > 0 && (
                                        <span className={cn(
                                            "font-mono text-[10px] tabular-nums",
                                            isActive ? "text-muted-foreground" : "text-muted-foreground/60"
                                        )}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Filtres avancés — icône de réglages (l'ancienne était « membres ») */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        aria-expanded={showAdvanced}
                        className={cn(
                            "flex items-center justify-center gap-2 px-4 h-11 min-w-[132px] rounded-xl border text-caption font-black transition-colors",
                            showAdvanced || hasActiveAdvancedFilters
                                ? "bg-elevated border-border-strong text-foreground"
                                : "bg-surface/50 border-border text-muted-foreground hover:bg-surface hover:text-foreground"
                        )}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                        Filtres
                        {hasActiveFilters && (
                            <span className="font-mono tabular-nums text-[10px] opacity-80">{filtered}/{total}</span>
                        )}
                    </button>

                    {/* Réinitialiser — toujours monté (désactivé) : le compteur ne déplace rien */}
                    <button
                        onClick={() => onChange({ ...DEFAULT_FILTERS })}
                        disabled={!hasActiveFilters}
                        className="flex items-center justify-center w-11 h-11 rounded-xl border border-border bg-surface/50 text-muted-foreground shrink-0 transition-colors enabled:hover:text-danger enabled:hover:border-danger/40 enabled:hover:bg-danger/10 disabled:opacity-30 disabled:cursor-default"
                        title="Effacer les filtres"
                        aria-label="Effacer les filtres"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Row 2: Advanced Filters — hauteur animée (la page ne saute plus) */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    showAdvanced ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 mb-2 p-3 rounded-2xl border border-border bg-surface/30">
                        {/* Paliers de niveau */}
                        <span className="mr-1 text-caption font-black text-muted-foreground uppercase tracking-widest">Niveau</span>
                        {LEVEL_PRESETS.map((preset) => {
                            const isActive = activePreset?.label === preset.label;
                            return (
                                <button
                                    key={preset.label}
                                    onClick={() => onChange({ ...filters, minLevel: preset.min, maxLevel: preset.max })}
                                    aria-pressed={isActive}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg border text-caption font-bold transition-colors",
                                        isActive
                                            ? "bg-elevated border-border-strong text-foreground"
                                            : "border-transparent text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                                    )}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}

                        <div className="mx-1 h-4 w-px bg-border" />

                        {/* Filtres rapides — pictos Dofus (joueur / succès / cadenas) */}
                        <ToggleChip
                            asset="player"
                            label="Places dispo"
                            active={filters.onlyWithSpots}
                            onToggle={() => onChange({ ...filters, onlyWithSpots: !filters.onlyWithSpots })}
                        />
                        <ToggleChip
                            asset="success"
                            label="Avec succès"
                            active={filters.onlyWithAchievement}
                            onToggle={() => onChange({ ...filters, onlyWithAchievement: !filters.onlyWithAchievement })}
                        />
                        <ToggleChip
                            asset="closed"
                            label="Posts fermés"
                            active={filters.showClosed}
                            onToggle={() => onChange({ ...filters, showClosed: !filters.showClosed })}
                        />

                        {/* Résultats — l'info n'apparaît que si un filtre agit réellement */}
                        {hasActiveFilters && (
                            <span className="ml-auto font-mono tabular-nums text-caption text-muted-foreground">
                                {filtered}/{total} résultats
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToggleChip({
    asset, label, active, onToggle,
}: {
    asset: DofusUiIconName;
    label: string;
    active: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={active}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-caption font-bold transition-colors",
                active
                    ? "border-border-strong bg-elevated text-foreground"
                    : "border-transparent bg-surface/40 text-muted-foreground hover:bg-elevated hover:text-foreground"
            )}
        >
            <DofusUiIcon name={asset} size={13} className={active ? undefined : "opacity-60"} />
            {label}
        </button>
    );
}
