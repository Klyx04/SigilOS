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
// ─── Filtres du registre (règles pures : une seule source de vérité, testable sans UI) ──────────

/**
 * Inscription au dashboard : `ALL` (les deux), `DASHBOARD` (profils inscrits seulement),
 * `MISSING` (« hors dashboard » : membres Discord sans profil — ils n'ont ni essai ni recruteur).
 */
export type RegistryDashboardFilter = "ALL" | "DASHBOARD" | "MISSING";

/** État des filtres de la vue « Registre recrutement ». */
export interface RegistryFilters {
    search: string;
    /** `ALL` = tous ; sinon la décision d'essai attendue. */
    trial: "ALL" | TrialDecision;
    /** `ALL` = tous ; sinon l'id du profil recruteur. */
    recruiterId: string;
    /** `ALL` = tous ; sinon l'id du rôle Discord. */
    roleId: string;
    dashboard: RegistryDashboardFilter;
}

export const DEFAULT_REGISTRY_FILTERS: RegistryFilters = {
    search: "",
    trial: "ALL",
    recruiterId: "ALL",
    roleId: "ALL",
    dashboard: "ALL",
};

/** Champs d'une ligne du registre interrogés par la recherche libre. */
export interface RegistrySearchableRow {
    displayName: string;
    discordId: string;
    pseudoDofus?: string | null;
    discordNickname?: string | null;
    ankamaId?: string | null;
}

/**
 * Recherche libre du registre : pseudo du dashboard, pseudo Dofus, pseudo Discord, tag Ankama
 * **ou** ID Discord (une chaîne vide ne filtre rien).
 */
export function matchesRegistrySearch(row: RegistrySearchableRow, search: string): boolean {
    const q = String(search ?? "").trim().toLowerCase();
    if (!q) return true;
    return (
        String(row.displayName ?? "").toLowerCase().includes(q) ||
        String(row.pseudoDofus ?? "").toLowerCase().includes(q) ||
        String(row.discordNickname ?? "").toLowerCase().includes(q) ||
        String(row.ankamaId ?? "").toLowerCase().includes(q) ||
        String(row.discordId ?? "").includes(q)
    );
}

/** Le membre porte-t-il le rôle Discord filtré ? (`ALL` / vide = pas de filtre). */
export function matchesDiscordRole(roles: readonly string[] | null | undefined, roleId: string): boolean {
    if (!roleId || roleId === "ALL") return true;
    return (Array.isArray(roles) ? roles : []).includes(roleId);
}

/**
 * Une ligne **membre du dashboard** passe-t-elle les filtres ? Une ligne dashboard n'est jamais
 * une ligne « hors dashboard » ⇒ le filtre `MISSING` l'exclut toujours.
 */
export function matchesRegistryFilters(
    input: {
        row: RegistrySearchableRow;
        trial: TrialDecision;
        recruitedById: string | null;
        roles: readonly string[] | null | undefined;
    },
    filters: RegistryFilters
): boolean {
    if (!matchesRegistrySearch(input.row, filters.search)) return false;
    if (!matchesDiscordRole(input.roles, filters.roleId)) return false;
    if (filters.dashboard === "MISSING") return false;
    if (filters.trial !== "ALL" && input.trial !== filters.trial) return false;
    if (filters.recruiterId !== "ALL" && input.recruitedById !== filters.recruiterId) return false;
    return true;
}

/**
 * Une ligne **membre Discord sans profil dashboard** passe-t-elle les filtres ?
 *
 * L'essai et le recruteur sont des données du registre : un membre hors dashboard ne peut pas y
 * répondre ⇒ ces deux filtres l'excluent (aucune ligne ne « matche » par accident).
 */
export function matchesDiscordOnlyFilters(
    row: RegistrySearchableRow & { roles: readonly string[] | null | undefined },
    filters: RegistryFilters
): boolean {
    if (filters.dashboard === "DASHBOARD") return false;
    if (filters.trial !== "ALL" || filters.recruiterId !== "ALL") return false;
    return matchesRegistrySearch(row, filters.search) && matchesDiscordRole(row.roles, filters.roleId);
}

/** Rôle Discord proposé au filtre : ce que l'écran affiche, avec le nombre de membres concernés. */
export interface DiscordRoleOption {
    id: string;
    name: string;
    color: number;
    position: number;
    count: number;
}

/**
 * Options du filtre « rôle Discord » : **seulement les rôles portés par au moins un membre** (un
 * rôle que personne ne porte ne filtre rien — il n'a rien à faire dans la liste), du plus haut au
 * plus bas dans la hiérarchie Discord, à position égale par ordre alphabétique.
 *
 * `members` = les deux natures de lignes du registre (profils dashboard **et** membres Discord
 * seuls) : le filtre doit pouvoir cibler les deux.
 */
export function registryRoleOptions(
    roles: readonly { id: string; name: string; color?: number | null; position?: number | null }[] | null | undefined,
    members: readonly { roles: readonly string[] | null | undefined }[] | null | undefined
): DiscordRoleOption[] {
    const counts = new Map<string, number>();
    for (const member of members ?? []) {
        for (const roleId of new Set(member?.roles ?? [])) {
            counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
        }
    }
    return (roles ?? [])
        .map((role) => ({
            id: role.id,
            name: role.name,
            color: Math.max(0, Math.floor(Number(role.color) || 0)),
            position: Math.floor(Number(role.position) || 0),
            count: counts.get(role.id) ?? 0,
        }))
        .filter((role) => role.count > 0)
        .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name, "fr"));
}

/**
 * Couleur d'un rôle Discord (entier `0xRRGGBB`) → `#rrggbb`, `null` si le rôle n'a pas de couleur
 * (`0` = couleur neutre côté Discord). Règle pure : jamais de couleur inventée.
 */
export function discordRoleColorHex(color: number | null | undefined): string | null {
    const value = Math.floor(Number(color) || 0);
    if (value <= 0 || value > 0xffffff) return null;
    return `#${value.toString(16).padStart(6, "0")}`;
}

/**
 * Le rôle le plus haut porté par un membre (nom + couleur), pour l'afficher dans la ligne.
 * `null` si le membre ne porte aucun rôle connu de la guilde (ex. `@everyone` non listé).
 */
export function topDiscordRole(
    roles: readonly string[] | null | undefined,
    options: readonly DiscordRoleOption[]
): DiscordRoleOption | null {
    const held = new Set(Array.isArray(roles) ? roles : []);
    return options.find((option) => held.has(option.id)) ?? null;
}

