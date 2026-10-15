/**
 * Rôles automatiques par ancienneté (chantier Y) — règles PURES, sans I/O.
 *
 * Une seule source de vérité pour :
 * - la forme des réglages de guilde (`GuildConfig.seniorityRoles*`) et leur relecture
 *   défensive (`mergeSeniorityRolesConfig`) : le JSON stocké n'est jamais cru sur parole ;
 * - le palier atteint par un membre (`resolveSeniorityRoleTier`) et les rôles que la
 *   synchronisation a le DROIT de toucher (`resolveSeniorityManagedRoleIds`) ;
 * - le diff à appliquer — à ajouter / à retirer (`computeSeniorityRoleDiff`) ;
 * - le texte de l'annonce personnalisable (`renderSeniorityAnnouncement`), consommé
 *   **à l'identique** par l'aperçu de l'écran et par l'envoi Discord réel.
 *
 * L'ancienneté n'est PAS recalculée ici : `computeSeniorityDays` (`@/lib/member-registry`)
 * reste la seule règle de calcul et `formatSeniority` (`@/lib/ladder-utils`) la seule mise
 * en forme lisible — le palier les reçoit en entrée. Aucun appel Discord, aucune lecture de
 * base : tout est testable seul.
 *
 * ── Sémantique retenue : CUMULATIVE (décision Y-1, brief §3) ─────────────────
 * Un membre porte les rôles de **tous** les paliers atteints : atteindre le palier 3 n'enlève
 * rien au palier 1. Le retrait n'existe que pour un palier qu'il n'a **plus** (date d'arrivée
 * corrigée, seuil remonté, rôle posé à la main) — et il ne touche jamais que les rôles
 * **déclarés dans les paliers** : les autres rôles du membre sont hors périmètre par
 * construction (fail-closed).
 */

import { isDiscordSnowflake } from "@/lib/discord-ids";
import { formatSeniority } from "@/lib/ladder-utils";

// ── Bornes : ce n'est pas « ce qu'on a mis à l'écran », c'est ce que la règle accepte ──

/** Nombre maximum de paliers par guilde. */
export const SENIORITY_ROLES_MAX_TIERS = 20;

/** Nombre maximum de rôles attribués par un seul palier. */
export const SENIORITY_ROLES_MAX_ROLES_PER_TIER = 10;

/** Seuil minimal d'un palier, en jours (« le jour même » n'est pas un palier). */
export const SENIORITY_ROLES_MIN_DAYS = 1;

/** Seuil maximal d'un palier, en jours (10 ans : au-delà, ce n'est plus de l'ancienneté). */
export const SENIORITY_ROLES_MAX_DAYS = 3650;

/** Bornes Discord du texte de l'annonce (contenu de message, titre et description d'embed). */
export const SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH = 2000;
export const SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH = 256;
export const SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH = 4096;

// ── Forme des réglages ───────────────────────────────────────────────────────

/** Surcharge **du texte** d'un palier : un champ absent hérite du message global. */
export interface SeniorityTierAnnouncementOverride {
    messageTemplate?: string;
    embedTitle?: string;
    embedDescription?: string;
}

/** Un palier : « à partir de `days` jours, ces rôles-là », avec son texte s'il est personnalisé. */
export interface SeniorityTier {
    days: number;
    roleIds: string[];
    /** Texte propre à ce palier (facultatif) — la couleur et la miniature restent communes. */
    announcement?: SeniorityTierAnnouncementOverride;
}

/** Source de la miniature de l'embed de félicitation. */
export type SeniorityThumbnailSource = "avatar" | "guild" | "none";

/** Message personnalisable de l'annonce (réglage de guilde, éditable à l'écran Y-3). */
export interface SeniorityAnnouncementConfig {
    /** Ligne de message envoyée avec l'embed — la mention du membre y est injectée par `{membre}`. */
    messageTemplate: string;
    embedTitle: string;
    embedDescription: string;
    /** Couleur décimale de la barre latérale de l'embed (0x000000–0xFFFFFF). */
    color: number;
    /** Miniature : la PP Discord du membre (défaut), l'icône de guilde, ou aucune. */
    thumbnail: SeniorityThumbnailSource;
}

