/**
 * Activité de guilde — règles **PURES** des notifications « tout le monde » (chantier **N**, lot **N-1**).
 *
 * ⚠️ Fichier **pur** : ni `"use server"`, ni Prisma, ni React — même forme que
 * `src/lib/market/notifications.ts`. Il porte :
 *   · la table **type d'activité → clé de `UserProfile.notificationPrefs`** (un booléen par clé) ;
 *   · la règle **fail-closed** « seul un `false` explicite coupe » (patron du Marché : §11.9) ;
 *   · les **paliers de points de succès** fêtés — fixes, tous les **1000** (décision user du 15/10/2026) ;
 *   · l'**entrée dans le top** du ladder succès de la guilde ;
 *   · la **copie** affichée (texte seul, jamais de HTML, jamais d'`eval`).
 *
 * ❌ Ce que ce module ne fait jamais : écrire en base, envoyer un message Discord, écrire une
 * `Notification` par membre (décision du 15/10/2026 : l'événement vit **une fois** dans le flux de
 * vie de la guilde, la bulle en découle — 350 copies par validation serait du spam de base).
 */

/** Pas des paliers de points de succès **fêtés** (1 000, 2 000, 3 000…). */
export const SUCCESS_POINTS_MILESTONE_STEP = 1000;

/** Nombre maximum de paliers annoncés sur un **seul** saut (anti-bruit : un rattrapage de 12 000 pts n'annonce pas 12 lignes). */
export const SUCCESS_POINTS_MAX_MILESTONES_PER_JUMP = 5;

/** Plafond de points accepté (même borne que les paliers de rôles du chantier **S**). */
export const SUCCESS_POINTS_MAX = 10_000_000;

/** Taille du « top » du ladder succès de guilde qui déclenche une annonce. */
export const LADDER_TOP_SIZE = 3;

/** Longueur maximale d'un pseudo repris dans une copie (borne d'entrée, comme `MARKET_NOTIFICATION_LABEL_MAX`). */
export const GUILD_ACTIVITY_NAME_MAX = 40;

/**
 * Les types d'activité annoncés par le flux. Chaque clé est **aussi** la clé écrite dans
 * `notificationPrefs` — volontairement à plat, pour rester compatible avec les préférences
 * existantes (`missions`, `donjons`, `songes`, `ocre`, `events`, `ladder` sont **déjà** là :
 * voir `src/components/profile/user-settings.tsx:115-127`). Seules `succes`, `dofus` et
 * `paliers` sont neuves — et **aucune migration** n'est nécessaire (le champ est un `Json`).
 */
export const GUILD_ACTIVITY_PREF_KEYS = {
    missions: "missions",
    donjons: "donjons",
    songes: "songes",
    ocre: "ocre",
    events: "events",
    succes: "succes",
    dofus: "dofus",
    paliers: "paliers",
    ladder: "ladder",
} as const;

export type GuildActivityKind = keyof typeof GUILD_ACTIVITY_PREF_KEYS;

/** Tous les types, dans l'ordre d'affichage des interrupteurs du profil. */
export const GUILD_ACTIVITY_KINDS = Object.keys(GUILD_ACTIVITY_PREF_KEYS) as GuildActivityKind[];

/** Nombre de clés (garde de cohérence des tests et de l'écran). */
export const GUILD_ACTIVITY_PREF_COUNT = GUILD_ACTIVITY_KINDS.length;

/** Libellés des interrupteurs du profil (défaut = **tout activé**). */
export const GUILD_ACTIVITY_PREF_LABELS: Record<GuildActivityKind, { label: string; hint: string }> = {
    missions: { label: "Missions de guilde", hint: "Une mission est validée par le staff" },
    donjons: { label: "Donjons & raids", hint: "Une sortie donjon / raid est bouclée" },
    songes: { label: "Songes Infinis", hint: "Un run de songes est terminé" },
    ocre: { label: "Quête Ocre", hint: "Un échange de la quête Ocre aboutit" },
    events: { label: "Agenda", hint: "Un événement existe ou approche" },
    succes: { label: "Succès validés", hint: "Un succès est validé par le staff" },
    dofus: { label: "Dofus validés", hint: "Un membre valide un Dofus" },
    paliers: { label: "Paliers de points", hint: "Un membre passe un palier de 1 000 points de succès" },
    ladder: { label: "Ladder succès", hint: "Un membre entre dans le top 3 du ladder succès" },
};

/**
 * Règle **serveur** : faut-il annoncer cette activité à ce membre ?
 *
 * Fail-closed inversé assumé : le **défaut est ON** (l'activité de guilde est le cœur du tableau de
 * bord) et **seul un `false` explicite** coupe — exactement le patron du Marché
 * (`notifPrefs.donjons !== false`, `src/server/actions/dungeon-finder-actions.ts:2033`). Un
 * `notificationPrefs` absent, corrompu (`null`, tableau, chaîne…) ou partiel ⇒ **ON**.
 */
