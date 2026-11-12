"use client";

/**
 * Guide public — **panneau « Progression par Dofus »**, une seule carte pour deux vues.
 *
 * Pourquoi ce composant : le 11/11/2026, une rangée « Ma progression par Dofus » avait été
 * ajoutée au bandeau, au-dessus du panneau « Progression Communautaire » — deux rangées de
 * 15 Dofus, dont une seule était cliquable. Ici, **une seule carte** :
 *
 *  · vue **Moi** (tout le monde) : les blocs cochés par le visiteur, calculés localement ;
 *  · vue **Communauté** (compte connecté) : la progression des visiteurs consentants du même
 *    serveur, chargée **à la demande** (aucun appel tant que l'onglet n'est pas ouvert) ;
 *  · chaque Dofus est un **bouton** : la fiche s'ouvre au clic, dans les deux vues ;
 *  · pour l'**Ocre**, la fiche montre **deux mesures séparées** (blocs du guide / captures
 *    Metamob) — jamais un pourcentage unique.
 *
 * Aucun code `@/server/` : la lecture communauté passe par l'action colocalisée
 * (`_actions/public-community`), comme avant.
 */

import { useEffect, useRef, useState } from "react";
import { UserRound, Users } from "lucide-react";
import { dofusMetaIndex } from "@/lib/rush-dofus-meta";
import {
    communityDofusStats,
    type CommunityMember,
} from "@/lib/rush-community-progress";
import {
    questStatusForMembers,
    type DofusMilestoneStat,
    type DofusQuestRef,
} from "@/lib/rush-dofus-progress";
import { resolveRushSeqIcon } from "@/lib/rush-guide-utils";
import type { RushMilestone } from "@/types/rush-guide-types";
import type { PublicOcreSnapshot } from "@/components/dofus-quests/rush/PublicOcreDungeonBridge";
import {
    RushDofusDetailModal,
    type DofusDetailQuest,
} from "@/components/dofus-quests/rush/RushDofusDetailModal";
import { loadCommunityProgress } from "../_actions/public-community";

const DOFUS_META = dofusMetaIndex();
/** Dofus connus — même filtre que l'interne : les ids hors référentiel sont ignorés. */
const KNOWN_DOFUS_IDS = new Set(Object.keys(DOFUS_META));

type PanelState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; members: CommunityMember[] }
    | { status: "error"; message: string };

type View = "personal" | "community";