/** Réglages complets, tels que la règle les consomme (jamais un JSON brut). */
export interface GuildSeniorityRolesConfig {
    /** Activation par guilde — OFF par défaut : aucune guilde ne reçoit de rôles à son insu. */
    enabled: boolean;
    /** Salon de l'annonce ; `null` = les rôles sont posés sans annonce. */
    channelId: string | null;
    tiers: SeniorityTier[];
    announcement: SeniorityAnnouncementConfig;
}

/** Annonce telle qu'elle part par défaut : mention du membre, rôle obtenu, ancienneté. */
export const DEFAULT_SENIORITY_ANNOUNCEMENT: SeniorityAnnouncementConfig = {
    messageTemplate: "🎉 Félicitations {membre} !",
    embedTitle: "🎖️ Nouveau palier d'ancienneté",
    embedDescription:
        "{membre} fait partie de {guilde} depuis **{anciennete}** et obtient {roles}.\nMerci pour ta fidélité !",
    color: 0x9333ea,
    thumbnail: "avatar",
};

/** Réglages par défaut : éteint, aucun palier — l'admin active explicitement. */
export const DEFAULT_SENIORITY_ROLES_CONFIG: GuildSeniorityRolesConfig = {
    enabled: false,
    channelId: null,
    tiers: [],
    announcement: DEFAULT_SENIORITY_ANNOUNCEMENT,
};

// ── Paliers : normalisation (un JSON stocké ne vaut rien tant qu'il n'est pas relu) ──

/**
 * Relit la **surcharge de texte** d'un palier : champ par champ, borné comme le message global ;
 * une chaîne vide (ou blanche) n'est **pas** une surcharge — c'est un héritage du global.
 */
export function normalizeTierAnnouncement(raw: unknown): SeniorityTierAnnouncementOverride | undefined {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const source = raw as { messageTemplate?: unknown; embedTitle?: unknown; embedDescription?: unknown };
    const bounded = (value: unknown, max: number) =>
        typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

    const out: SeniorityTierAnnouncementOverride = {};
    const messageTemplate = bounded(source.messageTemplate, SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH);
    const embedTitle = bounded(source.embedTitle, SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH);
    const embedDescription = bounded(source.embedDescription, SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH);
    if (messageTemplate) out.messageTemplate = messageTemplate;
    if (embedTitle) out.embedTitle = embedTitle;
    if (embedDescription) out.embedDescription = embedDescription;

    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Relit les paliers depuis une valeur brute (JSON de la base) et les rend **toujours**
 * exploitables :
 * - palier non conforme (seuil non entier, hors bornes, sans rôle) → écarté ;
 * - identifiant non-Discord → écarté ; rôle en doublon → **un seul palier le porte**
 *   (le premier, après tri par seuil) ;
 * - tri par seuil croissant, puis plafond `SENIORITY_ROLES_MAX_TIERS`.
 *
 * Aucune exception : une base corrompue rend `[]` (donc aucun rôle posé), jamais une erreur.
 */
export function normalizeSeniorityTiers(raw: unknown): SeniorityTier[] {
    const source = Array.isArray(raw) ? raw : [];
    const candidates: SeniorityTier[] = [];

    // ① Paliers valables (seuil entier dans les bornes, identifiants Discord), **sans encore**
    //    arbitrer les rôles en doublon : l'arbitrage doit venir **après** le tri par seuil,
    //    sinon c'est l'ordre reçu du formulaire qui décide — pas la règle.
    for (const entry of source) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const candidate = entry as { days?: unknown; roleIds?: unknown; announcement?: unknown };
        const days = candidate.days;
        if (typeof days !== "number" || !Number.isInteger(days)) continue;
        if (days < SENIORITY_ROLES_MIN_DAYS || days > SENIORITY_ROLES_MAX_DAYS) continue;

        const roleIds: string[] = [];
        const rawRoleIds = Array.isArray(candidate.roleIds) ? candidate.roleIds : [];
        for (const roleId of rawRoleIds) {
            if (!isDiscordSnowflake(roleId)) continue;
            roleIds.push(roleId);
            if (roleIds.length >= SENIORITY_ROLES_MAX_ROLES_PER_TIER) break;
        }
        if (roleIds.length === 0) continue;

        // Surcharge de texte : nettoyée ici, elle est portée par le **seuil** jusqu'à l'annonce.
        const announcement = normalizeTierAnnouncement(candidate.announcement);
        candidates.push(announcement ? { days, roleIds, announcement } : { days, roleIds });
    }

    // ② Tri par seuil : l'ordre de lecture redevient l'ordre logique de la règle.
    candidates.sort((a, b) => a.days - b.days);

    // ③ Un rôle n'est porté que par le palier **le plus précoce** ; un palier qui n'a plus
    //    aucun rôle est écarté (il n'attribuerait rien).
    const claimedRoleIds = new Set<string>();
    const tiers: SeniorityTier[] = [];
    for (const candidate of candidates) {
        const roleIds: string[] = [];
        for (const roleId of candidate.roleIds) {
            if (claimedRoleIds.has(roleId)) continue;
            claimedRoleIds.add(roleId);
            roleIds.push(roleId);
        }
        if (roleIds.length === 0) continue;
        // Le texte du palier survit au dédoublonnage des rôles : il appartient au **seuil**.
        tiers.push(
            candidate.announcement
                ? { days: candidate.days, roleIds, announcement: candidate.announcement }
                : { days: candidate.days, roleIds },
        );
    }

    return tiers.slice(0, SENIORITY_ROLES_MAX_TIERS);
}

