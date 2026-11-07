"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { loadCommunityProgress } from "../_actions/public-community";
import { dofusMetaIndex } from "@/lib/rush-dofus-meta";
import {
    communityDofusStats,
    type CommunityMember,
    type CommunityMilestoneLike,
} from "@/lib/rush-community-progress";

const DOFUS_META = dofusMetaIndex();

type PanelState =
    | { status: "loading" }
    | { status: "ready"; members: CommunityMember[] }
    | { status: "error"; message: string };

/**
 * Panneau **Progression Communautaire** du guide public (V2a-2).
 *
 * Il reproduit le panneau interne par Dofus (D-V8) : un bloc par Dofus, le pourcentage de
 * jalons couverts par au moins un membre, puis chaque membre situé **à la quête**
 * (`memberDofusProgress`, la même règle que l interne).
 *
 * Deux invariants de confidentialité : la liste ne contient que les visiteurs du serveur du
 * lecteur qui ont coché « Publier ma progression de rush » (D-V21), et le serveur ne renvoie
 * qu un nom de personnage + des compteurs — jamais `userId` ni `publicProfileId`.
 *
 * ⚠️ Conteneur **vertical** volontaire : `.da-card` est un flex horizontal (icône + texte), il
 * ne peut pas porter un titre puis une liste (mesure du 08/11/2026).
 */
export function PublicCommunityPanel({ milestones }: { milestones: CommunityMilestoneLike[] }) {
    const [state, setState] = useState<PanelState>({ status: "loading" });

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const result = await loadCommunityProgress();
            if (cancelled) return;
            if (!result.success) {
                setState({ status: "error", message: result.error });
                return;
            }
            setState({ status: "ready", members: result.members });
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const members = state.status === "ready" ? state.members : [];
    const stats = state.status === "ready" ? communityDofusStats(members, milestones) : [];

    return (
        <section
            className="rounded-[6px] border border-border bg-surface p-4"
            aria-labelledby="public-community-title"
        >
            <header className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h2 id="public-community-title" className="text-xs font-medium text-foreground">
                        Progression Communautaire
                    </h2>
                </div>
                {members.length > 0 ? (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                        {members.length} {members.length > 1 ? "membres" : "membre"}
                    </span>
                ) : null}
            </header>

            {state.status === "loading" ? (
                <p className="text-[11px] text-muted-foreground">Chargement de la progression du serveur…</p>
            ) : null}

            {state.status === "error" ? (
                <p role="status" className="text-[11px] text-muted-foreground">
                    {state.message}
                </p>
            ) : null}

            {state.status === "ready" && members.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                    Personne ne partage encore sa progression sur ton serveur. Chacun l active dans
                    les réglages de son espace visiteur.
                </p>
            ) : null}

            {stats.length > 0 ? (
                <div className="space-y-2.5">
                    {stats.map((stat) => {
                        const meta = DOFUS_META[stat.id];
                        const label = meta?.label ?? stat.id;
                        return (
                            <div key={stat.id} className="rounded-[4px] border border-border bg-background p-3">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
                                        {meta ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={meta.imageUrl}
                                                alt=""
                                                aria-hidden="true"
                                                className="h-4 w-4 shrink-0 object-contain"
                                            />
                                        ) : null}
                                        <span className="truncate">{label}</span>
                                    </span>
                                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                        {stat.pct} % · {stat.completedMilestones}/{stat.totalMilestones}
                                    </span>
                                </div>
                                <div
                                    className="mt-1 h-1.5 overflow-hidden rounded-[2px] bg-elevated"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={stat.pct}
                                    aria-label={`Avancement ${label}`}
                                >
                                    <span
                                        className="block h-full bg-success"
                                        style={{ width: `${stat.pct}%` }}
                                    />
                                </div>
                                <ul className="mt-2 space-y-1">
                                    {stat.members.map((member) => (
                                        <li
                                            key={member.name}
                                            className="flex items-baseline justify-between gap-3 text-[11px]"
                                        >
                                            <strong className="truncate font-semibold text-foreground">
                                                {member.name}
                                            </strong>
                                            <span className="truncate text-muted-foreground">
                                                {member.current
                                                    ? `${member.current} · ${member.currentIndex}/${member.total}`
                                                    : "Dofus terminé"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </section>
    );
}