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

import type { ReactNode } from "react";
import { CheckCircle2, Clock3, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import type { DofusQuestStatus } from "@/lib/rush-dofus-progress";

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

const QUEST_ICON = "/assets/icons/icone-quete.png";

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
    locale = "fr",
}: {
    open: boolean;
    onClose: () => void;
    dofus: DofusDetailTarget | null;
    summary: string;
    quests: DofusDetailQuest[];
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

                            <section>
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
                                            return (
                                                <li
                                                    key={`${quest.id}-${index}`}
                                                    className="flex items-center gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5"
                                                >
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
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    {quest.membersDone ? (
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
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            {members && members.length > 0 ? (
                                <section>
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
                                                        {member.current
                                                            ? `${en ? "Now" : "En cours"} : ${member.current}`
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


