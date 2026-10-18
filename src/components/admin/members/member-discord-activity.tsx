"use client";

import { useEffect, useState } from "react";
import { Activity, BookOpen, CalendarClock, Clock, Heart, Loader2, MessageSquare, Reply, Tv } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
    getMemberDiscordPresence,
    type MemberDiscordPresence,
    type RegistrySubject,
} from "@/server/actions/member-lifecycle-actions";
import { DISCORD_PRESENCE_LABELS } from "@/lib/ladder-presence";
import { cn } from "@/lib/utils";

/** 90 → « 1 h 30 », 45 → « 45 min » — tel que sur le ladder. */
function formatMinutes(total: number): string {
    if (total < 60) return `${total} min`;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return mins === 0 ? `${hours} h` : `${hours} h ${mins}`;
}

function formatDateTime(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return format(date, "dd MMM yyyy à HH:mm", { locale: fr });
}

function Stat({
    icon: Icon,
    label,
    value,
    hint,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div title={hint} className="rounded-md border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-caption uppercase text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
            </p>
            <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">{value}</p>
        </div>
    );
}

/**
 * Onglet « Activité Discord » de la fiche membre : les datas Discord complètes
 * (vocal semaine/mois/total, messages, stream, réponses, caractères, réactions
 * reçues, dernières activités) + profil de présence + transparence.
 * Lecture staff, jamais un blâme : Discret/Silencieux invitent à aller vers.
 */