export function shouldNotifyGuildActivity(input: { kind: GuildActivityKind; prefs: unknown }): boolean {
    const prefs =
        input.prefs && typeof input.prefs === "object" && !Array.isArray(input.prefs)
            ? (input.prefs as Record<string, unknown>)
            : {};
    return prefs[GUILD_ACTIVITY_PREF_KEYS[input.kind]] !== false;
}

// ── Points de succès : les paliers fêtés ─────────────────────────────────────

/**
 * Relit une valeur de points : tout ce qui n'est pas un entier fini et positif vaut **0**.
 *
 * `successPoints` est **nullable** en base (`prisma/schema.prisma:724`, `Int? @default(0)`) : un
 * `null` — ou une valeur douteuse — ne doit **jamais** devenir « un palier atteint » (fail-closed).
 * Borné à `SUCCESS_POINTS_MAX`.
 */
export function normalizeSuccessPoints(value: unknown): number {
    const numeric =
        typeof value === "number"
            ? value
            : typeof value === "string" && /^\d+$/.test(value.trim())
              ? Number(value.trim())
              : Number.NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.min(Math.floor(numeric), SUCCESS_POINTS_MAX);
}

/**
 * Paliers **franchis** entre deux relevés de points : les multiples de `SUCCESS_POINTS_MILESTONE_STEP`
 * **strictement supérieurs** à l'ancien score et **inférieurs ou égaux** au nouveau.
 *
 * · une **baisse** (le ladder recalcule, les points redescendent) ne fête **rien** : on ne rejoue
 *   jamais une fête déjà vécue ;
 * · un **rattrapage** est borné (`SUCCESS_POINTS_MAX_MILESTONES_PER_JUMP`) et garde les paliers les
 *   plus **récents** — un saut de 12 000 points n'annonce pas douze lignes.
 */
export function resolveSuccessPointsMilestones(before: unknown, after: unknown): number[] {
    const from = normalizeSuccessPoints(before);
    const to = normalizeSuccessPoints(after);
    if (to <= from) return [];

    const firstStep = Math.floor(from / SUCCESS_POINTS_MILESTONE_STEP) + 1;
    const lastStep = Math.floor(to / SUCCESS_POINTS_MILESTONE_STEP);
    const milestones: number[] = [];
    for (let step = firstStep; step <= lastStep; step += 1) {
        milestones.push(step * SUCCESS_POINTS_MILESTONE_STEP);
    }
    return milestones.slice(-SUCCESS_POINTS_MAX_MILESTONES_PER_JUMP);
}

/** Le **plus haut** palier franchi (c'est lui qui est annoncé), ou `null` si aucun. */
export function resolveHighestSuccessPointsMilestone(before: unknown, after: unknown): number | null {
    const milestones = resolveSuccessPointsMilestones(before, after);
    return milestones.length > 0 ? milestones[milestones.length - 1] : null;
}

// ── Ladder succès de la guilde ───────────────────────────────────────────────

/** Rang exploitable : entier ≥ 1, sinon `null` (jamais de rang inventé). */
function toRank(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const rank = Math.floor(value);
    return rank >= 1 ? rank : null;
}

/**
 * Rang d'**entrée** dans le top du ladder succès de la guilde : `n` si le membre y **entre**
 * (il n'y était pas, il y est), `null` sinon.
 *
 * Y **rester**, en **sortir** ou **ne pas bouger** n'annonce rien : une seule annonce par entrée
 * (idempotence — même exigence que les paliers de points).
 */
export function resolveLadderTopEntry(input: {
    previousRank: unknown;
    currentRank: unknown;
    topSize?: number;
}): number | null {
    const topSize =
        typeof input.topSize === "number" && input.topSize >= 1 ? Math.floor(input.topSize) : LADDER_TOP_SIZE;
    const current = toRank(input.currentRank);
    if (current === null || current > topSize) return null;

    const previous = toRank(input.previousRank);
    if (previous !== null && previous <= topSize) return null; // déjà dans le top : rien à fêter
    return current;
}

// ── Copie affichée (texte seul) ──────────────────────────────────────────────

/** Pseudo borné, sans caractère de contrôle ; jamais de HTML (texte seul, aucun `eval`). */
export function sanitizeGuildActivityName(value: unknown): string {
    if (typeof value !== "string") return "Un membre";
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (!cleaned) return "Un membre";
    return cleaned.length <= GUILD_ACTIVITY_NAME_MAX
        ? cleaned
        : `${cleaned.slice(0, GUILD_ACTIVITY_NAME_MAX - 1)}…`;
}

