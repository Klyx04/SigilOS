"use client";

import Image from "next/image";
import { Baby, HelpCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getClass } from "@/lib/dofus-assets";
import { collectDeclaredMules, type DeclaredMule } from "@/lib/member-mules";
import type { RosterRow } from "@/lib/member-roster";
import { cn } from "@/lib/utils";

/**
 * Inventaire des **mules déclarées** de la guilde : combien, à qui, avec quelle classe.
 *
 * Source = `altPseudos` des profils et des lignes de registre (règle pure
 * `src/lib/member-mules.ts`). Aucune classe inventée : sans classe déclarée, on affiche
 * un repère neutre plutôt qu'une icône qui ferait croire à une information.
 */
export function MemberMulesSummary({ rows }: { rows: RosterRow[] }) {
    const summary = collectDeclaredMules(rows);

    const initials = (name: string) =>
        name
            .split(/\s+/)
            .map((part) => part[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();

    const classIcon = (mule: DeclaredMule) => {
        const classe = mule.classe ? getClass(mule.classe) : null;
        if (!classe) {
            return (
                <span
                    title="Classe non déclarée"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-strong text-muted-foreground"
                >
                    <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
            );
        }
        return (
            <Image
                src={classe.icon}
                alt=""
                aria-hidden="true"
                title={classe.name}
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 object-contain"
            />
        );
    };

    return (
        <section className="rounded-lg border border-border-strong bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Baby className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-foreground">Mules déclarées</h3>
                    <Badge variant="outline" className="tabular-nums">
                        {summary.total}
                    </Badge>
                </div>
                <p className="text-caption text-muted-foreground">
                    {summary.membersWithMules} membre{summary.membersWithMules > 1 ? "s" : ""} en déclare
                    {summary.withoutClass > 0 && ` · ${summary.withoutClass} sans classe`}
                </p>
            </div>

            {summary.total === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                    Aucune mule déclarée pour l&apos;instant. Chaque membre les renseigne depuis
                    son profil (ou le staff depuis la fiche du membre).
                </p>
            ) : (
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {summary.groups.map((group) => (
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
                                <span className="truncate text-xs font-semibold text-foreground">
                                    {group.owner.name}
                                </span>
                                <span className="ml-auto shrink-0 text-caption tabular-nums text-muted-foreground">
                                    {group.mules.length} mule{group.mules.length > 1 ? "s" : ""}
                                </span>
                            </div>

                            <ul className="mt-2 flex flex-wrap gap-1.5">
                                {group.mules.map((mule) => (
                                    <li
                                        key={`${group.owner.name}-${mule.pseudo}`}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-md border border-border bg-elevated px-1.5 py-1",
                                            group.owner.status === "BANNED" && "opacity-60"
                                        )}
                                    >
                                        {classIcon(mule)}
                                        <span className="max-w-32 truncate text-xs text-foreground">{mule.pseudo}</span>
                                        {mule.level !== null && (
                                            <span className="text-caption tabular-nums text-muted-foreground">
                                                Nv. {mule.level}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