// ── Prochain palier (vue informative « Prochains paliers ») ──────────────────

/** Fenêtre, en jours, de la vue « Prochains paliers » (informative, côté staff). */
export const SENIORITY_UPCOMING_WINDOW_DAYS = 30;

/** Prochain palier d'un membre : lequel, et dans combien de jours. */
export interface UpcomingTierChange {
    /** Index du palier visé dans `tiers`. */
    tierIndex: number;
    /** Seuil de ce palier, en jours. */
    tierDays: number;
    /** Jours restants avant de le franchir (`0` = aujourd'hui). */
    daysUntil: number;
}

/**
 * Prochain palier qu'un membre **n'a pas encore** franchi, `null` s'il les a tous.
 *
 * `seniorityDays` est **fourni par l'appelant** : le calcul d'ancienneté reste la règle unique
 * (`computeSeniorityDays`, `@/lib/member-registry`). Comme les autres règles, celle-ci compare
 * les **seuils** : elle ne suppose pas le tableau trié.
 */
export function resolveUpcomingTierChange(input: {
    tiers: readonly SeniorityTier[];
    seniorityDays: number;
}): UpcomingTierChange | null {
    const days = Number.isFinite(input.seniorityDays) ? Math.max(0, Math.floor(input.seniorityDays)) : 0;
    let upcoming: UpcomingTierChange | null = null;
    for (let index = 0; index < input.tiers.length; index += 1) {
        const tier = input.tiers[index];
        if (days >= tier.days) continue;
        if (!upcoming || tier.days < upcoming.tierDays) {
            upcoming = { tierIndex: index, tierDays: tier.days, daysUntil: tier.days - days };
        }
    }
    return upcoming;
}

// ── Palier cible et périmètre ────────────────────────────────────────────────

/**
 * Index du **palier cible** : le plus haut palier atteint (`ancienneté >= seuil`),
 * `-1` si aucun. Indépendant de l'ordre reçu : la règle compare les seuils, elle ne
 * suppose jamais le tri.
 */
export function resolveSeniorityRoleTier(tiers: readonly SeniorityTier[], seniorityDays: number): number {
    if (!Number.isFinite(seniorityDays)) return -1;
    let tierIndex = -1;
    let bestDays = -1;
    for (let index = 0; index < tiers.length; index += 1) {
        const tier = tiers[index];
        if (seniorityDays < tier.days) continue;
        if (tier.days >= bestDays) {
            bestDays = tier.days;
            tierIndex = index;
        }
    }
    return tierIndex;
}

/** Union des rôles **déclarés** par les paliers : le seul ensemble que la synchro peut toucher. */
export function resolveSeniorityManagedRoleIds(tiers: readonly SeniorityTier[]): string[] {
    const out: string[] = [];
    for (const tier of tiers) {
        for (const roleId of tier.roleIds) if (!out.includes(roleId)) out.push(roleId);
    }
    return out;
}

