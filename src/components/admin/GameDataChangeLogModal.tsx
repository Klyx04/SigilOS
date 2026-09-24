"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Sparkles, PencilLine, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGameDataChangeLogAction } from "@/server/actions/game-data-sync-actions";
import type { GameDataChangeRow } from "@/lib/game-data-changelog";
import { isJournalWiredDataset, type GameDataDataset } from "@/lib/game-data-sync-state";

/**
 * 🔍 **Modale « Journal »** d'un siphon : le détail de **chaque changement** détecté/appliqué
 * (nouveaux, modifiés, retirés) champ par champ — « nom : avant → après ». C'est ce qui
 * manquait : le Tableau disait *combien*, jamais *quoi*.
 *
 * Rétention bornée côté serveur (30 j / 500 entrées par dataset) ⇒ l'en-tête le dit à
 * l'utilisateur, aucune surprise sur la profondeur d'historique.
 */

type FilterKey = "ALL" | "NEW" | "MODIFIED" | "REMOVED";

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "ALL", label: "Tout" },
    { key: "NEW", label: "Nouveaux" },
    { key: "MODIFIED", label: "Modifiés" },
    { key: "REMOVED", label: "Retirés" },
];

/** Libellés lisibles des champs journalisés (le reste s'affiche brut, jamais masqué). */
const FIELD_LABELS: Record<string, string> = {
    name: "Nom",
    level: "Niveau",
    levelMin: "Niveau min",
    levelMax: "Niveau max",
    category: "Catégorie",
    description: "Description",
    typeId: "Type (id)",
    typeName: "Type",
    effects: "Effets",
    hasRecipe: "Recette",
    realWeight: "Poids",
    priceNpc: "Prix PNJ",
    itemSetId: "Panoplie (id)",
    itemSetName: "Panoplie",
    isLegendary: "Légendaire",
    isSaleable: "Vendable",
    superTypeId: "Super-type (id)",
    superTypeName: "Super-type",
};

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "oui" : "non";
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return "(illisible)";
        }
    }
    return String(value);
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fr-FR");
}

export function GameDataChangeLogModal({
    dataset,
    label,
    onClose,
}: {
    dataset: GameDataDataset;
    label: string;
    onClose: () => void;
}) {
    const [rows, setRows] = useState<GameDataChangeRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterKey>("ALL");
    const [search, setSearch] = useState("");
    const [retention, setRetention] = useState<string>("");

    const load = useCallback(async () => {
        setRows(null);
        setError(null);
        const res = await getGameDataChangeLogAction(dataset, { limit: 300, changeType: filter });
        if (res.success) {
            setRows(res.data?.rows ?? []);
            if (res.data?.retention) setRetention(res.data.retention);
        } else {
            setError(res.error ?? "Journal indisponible");
        }
    }, [dataset, filter]);

    useEffect(() => {
        void load();
    }, [load]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = rows ?? [];
        if (!q) return list;
        return list.filter(
            (r) => (r.entityName ?? "").toLowerCase().includes(q) || r.entityId.includes(q),
        );
    }, [rows, search]);

    const counts = useMemo(() => {
        const base = { NEW: 0, MODIFIED: 0, REMOVED: 0 };
        for (const r of rows ?? []) base[r.changeType] += 1;
        return base;
    }, [rows]);

    return (
        <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Journal — {label}</DialogTitle>
                    <DialogDescription>
                        Chaque fiche créée ou modifiée par ce siphon, <strong>champ par champ</strong>.
                        {retention ? ` Historique borné volontairement : ${retention}.` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                    {FILTERS.map((f) => {
                        const count = f.key === "ALL" ? (rows?.length ?? 0) : counts[f.key];
                        return (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilter(f.key)}
                                className={cn(
                                    "rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors",
                                    filter === f.key
                                        ? "border-primary/50 bg-primary/15 text-primary"
                                        : "border-border bg-card/50 text-muted-foreground hover:bg-card",
                                )}
                            >
                                {f.label} {rows === null ? "" : `(${count})`}
                            </button>
                        );
                    })}
                    <div className="relative ml-auto w-56">
                        <Search
                            className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filtrer par nom ou id…"
                            className="h-8 pl-7 text-xs"
                        />
                    </div>
                </div>

                {error ? (
                    <p className="text-xs text-danger">{error}</p>
                ) : rows === null ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Lecture du journal…
                    </p>
                ) : visible.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                        {rows.length > 0 || search.trim()
                            ? "Aucun changement ne correspond à ce filtre."
                            : isJournalWiredDataset(dataset)
                              ? "Aucun changement enregistré pour ce siphon. Lancez une passe (ou la veille) : chaque fiche créée ou modifiée apparaîtra ici, avec le détail des champs."
                              : "Ce siphon n'est pas encore branché au journal : sa ligne est affichée, mais aucun changement n'y sera enregistré tant que son branchement n'est pas fait (voir ROADMAP, suite 24). Aucune passe ne remplira cet écran."}
                    </p>
                ) : (
                    <ScrollArea className="max-h-[26rem] pr-2">
                        <ul className="space-y-2">
                            {visible.map((row) => (
                                <li key={row.id} className="rounded-lg border border-border bg-card/50 p-2.5">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                                row.changeType === "NEW" && "bg-success/15 text-success",
                                                row.changeType === "MODIFIED" && "bg-info/15 text-info",
                                                row.changeType === "REMOVED" && "bg-danger/15 text-danger",
                                            )}
                                        >
                                            {row.changeType === "NEW" ? (
                                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                            ) : row.changeType === "REMOVED" ? (
                                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                                            ) : (
                                                <PencilLine className="h-3 w-3" aria-hidden="true" />
                                            )}
                                            {row.changeType === "NEW"
                                                ? "Nouveau"
                                                : row.changeType === "REMOVED"
                                                  ? "Retiré"
                                                  : "Modifié"}
                                        </span>
                                        <span className="font-semibold text-foreground">
                                            {row.entityName ?? `#${row.entityId}`}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            #{row.entityId} · {row.entityType}
                                        </span>
                                        <span className="ml-auto text-[10px] text-muted-foreground">
                                            {formatDate(row.createdAt)}
                                        </span>
                                    </div>
                                    {row.fields && Object.keys(row.fields).length > 0 ? (
                                        <table className="mt-2 w-full text-[11px]">
                                            <tbody>
                                                {Object.entries(row.fields).map(([key, value]) => (
                                                    <tr key={key} className="border-t border-border/50">
                                                        <td className="w-32 py-1 pr-2 align-top font-semibold text-muted-foreground">
                                                            {FIELD_LABELS[key] ?? key}
                                                        </td>
                                                        <td className="py-1 pr-2 align-top text-muted-foreground line-through">
                                                            {formatValue(value.before)}
                                                        </td>
                                                        <td className="py-1 align-top text-success">
                                                            <span className="inline-flex items-start gap-1">
                                                                <ArrowRight
                                                                    className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground"
                                                                    aria-hidden="true"
                                                                />
                                                                <span>{formatValue(value.after)}</span>
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            {row.changeType === "NEW"
                                                ? "Fiche nouvellement siphonnée (rien avant ⇒ aucun détail)."
                                                : "Changement détecté pour cette fiche (détail indisponible)."}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}
