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
import type { GameDataChangeLogPage, GameDataChangeRow } from "@/lib/game-data-changelog";
import {
    EMPTY_GAME_DATA_CHANGE_REFERENTIAL,
    formatChangeValue,
    type GameDataChangeReferential,
} from "@/lib/game-data-change-format";
import { isJournalWiredDataset, type GameDataDataset } from "@/lib/game-data-sync-state";

/**
 * 🔍 **Modale « Journal »** d'un siphon : le détail de **chaque changement** détecté/appliqué
 * (nouveaux, modifiés, retirés) champ par champ — « nom : avant → après ». C'est ce qui
 * manquait : le Tableau disait *combien*, jamais *quoi*.
 *
 * ✔️ 28/09/2026 (A3) — trois dettes mesurées, trois corrections :
 *   1. **« sur combien »** : la page reçue porte les **compteurs réels** du dataset
 *      (`counts`/`total`/`shown`/`limit`/`max`) ⇒ l'en-tête écrit « les 300 derniers sur 471 »
 *      et les filtres affichent des chiffres **vrais** (avant : `(n)` comptait seulement les
 *      lignes reçues, donc « 100 » même pour 471 changements) ;
 *   2. **« en clair »** : les valeurs passent par `formatChangeValue` + le référentiel renvoyé
 *      par l'action ⇒ « Vitalité (1 à 15) » au lieu de `[3 : {"effectId":90,…}]` ;
 *   3. **mobile** : les champs s'affichent en **cartes** sous 768 px (`md:hidden`) au lieu d'un
 *      tableau à trois colonnes illisible (règle : `useResponsiveTable` pour les tableaux larges
 *      des panneaux ; ici les colonnes sont fixes, le breakpoint CSS suffit et reste déterministe).
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

/** Métadonnées d'affichage par type de changement (libellé + couleur + icône, jamais devinées). */
const CHANGE_TYPE_META: Record<
    "NEW" | "MODIFIED" | "REMOVED",
    { label: string; className: string; Icon: typeof Sparkles }
> = {
    NEW: { label: "Nouveau", className: "text-success", Icon: Sparkles },
    MODIFIED: { label: "Modifié", className: "text-warning", Icon: PencilLine },
    REMOVED: { label: "Retiré", className: "text-danger", Icon: Trash2 },
};

function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fr-FR");
}