/**
 * Rôles **dus** à un palier cible : union de **tous les paliers atteints** (ceux dont le
 * seuil est inférieur ou égal à celui du palier cible) — sémantique cumulative. Comme
 * `resolveSeniorityRoleTier`, la règle compare les **seuils** : elle ne suppose pas que
 * le tableau reçu soit trié (il l'est en pratique, `normalizeSeniorityTiers` trie).
 */
export function resolveSeniorityTargetRoleIds(tiers: readonly SeniorityTier[], targetTierIndex: number): string[] {
    if (targetTierIndex < 0 || targetTierIndex >= tiers.length) return [];
    const threshold = tiers[targetTierIndex].days;
    const out: string[] = [];
    for (const tier of tiers) {
        if (tier.days > threshold) continue;
        for (const roleId of tier.roleIds) if (!out.includes(roleId)) out.push(roleId);
    }
    return out;
}

/**
 * Annonce **effective** d'un palier : ses surcharges de texte, champ par champ, sinon le message
 * global. Couleur et miniature restent **communes** (l'identité visuelle de la guilde) — un palier
 * ne personnalise que ce qui se lit.
 */
export function resolveTierAnnouncement(input: {
    announcement: SeniorityAnnouncementConfig;
    tier: Pick<SeniorityTier, "announcement">;
}): SeniorityAnnouncementConfig {
    const override = input.tier.announcement;
    if (!override) return input.announcement;
    return {
        messageTemplate: override.messageTemplate ?? input.announcement.messageTemplate,
        embedTitle: override.embedTitle ?? input.announcement.embedTitle,
        embedDescription: override.embedDescription ?? input.announcement.embedDescription,
        color: input.announcement.color,
        thumbnail: input.announcement.thumbnail,
    };
}

// ── Diff à appliquer ─────────────────────────────────────────────────────────

/** Ce que la synchronisation fera pour **un** membre : rien, ajouter, retirer. */
export interface SeniorityRoleDiff {
    seniorityDays: number;
    /** Palier cible atteint (`-1` = aucun palier, ou module éteint). */
    targetTierIndex: number;
    /** Rôles dus à ce membre, à cet instant. */
    targetRoleIds: string[];
    /** Rôles gérés à poser. */
    toAdd: string[];
    /** Rôles gérés à retirer (palier qu'il n'a plus). */
    toRemove: string[];
    /** Vrai s'il y a quelque chose à faire sur Discord. */
    changed: boolean;
}

/**
 * Diff **pur** pour un membre : rien n'est lu (les rôles courants sont fournis par
 * l'appelant, seul à parler à Discord) et rien n'est écrit.
 *
 * Invariants :
 * - module éteint ou aucun palier configuré ⇒ diff vide (fail-closed) ;
 * - `toAdd` = rôles dus − rôles courants ;
 * - `toRemove` = rôles courants **∩ rôles déclarés** − rôles dus : un rôle que la guilde
 *   n'a pas déclaré dans un palier n'est jamais retiré, même s'il ressemble à un grade ;
 * - aucun palier atteint ⇒ diff vide (on ne déshabille pas un membre tout juste arrivé).
 */
export function computeSeniorityRoleDiff(input: {
    config: GuildSeniorityRolesConfig;
    seniorityDays: number;
    currentRoleIds: readonly string[];
}): SeniorityRoleDiff {
    const seniorityDays =
        Number.isFinite(input.seniorityDays) && input.seniorityDays > 0 ? Math.floor(input.seniorityDays) : 0;
    const idle: SeniorityRoleDiff = {
        seniorityDays,
        targetTierIndex: -1,
        targetRoleIds: [],
        toAdd: [],
        toRemove: [],
        changed: false,
    };

    if (!input.config.enabled || input.config.tiers.length === 0) return idle;

    const targetTierIndex = resolveSeniorityRoleTier(input.config.tiers, seniorityDays);
    if (targetTierIndex < 0) return idle;

    const targetRoleIds = resolveSeniorityTargetRoleIds(input.config.tiers, targetTierIndex);
    const target = new Set(targetRoleIds);
    const current = new Set(input.currentRoleIds.filter((roleId) => isDiscordSnowflake(roleId)));

    const toAdd = targetRoleIds.filter((roleId) => !current.has(roleId));
    const managed = new Set(resolveSeniorityManagedRoleIds(input.config.tiers));
    const toRemove = [...current].filter((roleId) => managed.has(roleId) && !target.has(roleId));

    return {
        seniorityDays,
        targetTierIndex,
        targetRoleIds,
        toAdd,
        toRemove,
        changed: toAdd.length > 0 || toRemove.length > 0,
    };
}

