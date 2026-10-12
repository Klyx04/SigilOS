"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKET_LIMITS } from "@/server/actions/market-constants";

export interface WantedCriterionDraft {
    effectId: number;
    characteristic: number | null;
    label: string;
    minValue: number;
    exo: boolean;
}

interface MarketWantedCriteriaEditorProps {
    /** `effectId` → libellé FR (référentiel `GameEffect`, `null` = non chargé). */
    effectLabels: Record<number, string> | null;
    value: WantedCriterionDraft[];
    onChange: (next: WantedCriterionDraft[]) => void;
}

/**
 * Lot M1 — éditeur de critères d'une recherche d'achat : effet du référentiel
 * + valeur minimale + case « Exo » (effet hors-natif accepté). Le serveur
 * revalide tout (pastilles EXO / OVER calculées, D17).
 */
export function MarketWantedCriteriaEditor({ effectLabels, value, onChange }: MarketWantedCriteriaEditorProps) {
    const [search, setSearch] = useState("");
    const [pendingMin, setPendingMin] = useState<Record<number, string>>({});
    const [pendingExo, setPendingExo] = useState<Record<number, boolean>>({});
    const [minError, setMinError] = useState<number | null>(null);

    /** Valeur minimale saisie : entier strict 1..99999, sinon `null`. */
    function parseStrictMin(raw: string | undefined): number | null {
        const text = (raw ?? "").trim();
        if (!/^\d+$/.test(text)) return null;
        const n = Number(text);
        if (!Number.isSafeInteger(n) || n < 1 || n > 99_999) return null;
        return n;
    }

    const suggestions = useMemo(() => {
        if (!effectLabels) return [];
        const term = search.trim().toLowerCase();
        if (term.length < 2) return [];
        const taken = new Set(value.map((criterion) => criterion.effectId));
        return Object.entries(effectLabels)
            .filter(([, label]) => label.toLowerCase().includes(term))
            .filter(([effectId]) => !taken.has(Number(effectId)))
            .slice(0, 8)
            .map(([effectId, label]) => ({ effectId: Number(effectId), label }));
    }, [effectLabels, search, value]);

    const add = (effectId: number, label: string) => {
        if (value.length >= MARKET_LIMITS.WANTED_MAX_CRITERIA) return;
        const min = parseStrictMin(pendingMin[effectId]);
        if (min == null) {
            setMinError(effectId);
            return;
        }
        setMinError(null);
        onChange([...value, { effectId, characteristic: null, label, minValue: min, exo: pendingExo[effectId] ?? false }]);
        setSearch("");
    };

    return (
        <div className="space-y-3">
            {value.length > 0 && (
                <ul className="space-y-2">
                    {value.map((criterion) => (
                        <li
                            key={criterion.effectId}
                            className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">
                                    {criterion.exo ? "✦ Exo " : ""}{criterion.label}
                                </p>
                                <p className="text-[11px] text-muted-foreground">valeur minimale : {criterion.minValue}</p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-danger"
                                onClick={() => onChange(value.filter((candidate) => candidate.effectId !== criterion.effectId))}
                                title="Retirer ce critère"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {value.length < MARKET_LIMITS.WANTED_MAX_CRITERIA && (
                <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                    <Label className="text-xs">Ajouter un critère ({value.length}/{MARKET_LIMITS.WANTED_MAX_CRITERIA})</Label>
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Rechercher un effet (ex. Force, PA, Retrait PM)…"
                        className="h-9"
                        aria-label="Rechercher un effet"
                    />
                    {!effectLabels ? (
                        <p className="text-[11px] text-muted-foreground">Référentiel d&apos;effets non chargé.</p>
                    ) : (
                        suggestions.length > 0 && (
                            <ul className="space-y-1.5">
                                {suggestions.map((suggestion) => {
                                    const minInvalid = minError === suggestion.effectId;
                                    const minOk = parseStrictMin(pendingMin[suggestion.effectId]) != null;
                                    return (
                                    <li key={suggestion.effectId} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{suggestion.label}</span>
                                        <Input
                                            value={pendingMin[suggestion.effectId] ?? ""}
                                            onChange={(event) => {
                                                setPendingMin((prev) => ({ ...prev, [suggestion.effectId]: event.target.value }));
                                                setMinError(null);
                                            }}
                                            placeholder="Min"
                                            inputMode="numeric"
                                            maxLength={6}
                                            className={cn("h-8 w-20", minInvalid && "border-danger")}
                                            aria-label={`Valeur minimale pour ${suggestion.label}`}
                                            aria-invalid={minInvalid}
                                        />
                                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Switch
                                                checked={pendingExo[suggestion.effectId] ?? false}
                                                onCheckedChange={(checked) =>
                                                    setPendingExo((prev) => ({ ...prev, [suggestion.effectId]: checked }))
                                                }
                                                aria-label={`Exo pour ${suggestion.label}`}
                                            />
                                            Exo
                                        </label>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 gap-1"
                                            disabled={!minOk}
                                            onClick={() => add(suggestion.effectId, suggestion.label)}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Ajouter
                                        </Button>
                                    </div>
                                    {minInvalid && (
                                        <p className="text-[11px] font-semibold text-danger">
                                            Valeur minimale requise : entier entre 1 et 99 999.
                                        </p>
                                    )}
                                    </li>
                                    );
                                })}
                            </ul>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