/** Nombre plafonné au maximum de rétention (on ne demande jamais plus que ce qui est conservé). */
function nextLimit(page: GameDataChangeLogPage): number {
    return Math.min(page.total, page.max);
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
    const [page, setPage] = useState<GameDataChangeLogPage | null>(null);
    const [referential, setReferential] =
        useState<GameDataChangeReferential>(EMPTY_GAME_DATA_CHANGE_REFERENTIAL);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterKey>("ALL");
    const [search, setSearch] = useState("");
    /** `null` = taille de page **du serveur** (300) : le client ne recopie aucune constante de rétention. */
    const [limit, setLimit] = useState<number | null>(null);

    const load = useCallback(async () => {
        setPage(null);
        setError(null);
        const res = await getGameDataChangeLogAction(dataset, {
            limit: limit ?? undefined,
            changeType: filter,
        });
        if (res.success && res.data) {
            setPage(res.data);
            setReferential(res.data.referential);
        } else {
            setError(res.error ?? "Journal indisponible");
        }
    }, [dataset, filter, limit]);

    useEffect(() => {
        void load();
    }, [load]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = page?.rows ?? [];
        if (!q) return list;
        return list.filter((r) => (r.entityName ?? "").toLowerCase().includes(q) || r.entityId.includes(q));
    }, [page, search]);

    /** Valeur affichée : **humanisée** (référentiel de la page + noms frères), jamais du JSON brut. */
    const valueText = useCallback(
        (
            row: GameDataChangeRow,
            key: string,
            field: { before: unknown; after: unknown },
            side: "before" | "after",
        ): string =>
            formatChangeValue(side === "before" ? field.before : field.after, {
                key,
                fields: row.fields,
                side,
                referential,
            }),
        [referential],
    );

    const counts = page?.counts ?? null;
    const canLoadMore = page !== null && page.total > page.shown && nextLimit(page) > page.limit;

    return (
        <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Journal — {label}</DialogTitle>
                    <DialogDescription>
                        Origine : <strong>base serveur</strong> (journal persistant), pas les lignes de la
                        session en cours. Chaque fiche créée ou modifiée par ce siphon,{" "}
                        <strong>champ par champ</strong>.
                        {page ? ` Historique borné volontairement : ${page.retention}.` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                    {FILTERS.map((f) => {
                        // Compteurs **du serveur** (toutes les lignes retenues, filtre ignoré) :
                        // un `(0)` veut donc dire « rien de ce type dans l'historique », jamais
                        // « rien dans la page courante ».
                        const count = counts ? counts[f.key] : null;
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
                                {f.label}
                                {count === null ? "" : ` (${count})`}
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

                {page ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                            <strong className="text-foreground">{page.shown}</strong> affiché(s) sur{" "}
                            <strong className="text-foreground">{page.total}</strong>
                            {page.total > page.shown ? ` (les ${page.limit} plus récents)` : ""}
                        </span>
                        {counts ? (
                            <span>
                                Nouveaux {counts.NEW} · Modifiés {counts.MODIFIED} · Retirés {counts.REMOVED}
                            </span>
                        ) : null}
                        {canLoadMore ? (
                            <button
                                type="button"
                                onClick={() => setLimit(nextLimit(page))}
                                className="rounded-lg border border-border px-2 py-0.5 font-bold text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Afficher les {nextLimit(page)} plus récents
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <ScrollArea className="max-h-[60vh] pr-2">
                    {error ? (
                        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
                            {error}
                        </p>
                    ) : page === null ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Chargement du journal…
                        </div>
                    ) : visible.length === 0 ? (
                        <p className="py-10 text-center text-xs text-muted-foreground">
                            Aucun changement {filter === "ALL" ? "" : "de ce type "}sur ce dataset
                            {search.trim() ? " pour cette recherche" : ""}.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {visible.map((row) => {
                                const { label: typeLabel, className, Icon } = CHANGE_TYPE_META[row.changeType];
                                const fieldEntries = Object.entries(row.fields ?? {});
                                return (
                                    <li key={row.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                                            <span className={cn("inline-flex items-center gap-1 font-bold", className)}>
                                                <Icon className="h-3 w-3" aria-hidden="true" />
                                                {typeLabel}
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
                                        {fieldEntries.length > 0 ? (
                                            <>
                                                <table className="mt-2 hidden w-full text-[11px] md:table">
                                                    <tbody>
                                                        {fieldEntries.map(([key, field]) => (
                                                            <tr key={key} className="border-t border-border/50">
                                                                <td className="w-36 py-1 pr-2 align-top font-semibold text-muted-foreground">
                                                                    {FIELD_LABELS[key] ?? key}
                                                                </td>
                                                                <td className="py-1 pr-2 align-top text-muted-foreground line-through">
                                                                    {valueText(row, key, field, "before")}
                                                                </td>
                                                                <td className="py-1 align-top text-success">
                                                                    <span className="inline-flex items-start gap-1">
                                                                        <ArrowRight
                                                                            className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground"
                                                                            aria-hidden="true"
                                                                        />
                                                                        <span>{valueText(row, key, field, "after")}</span>
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {/* < 768 px : une carte par champ — aucun défilement horizontal. */}
                                                <div className="mt-2 space-y-2 md:hidden">
                                                    {fieldEntries.map(([key, field]) => (
                                                        <div
                                                            key={key}
                                                            className="rounded-lg border border-border/40 p-2 text-[11px]"
                                                        >
                                                            <p className="font-semibold text-muted-foreground">
                                                                {FIELD_LABELS[key] ?? key}
                                                            </p>
                                                            <p className="mt-0.5 text-muted-foreground line-through">
                                                                {valueText(row, key, field, "before")}
                                                            </p>
                                                            <p className="text-success">
                                                                {valueText(row, key, field, "after")}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                {row.changeType === "NEW"
                                                    ? "Fiche nouvellement siphonnée (rien avant ⇒ aucun détail)."
                                                    : "Changement détecté pour cette fiche (détail indisponible)."}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </ScrollArea>

                {!isJournalWiredDataset(dataset) ? (
                    <p className="text-[11px] text-warning">
                        ⚠️ Ce dataset n'est pas encore tracé par le journal : aucune ligne ne peut apparaître.
                    </p>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}