// ── Annonce personnalisable (aperçu et envoi réel : le même texte) ───────────

/**
 * Variables autorisées dans les modèles. Allowlist **fermée** : aucun `eval`, aucun
 * accès dynamique. Une variable inconnue reste écrite telle quelle — donc **visible
 * dans l'aperçu** : une faute de frappe se voit tout de suite, elle ne disparaît pas
 * en silence.
 */
export const SENIORITY_ANNOUNCEMENT_VARIABLES = ["membre", "pseudo", "anciennete", "roles", "guilde"] as const;

export type SeniorityAnnouncementVariable = (typeof SENIORITY_ANNOUNCEMENT_VARIABLES)[number];

/** Valeurs injectées dans les modèles (construites par `buildSeniorityAnnouncementValues`). */
export type SeniorityAnnouncementValues = Record<SeniorityAnnouncementVariable, string>;

/** Remplace les variables connues, laisse toute autre accolade intacte. */
export function renderSeniorityAnnouncementText(template: string, values: SeniorityAnnouncementValues): string {
    let out = template;
    for (const variable of SENIORITY_ANNOUNCEMENT_VARIABLES) {
        // Remplacement par fonction : un `$` dans un pseudo ne peut pas être réinterprété.
        out = out.replace(new RegExp(`\\{${variable}\\}`, "g"), () => values[variable]);
    }
    return out;
}

/**
 * Valeurs réellement injectées : la mention Discord pour `{membre}`, le pseudo pour
 * `{pseudo}`, l'ancienneté **lisible** pour `{anciennete}` (via `formatSeniority`, la
 * seule mise en forme de durée du dépôt), les mentions des rôles obtenus pour `{roles}`
 * et le nom de la guilde pour `{guilde}`.
 */
export function buildSeniorityAnnouncementValues(input: {
    member: { discordId: string; displayName: string };
    guildName: string;
    seniorityDays: number;
    awardedRoleIds: readonly string[];
}): SeniorityAnnouncementValues {
    const awarded = input.awardedRoleIds
        .filter((roleId) => isDiscordSnowflake(roleId))
        .map((roleId) => `<@&${roleId}>`);
    const days = Number.isFinite(input.seniorityDays) ? Math.max(0, Math.floor(input.seniorityDays)) : 0;
    return {
        membre: `<@${input.member.discordId}>`,
        pseudo: input.member.displayName,
        anciennete: formatSeniority(days),
        roles: awarded.join(", "),
        guilde: input.guildName,
    };
}

/** Annonce prête à envoyer : contenu de message + texte d'embed, bornés pour Discord. */
export interface SeniorityAnnouncement {
    content: string;
    embedTitle: string;
    embedDescription: string;
    color: number;
    thumbnail: SeniorityThumbnailSource;
}

/** Coupe à la borne : un texte trop long se tronque, il ne fait jamais échouer l'envoi. */
function boundText(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
}

/** Rendu **unique** de l'annonce — l'aperçu de l'écran et l'envoi Discord le partagent. */
export function renderSeniorityAnnouncement(input: {
    announcement: SeniorityAnnouncementConfig;
    values: SeniorityAnnouncementValues;
}): SeniorityAnnouncement {
    return {
        content: boundText(
            renderSeniorityAnnouncementText(input.announcement.messageTemplate, input.values),
            SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
        ),
        embedTitle: boundText(
            renderSeniorityAnnouncementText(input.announcement.embedTitle, input.values),
            SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH,
        ),
        embedDescription: boundText(
            renderSeniorityAnnouncementText(input.announcement.embedDescription, input.values),
            SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH,
        ),
        color: input.announcement.color,
        thumbnail: input.announcement.thumbnail,
    };
}

// ── Franchissement d'un palier : à fêter, ou rattrapage ? (lot Y-2) ──────────

const DAY_MS = 86_400_000;

/**
 * Date de **franchissement** d'un palier : arrivée + seuil. C'est elle qui décide si le
 * palier est un événement à fêter ou un rattrapage (cf. `shouldCelebrateSeniorityTier`).
 * `null` si l'arrivée ou le seuil n'est pas exploitable.
 */
