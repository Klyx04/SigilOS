"use client";

/**
 * Fiche **Dofus** partagée — interne (dashboard membre) et public (guide connecté).
 *
 * Une seule forme pour les deux surfaces, née du retour du 11/11/2026 : « la modale de détail
 * est un squelette, on veut les assets de quête, le statut validé / en cours / à faire, les
 * membres sans surcharge, et l'icône Ocre ». Elle affiche donc :
 *
 *  · l'**icône du Dofus** et le résumé (`2/3 blocs`, membres engagés) ;
 *  · pour l'**Ocre**, une bande Metamob avec l'icône du Dofus et **deux mesures** (captures,
 *    étape) — jamais un pourcentage unique ;
 *  · la **liste des quêtes** avec l'asset de quête et un statut explicite :
 *    **Validée** / **En cours** (rendu là) / **À faire** ; en communauté, le nombre de
 *    membres qui l'ont validée ou qui y sont ;
 *  · les **membres engagés** en lignes compactes (avatar, quête en cours, `done/total`),
 *    dans une zone qui défile — aucun empilement de cartes.
 *
 * La modale sort de l'arbre (Radix) : elle réapplique la portée DA (`da-modal`, `da-portal`).
 */

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronRight, Circle, Clock3, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import type { DofusQuestStatus } from "@/lib/rush-dofus-progress";
import { questTypeIconPath } from "@/lib/quest-type-icon";
import { cn } from "@/lib/utils";

export type DofusDetailQuest = DofusQuestStatus & {
    /** Asset de la quête (`icone-quete.png` par défaut côté appelant). */
    asset?: string | null;
};

export type DofusDetailMember = {
    name: string;
    avatar?: string | null;
    current?: string | null;
    done: number;
    total: number;
    pct: number;
    /** Mule d'un personnage principal : pseudo du principal. */
    muleOf?: string | null;
};

export type DofusDetailOcre = {
    progress: number;
    captured: number;
    total: number;
    currentStep: number;
    stepCount: number | null;
};

export type DofusDetailTarget = {
    id: string;
    label: string;
    imageUrl: string;
    color: string;
};

const QUEST_ICON = questTypeIconPath("secondaire");

const PILL = {
    done: "border-success/30 bg-success/10 text-success",
    current: "border-warning/30 bg-warning/10 text-warning",
    todo: "border-border bg-elevated text-muted-foreground",
} as const;

