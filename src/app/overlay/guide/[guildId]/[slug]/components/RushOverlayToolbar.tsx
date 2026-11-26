"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import type { RushQuestCounts, RushQuestFilter } from "@/lib/rush-quest-filter";
import { RushOverlayQuestFilter } from "./RushOverlayQuestFilter";

export interface RushOverlayToolbarMember {
    name: string;
    avatar?: string | null;
}

/**
 * Barre d'outils **tight** de l'overlay : une seule rangée de 30-36 px qui
 * remplace les deux blocs empilés `RushOverlayActions` + `RushOverlayQuestFilter`
 * + la ligne « Sur ce chapitre ».
 *
 * Ordre : filtre (flex) · Reprendre · ressources (0/19) · avatars des membres
 * du chapitre. Le filtre garde son menu DA ; les avatars ouvrent la même modale
 * que la ligne « Sur ce chapitre » des modes larges.
 */
export function RushOverlayToolbar({
    filter,
    counts,
    onFilterChange,
    onResume,
    onOpenResources,
    checked,
    total,
    members = [],
    onOpenMembers,
    className,
}: {
    filter: RushQuestFilter;
    counts?: RushQuestCounts;
    onFilterChange: (value: RushQuestFilter) => void;
    onResume: () => void;
    onOpenResources: () => void;
    checked: number;
    total: number;
    members?: RushOverlayToolbarMember[];
    onOpenMembers?: () => void;
    className?: string;
}) {
    const shown = members.slice(0, 3);
    const extra = Math.max(0, members.length - shown.length);

    return (
        <div className={cn("da-toolbar", className)} data-testid="rush-overlay-toolbar">
            <RushOverlayQuestFilter
                value={filter}
                onChange={onFilterChange}
                counts={counts}
                compact
                inline
            />

            <button
                type="button"
                onClick={onResume}
                title="Reprendre : repère « je suis ici » ou prochaine quête à faire"
                className="da-btn da-toolbar-resume"
            >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reprendre</span>
            </button>

            <button
                type="button"
                onClick={onOpenResources}
                title="Ressources à prévoir"
                aria-label={total > 0 ? `Ressources à prévoir, ${checked} sur ${total}` : "Ressources à prévoir"}
                className="da-btn da-btn-icon da-toolbar-resources"
            >
                {/* Picto du jeu (asset Dofus du module Ressources). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/dofus/modules/resources.png"
                    alt=""
                    className="h-4 w-4 object-contain"
                    loading="lazy"
                />
                {total > 0 && (
                    <b className="da-badge" aria-hidden="true">
                        {checked}/{total}
                    </b>
                )}
            </button>

            {members.length > 0 && (
                <button
                    type="button"
                    onClick={onOpenMembers}
                    title={
                        extra > 0
                            ? `${members.length} membres sur ce chapitre`
                            : "Voir les membres sur ce chapitre"
                    }
                    aria-label={`${members.length} membre${members.length > 1 ? "s" : ""} sur ce chapitre`}
                    className="da-toolbar-members"
                >
                    {shown.map((member, index) => (
                        <MemberAvatar
                            key={`${member.name}-${index}`}
                            src={member.avatar}
                            name={member.name}
                            alt=""
                            title={member.name}
                            className={cn(
                                "h-[18px] w-[18px] shrink-0 rounded-full border border-[#39bc95]/40",
                                index > 0 && "-ml-[5px]",
                            )}
                            fallbackClassName="bg-[#39bc95]/20 text-[#39bc95] text-[8px] font-bold uppercase"
                        />
                    ))}
                    {extra > 0 && <span className="da-toolbar-more">+{extra}</span>}
                </button>
            )}
        </div>
    );
}
