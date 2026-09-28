"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Play, Loader2, CheckCircle2, AlertTriangle, Clock, ServerCog, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { responsiveTableSlots, useResponsiveTable } from "@/hooks/use-responsive-table";
import {
    getGameDataSyncStates,
    startGameDataSyncInBackground,
} from "@/server/actions/game-data-sync-actions";
import {
    GAME_DATA_DATASET_LABEL,
    gameDataLaunchKind,
    isBackgroundDataset,
    isWatchedDataset,
    type GameDataDataset,
    type GameDataRunState,
} from "@/lib/game-data-sync-state";
import { isInlineRunnable, runInlineGameDataDataset } from "./game-data-inline-runners";
import { DataHealthPanel } from "./DataHealthPanel";
import { GameDataChangeLogModal } from "./GameDataChangeLogModal";

/**
 * Tableau d'état des datasets game-data — **ce qui se lit AVANT de cliquer**, et le
 * **seul** endroit d'où l'on lance un siphon.
 *
 * Audit 23/09/2026 (demande user : « je comprends rien », « pk on a des “Bouton direct
 * ci-dessous” ») : l'ACTION vivait à 3 endroits (tableau, onglet Siphons, éditeurs) avec
 * 3 libellés, et 5 datasets renvoyaient à un bouton « ci-dessous » — dont **Récoltables**,
 * qui n'a aucune action en ligne. Chaque dataset déclare maintenant son mode
 * (`gameDataLaunchKind`) :
 *   · `⏳ En arrière-plan` — file BullMQ + worker, survit à l'onglet fermé ;
 *   · `▶ Lancer ici` — dans l'onglet (datasets sans cœur `src/lib`) ;
 *   · `▶ Ici` — repli des datasets d'arrière-plan, utile si aucun worker n'écoute ;
 *   · `🖥️ Script local` — aucune action en ligne (fichier produit par un script).
 */
/**
 * Où corriger chaque dataset à la main — cible de l'onglet « Ouvrir ».
 * Seuls les datasets qui ont RÉELLEMENT un éditeur sont mappés (pas de lien mort).
 */
const GO_TARGET: Partial<Record<GameDataRunState["dataset"], string>> = {
    CATALOGUE: "dungeons",
    FAMILIES: "families",
    ZONES: "zones",
    QUESTS: "quests",
    ANOMALY_BOSSES: "archimonstres",
};

/** Nombre de causes détaillées dans « Dernière erreur » (le reste est résumé en « … N autre(s) »). */
const ERROR_GROUPS_SHOWN = 4;