/** Points lisibles (`1 000`) — même mise en forme que le reste de l'application (`fr-FR`). */
export function formatSuccessPoints(value: unknown): string {
    return normalizeSuccessPoints(value).toLocaleString("fr-FR");
}

/** Détail d'une ligne (nom de donjon, de Dofus…), borné — texte seul. */
function sanitizeDetail(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (!cleaned) return null;
    return cleaned.length <= 80 ? cleaned : `${cleaned.slice(0, 79)}…`;
}

/**
 * Copie de l'annonce : un titre court et une phrase qui **nomme** le membre et dit **ce qui vient de
 * se passer** (« wylan a validé ceci », « wylan est désormais dans les 3 premiers du ladder succès »).
 * Texte seul, borné, jamais de HTML.
 */
export function buildGuildActivityCopy(input: {
    kind: GuildActivityKind;
    memberName: unknown;
    detail?: string | null;
    points?: unknown;
}): { title: string; message: string } {
    const name = sanitizeGuildActivityName(input.memberName);
    const detail = sanitizeDetail(input.detail);

    switch (input.kind) {
        case "missions":
            return { title: "Mission validée", message: `${name} a validé ${detail ? `« ${detail} »` : "une mission"}.` };
        case "donjons":
            return { title: "Sortie bouclée", message: `${name} a bouclé ${detail ? `« ${detail} »` : "un donjon"}.` };
        case "songes":
            return { title: "Run de songes", message: `${name} a terminé ${detail ? `« ${detail} »` : "un run de songes"}.` };
        case "ocre":
            return { title: "Quête Ocre", message: `${name} a progressé sur la quête Ocre${detail ? ` (${detail})` : ""}.` };
        case "events":
            return { title: "Agenda", message: `${name} a programmé ${detail ? `« ${detail} »` : "un événement"}.` };
        case "succes":
            return { title: "Succès validé", message: `${name} a validé le succès ${detail ? `« ${detail} »` : "annoncé"}.` };
        case "dofus":
            return { title: "Dofus validé", message: `${name} valide ${detail ? `le ${detail}` : "un Dofus"} !` };
        case "paliers":
            return {
                title: "Palier de points",
                message: `${name} passe la barre des ${formatSuccessPoints(input.points)} points de succès !`,
            };
        case "ladder":
            return {
                title: "Ladder succès",
                message: `${name} est désormais dans les ${LADDER_TOP_SIZE} premiers du ladder succès de la guilde !`,
            };
        default:
            return { title: "Activité de guilde", message: `${name} a nourri la vie de la guilde.` };
    }
}

// ── Lien avec le flux (lot N-2) ──────────────────────────────────────────────

/**
 * Le **module** écrit dans `ServiceActivityLog.module` pour chaque type d'activité — c'est la
 * colonne que le flux lit (`src/server/actions/unified-activity-actions.ts:143`) et sur laquelle
 * le filtre de préférences se recale. Une **seule** table de correspondance, donc : écrire avec
 * `GUILD_ACTIVITY_MODULE_BY_KIND` et relire avec `resolveGuildActivityKind` ne peuvent pas diverger.
 */
export const GUILD_ACTIVITY_MODULE_BY_KIND = {
    missions: "MISSIONS",
    donjons: "DONJONS",
    songes: "SONGES",
    ocre: "OCRE",
    events: "EVENTS",
    succes: "SUCCES",
    dofus: "DOFUS",
    paliers: "PALIERS",
    ladder: "LADDER",
} as const satisfies Record<GuildActivityKind, string>;

/**
 * Type d'activité d'une ligne du flux, depuis le `module` stocké. `null` pour tout ce qui n'est pas
 * une activité de guilde connue (service, prêt, coffre…) : **fail-closed**, on n'invente pas un
 * type, et l'appelant décide (ces lignes-là ne sont pas filtrées par les préférences de ce module).
 */
export function resolveGuildActivityKind(module: unknown): GuildActivityKind | null {
    if (typeof module !== "string") return null;
    const legacy = LEGACY_FEED_TYPE_TO_KIND[module];
    if (legacy) return legacy;
    const entry = (Object.entries(GUILD_ACTIVITY_MODULE_BY_KIND) as [GuildActivityKind, string][]).find(
        ([, value]) => value === module,
    );
    return entry ? entry[0] : null;
}

/**
 * Types **déjà** produits par le flux historiquement (`unified-activity-actions.ts`) : ils ne portent
 * pas un `module` de `ServiceActivityLog` mais un type dédié. Sans cette table, leurs lignes
 * échapperaient au filtre de préférences (donc : impossibles à couper par un membre).
 */
const LEGACY_FEED_TYPE_TO_KIND: Record<string, GuildActivityKind> = {
    MISSION_VALIDATED: "missions",
    OCRE_TRADE: "ocre",
};


