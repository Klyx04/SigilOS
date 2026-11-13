/**
 * Registre de présence d'un raid — **R1 « no-show »** (PLAN-RAID L2), **aucune I/O**.
 *
 * Trois règles y vivent, une seule fois, pour que le serveur, l'écran et les tests parlent le
 * même langage :
 *
 * 1. **Chaque inscrit a un statut** — présent, prévenu, excusé ou no-show. Un inscrit non coché
 *    **sans motif** bloque la clôture : c'est ce qui distingue un no-show assumé d'un oubli.
 * 2. **Le registre ne déborde pas des inscrits** — un présent comme une absence doit figurer
 *    parmi les inscrits du raid, et personne ne peut être les deux à la fois (fail-closed : un
 *    identifiant inconnu fait refuser la clôture entière).
 * 3. **Rétention 90 jours** (décision D5 du 31/10/2026) — `createdAt` porte la date de la
 *    clôture, l'index `(guildId, createdAt)` sert au compteur glissant et à la purge.
 *
 * ⚠️ Donnée **personnelle** : le registre ne s'affiche que côté staff (`canManageRaid` / admin)
 * et ne part **jamais** dans un embed Discord public (décision D3 : staff seul).
 */

import { z } from "zod";

/** Statuts possibles d'un inscrit — miroir exact de l'enum Prisma `RaidPresenceStatus`. */
export const RAID_PRESENCE_STATUSES = ["PRESENT", "PREVENU", "EXCUSE", "NO_SHOW"] as const;
export type RaidPresenceStatus = (typeof RAID_PRESENCE_STATUSES)[number];

/**
 * Motifs proposés quand on décoche un inscrit. « Prévenu » est le défaut (consigne §14) :
 * l'absence annoncée n'est pas une faute, le no-show est un constat.
 */
export const RAID_ABSENCE_REASONS = ["PREVENU", "EXCUSE", "NO_SHOW"] as const;
export type RaidAbsenceReason = (typeof RAID_ABSENCE_REASONS)[number];
export const RAID_ABSENCE_DEFAULT: RaidAbsenceReason = "PREVENU";

/** Libellés affichés (français, jamais de code technique à l'écran). */
export const RAID_PRESENCE_LABELS: Record<RaidPresenceStatus, string> = {
    PRESENT: "Présent",
    PREVENU: "Prévenu",
    EXCUSE: "Excusé",
    NO_SHOW: "Non présent",
};

/** Décision D5 du 31/10/2026 : on garde 90 jours, pas plus. */
export const RAID_PRESENCE_RETENTION_DAYS = 90;

/** Borne dure : au-delà, ce n'est plus un raid (même plafond que la clôture, 32 présents). */
export const RAID_PRESENCE_MAX_ROWS = 32;

const AbsenceSchema = z.object({
    userId: z.string().min(1).max(64),
    reason: z.enum(RAID_ABSENCE_REASONS),
});

const AbsencesSchema = z
    .array(AbsenceSchema)
    .max(RAID_PRESENCE_MAX_ROWS, `Trop d'absences pour un raid (${RAID_PRESENCE_MAX_ROWS} maximum).`);

export interface RaidAbsence {
    userId: string;
    reason: RaidAbsenceReason;
}

/**
 * Valide la liste des absences envoyée par l'écran (bornée) et dédoublonne en gardant la
 * **première** décision. `ok: false` ⇒ la clôture est refusée, rien n'est écrit.
 */
export function validateRaidAbsences(
    input: unknown,
): { ok: true; absences: RaidAbsence[] } | { ok: false; error: string } {
    const parsed = AbsencesSchema.safeParse(Array.isArray(input) ? input : []);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Absences invalides." };
    }
    const seen = new Set<string>();
    const absences: RaidAbsence[] = [];
    for (const entry of parsed.data) {
        if (seen.has(entry.userId)) continue;
        seen.add(entry.userId);
        absences.push({ userId: entry.userId, reason: entry.reason });
    }
    return { ok: true, absences };
}

export interface RaidPresenceInput {
    /** Inscrits `REGISTERED` au moment de la clôture (résolus **côté serveur**). */
    registeredUserIds: string[];
    /** Cochés « présent » par le staff. */
    presentUserIds: string[];
    /** Motif de chaque inscrit décoché. */
    absences: RaidAbsence[];
}

export interface RaidPresenceSummary {
    present: number;
    absent: number;
    warned: number;
    excused: number;
    noShows: number;
}

export type RaidPresenceBuild =
    | ({ ok: true; rows: { userId: string; status: RaidPresenceStatus }[] } & RaidPresenceSummary)
    | { ok: false; error: string };

