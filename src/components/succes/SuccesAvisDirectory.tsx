"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { MonsterImage } from "@/components/succes/BountyFicheView";
import { getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import {
    getGuildBountyDirectory,
    type GuildBountyDirectoryEntry,
    type GuildBountyDirectoryMember,
} from "@/server/actions/dungeon-achievement-actions";

/** Ligne membre dense — même lecture que `SuccesDirectory` (avatar, pseudo, classe). */
function MemberRow({ member }: { member: GuildBountyDirectoryMember }) {
    const classe = member.classe ? getClass(member.classe) : null;
    return (
        <div className="flex min-w-0 items-center gap-2 py-1">
            <div className="size-5 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                {member.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={member.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <Users className="m-auto size-3 text-muted-foreground/60" aria-hidden="true" />
                )}
            </div>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                {member.name}
            </span>
            {classe ? <GameIcon src={classe.icon} className="size-4 shrink-0" /> : null}
        </div>
    );
}

function MemberColumn({
    title,
    members,
    empty,
}: {
    title: string;
    members: GuildBountyDirectoryMember[];
    empty: string;
}) {
    return (
        <div>
            <p className="text-caption font-bold uppercase tracking-widest text-muted-foreground">
                {title} · {members.length}
            </p>
            {members.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">{empty}</p>
            ) : (
                <div className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                    {members.map((member) => (
                        <MemberRow key={member.id} member={member} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Filtre commun des **avis de recherche** (module Succès) : qui a fait quel avis dans la
 * guilde, et qui le cherche encore. Les coches se font dans la fiche (`view=bounties`) ;
 * ici on ne lit que le périmètre `canViewGuildSucces` renvoyé par l'action serveur.
 */
export function SuccesAvisDirectory({ guildId }: { guildId: string }) {
    const [entries, setEntries] = useState<GuildBountyDirectoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getGuildBountyDirectory(guildId)
            .then((res) => {
                if (cancelled) return;
                if (res.success && res.data) {
                    setEntries(res.data);
                    setSelectedId((current) => current ?? res.data![0]?.bountyId ?? null);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guildId]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return entries;
        return entries.filter(
            (entry) =>
                entry.name.toLowerCase().includes(term) ||
                (entry.zoneName ?? "").toLowerCase().includes(term)
        );
    }, [entries, search]);

    const selected = entries.find((entry) => entry.bountyId === selectedId) ?? null;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="mb-4 size-8 animate-spin text-warning" />
                <p className="font-medium">Chargement des avis de la guilde…</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 2xl:grid-cols-[320px_1fr]">
            <aside className="min-w-0">
                <div className="reg-panel p-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Rechercher un avis ou une zone…"
                            aria-label="Rechercher un avis de recherche"
                            className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                    <div className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto pr-0.5">
                        {filtered.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                Aucun avis ne correspond à cette recherche.
                            </p>
                        ) : (
                            filtered.map((entry) => {
                                const active = entry.bountyId === selectedId;
                                return (
                                    <button
                                        key={entry.bountyId}
                                        type="button"
                                        onClick={() => setSelectedId(entry.bountyId)}
                                        aria-current={active ? "true" : undefined}
                                        className={cn(
                                            "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                                            active
                                                ? "border-border-strong bg-elevated text-foreground"
                                                : "border-transparent bg-elevated/40 text-muted-foreground hover:bg-elevated hover:text-foreground"
                                        )}
                                    >
                                        <MonsterImage
                                            src={entry.imageUrl}
                                            className="size-9 shrink-0 rounded-lg object-contain"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-semibold text-foreground">
                                                {entry.name}
                                            </span>
                                            <span className="block truncate text-[10px]">
                                                {entry.zoneName ?? "—"}
                                            </span>
                                        </span>
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            niv. {entry.level}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </aside>
            <section className="min-w-0">
                {!selected ? (
                    <div className="reg-callout">
                        <p className="text-sm text-muted-foreground">
                            Sélectionne un avis dans la liste pour voir qui l&apos;a fait et qui le
                            cherche encore.
                        </p>
                    </div>
                ) : (
                    <article className="reg-panel p-4">
                        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <MonsterImage
                                    src={selected.imageUrl}
                                    className="size-12 shrink-0 rounded-lg object-contain"
                                />
                                <div className="min-w-0">
                                    <h2 className="truncate text-lg font-semibold text-foreground">
                                        {selected.name}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Avis de recherche · LVL {selected.level}
                                        {selected.zoneName ? ` · ${selected.zoneName}` : ""}
                                    </p>
                                </div>
                            </div>
                            {selected.slug ? (
                                <a
                                    href={`/boss/${selected.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="reg-link text-xs"
                                >
                                    Voir la fiche
                                </a>
                            ) : null}
                        </header>

                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <MemberColumn
                                title="Déjà fait"
                                members={selected.hasCompleted}
                                empty="Personne pour l'instant."
                            />
                            <MemberColumn
                                title="Cherchent encore"
                                members={selected.missing}
                                empty="Tout le monde l'a fait."
                            />
                        </div>
                    </article>
                )}
            </section>
        </div>
    );
}
