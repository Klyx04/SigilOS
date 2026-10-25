"use client";

/**
 * Onglet **Mules** — panneau « en guilde en jeu ».
 *
 * Deux sources déclaratives, un seul compteur :
 *  1. les **rôles Discord** cochés ici (une personne portant plusieurs rôles cochés ne
 *     compte qu'**une fois** — règle pure `tallyInGameGuild`) ;
 *  2. les **mules** taguées dans l'inventaire juste en dessous.
 *
 * Le compteur se recalcule **côté client** à partir des rôles déjà chargés par la page
 * (`RosterRow.roles` vient de `listGuildMembers`) : aucun appel Discord supplémentaire.
 * L'enregistrement de la sélection est une server action (RBAC + rôles réels validés).
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameIcon } from "@/components/shared/game-icon";
import { normalizeInGameGuildRoleIds, tallyInGameGuild } from "@/lib/in-game-guild";
import type { RosterRoleInput, RosterRow } from "@/lib/member-roster";
import { setInGameGuildRoleIds } from "@/server/actions/member-in-game-actions";
import { cn } from "@/lib/utils";

function sameSelection(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
    return (
        <div className="rounded-lg border border-border-strong bg-surface p-3">
            <p className="text-caption uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="mt-1 text-caption text-muted-foreground">{hint}</p>
        </div>
    );
}

export function InGameGuildPanel({
    guildId,
    rows,
    roles,
    initialRoleIds,
    canManageMembers,
}: {
    guildId: string;
    rows: RosterRow[];
    roles: RosterRoleInput[];
    initialRoleIds: string[];
    canManageMembers: boolean;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selected, setSelected] = useState<string[]>(() => normalizeInGameGuildRoleIds(initialRoleIds));
    const [query, setQuery] = useState("");

    // @everyone n'est jamais proposé : le cocher reviendrait à compter tout le serveur.
    // Les rôles **gérés par un bot/intégration** ne sont pas gérés par la guilde : inutiles ici.
    const selectableRoles = useMemo(
        () =>
            [...roles]
                .filter((role) => role.id !== guildId && role.managed !== true)
                .sort((a, b) => (b.position ?? 0) - (a.position ?? 0)),
        [roles, guildId]
    );

    const knownIds = useMemo(() => new Set(selectableRoles.map((role) => role.id)), [selectableRoles]);
    const staleCount = selected.filter((roleId) => !knownIds.has(roleId)).length;

    const visibleRoles = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return selectableRoles;
        return selectableRoles.filter((role) => role.name.toLowerCase().includes(needle));
    }, [selectableRoles, query]);

    const tally = useMemo(() => tallyInGameGuild({ roleIds: selected, rows }), [selected, rows]);
    const dirty = !sameSelection(selected, initialRoleIds);

    const toggleRole = (roleId: string) => {
        setSelected((previous) =>
            previous.includes(roleId)
                ? previous.filter((id) => id !== roleId)
                : normalizeInGameGuildRoleIds([...previous, roleId])
        );
    };

    const save = () => {
        startTransition(async () => {
            const result = await setInGameGuildRoleIds(guildId, selected);
            if (!result.success) {
                toast.error(result.error || "Erreur lors de l'enregistrement");
                return;
            }
            setSelected(result.roleIds ?? []);
            toast.success("Rôles « en guilde en jeu » enregistrés");
            router.refresh();
        });
    };

    return (
        <section className="rounded-lg border border-border-strong bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
                <GameIcon src="/assets/dofus/modules/guild.png" className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-foreground">En guilde en jeu</h3>
                <Badge variant="outline" className="tabular-nums">
                    {tally.total}
                </Badge>
                <span className="text-caption text-muted-foreground">
                    Membres par rôle Discord + mules déclarées
                </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Membres par rôle" value={tally.members} hint="Personnes distinctes, bots exclus (aucun doublon)" />
                <Stat label="Mules taguées" value={tally.mules} hint="Déclarées en guilde en jeu" />
                <Stat label="Total" value={tally.total} hint="Membres + mules" />
            </div>

            {!canManageMembers ? (
                <p className="mt-3 text-xs text-muted-foreground">
                    Seuls les gestionnaires de membres peuvent choisir les rôles comptés. Le total reste visible.
                </p>
            ) : roles.length === 0 ? (
                <p className="mt-3 text-xs text-warning">
                    Discord injoignable : aucun rôle disponible pour l’instant.
                </p>
            ) : (
                <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Filtrer les rôles…"
                                aria-label="Filtrer les rôles Discord"
                                className="h-8 w-56 pl-8 text-xs"
                            />
                        </div>
                        <span className="text-caption text-muted-foreground">
                            {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
                        </span>
                        {staleCount > 0 && (
                            <Badge variant="outline" className="border-border text-caption text-warning">
                                {staleCount} rôle(s) supprimé(s) sur Discord
                            </Badge>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelected([])}
                            disabled={isPending || selected.length === 0}
                            title="Décocher tous les rôles (pense à enregistrer ensuite)"
                            className="ml-auto"
                        >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Tout décocher
                        </Button>
                        <Button size="sm" onClick={save} disabled={isPending || !dirty}>
                            {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Enregistrer
                        </Button>
                    </div>

                    <ul className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                        {visibleRoles.map((role) => {
                            const active = selected.includes(role.id);
                            const dot = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#71717a";
                            return (
                                <li key={role.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggleRole(role.id)}
                                        aria-pressed={active}
                                        className={cn(
                                            "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                                            active
                                                ? "border-accent-soft-border bg-accent-soft text-accent"
                                                : "border-border bg-elevated text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{ backgroundColor: dot }}
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{role.name}</span>
                                        {active && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {visibleRoles.length === 0 && (
                        <p className="text-xs text-muted-foreground">Aucun rôle ne correspond à « {query} ».</p>
                    )}
                </div>
            )}
        </section>
    );
}