export function resolveSeniorityCrossingIso(joinedAtIso: string, tierDays: number): string | null {
    const joined = new Date(joinedAtIso).getTime();
    if (Number.isNaN(joined) || !Number.isInteger(tierDays) || tierDays < 0) return null;
    return new Date(joined + tierDays * DAY_MS).toISOString();
}

/**
 * Faut-il **fêter** ce palier (embed dans le salon), ou le marquer en silence ?
 *
 * Un palier atteint n'est un événement que si sa date de franchissement est **strictement
 * postérieure** à l'activation du module. Sinon c'est un **rattrapage** : les rôles sont
 * posés, mais rien n'est posté (décision user du 14/10/2026 — les membres déjà présents
 * reçoivent leurs rôles en silence, le salon ne fête que les franchissements à venir).
 *
 * Sans marqueur d'activation (`null`, `undefined` ou date invalide) : **on ne fête rien**
 * (fail-closed — jamais des félicitations qu'on ne saurait pas expliquer).
 */
export function shouldCelebrateSeniorityTier(input: {
    joinedAtIso: string;
    tierDays: number;
    activatedAtIso: string | null | undefined;
}): boolean {
    if (!input.activatedAtIso) return false;
    const activated = new Date(input.activatedAtIso).getTime();
    if (Number.isNaN(activated)) return false;
    const crossing = resolveSeniorityCrossingIso(input.joinedAtIso, input.tierDays);
    if (!crossing) return false;
    return new Date(crossing).getTime() > activated;
}

/**
 * Relit l'annonce depuis la base : tout champ douteux (vide, mal typé, hors bornes)
 * retombe sur le défaut — **fail-safe**, jamais fail-open sur du texte Discord.
 */
export function mergeSeniorityAnnouncement(raw: unknown): SeniorityAnnouncementConfig {
    const merged: SeniorityAnnouncementConfig = { ...DEFAULT_SENIORITY_ANNOUNCEMENT };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return merged;
    const source = raw as Record<string, unknown>;

    if (typeof source.messageTemplate === "string" && source.messageTemplate.trim().length > 0) {
        merged.messageTemplate = boundText(source.messageTemplate, SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH);
    }
    if (typeof source.embedTitle === "string" && source.embedTitle.trim().length > 0) {
        merged.embedTitle = boundText(source.embedTitle, SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH);
    }
    if (typeof source.embedDescription === "string" && source.embedDescription.trim().length > 0) {
        merged.embedDescription = boundText(source.embedDescription, SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH);
    }
    if (
        typeof source.color === "number" &&
        Number.isInteger(source.color) &&
        source.color >= 0 &&
        source.color <= 0xffffff
    ) {
        merged.color = source.color;
    }
    if (source.thumbnail === "avatar" || source.thumbnail === "guild" || source.thumbnail === "none") {
        merged.thumbnail = source.thumbnail;
    }
    return merged;
}

// ── Relecture complète des réglages ──────────────────────────────────────────

/** Les 4 colonnes de `GuildConfig` du chantier Y, telles qu'elles sont lues en base. */
export interface SeniorityRolesConfigSource {
    seniorityRolesEnabled?: unknown;
    seniorityRolesChannelId?: unknown;
    seniorityRolesTiers?: unknown;
    seniorityRolesAnnouncement?: unknown;
}

/**
 * Relit les réglages d'une guilde et rend une config **toujours exploitable** :
 * activation seulement sur `true` exact (fail-closed), salon uniquement s'il est un
 * snowflake, paliers normalisés et bornés, annonce retombant sur ses défauts.
 */
export function mergeSeniorityRolesConfig(
    raw: SeniorityRolesConfigSource | null | undefined,
): GuildSeniorityRolesConfig {
    const channelId = raw?.seniorityRolesChannelId;
    return {
        enabled: raw?.seniorityRolesEnabled === true,
        channelId: isDiscordSnowflake(channelId) ? channelId : null,
        tiers: normalizeSeniorityTiers(raw?.seniorityRolesTiers),
        announcement: mergeSeniorityAnnouncement(raw?.seniorityRolesAnnouncement),
    };
}