export function GameDataSyncStatePanel({ onGo }: { onGo?: (target: string) => void } = {}) {
    const [states, setStates] = useState<GameDataRunState[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [inlineBusy, setInlineBusy] = useState<string | null>(null);
    /** Couverture/dry-runs (ex-`DataHealthPanel`) : replié par défaut — une seule carte. */
    const [showCoverage, setShowCoverage] = useState(false);
    /**
     * Journal du run « dans l'onglet » — ce qui manquait le 23/09/2026 : les erreurs
     * s'empilaient dans le terminal du serveur et l'écran God ne montrait rien.
     */
    const [journal, setJournal] = useState<{ dataset: string; lines: string[] } | null>(null);
    /** 🔍 Dataset dont le **journal des changements** est ouvert dans la modale (`null` = fermé). */
    const [changeLogDataset, setChangeLogDataset] = useState<GameDataDataset | null>(null);
    /**
     * 📱 **Tableau → cartes** (chantier A3) : le seuil (768 px) et le débordement mesuré vivent dans
     * `useResponsiveTable` — une seule règle pour les deux tableaux d'admin, jamais recopiée ici.
     */
    const { containerRef, useCards } = useResponsiveTable();
    const slots = responsiveTableSlots(useCards);

    const load = useCallback(async () => {
        const res = await getGameDataSyncStates();
        if (res.success && res.data) {
            setStates(res.data);
            setError(null);
        } else {
            setError(res.error || "État indisponible");
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Le % est calculé côté serveur : on rafraîchit tant qu'un run travaille.
    const hasRunning = !!states?.some((s) => s.status === "RUNNING");
    useEffect(() => {
        if (!hasRunning) return;
        const timer = setInterval(() => void load(), 3000);
        return () => clearInterval(timer);
    }, [hasRunning, load]);

    const launchInBackground = async (dataset: string) => {
        setBusy(dataset);
        try {
            const res = await startGameDataSyncInBackground(dataset);
            if (res.success) {
                toast.success("Siphon lancé en arrière-plan — il continue même si vous fermez l'onglet.");
            } else {
                toast.error(res.error || "Mise en file impossible");
            }
            await load();
        } finally {
            setBusy(null);
        }
    };

    /**
     * 🔭 **Veille ciblée** (23/09/2026) : ne relit que ce que DofusDB a modifié depuis le
     * filigrane (`updatedAt[$gt]`, mesuré : 46 items au lieu de 21 776). Le cron la pose
     * aussi tout seul ; ce bouton sert à la déclencher à la main après un patch de jeu.
     */
    const launchWatch = async (dataset: string) => {
        setBusy(dataset);
        try {
            const res = await startGameDataSyncInBackground(dataset, { incremental: true });
            if (res.success) {
                toast.success("Veille ciblée mise en file — seuls les changements seront relus.");
            } else {
                toast.error(res.error || "Veille impossible");
            }
            await load();
        } finally {
            setBusy(null);
        }
    };

    /**
     * Lance **dans cet onglet** : soit un dataset sans cœur `src/lib` (il n'a pas d'autre
     * mode), soit le **repli** d'un dataset d'arrière-plan quand aucun worker n'écoute.
     * Le suivi est le même que pour la file (état écrit côté serveur) ⇒ la colonne
     * « Progression » se remplit toute seule ; en revanche **fermer l'onglet interrompt**.
     */
    const launchInline = async (dataset: GameDataRunState["dataset"]) => {
        if (!isInlineRunnable(dataset)) return;
        setInlineBusy(dataset);
        setJournal({ dataset, lines: [] });
        try {
            const res = await runInlineGameDataDataset(dataset, {
                // Journal **live** : chaque ligne du lanceur arrive ici (les erreurs aussi).
                log: (line) =>
                    setJournal((prev) => ({
                        dataset,
                        lines: [line, ...(prev?.lines ?? [])].slice(0, 80),
                    })),
            });
            if (res.ok) {
                toast.success(res.summary || "Siphon terminé.");
            } else {
                toast.error(res.error || "Siphon interrompu.");
            }
        } finally {
            setInlineBusy(null);
            await load();
        }
    };

    return (
        <div className="rounded-2xl border border-border bg-surface/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ServerCog className="h-4 w-4 text-info" aria-hidden="true" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                        État des datasets
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", hasRunning && "animate-spin")} aria-hidden="true" />
                    Rafraîchir
                </button>
            </div>

            {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                    {error}
                </p>
            )}

            {states === null ? (
                <p className="text-xs text-muted-foreground">Lecture de l&apos;état…</p>
            ) : (
                <div ref={containerRef} className={cn("overflow-x-auto custom-scrollbar", slots.table)}>
                    <table className="w-full min-w-[46rem] text-xs">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="py-2 pr-3 font-semibold">Dataset</th>
                                <th className="py-2 pr-3 font-semibold">État</th>
                                <th className="py-2 pr-3 font-semibold">Progression</th>
                                <th className="py-2 pr-3 font-semibold">Dernière exécution</th>
                                <th className="py-2 pr-3 font-semibold">Dernière erreur</th>
                                <th className="py-2 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {states.map((state) => (
                                <tr key={state.dataset} className="border-b border-border/60 last:border-0">
                                    <td className="py-2 pr-3 font-semibold text-foreground">
                                        {GAME_DATA_DATASET_LABEL[state.dataset] ?? state.dataset}
                                    </td>
                                    <td className="py-2 pr-3">
                                        <StateChip state={state} />
                                    </td>
                                    <td className="py-2 pr-3">
                                        <ProgressBlock state={state} />
                                    </td>
                                    <td className="py-2 pr-3 text-muted-foreground">
                                        {formatWhen(state.finishedAt ?? state.startedAt)}
                                    </td>
                                    <td className="py-2 pr-3">
                                        <ErrorSummary state={state} />
                                    </td>
                                    <td className="py-2">
                                        <DatasetActions
                                            state={state}
                                            busy={busy}
                                            inlineBusy={inlineBusy}
                                            onBackground={(dataset) => void launchInBackground(dataset)}
                                            onWatch={(dataset) => void launchWatch(dataset)}
                                            onInline={(dataset) => void launchInline(dataset)}
                                            onJournal={setChangeLogDataset}
                                            onGo={onGo}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 📱 **Cartes** (chantier A3) — sous 768 px (ou si le tableau déborde réellement), les mêmes
                cellules que la ligne du tableau : aucun contenu n'est recopié, donc les deux vues ne
                peuvent pas diverger. */}
            {states && states.length > 0 ? (
                <div className={slots.cards}>
                    {states.map((state) => (
                        <article key={state.dataset} className="rounded-xl border border-border/70 bg-surface/40 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-black text-foreground">
                                    {GAME_DATA_DATASET_LABEL[state.dataset] ?? state.dataset}
                                </span>
                                <StateChip state={state} />
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                Dernière exécution : {formatWhen(state.finishedAt ?? state.startedAt)}
                            </p>
                            <div className="mt-2 text-xs">
                                <ProgressBlock state={state} />
                            </div>
                            <div className="mt-2 text-xs">
                                <ErrorSummary state={state} />
                            </div>
                            <div className="mt-2">
                                <DatasetActions
                                    state={state}
                                    busy={busy}
                                    inlineBusy={inlineBusy}
                                    onBackground={(dataset) => void launchInBackground(dataset)}
                                    onWatch={(dataset) => void launchWatch(dataset)}
                                    onInline={(dataset) => void launchInline(dataset)}
                                    onJournal={setChangeLogDataset}
                                    onGo={onGo}
                                />
                            </div>
                        </article>
                    ))}
                </div>
            ) : null}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
                La progression vient du serveur (Redis). <strong>⏳ En arrière-plan</strong> tourne sur
                le serveur (worker) : il continue après la fermeture de l&apos;onglet et reprend en cas
                d&apos;échec réseau. <strong>▶ Lancer ici</strong> (et le repli <strong>Ici</strong>)
                tourne dans cet onglet : ne le fermez pas pendant la passe.
            </p>

            {/* Journal du run « dans l'onglet » : sans lui, les erreurs ne vivaient que
                dans le terminal du serveur (constat user du 23/09/2026). Les runs
                d'arrière-plan, eux, journalisent dans le worker. */}
            {journal && journal.lines.length > 0 ? (
                <div className="rounded-xl border border-border bg-black/70 p-3 font-mono text-[11px] text-emerald-400 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 text-white font-bold">
                        <span className="flex items-center gap-1.5">
                            <ServerCog className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                            Journal — {GAME_DATA_DATASET_LABEL[journal.dataset as GameDataRunState["dataset"]] ?? journal.dataset}
                        </span>
                        <button
                            type="button"
                            onClick={() => setJournal(null)}
                            className="text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Effacer
                        </button>
                    </div>
                    {journal.lines.map((line, i) => (
                        <div
                            key={`${i}-${line.slice(0, 12)}`}
                            className={cn(
                                line.startsWith("❌") && "text-danger",
                                line.startsWith("⚠️") && "text-warning",
                            )}
                        >
                            {line}
                        </div>
                    ))}
                </div>
            ) : null}

            {/* 🔍 Journal des changements (modale) — « quoi a changé » sur ce siphon, champ par
                champ. Ouverte depuis le bouton « Journal » de la ligne concernée. */}
            {changeLogDataset ? (
                <GameDataChangeLogModal
                    dataset={changeLogDataset}
                    label={GAME_DATA_DATASET_LABEL[changeLogDataset] ?? changeLogDataset}
                    onClose={() => setChangeLogDataset(null)}
                />
            ) : null}

            {/* Couverture par source → cible + dry-runs : replié ici (une seule carte dans le
                Tableau). C'était un 2ᵉ tableau empilé en dessous — l'utilisateur ne savait plus
                lequel pilotait quoi (audit 23/09/2026). */}
            <div className="border-t border-border pt-3">
                <button
                    type="button"
                    onClick={() => setShowCoverage((v) => !v)}
                    aria-expanded={showCoverage}
                    className="inline-flex items-center gap-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                >
                    🔎 Couverture réelle par source → cible (lecture seule, dry-runs)
                    <span aria-hidden="true">{showCoverage ? "▲" : "▼"}</span>
                </button>
                {showCoverage ? (
                    <div className="mt-3">
                        <DataHealthPanel onGoTab={(target) => onGo?.(target)} />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

/**
 * 🧩 **Cellules partagées tableau / cartes** (chantier A3) : la ligne du tableau ci-dessus et la carte
 * téléphone peignent **ces** composants — un contenu écrit une fois ne peut pas diverger entre les
 * deux vues, et corriger un libellé n'oblige jamais à le corriger deux fois.
 */
function StateChip({ state }: { state: GameDataRunState }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 font-semibold",
                state.status === "RUNNING" && "text-info",
                state.status === "OK" && "text-success",
                state.status === "ERROR" && "text-danger",
                state.status === "IDLE" && "text-muted-foreground",
            )}
        >
            {state.status === "RUNNING" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {state.status === "OK" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
            {state.status === "ERROR" && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
            {state.status === "IDLE" && <Clock className="h-3 w-3" aria-hidden="true" />}
            {state.status === "RUNNING"
                ? "En cours"
                : state.status === "OK"
                  ? "OK"
                  : state.status === "ERROR"
                    ? "Échec"
                    : "Jamais exécuté"}
        </span>
    );
}

/**
 * Progression **réelle** (jamais un pourcentage inventé), message de la passe en cours, **bilan
 * chiffré** de la dernière passe et note de veille ciblée — « 0 % » ou « OK » ne disaient pas CE QUI
 * avait bougé (audit 23/09/2026).
 */
function ProgressBlock({ state }: { state: GameDataRunState }) {
    return (
        <div className="text-muted-foreground">
            {state.status === "RUNNING"
                ? state.percent === null
                    ? `${state.done}${state.total ? ` / ${state.total}` : ""} — total inconnu`
                    : `${state.percent} % (${state.done}/${state.total})`
                : state.total
                  ? `${state.done}/${state.total}`
                  : "—"}
            {state.message ? (
                <span className="block text-[11px] text-muted-foreground">{state.message}</span>
            ) : null}
            {state.counts ? (
                <span className="block text-[11px] text-muted-foreground">
                    Bilan : {state.counts.inserted} nouveau(x) · {state.counts.updated} modifié(s) ·{" "}
                    {state.counts.unchanged} inchangé(s)
                </span>
            ) : null}
            {isWatchedDataset(state.dataset) ? (
                <span
                    className="block text-[11px] text-muted-foreground"
                    title="Veille ciblée : le cron ne relit que ce qui a bougé chez DofusDB (filtre updatedAt), sans jamais supprimer"
                >
                    🔭 Veille ciblée active
                </span>
            ) : null}
        </div>
    );
}


interface DatasetActionsProps {
    state: GameDataRunState;
    busy: string | null;
    inlineBusy: string | null;
    onBackground: (dataset: GameDataDataset) => void;
    onWatch: (dataset: GameDataDataset) => void;
    onInline: (dataset: GameDataDataset) => void;
    onJournal: (dataset: GameDataDataset) => void;
    onGo?: (target: string) => void;
}

/**
 * Actions d'un dataset — **une seule définition** (le mode est déclaré par `gameDataLaunchKind`),
 * peinte dans le tableau **et** dans la carte. Les verrous `disabled` vivent ici : ajouter une vue ne
 * peut plus oublier un garde-fou.
 */
function DatasetActions({
    state,
    busy,
    inlineBusy,
    onBackground,
    onWatch,
    onInline,
    onJournal,
    onGo,
}: DatasetActionsProps) {
    const dataset = state.dataset;
    if (gameDataLaunchKind(dataset) === "SCRIPT") {
        return (
            <span
                className="text-[11px] text-muted-foreground"
                title="Aucune action en ligne : ce fichier est produit par un script local (scripts/compile-harvest-and-zaaps.ts)"
            >
                🖥️ Script local
            </span>
        );
    }
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {isBackgroundDataset(dataset) ? (
                <button
                    type="button"
                    onClick={() => onBackground(dataset)}
                    disabled={busy === dataset || state.status === "RUNNING"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-2.5 py-1.5 text-[11px] font-bold text-info transition-colors hover:bg-info/20 disabled:opacity-50"
                    title="Tourne sur le serveur (worker) : continue même si vous fermez l'onglet"
                >
                    {busy === dataset ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <Play className="h-3 w-3" aria-hidden="true" />
                    )}
                    En arrière-plan
                </button>
            ) : null}
            {/* 🔭 Veille ciblée : uniquement pour les datasets du registre (filtre `updatedAt` réel +
                passe additive). Le cron la pose seul ; ce bouton sert après un patch de jeu. */}
            {isWatchedDataset(dataset) ? (
                <button
                    type="button"
                    onClick={() => onWatch(dataset)}
                    disabled={busy === dataset || state.status === "RUNNING"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                    title="Veille ciblée : ne relit que ce que DofusDB a modifié depuis la dernière passe (elle-même posée par le cron)"
                >
                    🔭 Veille
                </button>
            ) : null}
            {isInlineRunnable(dataset) ? (
                <button
                    type="button"
                    onClick={() => onInline(dataset)}
                    disabled={inlineBusy === dataset || busy === dataset || state.status === "RUNNING"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    title={
                        isBackgroundDataset(dataset)
                            ? "Repli : tourne dans CET onglet (le fermer l'interrompt) — utile si aucun worker n'écoute la file"
                            : "Tourne dans cet onglet : le suivi s'affiche ici, mais ne fermez pas l'onglet"
                    }
                >
                    {inlineBusy === dataset ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <Play className="h-3 w-3" aria-hidden="true" />
                    )}
                    {isBackgroundDataset(dataset) ? "Ici" : "Lancer ici"}
                </button>
            ) : null}
            {/* 🔍 Journal : « quoi a changé » sur ce dataset (modale) — le Tableau disait *combien*,
                jamais *quoi*. */}
            <button
                type="button"
                onClick={() => onJournal(dataset)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                title="Derniers changements de ce siphon : chaque fiche créée/modifiée, champ par champ (avant → après)"
            >
                <ScrollText className="h-3 w-3" aria-hidden="true" />
                Journal
            </button>
            {onGo && GO_TARGET[dataset] ? (
                <button
                    type="button"
                    onClick={() => onGo(GO_TARGET[dataset] as string)}
                    title="Ouvrir l'outil qui corrige ce dataset"
                    className="inline-flex items-center rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                >
                    Ouvrir →
                </button>
            ) : null}
        </div>
    );
}

/**
 * **Dernière erreur, chiffrée** (chantier A3) : la ligne courte du serveur (`lastError`, qui porte
 * déjà le total et les causes principales), puis **chaque cause** avec son nombre d'occurrences —
 * c'est ce qui distingue « relancer » (limite locale) de « corriger la donnée » (DofusDB ne
 * référence pas ce butin), deux actions opposées que « 96 erreurs » confondait.
 */
function ErrorSummary({ state }: { state: GameDataRunState }) {
    const groups = state.errorGroups ?? [];
    if (!state.lastError && groups.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }
    const hidden = groups.length - ERROR_GROUPS_SHOWN;
    return (
        <div className="text-danger/90">
            {state.lastError ? <span className="block">{state.lastError}</span> : null}
            {groups.length > 0 ? (
                <ul className="mt-0.5 space-y-0.5">
                    {groups.slice(0, ERROR_GROUPS_SHOWN).map((group) => (
                        <li key={group.key} className="text-[11px] font-normal text-muted-foreground" title={group.sample}>
                            {group.label} — {group.count}×
                        </li>
                    ))}
                    {hidden > 0 ? (
                        <li className="text-[11px] font-normal text-muted-foreground">… {hidden} autre(s) cause(s)</li>
                    ) : null}
                </ul>
            ) : null}
        </div>
    );
}

/** « il y a 17 h » — calculé côté client uniquement (aucun rendu serveur). */
function formatWhen(iso: string | null): string {
    if (!iso) return "—";
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return "—";
    const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} j`;
}