export function PublicDofusProgressPanel({
    milestones,
    completedSeqIds,
    bookmarkedSeqId,
    personal,
    ocreSnapshot,
    canSeeCommunity,
    metamobVerified,
    locale = "fr",
}: {
    milestones: RushMilestone[];
    /** Séquences terminées (ids) — statut « Validée » des quêtes, vue « Moi ». */
    completedSeqIds: ReadonlySet<string>;
    /** Repère « Je suis ici » — statut « En cours » (rendu là). */
    bookmarkedSeqId: string | null;
    personal: DofusMilestoneStat[];
    ocreSnapshot: PublicOcreSnapshot | null;
    canSeeCommunity: boolean;
    /** Compte lié à Metamob par une clé prouvée : seul cas où une capture est lisible. */
    metamobVerified: boolean;
    locale?: "fr" | "en";
}) {
    const en = locale === "en";
    const [view, setView] = useState<View>("personal");
    const [openDofusId, setOpenDofusId] = useState<string | null>(null);
    const [community, setCommunity] = useState<PanelState>({ status: "idle" });
    /** Une seule requête communauté par ouverture de page, même si on change d'onglet. */
    const communityRequested = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        return () => {
            mounted.current = false;
        };
    }, []);

    // Chargement PARESSEUX : la vue « Moi » ne coûte aucune requête, et un anonyme n'en fait
    // jamais. ⚠️ Ne PAS mettre `community.status` dans les dépendances : passer à `loading`
    // relançait l'effet, dont le nettoyage annulait la requête en vol → « Chargement… » infini.
    useEffect(() => {
        if (!canSeeCommunity || view !== "community" || communityRequested.current) return;
        communityRequested.current = true;
        setCommunity({ status: "loading" });
        void loadCommunityProgress().then((result) => {
            if (!mounted.current) return;
            setCommunity(
                result.success
                    ? { status: "ready", members: result.members }
                    : { status: "error", message: result.error }
            );
        });
    }, [canSeeCommunity, view]);

    const members = community.status === "ready" ? community.members : [];
    const communityStats =
        community.status === "ready" ? communityDofusStats(members, milestones, KNOWN_DOFUS_IDS) : [];

    const openMeta = openDofusId ? DOFUS_META[openDofusId] : null;
    const openPersonal = openDofusId ? personal.find((stat) => stat.id === openDofusId) ?? null : null;
    const openCommunity = openDofusId ? communityStats.find((stat) => stat.id === openDofusId) ?? null : null;
    const isOcre = openDofusId === "ocre";

    // Fiche : les **quêtes** du Dofus, pas seulement les blocs. En « Moi », le statut vient
    // des séquences cochées et du repère ; en « Communauté », de la même règle appliquée aux
    // membres (quête validée / en cours chez qui).
    const openMilestones = openDofusId ? milestones.filter((milestone) => milestone.dofusId === openDofusId) : [];
    const openQuests: DofusDetailQuest[] =
        view === "personal"
            ? openMilestones.flatMap((milestone) =>
                  milestone.sequences.map((sequence) => ({
                      id: sequence.id,
                      name: sequence.subGuideName,
                      category: milestone.chapterLabel ?? milestone.title,
                      done: completedSeqIds.has(sequence.id),
                      current: sequence.id === bookmarkedSeqId,
                      asset: sequence.icon ? resolveRushSeqIcon(sequence.icon) : null,
                  }))
              )
            : openMilestones.flatMap((milestone) =>
                  milestone.sequences.map((sequence) => {
                      const ref: DofusQuestRef = {
                          milestoneId: milestone.id,
                          category: milestone.chapterLabel ?? milestone.title,
                          label: sequence.subGuideName,
                          step: sequence.subGuideRef,
                          steps:
                              sequence.stepFrom != null && sequence.stepTo != null && sequence.stepTo >= sequence.stepFrom
                                  ? sequence.stepTo - sequence.stepFrom + 1
                                  : 1,
                      };
                      const status = questStatusForMembers([ref], members)[0];
                      return {
                          ...status,
                          asset: sequence.icon ? resolveRushSeqIcon(sequence.icon) : null,
                      };
                  })
              );
    const openMembers =
        view === "community" && openCommunity
            ? openCommunity.members.map((member) => ({
                  name: member.name,
                  current: typeof member.current === "string" ? member.current : null,
                  done: member.done,
                  total: member.total,
                  pct: member.total > 0 ? Math.round((member.done / member.total) * 100) : 0,
              }))
            : undefined;
    const openSummary =
        view === "personal"
            ? `${openPersonal?.done ?? 0}/${openPersonal?.total ?? 0} ${en ? "blocks validated" : "blocs validés"}`
            : `${openCommunity?.completedMilestones ?? 0}/${openCommunity?.totalMilestones ?? 0} ${
                  en ? "blocks validated by at least one member" : "blocs validés par au moins un membre"
              } · ${openCommunity?.members.length ?? 0} ${en ? "engaged member(s)" : "membre(s) engagé(s)"}`;

    const switchView = (next: View) => {
        setOpenDofusId(null);
        setView(next);
    };

    const ocreRowLabel = ocreSnapshot ? `${ocreSnapshot.progress} % capt.` : "capt. —";

    return (
        <div className="rounded-[6px] border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                        {view === "personal" ? (
                            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        ) : (
                            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                        {view === "personal"
                            ? en ? "My progress per Dofus" : "Ma progression par Dofus"
                            : "Progression Communautaire"}
                    </span>
                    {view === "personal" ? (
                        <span className="text-[11px] text-muted-foreground">
                            {en ? "blocks validated in this guide" : "blocs validés dans ce guide"}
                        </span>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    {canSeeCommunity ? (
                        <div
                            role="tablist"
                            aria-label={en ? "Progress view" : "Vue de progression"}
                            className="inline-flex rounded-[4px] border border-border p-0.5"
                        >
                            {(["personal", "community"] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === value}
                                    onClick={() => switchView(value)}
                                    className={`rounded-[3px] px-2 py-1 text-[11px] font-semibold transition-colors ${
                                        view === value
                                            ? "bg-elevated text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {value === "personal" ? (en ? "Me" : "Moi") : en ? "Community" : "Communauté"}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {view === "community" && community.status === "ready" ? (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {members.length}{" "}
                            {en ? (members.length > 1 ? "members" : "member") : `membre${members.length > 1 ? "s" : ""}`}
                        </span>
                    ) : null}
                </div>
            </div>

            {view === "community" && community.status === "loading" ? (
                <p className="text-[11px] text-muted-foreground">
                    {en ? "Loading the server's progress…" : "Chargement de la progression du serveur…"}
                </p>
            ) : null}

            {view === "community" && community.status === "error" ? (
                <p role="status" className="text-[11px] text-muted-foreground">
                    {community.message}
                </p>
            ) : null}

            {view === "community" && community.status === "ready" && members.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                    {en
                        ? "Nobody shares their progress on your server yet. Each visitor enables it in their visitor settings."
                        : "Personne ne partage encore sa progression sur ton serveur. Chacun l'active dans les réglages de son espace visiteur."}
                </p>
            ) : null}

            {view === "personal" && personal.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                    {en ? "No block of this guide is linked to a Dofus." : "Aucun bloc de ce guide n'est rattaché à un Dofus."}
                </p>
            ) : null}

            {view === "personal" && personal.length > 0 ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {personal.map((stat) => {
                        const meta = DOFUS_META[stat.id];
                        const label = meta?.label ?? stat.id;
                        const isAllDone = stat.total > 0 && stat.done === stat.total;
                        return (
                            <button
                                key={stat.id}
                                type="button"
                                onClick={() => setOpenDofusId(stat.id)}
                                aria-label={`${en ? "See my progress on" : "Voir ma progression sur"} ${label} — ${stat.done}/${stat.total}`}
                                title={`${label} — ${stat.done}/${stat.total}${stat.id === "ocre" ? ` · ${ocreRowLabel}` : ""}`}
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
                                    {stat.done}/{stat.total}
                                </span>
                                {stat.id === "ocre" ? (
                                    <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                                        {ocreRowLabel}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}

            {view === "community" && communityStats.length > 0 ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {communityStats.map((stat) => {
                        const meta = DOFUS_META[stat.id];
                        const label = meta?.label ?? stat.id;
                        const isAllDone =
                            stat.completedMilestones === stat.totalMilestones && stat.totalMilestones > 0;
                        return (
                            <button
                                key={stat.id}
                                type="button"
                                onClick={() => setOpenDofusId(stat.id)}
                                aria-label={`${en ? "See where members are on" : "Voir où en sont les membres sur le Dofus"} ${label} — ${stat.pct} %, ${stat.members.length}`}
                                title={`${label} — ${stat.pct} % — ${en ? "click for the per-member detail" : "cliquer pour le détail par membre"}`}
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

            <RushDofusDetailModal
                open={!!openDofusId}
                onClose={() => setOpenDofusId(null)}
                dofus={
                    openMeta
                        ? {
                              id: openMeta.id,
                              label: openMeta.label,
                              imageUrl: openMeta.imageUrl,
                              color: openMeta.color,
                          }
                        : null
                }
                summary={openSummary}
                quests={openQuests}
                members={openMembers}
                ocre={isOcre && ocreSnapshot ? ocreSnapshot : null}
                metamobVerified={metamobVerified}
                showOcreBand={isOcre}
                locale={locale}
            />
        </div>
    );
}



