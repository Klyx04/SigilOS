"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Baby, ChevronDown, ChevronUp, HelpCircle, Search } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClass } from "@/lib/dofus-assets";
import { isMuleInGameGuild } from "@/lib/in-game-guild";
import {
    collectDeclaredMules,
    filterDeclaredMuleGroups,
    MULE_OMEGA_BASE,
    type DeclaredMule,
    type DeclaredMuleGroup,
} from "@/lib/member-mules";
import type { RosterRow } from "@/lib/member-roster";
import { setMuleInGameGuild } from "@/server/actions/member-in-game-actions";
import { cn } from "@/lib/utils";

/** Nombre de propriétaires visibles quand le panneau est replié (le reste est derrière « Voir tout »). */
const COLLAPSED_GROUPS = 3;

function initials(name: string) {
    return name
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function MuleChip({
    mule,
    muted,
    canToggle,
    pending,
    onToggle,
}: {
    mule: DeclaredMule;
    muted: boolean;
    canToggle?: boolean;
    pending?: boolean;
    onToggle?: () => void;
}) {
    const classe = mule.classe ? getClass(mule.classe) : null;
    const enGuilde = isMuleInGameGuild(mule);

    const content = (
        <>
            {classe ? (
                <Image
                    src={classe.icon}
                    alt=""
                    aria-hidden="true"
                    title={classe.name}
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                />
            ) : (
                <span
                    title="Classe non déclarée"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-strong text-muted-foreground"
                >
                    <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
            )}
            <span className="max-w-32 truncate text-xs text-foreground">{mule.pseudo}</span>
            {mule.level !== null && (
                <span className="tabular-nums text-caption text-muted-foreground">
                    {mule.level > MULE_OMEGA_BASE ? `Ω${mule.level - MULE_OMEGA_BASE}` : `Nv. ${mule.level}`}
                </span>
            )}
            {enGuilde && (
                <span className="rounded-sm border border-accent-soft-border bg-accent-soft px-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    En guilde
                </span>
            )}
        </>
    );

    return (
        <li
            className={cn(
                "flex items-center gap-1.5 rounded-md border bg-elevated px-1.5 py-1",
                enGuilde ? "border-accent-soft-border" : "border-border",
                muted && "opacity-60",
                pending && "opacity-60"
            )}
        >
            {canToggle && onToggle ? (
                <button
                    type="button"
                    onClick={onToggle}
                    disabled={pending}
                    aria-pressed={enGuilde}
                    title={
                        enGuilde
                            ? "Retirer le tag « en guilde en jeu »"
                            : "Marquer cette mule « en guilde en jeu »"
                    }
                    className="flex items-center gap-1.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                    {content}
                </button>
            ) : (
                content
            )}
        </li>
    );
}

/**
 * Inventaire des **mules déclarées** de la guilde : combien, à qui, avec quelle classe.
 *
 * Une guilde peut compter **beaucoup** de mules : le panneau reste donc **replié** par
 * défaut (3 propriétaires seulement), et « Voir tout » ouvre la liste complète —
 * recherche par pseudo ou par membre, zone **défilante** bornée. Il ne pousse jamais la
 * liste des membres hors de l'écran.
 *
 * Source = `altPseudos` des profils et des lignes de registre (règle pure
 * `src/lib/member-mules.ts`). Aucune classe inventée : sans classe déclarée, un repère
 * neutre plutôt qu'une icône qui ferait croire à une information.
 */
export function MemberMulesSummary({
    rows,
    guildId,
    canManageMembers = false,
}: {
    rows: RosterRow[];
    /** Fourni ⇒ le staff peut taguer une mule « en guilde en jeu » (action serveur). */
    guildId?: string;
    canManageMembers?: boolean;
}) {
    const summary = useMemo(() => collectDeclaredMules(rows), [rows]);
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState("");
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    const router = useRouter();

    const canTag = Boolean(guildId && canManageMembers);
    const tagged = useMemo(
        () =>
            summary.groups.reduce(
                (count, group) => count + group.mules.filter(isMuleInGameGuild).length,
                0
            ),
        [summary]
    );

    /** Clé stable d'une mule pour l'état d'attente (profil, sinon Discord, sinon nom). */
    const muleKey = (group: DeclaredMuleGroup, mule: DeclaredMule) =>
        `${group.owner.profileId ?? group.owner.discordId ?? group.owner.name}::${mule.pseudo}`;

    const toggleMule = (group: DeclaredMuleGroup, mule: DeclaredMule) => {
        if (!guildId || !canTag) return;
        setPendingKey(muleKey(group, mule));
        startTransition(async () => {
            const result = await setMuleInGameGuild(
                guildId,
                {
                    profileId: group.owner.profileId,
                    // Une seule cible : le profil prime sur la ligne de registre.
                    discordId: group.owner.profileId ? null : group.owner.discordId,
                },
                mule.pseudo,
                !mule.inGameGuild
            );
            setPendingKey(null);
            if (!result.success) {
                toast.error(result.error || "Erreur lors de l'enregistrement");
                return;
            }
            toast.success(
                mule.inGameGuild
                    ? "Tag « en guilde » retiré"
                    : `${mule.pseudo} marquée « en guilde en jeu »`
            );
            router.refresh();
        });
    };

    const groups = useMemo(() => filterDeclaredMuleGroups(summary.groups, query), [summary, query]);
    const visibleGroups = expanded ? groups : groups.slice(0, COLLAPSED_GROUPS);
    const hiddenGroups = Math.max(0, groups.length - visibleGroups.length);
    const hiddenMules = groups
        .slice(visibleGroups.length)
        .reduce((count, group) => count + group.mules.length, 0);

    return (
        <section className="rounded-lg border border-border-strong bg-surface p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Baby className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">Mules déclarées</h3>
                <Badge variant="outline" className="tabular-nums">{summary.total}</Badge>
                {tagged > 0 && (
                    <Badge className="tabular-nums border border-accent-soft-border bg-accent-soft text-accent">
                        {tagged} en guilde
                    </Badge>
                )}
                <span className="text-caption text-muted-foreground">
                    {summary.membersWithMules} membre{summary.membersWithMules > 1 ? "s" : ""} en déclare
                    {summary.withoutClass > 0 && ` · ${summary.withoutClass} sans classe`}
                </span>

                {summary.total > 0 && (
                    <div className="ml-auto flex items-center gap-2">
                        {expanded && (
                            <div className="relative">
                                <Search
                                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Mule ou membre…"
                                    aria-label="Rechercher une mule ou un membre"
                                    className="h-8 w-52 pl-8 text-xs"
                                />
                            </div>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => {
                                setExpanded((previous) => !previous);
                                if (expanded) setQuery("");
                            }}
                            aria-expanded={expanded}
                        >
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {expanded ? "Réduire" : "Voir tout"}
                        </Button>
                    </div>
                )}
            </div>

            {summary.total === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                    Aucune mule déclarée pour l’instant. Chaque membre les renseigne depuis son profil
                    (ou le staff depuis la fiche du membre).
                </p>
            ) : (
                <div className={cn("mt-3 space-y-2", expanded && "max-h-80 overflow-y-auto pr-1")}>
                    {visibleGroups.map((group) => (
                        <div
                            key={group.owner.profileId || group.owner.discordId || group.owner.name}
                            className="rounded-md border border-border bg-surface/60 p-2.5"
                        >
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6 rounded-md border border-border">
                                    <AvatarImage src={group.owner.avatar || undefined} alt="" />
                                    <AvatarFallback className="rounded-md text-[10px] font-semibold">
                                        {initials(group.owner.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-xs font-semibold text-foreground">{group.owner.name}</span>
                                <span className="ml-auto shrink-0 tabular-nums text-caption text-muted-foreground">
                                    {group.mules.length} mule{group.mules.length > 1 ? "s" : ""}
                                </span>
                            </div>
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                                {group.mules.map((mule) => (
                                    <MuleChip
                                        key={`${group.owner.name}-${mule.pseudo}`}
                                        mule={mule}
                                        muted={group.owner.status === "BANNED"}
                                        canToggle={canTag}
                                        pending={pendingKey === muleKey(group, mule)}
                                        onToggle={() => toggleMule(group, mule)}
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}

                    {!expanded && hiddenGroups > 0 && (
                        <p className="text-caption text-muted-foreground">
                            + {hiddenGroups} autre{hiddenGroups > 1 ? "s" : ""} membre{hiddenGroups > 1 ? "s" : ""} ({hiddenMules} mule
                            {hiddenMules > 1 ? "s" : ""}) — « Voir tout » pour la liste complète.
                        </p>
                    )}

                    {expanded && groups.length === 0 && (
                        <p className="text-xs text-muted-foreground">Aucune mule ne correspond à « {query} ».</p>
                    )}
                </div>
            )}
        </section>
    );
}