export function MemberDiscordActivity({
    guildId,
    subject,
    displayName,
}: {
    guildId: string;
    subject: RegistrySubject;
    displayName: string;
}) {
    const [data, setData] = useState<MemberDiscordPresence | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const subjectKey = JSON.stringify(subject);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        // `subjectKey` est la forme **stable** du sujet : le parent recrée l'objet `subject` à chaque
        // render, donc la dépendance volontaire est la chaîne sérialisée, pas l'objet.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const parsed = JSON.parse(subjectKey) as RegistrySubject;
        getMemberDiscordPresence(guildId, parsed).then((res) => {
            if (cancelled) return;
            if (res.success && res.data) {
                setData(res.data);
            } else {
                setError(res.error || "Lecture impossible");
            }
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [guildId, subjectKey]);

    if (loading) {
        return (
            <p className="flex items-center gap-2 py-8 text-xs text-muted-foreground" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Lecture de l&apos;activité Discord…
            </p>
        );
    }

    if (error || !data) {
        return (
            <p className="rounded-md border border-border-strong bg-surface p-3 text-xs text-muted-foreground">
                {error || "Lecture impossible."} Réessayez en rouvrant la fiche.
            </p>
        );
    }

    if (!data.tracked) {
        return (
            <div className="space-y-3">
                <p className="inline-flex items-center gap-2 text-sm">
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-caption font-semibold uppercase text-muted-foreground">
                        Non mesuré
                    </span>
                </p>
                <p className="rounded-md border border-border-strong bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
                    {displayName} n&apos;est jamais connecté au dashboard : le bot ne mesure pas son
                    activité Discord. Ses messages et vocaux existent peut-être — ils ne sont juste
                    pas comptés.
                </p>
            </div>
        );
    }

    // Lot 7 — membre mesuré par le bot **sans profil dashboard** : compteurs bruts uniquement
    // (pas de fenêtre hebdo/mensuelle), présentés pour ce qu'ils sont.
    if (data.source === "member" && data.memberActivity) {
        const activity = data.memberActivity;
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-success/40 bg-surface px-2 py-0.5 text-caption font-semibold uppercase text-success">
                        Mesuré · tous membres
                    </span>
                    <span className="text-caption text-muted-foreground">
                        membre non inscrit au dashboard
                    </span>
                    {activity.leftDiscordAt && (
                        <span className="rounded-full border border-warning/40 bg-surface px-2 py-0.5 text-caption font-semibold uppercase text-warning">
                            A quitté le serveur le {formatDateTime(activity.leftDiscordAt)}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat icon={MessageSquare} label="Messages" value={activity.messagesTotal.toLocaleString()} hint="Cumul mesuré par le bot, tous les membres" />
                    <Stat icon={Clock} label="Vocal · total" value={formatMinutes(activity.voiceMinutesTotal)} hint="Minutes cumulées mesurées par le bot (tous les membres)" />
                    <Stat icon={CalendarClock} label="Première vue" value={formatDateTime(activity.firstSeenAt)} hint="Première activité observée par le bot" />
                    <Stat icon={Activity} label="Dernière activité" value={formatDateTime(activity.lastSeenAt)} hint="Dernier événement observé (message ou vocal)" />
                </div>

                <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-md border border-border bg-surface p-2.5">
                        <dt className="text-caption uppercase text-muted-foreground">Dernier message</dt>
                        <dd className="mt-0.5 text-foreground">{formatDateTime(activity.lastMessageAt)}</dd>
                    </div>
                    <div className="rounded-md border border-border bg-surface p-2.5">
                        <dt className="text-caption uppercase text-muted-foreground">Dernier vocal</dt>
                        <dd className="mt-0.5 text-foreground">{formatDateTime(activity.lastVoiceAt)}</dd>
                    </div>
                    <div className="rounded-md border border-border bg-surface p-2.5">
                        <dt className="text-caption uppercase text-muted-foreground">Départ Discord</dt>
                        <dd className="mt-0.5 text-foreground">{formatDateTime(activity.leftDiscordAt)}</dd>
                    </div>
                </dl>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Membre non inscrit : le bot mesure les <strong>compteurs bruts</strong> (messages,
                    vocal total) — pas de fenêtre hebdomadaire ni mensuelle, et aucune réaction suivie.
                    Lecture staff, jamais un blâme.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                {data.profileWeekly && (
                    <span
                        title={data.noteWeekly ?? undefined}
                        className="rounded-full border border-border bg-surface px-2 py-0.5 text-caption font-semibold uppercase text-muted-foreground"
                    >
                        {DISCORD_PRESENCE_LABELS[data.profileWeekly]} · sem.
                    </span>
                )}
                {data.profileMonthly && (
                    <span
                        title={data.noteMonthly ?? undefined}
                        className="rounded-full border border-border bg-surface px-2 py-0.5 text-caption font-semibold uppercase text-muted-foreground"
                    >
                        {DISCORD_PRESENCE_LABELS[data.profileMonthly]} · mois
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat icon={Clock} label="Vocal · sem." value={formatMinutes(data.voiceWeekly)} hint="Minutes mesurées entre mardi 07:00 et aujourd'hui" />
                <Stat icon={Clock} label="Vocal · mois" value={formatMinutes(data.voiceMonthly)} hint="Minutes mesurées du 1er à aujourd'hui" />
                <Stat icon={Clock} label="Vocal · total" value={formatMinutes(data.voiceTotal)} hint="Cumul historique mesuré" />
                <Stat icon={Tv} label="Stream · total" value={formatMinutes(data.streamTotal)} hint="Minutes en stream, comptées à part du vocal" />
                <Stat icon={MessageSquare} label="Messages" value={data.messagesTotal.toLocaleString()} hint="Messages postés, cumul mesuré" />
                <Stat icon={Reply} label="Réponses" value={data.repliesTotal.toLocaleString()} hint="Réponses apportées, cumul mesuré" />
                <Stat icon={BookOpen} label="Caractères" value={data.charactersTotal.toLocaleString()} hint="Volume écrit, cumul mesuré" />
                <Stat icon={Heart} label="Réactions reçues" value={data.reactionsReceivedTotal.toLocaleString()} hint="Réactions reçues uniquement — les émises ne sont pas comptées" />
            </div>

            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                {(
                    [
                        ["Dernier message", data.lastMessageAt],
                        ["Dernier vocal", data.lastVoiceAt],
                        ["Dernière réaction", data.lastReactionAt],
                    ] as const
                ).map(([label, iso]) => (
                    <div key={label} className="rounded-md border border-border bg-surface p-2.5">
                        <dt className="text-caption uppercase text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 text-foreground">{formatDateTime(iso)}</dd>
                    </div>
                ))}
            </dl>

            <p className={cn("text-[11px] leading-relaxed text-muted-foreground")}>
                Mesuré par le bot en temps réel · minutes arrondies (moins d&apos;une minute = invisible) ·
                réactions émises non comptées · données de lecture staff, jamais un blâme.
            </p>

            {/* Lot 7 — la mesure « tous membres » complète le profil : départ du serveur Discord. */}
            {data.memberActivity?.leftDiscordAt && (
                <p className="rounded-md border border-warning/40 bg-surface p-3 text-xs text-warning">
                    Ce membre a quitté le serveur Discord le {formatDateTime(data.memberActivity.leftDiscordAt)}.
                </p>
            )}
        </div>
    );
}
