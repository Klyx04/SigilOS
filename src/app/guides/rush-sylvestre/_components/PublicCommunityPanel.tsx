"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
 * Même forme que le panneau interne (`GuildStatusPanel`) : une **rangée de pastilles**
 * Dofus (icône nue + libellé + filet + %), et le détail par membre dans une modale au clic.
 * Une pile de cartes pleine largeur avait été livrée le 08/11/2026 : elle écrasait la page
 * (douze blocs vides) et ne ressemblait pas à l interne — mesure, pas goût.
 *
 * Deux invariants de confidentialité : seuls les visiteurs du serveur du lecteur qui ont coché
 * « Publier ma progression de rush » (D-V21) arrivent ici, et le serveur ne renvoie qu un nom
 * de personnage + des compteurs — jamais `userId` ni `publicProfileId`.
 */
export function PublicCommunityPanel({ milestones }: { milestones: CommunityMilestoneLike[] }) {
    const [state, setState] = useState<PanelState>({ status: "loading" });
    const [openDofusId, setOpenDofusId] = useState<string | null>(null);

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
    const selected = stats.find((stat) => stat.id === openDofusId) ?? null;
    const selectedMeta = selected ? DOFUS_META[selected.id] : null;

    return (
        <div className="rounded-[6px] border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-xs font-medium text-foreground">
                        Progression Communautaire
                    </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {members.length} membre{members.length > 1 ? "s" : ""}
                </span>
            </div>

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
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {stats.map((stat) => {
                        const meta = DOFUS_META[stat.id];
                        const label = meta?.label ?? stat.id;
                        const isAllDone =
                            stat.completedMilestones === stat.totalMilestones && stat.totalMilestones > 0;
                        return (
                            <button
                                key={stat.id}
                                type="button"
                                onClick={() => setOpenDofusId(stat.id)}
                                aria-label={`Voir où en sont les membres sur le Dofus ${label} — ${stat.pct} %, ${stat.members.length} membre(s)`}
                                title={`${label} — ${stat.pct} % — cliquer pour le détail par membre`}
                                className="relative flex w-[78px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[4px] border border-transparent p-1.5 text-center transition-colors hover:border-border"
                            >
                                {meta ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={meta.imageUrl} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
                                ) : null}
                                <span
                                    className={`max-w-full truncate text-[11px] leading-tight ${
                                        isAllDone ? "text-success" : "text-muted-foreground"
                                    }`}
                                >
                                    {label}
                                </span>
                                <div className="h-1 w-full overflow-hidden rounded-[2px] bg-elevated">
                                    <div
                                        className="h-full rounded-[2px] transition-all duration-300"
                                        style={{
                                            width: `${stat.pct}%`,
                                            background: isAllDone ? "var(--success)" : meta?.color,
                                        }}
                                    />
                                </div>
                                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                                    {stat.pct}%
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : null}

            <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setOpenDofusId(null); }}>
                <DialogContent className="max-w-md">
                    <DialogTitle>
                        {selectedMeta?.label ?? "Progression"} — où en sont les membres
                    </DialogTitle>
                    {(selected?.members.length ?? 0) === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                            Aucun membre n a encore coché de quête sur ce Dofus.
                        </p>
                    ) : null}
                    <ul className="mt-2 space-y-1.5">
                        {(selected?.members ?? []).map((member) => (
                            <li
                                key={member.name}
                                className="flex items-baseline justify-between gap-3 text-[11px]"
                            >
                                <strong className="truncate font-semibold text-foreground">{member.name}</strong>
                                <span className="truncate text-muted-foreground">
                                    {member.current
                                        ? `${member.current} · ${member.currentIndex}/${member.total}`
                                        : "Dofus terminé"}
                                </span>
                            </li>
                        ))}
                    </ul>
                </DialogContent>
            </Dialog>
        </div>
    );
}