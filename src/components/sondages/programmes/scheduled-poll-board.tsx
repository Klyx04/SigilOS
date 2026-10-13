"use client";

/**
 * Sondages **programmés** (module staff) — **tableau de bord** des créneaux.
 *
 * Rappelle en permanence la règle du module : **N créneaux en attente maximum**
 * (le compteur vient du serveur, jamais recalculé ici) et **une seule chose à la
 * fois par minute**. Chaque ligne dit ce qui va se passer, quand, et dans quel
 * salon — et propose les deux seules actions utiles : publier tout de suite, ou
 * annuler.
 *
 * Style : les tokens de `@/lib/polls/ui` (même contrat que la fiche des
 * sondages) — un seul accent, pas d'ombre, pas de palette en dur.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    CalendarClock,
    CheckCircle2,
    ExternalLink,
    Hash,
    Hourglass,
    Pencil,
    Send,
    TriangleAlert,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPollEnd } from "@/lib/poll-format";
import {
    POLL_CATEGORY_LABELS,
    POLL_SCHEDULED_TAG,
    POLL_SLOT_COUNTER,
    POLL_SLOT_ROW,
    POLL_SLOT_STATUS_ACTIVE,
    POLL_SLOT_STATUS_IDLE,
} from "@/lib/polls/ui";
import { SCHEDULED_POLL_TAG } from "@/lib/polls/scheduling";
import {
    cancelScheduledPoll,
    publishScheduledPollNow,
    type ScheduledPollBoard as BoardData,
    type ScheduledPollSlotView,
} from "@/server/actions/scheduled-poll-actions";
import { cn } from "@/lib/utils";
import { ScheduledPollForm } from "./scheduled-poll-form";

const STATUS: Record<string, { label: string; tone: string }> = {
    SCHEDULED: { label: "En attente", tone: POLL_SLOT_STATUS_ACTIVE },
    PUBLISHING: { label: "Publication en cours", tone: POLL_SLOT_STATUS_ACTIVE },
    PUBLISHED: { label: "Publié", tone: POLL_SLOT_STATUS_IDLE },
    CANCELLED: { label: "Annulé", tone: POLL_SLOT_STATUS_IDLE },
    FAILED: { label: "Échec", tone: "text-danger" },
};

interface ScheduledPollBoardProps {
    guildId: string;
    board: BoardData;
}

export function ScheduledPollBoard({ guildId, board }: ScheduledPollBoardProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [busySlotId, setBusySlotId] = useState<string | null>(null);

    const pending = board.slots.filter((s) => s.status === "SCHEDULED" || s.status === "PUBLISHING");
    const history = board.slots.filter((s) => !(s.status === "SCHEDULED" || s.status === "PUBLISHING"));

    const publishNow = (slot: ScheduledPollSlotView) => {
        if (!window.confirm(`Publier maintenant « ${slot.title} » dans le salon configuré ?`)) return;
        setBusySlotId(slot.id);
        startTransition(async () => {
            const res = await publishScheduledPollNow(guildId, slot.id);
            setBusySlotId(null);
            if (res.success) {
                toast.success("Sondage publié");
                router.refresh();
            } else {
                toast.error(res.error || "Publication impossible");
            }
        });
    };

    const cancel = (slot: ScheduledPollSlotView) => {
        if (!window.confirm(`Annuler le créneau « ${slot.title} » ? Aucun sondage ne sera publié.`)) return;
        setBusySlotId(slot.id);
        startTransition(async () => {
            const res = await cancelScheduledPoll(guildId, slot.id);
            setBusySlotId(null);
            if (res.success) {
                toast.success("Créneau annulé");
                router.refresh();
            } else {
                toast.error(res.error || "Annulation impossible");
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className={POLL_SLOT_COUNTER}>
                        {board.pendingCount}/{board.maxSlots} créneaux en attente
                    </span>
                    {board.slotsLeft === 0 && (
                        <span className="text-caption text-warning flex items-center gap-1.5">
                            <TriangleAlert className="w-3.5 h-3.5" />
                            Plafond atteint
                        </span>
                    )}
                </div>
                <ScheduledPollForm
                    guildId={guildId}
                    slotsLeft={board.slotsLeft}
                    defaultChannelId={board.defaultChannelId}
                    defaultDurationH={board.defaultDurationH}
                />
            </div>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Hourglass className="w-4 h-4 text-info" />
                    En attente
                </h2>
                {pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Aucun créneau programmé. Un créneau publie le sondage automatiquement à la minute choisie.
                    </p>
                ) : (
                    pending.map((slot) => {
                        const end = formatPollEnd(slot.scheduledAt);
                        const status = STATUS[slot.status];
                        const busy = isPending && busySlotId === slot.id;
                        return (
                            <article key={slot.id} className={POLL_SLOT_ROW}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={cn("text-caption font-semibold uppercase tracking-wider", status.tone)}>
                                                {status.label}
                                            </span>
                                            <span className={POLL_SCHEDULED_TAG}>{SCHEDULED_POLL_TAG}</span>
                                            <span className="text-caption text-muted-foreground">
                                                {POLL_CATEGORY_LABELS[slot.category] ?? slot.category}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-semibold text-foreground break-words">{slot.title}</h3>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
                                            <span className="flex items-center gap-1.5">
                                                <CalendarClock className="w-3.5 h-3.5" />
                                                {end ? `${end.absolute} (${end.relative})` : slot.scheduledAt}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Hash className="w-3.5 h-3.5" />
                                                {slot.discordChannelId ? "Salon dédié" : "Salon par défaut"}
                                            </span>
                                            <span>{slot.options.length} choix</span>
                                            {slot.allowMultipleVotes && <span>Choix multiple</span>}
                                            {slot.isAnonymous && <span>Anonyme</span>}
                                            {slot.mentionRoleIds.length > 0 && (
                                                <span>{slot.mentionRoleIds.length} rôle(s) mentionné(s)</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <ScheduledPollForm
                                            guildId={guildId}
                                            slot={slot}
                                            slotsLeft={board.slotsLeft}
                                            defaultChannelId={board.defaultChannelId}
                                            defaultDurationH={board.defaultDurationH}
                                            trigger={
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    Modifier
                                                </Button>
                                            }
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            disabled={busy}
                                            onClick={() => publishNow(slot)}
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            Publier maintenant
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-2 text-danger hover:text-danger"
                                            disabled={busy}
                                            onClick={() => cancel(slot)}
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            Annuler
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </section>

            {history.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-foreground">Historique</h2>
                    {history.map((slot) => {
                        const status = STATUS[slot.status];
                        const end = formatPollEnd(slot.scheduledAt);
                        return (
                            <article key={slot.id} className={POLL_SLOT_ROW}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={cn("text-caption font-semibold uppercase tracking-wider", status.tone)}>
                                                {status.label}
                                            </span>
                                            <span className="text-caption text-muted-foreground">
                                                {end ? end.absolute : slot.scheduledAt}
                                            </span>
                                            <span className="text-caption text-muted-foreground">
                                                {POLL_CATEGORY_LABELS[slot.category] ?? slot.category}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-semibold text-foreground break-words">{slot.title}</h3>
                                        {slot.lastError && (
                                            <p className="text-caption text-danger flex items-center gap-2">
                                                <TriangleAlert className="w-3.5 h-3.5" />
                                                {slot.lastError}
                                            </p>
                                        )}
                                    </div>
                                    {slot.status === "PUBLISHED" && slot.createdPollId && (
                                        <Link
                                            href={`/dashboard/${guildId}/sondages/${slot.createdPollId}`}
                                            className="text-caption text-info hover:underline inline-flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Voir le sondage publié
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}
        </div>
    );
}