export function RushDofusDetailModal({
    open,
    onClose,
    dofus,
    summary,
    quests,
    members,
    ocre,
    metamobVerified = false,
    showOcreBand = false,
    footer,
    onOpenQuest,
    locale = "fr",
}: {
    open: boolean;
    onClose: () => void;
    dofus: DofusDetailTarget | null;
    summary: string;
    quests: DofusDetailQuest[];
    /** Clic sur une quête : la fiche se ferme et l'appelant ouvre la quête. */
    onOpenQuest?: (quest: DofusDetailQuest) => void;
    members?: DofusDetailMember[];
    ocre?: DofusDetailOcre | null;
    metamobVerified?: boolean;
    /** Affiche la bande Ocre même sans données (icône + « compte requis »). */
    showOcreBand?: boolean;
    footer?: ReactNode;
    locale?: "fr" | "en";
}) {
    const en = locale === "en";
    const daScope = daScopeProps(useDaTheme());
    const [tab, setTab] = useState<"quests" | "members">("quests");
    const [questMembersOpen, setQuestMembersOpen] = useState<string | null>(null);
    // Un nouveau Dofus (ou une fermeture) repart sur les quêtes et referme les listes.
    useEffect(() => {
        setQuestMembersOpen(null);
        if (!open) setTab("quests");
    }, [open, dofus?.id]);

    return (
        <Dialog open={open && !!dofus} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                {...daScope}
                overlayClassName="da-modal-scrim"
                className="da-modal da-portal gap-0 p-0 sm:max-w-xl"
            >
                {dofus ? (
                    <>
                        <DialogHeader className="da-modal-head">
                            <DialogTitle className="da-modal-title flex items-center gap-2.5">
                                {/* L'asset du Dofus (Ocre compris), jamais un picto générique. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={dofus.imageUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
                                <span className="min-w-0 truncate">{dofus.label}</span>
                            </DialogTitle>
                            <DialogDescription className="da-modal-sub">{summary}</DialogDescription>
                        </DialogHeader>

                        <div className="da-modal-body max-h-[60vh] space-y-3 overflow-y-auto custom-scrollbar pr-0.5">
                            {members && members.length > 0 ? (
                                <div className="flex gap-1" role="tablist">
                                    {(["quests", "members"] as const).map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            role="tab"
                                            aria-selected={tab === key}
                                            onClick={() => setTab(key)}
                                            className={cn(
                                                "rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition-colors",
                                                tab === key
                                                    ? "bg-success/15 text-success"
                                                    : "text-muted-foreground hover:bg-elevated"
                                            )}
                                        >
                                            {key === "quests"
                                                ? en ? "Quests" : "Quêtes"
                                                : en ? "Member progress" : "Avancement"}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {/* Ocre : bande Metamob, avec l'icône du Dofus. */}
                            {ocre || showOcreBand ? (
                                <section className="rounded-[5px] border border-warning/30 bg-warning/[0.06] p-2.5">
                                    <div className="flex items-center gap-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={dofus.imageUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />
                                        <p className="text-[11px] font-semibold text-foreground">
                                            {en ? "Metamob captures" : "Captures Metamob"}
                                        </p>
                                        <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                                            {ocre ? `${ocre.progress} %` : "—"}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        {ocre
                                            ? en
                                                ? `Step ${ocre.currentStep}/${ocre.stepCount ?? "?"} · ${ocre.captured}/${ocre.total} monsters captured`
                                                : `Étape ${ocre.currentStep}/${ocre.stepCount ?? "?"} · ${ocre.captured}/${ocre.total} monstres capturés`
                                            : metamobVerified
                                                ? en ? "Captures unavailable right now." : "Captures indisponibles pour l'instant."
                                                : en
                                                    ? "Requires a visitor account and a Metamob API key."
                                                    : "Demande un compte visiteur et une clé d'API Metamob."}
                                    </p>
                                </section>
                            ) : null}

                            <section hidden={tab !== "quests"}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="text-[11px] font-semibold text-foreground">
                                        {en ? "Quests" : "Quêtes"}
                                    </p>
                                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                                        {quests.filter((quest) => quest.done).length}/{quests.length}
                                    </span>
                                </div>
                                {quests.length === 0 ? (
                                    <p className="mt-1 text-[11px] italic text-muted-foreground">
                                        {en
                                            ? "No quest of this guide is linked to this Dofus."
                                            : "Aucune quête de ce guide n'est liée à ce Dofus."}
                                    </p>
                                ) : (
                                    <ul className="mt-1.5 space-y-1">
                                        {quests.map((quest, index) => {
                                            const status = quest.done ? "done" : quest.current ? "current" : "todo";
                                            const rowKey = `${quest.id}-${index}`;
                                            const isMembersOpen = questMembersOpen === rowKey;
                                            const listedMembers = (quest.members ?? []).filter(
                                                (member) => member.done || member.current
                                            );
                                            return (
                                                <li
                                                    key={rowKey}
                                                    className="rounded-[4px] border border-border bg-surface transition-colors hover:border-success/40"
                                                >
                                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                                        {onOpenQuest ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => onOpenQuest(quest)}
                                                                className="group -mx-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[3px] px-1 py-0.5 text-left transition-colors hover:bg-elevated hover:text-success focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-success/50"
                                                                title={en ? "Open the quest in the guide" : "Ouvrir la quête dans le guide"}
                                                            >
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={quest.asset || QUEST_ICON}
                                                                    alt=""
                                                                    aria-hidden="true"
                                                                    loading="lazy"
                                                                    className="h-4 w-4 shrink-0 object-contain"
                                                                />
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block truncate text-xs font-semibold text-foreground">
                                                                        {quest.name}
                                                                    </span>
                                                                    {quest.category ? (
                                                                        <span className="block truncate text-[10px] text-muted-foreground">
                                                                            {quest.category}
                                                                            {quest.variantCount && quest.variantCount > 1
                                                                                ? ` · ${quest.variantCount} variantes`
                                                                                : ""}
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-success" aria-hidden="true" />
                                                            </button>
                                                        ) : (
                                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={quest.asset || QUEST_ICON}
                                                                    alt=""
                                                                    aria-hidden="true"
                                                                    loading="lazy"
                                                                    className="h-4 w-4 shrink-0 object-contain"
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-xs font-semibold text-foreground">
                                                                        {quest.name}
                                                                    </p>
                                                                    {quest.category ? (
                                                                        <p className="truncate text-[10px] text-muted-foreground">
                                                                            {quest.category}
                                                                            {quest.variantCount && quest.variantCount > 1
                                                                                ? ` · ${quest.variantCount} variantes`
                                                                                : ""}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {listedMembers.length > 0 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setQuestMembersOpen(isMembersOpen ? null : rowKey)}
                                                                aria-expanded={isMembersOpen}
                                                                aria-controls={`quest-members-${index}`}
                                                                aria-label={`${en ? "See members on" : "Voir les membres sur"} ${quest.name}`}
                                                                className={cn(
                                                                    "inline-flex shrink-0 items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                                                                    isMembersOpen
                                                                        ? "border-success/40 bg-success/10 text-success"
                                                                        : "border-border bg-elevated text-muted-foreground hover:text-foreground"
                                                                )}
                                                            >
                                                                <Users className="h-3 w-3" aria-hidden="true" />
                                                                {listedMembers.length}
                                                            </button>
                                                        ) : quest.membersDone ? (
                                                            <span className="shrink-0 text-[10px] text-muted-foreground">
                                                                {quest.membersDone}{" "}
                                                                {en
                                                                    ? quest.membersDone > 1 ? "members" : "member"
                                                                    : `membre${quest.membersDone > 1 ? "s" : ""}`}
                                                            </span>
                                                        ) : null}
                                                        <span
                                                            className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold ${PILL[status]}`}
                                                        >
                                                            {status === "done" ? (
                                                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                                            ) : status === "current" ? (
                                                                <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                            ) : (
                                                                <Circle className="h-3 w-3" aria-hidden="true" />
                                                            )}
                                                            {status === "done"
                                                                ? en ? "Validated" : "Validée"
                                                                : status === "current"
                                                                    ? en ? "In progress" : "En cours"
                                                                    : en ? "To do" : "À faire"}
                                                        </span>
                                                    </div>
                                                    {isMembersOpen ? (
                                                        <ul
                                                            id={`quest-members-${index}`}
                                                            className="space-y-0.5 border-t border-border/70 px-2 py-1.5"
                                                        >
                                                            {listedMembers.map((member, memberIndex) => (
                                                                <li key={`${member.name}-${memberIndex}`} className="flex items-center gap-2">
                                                                    <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-border bg-elevated">
                                                                        <MemberAvatar
                                                                            src={member.avatar}
                                                                            name={member.name}
                                                                            alt={member.name}
                                                                            fallbackClassName="text-[9px] font-semibold text-muted-foreground"
                                                                        />
                                                                    </span>
                                                                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                                                                        {member.name}
                                                                        {member.muleOf ? (
                                                                            <span className="ml-1 text-[9px] font-normal text-muted-foreground">
                                                                                mule de {member.muleOf}
                                                                            </span>
                                                                        ) : null}
                                                                        {member.isViewer ? (
                                                                            <span className="ml-1 rounded-[3px] border border-success/30 bg-success/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-success">
                                                                                {en ? "Me" : "Moi"}
                                                                            </span>
                                                                        ) : null}
                                                                    </span>
                                                                    <span
                                                                        className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold ${PILL[member.done ? "done" : "current"]}`}
                                                                    >
                                                                        {member.done ? (
                                                                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                                                        ) : (
                                                                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                                        )}
                                                                        {member.done
                                                                            ? en ? "Validated" : "Validée"
                                                                            : en ? "Here" : "Ici"}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            {members && members.length > 0 ? (
                                <section hidden={tab !== "members"}>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="text-[11px] font-semibold text-foreground">
                                            {en ? "Engaged members" : "Membres engagés"}
                                        </p>
                                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                                            {members.length}
                                        </span>
                                    </div>
                                    <ul className="mt-1.5 max-h-[26vh] space-y-1 overflow-y-auto pr-0.5">
                                        {members.map((member, index) => (
                                            <li
                                                key={`${member.name}-${index}`}
                                                className="flex items-center gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5"
                                            >
                                                <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border bg-elevated">
                                                    <MemberAvatar
                                                        src={member.avatar}
                                                        name={member.name}
                                                        alt={member.name}
                                                        fallbackClassName="text-[10px] font-semibold text-muted-foreground"
                                                    />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-semibold text-foreground">
                                                        {member.name}
                                                    </p>
                                                    <p className="truncate text-[10px] text-muted-foreground">
                                                        {member.muleOf ? `Mule de ${member.muleOf}` : null}
                                                        {member.muleOf && member.current ? " · " : null}
                                                        {member.current
                                                            ? `${en ? "Now" : "En cours"} : ${member.current}`
                                                            : member.muleOf
                                                              ? null
                                                              : en ? "Dofus done" : "Dofus terminé"}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                                                    {member.done}/{member.total} · {member.pct} %
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ) : null}
                        </div>

                        {footer ? (
                            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                                {footer}
                            </div>
                        ) : null}
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}