/**
 * Construit le registre complet d'un raid : **une ligne par inscrit**, avec le statut qui va bien.
 *
 * Fail-closed, dans cet ordre : pas d'inscrit ⇒ refus ; un présent hors inscrits ⇒ refus ; une
 * absence hors inscrits ⇒ refus ; un membre à la fois présent et absent ⇒ refus ; un inscrit non
 * coché **sans motif** ⇒ refus avec le nombre à compléter.
 */
export function buildRaidPresenceRows(input: RaidPresenceInput): RaidPresenceBuild {
    const registered = [
        ...new Set((input?.registeredUserIds ?? []).map((u) => String(u ?? "").trim()).filter(Boolean)),
    ];
    if (registered.length === 0) {
        return { ok: false, error: "Aucun inscrit : impossible d'enregistrer les présences." };
    }
    if (registered.length > RAID_PRESENCE_MAX_ROWS) {
        return { ok: false, error: `Trop d'inscrits pour un raid (${RAID_PRESENCE_MAX_ROWS} maximum).` };
    }

    const registeredSet = new Set(registered);
    const present = [...new Set((input?.presentUserIds ?? []).map((u) => String(u ?? "").trim()).filter(Boolean))];
    for (const userId of present) {
        if (!registeredSet.has(userId)) {
            return { ok: false, error: "Un présent ne figure pas parmi les inscrits du raid." };
        }
    }

    const reasons = new Map<string, RaidAbsenceReason>();
    for (const absence of input?.absences ?? []) {
        if (!registeredSet.has(absence.userId)) {
            return { ok: false, error: "Une absence ne figure pas parmi les inscrits du raid." };
        }
        if (present.includes(absence.userId)) {
            return { ok: false, error: "Un même membre ne peut pas être présent et absent." };
        }
        reasons.set(absence.userId, absence.reason);
    }

    const missing = registered.filter((userId) => !present.includes(userId) && !reasons.has(userId));
    if (missing.length > 0) {
        return {
            ok: false,
            error: `Précisez le motif d'absence pour ${missing.length} inscrit${missing.length > 1 ? "s" : ""}.`,
        };
    }

    const presentSet = new Set(present);
    const rows = registered.map((userId) => ({
        userId,
        status: (presentSet.has(userId) ? "PRESENT" : reasons.get(userId)!) as RaidPresenceStatus,
    }));
    const count = (status: RaidPresenceStatus) => rows.filter((row) => row.status === status).length;

    return {
        ok: true,
        rows,
        present: count("PRESENT"),
        absent: rows.length - count("PRESENT"),
        warned: count("PREVENU"),
        excused: count("EXCUSE"),
        noShows: count("NO_SHOW"),
    };
}

/**
 * Phrase d'attestation de la modale : ce que le staff valide **en clair** avant de clôturer.
 * `purpleKamasCost === null` = don désactivé pour cette guilde (rien n'est débité).
 */
export function buildRaidClosureAttestation(attestation: {
    present: number;
    noShows: number;
    purpleKamasCost: number | null;
}): string {
    const presents = `${attestation.present} présent${attestation.present > 1 ? "s" : ""}`;
    const noShows = `${attestation.noShows} no-show${attestation.noShows > 1 ? "s" : ""}`;
    if (attestation.purpleKamasCost === null) {
        return `${presents} et ${noShows} : les présents seront validés, aucun Kamas Violet n'est requis.`;
    }
    if (attestation.purpleKamasCost <= 0) {
        return `${presents} et ${noShows} : les présents seront validés sans débit de Kamas Violets.`;
    }
    return `${presents} débités de ${attestation.purpleKamasCost} 🟣 chacun, ${noShows}.`;
}

/** Borne de purge (rétention 90 jours) — `now` injectable pour les tests. */
export function raidPresenceRetentionCutoff(now: Date = new Date()): Date {
    return new Date(now.getTime() - RAID_PRESENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** Compteur glissant (90 jours) : agrège des statuts **déjà lus**, ne requête rien. */
export function summarizeRaidPresence(statuses: RaidPresenceStatus[]): RaidPresenceSummary {
    const summary: RaidPresenceSummary = { present: 0, absent: 0, warned: 0, excused: 0, noShows: 0 };
    for (const status of statuses) {
        if (status === "PRESENT") {
            summary.present++;
            continue;
        }
        summary.absent++;
        if (status === "PREVENU") summary.warned++;
        else if (status === "EXCUSE") summary.excused++;
        else if (status === "NO_SHOW") summary.noShows++;
    }
    return summary;
}
