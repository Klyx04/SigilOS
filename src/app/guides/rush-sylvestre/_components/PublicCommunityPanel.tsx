"use client";

import { useEffect, useState } from "react";
import { loadCommunityProgress } from "../_actions/public-community";
import {
    memberCompletion,
    sortCommunityMembers,
    type CommunityMember,
} from "@/lib/rush-community-progress";

type PanelState =
    | { status: "loading" }
    | { status: "ready"; members: CommunityMember[] }
    | { status: "error"; message: string };

function countLabel(count: number, singular: string, plural: string): string {
    return `${count} ${count > 1 ? plural : singular}`;
}

/**
 * Panneau **Progression Communautaire** du guide public (V2a-2).
 *
 * Il n'affiche que les visiteurs du serveur du lecteur qui ont coché « Publier ma progression
 * de rush » (D-V21) : la liste vient d'une action colocalisée, jamais d'une lecture directe
 * (`@/server/` est interdit dans ce client). Aucun nom de compte, aucun identifiant : le
 * serveur ne renvoie qu'un nom de personnage et deux compteurs.
 */
export function PublicCommunityPanel({ totalMilestones }: { totalMilestones: number }) {
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

    const members =
        state.status === "ready" ? sortCommunityMembers(state.members, totalMilestones) : [];

    return (
        <section className="da-card" aria-labelledby="public-community-title">
            <h2 id="public-community-title" className="da-title">
                Progression Communautaire
            </h2>
            <p className="da-kicker">Les visiteurs de ton serveur qui partagent leur progression.</p>

            {state.status === "loading" ? (
                <p className="da-state">Chargement de la progression du serveur…</p>
            ) : null}

            {state.status === "error" ? (
                <p className="da-state" role="status">
                    {state.message}
                </p>
            ) : null}

            {state.status === "ready" && members.length === 0 ? (
                <p className="da-state">
                    Personne ne partage encore sa progression sur ton serveur. Chacun l active dans
                    les réglages de son espace visiteur.
                </p>
            ) : null}

            {members.length > 0 ? (
                <ul className="mt-3 space-y-3">
                    {members.map((member) => {
                        const pct = memberCompletion(member, totalMilestones);
                        return (
                            <li key={`${member.name}-${member.updatedAt}`}>
                                <div className="flex items-baseline justify-between gap-3">
                                    <strong>{member.name}</strong>
                                    <span className="text-sm" style={{ color: "var(--da-muted0)" }}>
                                        {countLabel(member.completedMilestones.length, "bloc", "blocs")}
                                        {" · "}
                                        {countLabel(member.dungeonDone.length, "donjon", "donjons")}
                                    </span>
                                </div>
                                <div
                                    className="mt-1 h-1.5 overflow-hidden rounded-[4px]"
                                    style={{ background: "var(--da-line0)" }}
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={pct}
                                    aria-label={`Avancement de ${member.name}`}
                                >
                                    <div
                                        className="h-full rounded-[4px]"
                                        style={{ width: `${pct}%`, background: "var(--da-acc)" }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </section>
    );
}