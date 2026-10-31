"use client";

/**
 * Onglet « Présences » de la fiche membre (staff) — R1 « no-show », 31/10/2026.
 *
 * Le constat d'un raid n'appartient pas au raid : il appartient au **membre**. Cet onglet
 * répond à la question qu'un staff se pose vraiment (« a-t-il séché trois raids ce
 * trimestre ? ») sans mélanger ça à l'acte de clôture.
 *
 * Donnée **personnelle** : le serveur re-vérifie la permission à chaque lecture
 * (`canManageMembers` / `canManageRaid` / admin) et ne renvoie que la guilde courante.
 * La correction d'un statut reste réservée à l'**officier de raid** ou à l'admin (`canCorrect`).
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
    correctRaidPresence,
    getMemberRaidPresence,
    type MemberRaidPresenceRow,
} from "@/server/actions/calendar-actions";
import { RAID_PRESENCE_LABELS, type RaidPresenceStatus } from "@/lib/raid-presence";
import { cn } from "@/lib/utils";

interface PresenceSummary {
    present: number;
    absent: number;
    warned: number;
    excused: number;
    noShows: number;
}

const PLURAL = (count: number) => (count > 1 ? "s" : "");

export function MemberRaidPresence({
    guildId,
    memberUserId,
}: {
    guildId: string;
    /** `User.id` — `null` pour un membre Discord sans compte SigilOS (aucune présence possible). */
    memberUserId: string | null;
}) {
    const [rows, setRows] = useState<MemberRaidPresenceRow[]>([]);
    const [summary, setSummary] = useState<PresenceSummary | null>(null);
    const [retentionDays, setRetentionDays] = useState(90);
    const [canCorrect, setCanCorrect] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        if (!memberUserId) return;
        let cancelled = false;
        setLoading(true);
        getMemberRaidPresence(guildId, memberUserId)
            .then((res) => {
                if (cancelled) return;
                if (res.success && res.rows && res.summary) {
                    setRows(res.rows);
                    setSummary(res.summary);
                    setRetentionDays(res.retentionDays ?? 90);
                    setCanCorrect(res.canCorrect === true);
                    setError(null);
                } else {
                    setError(res.error || "Registre illisible");
                }
            })
            .catch(() => { if (!cancelled) setError("Registre illisible"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [guildId, memberUserId]);

    if (!memberUserId) {
        return (
            <p className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                Ce membre n&apos;a pas de compte SigilOS : aucune présence de raid à afficher.
            </p>
        );
    }

    async function changeStatus(row: MemberRaidPresenceRow, next: RaidPresenceStatus) {
        if (!memberUserId) return;
        setSaving(row.eventId);
        const res = await correctRaidPresence(guildId, row.eventId, memberUserId, next);
        setSaving(null);
        if (res.success) {
            setRows((prev) => prev.map((item) => (item.eventId === row.eventId ? { ...item, status: next } : item)));
            toast.success("Présence corrigée");
        } else {
            toast.error(res.error || "Correction impossible");
        }
    }

    return (
        <div className="space-y-4">
            {loading && <p className="text-xs text-muted-foreground">Chargement…</p>}
            {error && (
                <p className="rounded-md border border-danger/40 px-3 py-2 text-xs text-danger">{error}</p>
            )}

            {!loading && !error && summary && (
                <p className="text-xs text-muted-foreground">
                    {retentionDays} derniers jours : {summary.present} présence{PLURAL(summary.present)}
                    {" · "}{summary.warned} prévenu{PLURAL(summary.warned)}
                    {" · "}{summary.excused} excusé{PLURAL(summary.excused)}
                    {" · "}
                    <span className="font-semibold text-danger">
                        {summary.noShows} non présent{PLURAL(summary.noShows)}
                    </span>
                </p>
            )}

            {!loading && !error && rows.length === 0 && (
                <p className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                    Aucune présence de raid enregistrée : les clôtures antérieures au registre ne sont pas reprises.
                </p>
            )}

            {rows.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {rows.map((row) => (
                        <li key={row.eventId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {format(new Date(row.eventDate), "dd/MM/yyyy", { locale: fr })}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.eventTitle}</span>
                            {canCorrect ? (
                                <select
                                    aria-label={`Statut de présence — ${row.eventTitle}`}
                                    value={row.status}
                                    disabled={saving === row.eventId}
                                    onChange={(event) => changeStatus(row, event.target.value as RaidPresenceStatus)}
                                    className="h-8 rounded-md border border-border bg-background px-2 text-caption text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
                                >
                                    {(["PRESENT", "PREVENU", "EXCUSE", "NO_SHOW"] as RaidPresenceStatus[]).map((status) => (
                                        <option key={status} value={status}>{RAID_PRESENCE_LABELS[status]}</option>
                                    ))}
                                </select>
                            ) : (
                                <span
                                    className={cn(
                                        "text-caption font-semibold",
                                        row.status === "PRESENT"
                                            ? "text-success"
                                            : row.status === "NO_SHOW"
                                                ? "text-danger"
                                                : "text-muted-foreground",
                                    )}
                                >
                                    {RAID_PRESENCE_LABELS[row.status]}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
