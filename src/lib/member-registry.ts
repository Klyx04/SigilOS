/**
 * Registre Membres & Recrutement — règles pures (sans I/O, testables).
 *
 * Une seule source de vérité pour :
 * - la date d'arrivée retenue (`guildJoinedAt` manuelle, repli `createdAt`),
 * - l'ancienneté en jours (calculée seule),
 * - la décision d'essai `oui | non | prolonge` (dérivée du statut + `trialEndsAt`),
 * - la validation du tag Ankama `Nom#0000`,
 * - les commentaires du staff (plafond, ordre de lecture),
 * - l'export CSV du registre (séparateur `;`, avec l'ID Discord).
 */

export const ANKAMA_ID_PATTERN = /^[a-zA-Z0-9-]{1,50}#[0-9]{4}$/;

/** Commentaires du registre : plafond par membre et taille d'un commentaire. */
export const MAX_REGISTRY_COMMENTS = 20;
export const REGISTRY_COMMENT_MAX_LENGTH = 1000;

export interface RegistryComment {
    id: string;
    body: string;
    authorName: string;
    authorUserId: string | null;
    createdAt: string;
}

/** Ordre de lecture du journal : du plus ancien au plus récent. */
export function sortRegistryComments(comments: RegistryComment[]): RegistryComment[] {
    return [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Plafond atteint ? (le staff ne noie pas la fiche sous les commentaires) */
export function canAddRegistryComment(currentCount: number): boolean {
    return currentCount < MAX_REGISTRY_COMMENTS;
}

export function isValidAnkamaId(value: string): boolean {
    return ANKAMA_ID_PATTERN.test(value.trim());
}

/** Décompose un tag Ankama au format Nom#0000 en nom et discriminant */
export function parseAnkamaTag(tag: string | null | undefined): { name: string; discriminator: string } | null {
    if (!tag) return null;
    const trimmed = tag.trim();
    const hashIndex = trimmed.indexOf("#");
    if (hashIndex === -1) return { name: trimmed, discriminator: "" };
    return {
        name: trimmed.slice(0, hashIndex),
        discriminator: trimmed.slice(hashIndex + 1),
    };
}

/** Normalise un pseudo pour comparaison tolérante (retire parenthèses/crochets/emojis/espaces) */
export function normalizePseudoForComparison(val: string | null | undefined): string {
    if (!val) return "";
    return val
        .toLowerCase()
        .replace(/[\(\[\{].*?[\)\]\}]/g, "")
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
        .replace(/[^a-z0-9]/g, "");
}

/** Vérifie s'il y a une divergence notable entre le pseudo Discord et le pseudo Ankama */
export function hasPseudoDiscordMismatch(
    discordName: string | null | undefined,
    ankamaId: string | null | undefined
): boolean {
    const ankama = parseAnkamaTag(ankamaId);
    if (!ankama || !ankama.name) return false;
    const normDiscord = normalizePseudoForComparison(discordName);
    const normAnkama = normalizePseudoForComparison(ankama.name);
    if (!normDiscord || !normAnkama) return false;
    return normDiscord !== normAnkama;
}

const DAY_MS = 86_400_000;

/** Date d'arrivée retenue : la saisie manuelle, sinon la création du profil. */
export function resolveJoinedAt(input: {
    guildJoinedAt?: string | null;
    createdAt: string;
}): string {
    return input.guildJoinedAt ?? input.createdAt;
}

/** Ancienneté en jours calendaires, jamais négative. */
export function computeSeniorityDays(joinedAtIso: string, now: Date = new Date()): number {
    const joined = new Date(joinedAtIso).getTime();
    if (Number.isNaN(joined)) return 0;
    return Math.max(0, Math.floor((now.getTime() - joined) / DAY_MS));
}

export type TrialDecision = "oui" | "non" | "prolonge";

/**
 * Décision d'essai dérivée :
 * - essai validé → `oui`
 * - sinon, `trialEndsAt` au-delà de `arrivée + durée par défaut` → `prolonge`
 * - sinon → `non` (en essai, pas encore validé)
 */
export function getTrialDecision(input: {
    trialValidated: boolean;
    trialEndsAt?: string | null;
    joinedAtIso: string;
    trialDurationDays: number;
    now?: Date;
}): TrialDecision {
    if (input.trialValidated) return "oui";
    if (!input.trialEndsAt) return "non";
    const ends = new Date(input.trialEndsAt).getTime();
    const joined = new Date(input.joinedAtIso).getTime();
    if (Number.isNaN(ends) || Number.isNaN(joined)) return "non";
    const defaultEnd = joined + Math.max(1, input.trialDurationDays) * DAY_MS;
    // Marge d'un jour : un essai posé « à durée par défaut » n'est pas une prolongation.
    return ends > defaultEnd + DAY_MS ? "prolonge" : "non";
}

export interface RegistryCsvRow {
    displayName: string;
    pseudoDofus: string | null;
    discordNickname: string | null;
    joinedAt: string;
    seniorityDays: number;
    discordId: string;
    ankamaId: string | null;
    recruiterName: string | null;
    trialDecision: TrialDecision;
    trialEndsAt: string | null;
    muleCount: number;
    mules: string[];
    comments: RegistryComment[];
}

function csvCell(value: string | number | null | undefined): string {
    const raw = value === null || value === undefined ? "" : String(value);
    return /[";\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/** Export CSV du registre (en-têtes stables, `;` comme l'export historique). */
export function buildRegistryCsv(rows: RegistryCsvRow[], guildId: string, todayIso: string): { filename: string; content: string } {
    const headers = [
        "Pseudo Membre",
        "Pseudo Dofus",
        "Surnom Discord",
        "Date d'arrivée",
        "Aujourd'hui",
        "Ancienneté (jours)",
        "ID Discord",
        "Tag Ankama",
        "Recruté par",
        "Essai validé",
        "Fin d'essai",
        "Nombre de mules",
        "Mules",
        "Commentaires",
    ];
    const lines = rows.map((r) =>
        [
            r.displayName,
            r.pseudoDofus,
            r.discordNickname,
            r.joinedAt.split("T")[0],
            todayIso.split("T")[0],
            r.seniorityDays,
            r.discordId,
            r.ankamaId,
            r.recruiterName,
            r.trialDecision,
            r.trialEndsAt ? r.trialEndsAt.split("T")[0] : "",
            r.muleCount,
            r.mules.join(", "),
            // Journal lisible : « 2026-09-24 18:05 — Wylan : texte », du plus ancien au plus récent.
            sortRegistryComments(r.comments)
                .map((c) => `${c.createdAt.slice(0, 16).replace("T", " ")} — ${c.authorName} : ${c.body.replace(/\s+/g, " ")}`)
                .join(" | "),
        ]
            .map(csvCell)
            .join(";")
    );
    const date = todayIso.split("T")[0];
    return {
        filename: `sigilos_registre_${guildId}_${date}.csv`,
        content: `${headers.join(";")}\n${lines.join("\n")}`,
    };
}
