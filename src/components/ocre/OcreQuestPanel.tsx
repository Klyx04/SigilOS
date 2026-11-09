"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Info, RefreshCw, Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { OcreMonsterThumb, OcreTargetStepper } from "@/components/ocre/OcreTargetBits";
import type { OcreMonsterLite } from "@/lib/ocre-soul-stones";

/**
 * Panneau « quête Ocre » — **source unique** de la liste, de la recherche, des onglets
 * Gardiens / Archis et du retour d'écriture.
 *
 * Pourquoi extrait : la même liste existait en trois exemplaires (guide interne, overlay,
 * modale publique), et le public en affichait une version appauvrie (« Marquer », sans
 * recherche ni onglets). Ici seule la **coquille** change d'un écran à l'autre.
 *
 * Ce composant ne fait **aucune** écriture : il remonte `onStep`, c'est l'appelant qui décide
 * du chemin (file d'écriture de guilde ou action visiteur).
 */

export type OcreQuestNotice = { kind: "error" | "info"; text: string };

type Tab = "all" | "boss" | "archi";

export default function OcreQuestPanel({
    monsters,
    requiredCopies = 1,
    bossCount,
    archiCount,
    busy = false,
    notice = null,
    pendingIds = [],
    onStep,
    /** Lien « Quête complète » — **absent** côté public (pas de guilde, donc pas de page). */
    questHref,
}: {
    monsters: OcreMonsterLite[];
    requiredCopies?: number;
    bossCount?: { gathered?: number; total?: number };
    archiCount?: { gathered?: number; total?: number };
    busy?: boolean;
    notice?: OcreQuestNotice | null;
    pendingIds?: number[];
    onStep: (monster: OcreMonsterLite, delta: 1 | -1) => void;
    questHref?: string;
}) {
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<Tab>("all");
    /** État de possession — remplace l'ancien bouton « Masquer les possédés » (un seul sens). */
    const [status, setStatus] = useState<"all" | "owned" | "missing">("all");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let out = monsters.filter((m) => m.type === "boss" || m.type === "archimonstre");
        if (tab === "boss") out = out.filter((m) => m.type === "boss");
        if (tab === "archi") out = out.filter((m) => m.type === "archimonstre");
        if (q) {
            out = out.filter((m) =>
                `${m.nameFr} ${m.zone ?? ""} ${m.subzone ?? ""}`.toLowerCase().includes(q)
            );
        }
        if (status === "owned") out = out.filter((m) => m.owned > 0);
        if (status === "missing") out = out.filter((m) => m.owned <= 0);
        // À capturer d'abord (c'est l'action), puis par nom.
        return [...out].sort((a, b) => {
            const aNeeded = a.owned <= 0 ? 0 : 1;
            const bNeeded = b.owned <= 0 ? 0 : 1;
            if (aNeeded !== bNeeded) return aNeeded - bNeeded;
            return a.nameFr.localeCompare(b.nameFr, "fr");
        });
    }, [monsters, query, tab, status]);

    const bossOwned = bossCount?.gathered ?? monsters.filter((m) => m.type === "boss" && m.owned > 0).length;
    const archiOwned = archiCount?.gathered ?? monsters.filter((m) => m.type === "archimonstre" && m.owned > 0).length;
    // Totaux : la valeur serveur si on l'a, sinon ce que la liste connue contient (le visiteur
    // n'a pas de statistiques de guilde — sans ça les onglets affichaient « 155/0 »).
    const bossTotal = bossCount?.total ?? monsters.filter((m) => m.type === "boss").length;
    const archiTotal = archiCount?.total ?? monsters.filter((m) => m.type === "archimonstre").length;

    const countByTab = (t: Tab) => {
        if (t === "boss") return `${bossOwned}/${bossTotal}`;
        if (t === "archi") return `${archiOwned}/${archiTotal}`;
        return `${bossOwned + archiOwned}/${bossTotal + archiTotal}`;
    };

    const segCls = (active: boolean) =>
        cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
            active
                ? "border-warning/50 bg-warning/10 text-warning"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
        );

    /**
     * Onglets Gardiens/Archis **seulement si le split est connu**. Une source qui ne donne pas la
     * nature des cibles (cas de Metamob côté visiteur) afficherait « Gardiens 0/0 » — on préfère
     * une liste unique honnête à deux onglets faux.
     */
    const hasSplit = useMemo(() => {
        const kinds = new Set(monsters.map((m) => m.type));
        return kinds.has("boss") && kinds.has("archimonstre");
    }, [monsters]);

    return (
        <>
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5">
                    <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Rechercher dans ma collection Ocre"
                        placeholder="Rechercher un gardien ou un archimonstre…"
                        className="min-w-0 flex-1 bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            aria-label="Effacer la recherche"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
                {questHref && (
                    <a
                        href={questHref}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-warning/90 transition-colors hover:text-warning"
                    >
                        Quête complète <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {hasSplit && (["all", "boss", "archi"] as Tab[]).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        aria-pressed={tab === t}
                        className={segCls(tab === t)}
                    >
                        {t === "all" ? "Tout" : t === "boss" ? "Gardiens" : "Archis"}
                        <span className="tabular-nums opacity-80">{countByTab(t)}</span>
                    </button>
                ))}
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    {(["all", "owned", "missing"] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(s)}
                            aria-pressed={status === s}
                            className={segCls(status === s)}
                            title={
                                s === "all"
                                    ? "Toutes les cibles"
                                    : s === "owned"
                                        ? "Uniquement celles déjà possédées"
                                        : "Uniquement celles encore à capturer"
                            }
                        >
                            {s === "all" ? "Tous" : s === "owned" ? "Possédés" : "Manquants"}
                        </button>
                    ))}
                </span>
            </div>

            {/* Retour d'écriture DANS le panneau (mêmes règles partout). */}
            {(busy || notice) && (
                <p
                    className={cn(
                        "flex items-center gap-1 text-[11px]",
                        notice?.kind === "error" ? "text-danger" : "text-muted-foreground"
                    )}
                    role={notice?.kind === "error" ? "alert" : "status"}
                >
                    {busy ? (
                        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <Info className="h-3 w-3" aria-hidden="true" />
                    )}
                    {busy ? "Enregistrement sur Metamob…" : notice?.text}
                </p>
            )}

            <ScrollArea className="no-scrollbar max-h-[440px] w-full min-w-0 px-2 py-2">
                {filtered.length === 0 ? (
                    <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                        {query
                            ? "Aucune cible ne correspond à la recherche."
                            : status === "missing"
                                ? "Tout est déjà capturé."
                                : status === "owned"
                                    ? "Rien de capturé pour l'instant."
                                    : "Aucune cible dans cette catégorie."}
                    </p>
                ) : (
                    <div className="min-w-0 space-y-1">
                        {filtered.map((m) => (
                            <div
                                key={m.id}
                                className={cn(
                                    "flex min-w-0 items-center gap-2 overflow-hidden rounded-md border bg-surface px-2.5 py-2",
                                    m.owned > 0 ? "border-border" : "border-warning/25"
                                )}
                            >
                                <OcreMonsterThumb id={m.id} type={m.type} dimmed={m.owned > 0} className="h-8 w-8" />

                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-xs font-semibold text-foreground">{m.nameFr}</span>
                                    {(m.zone || m.subzone) && (
                                        <span className="truncate text-[10px] text-muted-foreground">
                                            {[m.zone, m.subzone].filter(Boolean).join(" · ")}
                                        </span>
                                    )}
                                </div>

                                <OcreTargetStepper
                                    owned={m.owned}
                                    requiredCopies={requiredCopies}
                                    pending={pendingIds.includes(m.id)}
                                    label={m.nameFr}
                                    onStep={(delta) => onStep(m, delta)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </>
    );
}
