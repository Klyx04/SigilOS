/**
 * Télémétrie — règles **produit** pures (D-2bis : refonte du module God).
 *
 * Pourquoi ce fichier existe : l'écran God ne mesurait que la **navigation** (pages vues, clics,
 * user-agent) sur un échantillon de quelques comptes — un « Google Console » qui ne dit rien du
 * produit. Les mesures qui décrivent réellement le produit (une guilde qui adopte un module,
 * une guilde qui décroche, une cohorte qui revient) étaient soit absentes, soit fabriquées.
 *
 * Règle de la maison (celle de `aggregate.ts`) : **aucun seuil magique**. Ce qui dépend des
 * données est **dérivé de la distribution observée**, et l'écran doit pouvoir dire quel seuil a
 * été retenu et sur combien de guildes il repose. Ce qui ne dépend que du format est une
 * constante nommée, documentée, exportée.
 *
 * ⚠️ Aucune dépendance Prisma / Next / React : utilisable côté serveur **et** dans un composant.
 */

// ---------------------------------------------------------------------------
// Semaines (ISO 8601 : la semaine commence le lundi, en UTC)
// ---------------------------------------------------------------------------

/** Nombre de semaines affichées par défaut dans les vues de rétention. */
export const RETENTION_WEEKS = 8;

/** Fenêtre par défaut des compteurs produit, en jours. */
export const PRODUCT_WINDOW_DAYS = 30;

/** Lundi 00:00 UTC de la semaine contenant `date`. */
export function startOfIsoWeek(date: Date): Date {
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const weekday = day.getUTCDay() || 7; // dimanche = 7 (ISO)
    day.setUTCDate(day.getUTCDate() - (weekday - 1));
    return day;
}

/** Numéro de semaine ISO (année ISO + semaine), sans dépendance externe. */
function isoWeekOf(date: Date): { year: number; week: number } {
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const weekday = day.getUTCDay() || 7;
    day.setUTCDate(day.getUTCDate() + 4 - weekday); // jeudi de la semaine = clé d'année ISO
    const isoYear = day.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { year: isoYear, week };
}

/**
 * Clé de semaine `AAAA-Sxx` d'une date. `null` si la date est absente ou invalide :
 * une facture sans date ne doit **jamais** être rangée arbitrairement dans la semaine courante.
 */
export function weekKey(date: Date | string | null | undefined): string | null {
    if (date === null || date === undefined) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;

    const { year, week } = isoWeekOf(parsed);
    return `${year}-S${String(week).padStart(2, "0")}`;
}

/**
 * Les `count` dernières clés de semaine, **de la plus ancienne à la plus récente**
 * (ordre d'affichage d'un axe temporel). `[]` si `count` n'est pas un entier positif.
 */
export function listWeekKeys(end: Date, count: number = RETENTION_WEEKS): string[] {
    const total = Math.trunc(count);
    if (!Number.isFinite(total) || total <= 0 || Number.isNaN(end.getTime())) return [];

    const keys: string[] = [];
    const cursor = startOfIsoWeek(end);
    for (let index = 0; index < total; index++) {
        const key = weekKey(cursor);
        if (key) keys.push(key);
        cursor.setUTCDate(cursor.getUTCDate() - 7);
    }

    return keys.reverse();
}

// ---------------------------------------------------------------------------
// Activité hebdomadaire (guildes et membres réellement actifs)
// ---------------------------------------------------------------------------

export interface ActivityFact {
    readonly guildId: string | null | undefined;
    readonly actorId: string | null | undefined;
    /** Date de la facture d'activité. */
    readonly at: Date | string | null | undefined;
}

export interface WeeklyActivity {
    /** Clé ISO `AAAA-Sxx`. */
    readonly week: string;
    /** Guildes distinctes ayant produit au moins une action cette semaine-là. */
    readonly activeGuilds: number;
    /** Membres distincts ayant produit au moins une action cette semaine-là. */
    readonly activeMembers: number;
}

/**
 * Série hebdomadaire continue : **chaque** semaine de la fenêtre est présente, y compris à zéro.
 * Une semaine absente d'un graphe se lirait comme une semaine faste.
 */
export function buildWeeklyActivity(
    facts: readonly ActivityFact[],
    options: { end: Date; weeks?: number }
): WeeklyActivity[] {
    const weeks = listWeekKeys(options.end, options.weeks ?? RETENTION_WEEKS);
    if (weeks.length === 0) return [];

    const guildsPerWeek = new Map<string, Set<string>>();
    const membersPerWeek = new Map<string, Set<string>>();
    for (const week of weeks) {
        guildsPerWeek.set(week, new Set());
        membersPerWeek.set(week, new Set());
    }

    for (const fact of facts) {
        const key = weekKey(fact.at);
        if (!key || !guildsPerWeek.has(key)) continue;

        if (fact.guildId) guildsPerWeek.get(key)?.add(fact.guildId);
        if (fact.actorId) membersPerWeek.get(key)?.add(fact.actorId);
    }

    return weeks.map((week) => ({
        week,
        activeGuilds: guildsPerWeek.get(week)?.size ?? 0,
        activeMembers: membersPerWeek.get(week)?.size ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Rétention : cohortes de guildes
// ---------------------------------------------------------------------------

/**
 * Taille minimale d'une cohorte pour publier un taux. En dessous, le taux est `null` :
 * un « 0 % de retour » calculé sur une guilde est une affirmation, pas une mesure.
 */
export const MIN_COHORT_SIZE = 3;

export interface GuildWeeks {
    readonly guildId: string;
    /** Semaines (clés ISO) où la guilde a été active, dans le désordre. */
    readonly weeks: readonly (string | null | undefined)[];
}

export interface RetentionPoint {
    /** Décalage en semaines après la semaine d'entrée (1 = J+7). */
    readonly weekOffset: number;
    readonly retained: number;
    /** Taux de retour borné `[0, 100]`, ou `null` si la cohorte est trop petite. */
    readonly rate: number | null;
}

export interface RetentionCohort {
    /** Semaine d'entrée de la cohorte. */
    readonly cohortWeek: string;
    /** Nombre de guildes entrées cette semaine-là (dans la fenêtre observée). */
    readonly size: number;
    /** Points de retour, du plus proche au plus lointain. */
    readonly points: RetentionPoint[];
}

/**
 * Cohortes de rétention **par semaine d'entrée** d'une guilde (sa première semaine d'activité
 * dans la fenêtre). Aucune donnée n'est extrapolée : un point dont la semaine de mesure est
 * postérieure à la fenêtre n'existe simplement pas.
 */
export function buildRetentionCohorts(
    guildWeeks: readonly GuildWeeks[],
    weeks: readonly string[]
): RetentionCohort[] {
    if (weeks.length === 0) return [];

    const activeByGuild = new Map<string, Set<string>>();
    for (const entry of guildWeeks) {
        const set = new Set<string>();
        for (const week of entry.weeks) {
            if (week && weeks.includes(week)) set.add(week);
        }
        if (set.size > 0) activeByGuild.set(entry.guildId, set);
    }

    const cohorts = new Map<string, string[]>();
    for (const [guildId, active] of activeByGuild) {
        const firstWeek = weeks.find((week) => active.has(week));
        if (!firstWeek) continue;
        const members = cohorts.get(firstWeek);
        if (members) members.push(guildId);
        else cohorts.set(firstWeek, [guildId]);
    }

    return weeks
        .filter((week) => cohorts.has(week))
        .map((cohortWeek) => {
            const members = cohorts.get(cohortWeek) ?? [];
            const size = members.length;
            const startIndex = weeks.indexOf(cohortWeek);

            const points: RetentionPoint[] = [];
            for (let offset = 1; startIndex + offset < weeks.length; offset++) {
                const measureWeek = weeks[startIndex + offset];
                if (!measureWeek) continue;

                const retained = members.filter((guildId) =>
                    activeByGuild.get(guildId)?.has(measureWeek)
                ).length;

                points.push({
                    weekOffset: offset,
                    retained,
                    rate: size >= MIN_COHORT_SIZE ? Math.round((retained / size) * 100) : null,
                });
            }

            return { cohortWeek, size, points };
        });
}

// ---------------------------------------------------------------------------
// Adoption : module activé ≠ module utilisé
// ---------------------------------------------------------------------------

export interface ModuleAdoptionInput {
    /** Clé de module (`songes`, `missions`, `marche`…). */
    readonly module: string;
    /** Guildes ayant le module **activé** (bascule ON, non verrouillée par le staff). */
    readonly enabledGuilds: number;
    /** Guildes ayant produit **au moins une ligne métier** avec ce module sur la fenêtre. */
    readonly usedGuilds: number;
}

export interface ModuleAdoption {
    readonly module: string;
    readonly enabledGuilds: number;
    readonly usedGuilds: number;
    /** Activé mais aucun usage : `enabledGuilds - usedGuilds`. */
    readonly idleGuilds: number;
    /** Part des guildes activantes qui l'utilisent réellement, bornée `[0, 100]`. */
    readonly adoptionRate: number;
}

/**
 * Croise l'activation d'un module et son usage réel.
 *
 * C'est **le** signal produit du module : un module activé par 5 guildes et utilisé par 1
 * indique un problème de valeur (ou d'onboarding), là où un compteur de pages vues ne dit rien.
 * Tri : les modules les plus « activés mais inutilisés » d'abord, puis les plus utilisés.
 */
export function deriveModuleAdoption(
    rows: readonly ModuleAdoptionInput[],
    guildCount?: number
): ModuleAdoption[] {
    const ceiling =
        guildCount !== undefined && Number.isFinite(guildCount) ? Math.max(0, Math.trunc(guildCount)) : null;
    const clampCount = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);

    return rows
        .map((row) => {
            let enabled = clampCount(row.enabledGuilds);
            let used = clampCount(row.usedGuilds);
            if (ceiling !== null) {
                enabled = Math.min(enabled, ceiling);
                used = Math.min(used, ceiling);
            }
            // Un module ne peut pas être utilisé par une guilde qui ne l'a pas activé : on borne
            // au lieu de publier un taux supérieur à 100 % (le bug d'origine de l'entonnoir).
            used = Math.min(used, enabled);

            const idleGuilds = enabled - used;
            const adoptionRate = enabled <= 0 ? 0 : Math.round((used / enabled) * 100);

            return {
                module: row.module,
                enabledGuilds: enabled,
                usedGuilds: used,
                idleGuilds,
                adoptionRate: Math.min(100, Math.max(0, adoptionRate)),
            };
        })
        .sort(
            (a, b) =>
                b.idleGuilds - a.idleGuilds ||
                b.usedGuilds - a.usedGuilds ||
                a.module.localeCompare(b.module)
        );
}

// ---------------------------------------------------------------------------
// Fraîcheur : quelles guildes relancer (seuil dérivé, jamais inventé)
// ---------------------------------------------------------------------------

/**
 * Plancher du seuil d'alerte, en jours. Ce n'est **pas** un seuil produit : c'est un garde-fou
 * pour les échantillons minuscules, où un centile n'a aucun sens — il est affiché comme tel.
 */
export const MIN_INACTIVITY_FLOOR_DAYS = 7;

/** Nombre minimal de guildes mesurées pour qu'un centile soit considéré comme dérivé. */
export const MIN_GUILDS_FOR_DERIVED_THRESHOLD = 3;

export type FreshnessStatus = "ACTIVE" | "SLOWING" | "DORMANT";

export interface FreshnessThresholds {
    /** Au-delà de ce nombre de jours sans action, la guilde est « à relancer ». */
    readonly warningDays: number;
    /** Au-delà, la guilde est considérée endormie. */
    readonly dormantDays: number;
    /** `true` si les seuils viennent de la distribution observée (et non du plancher). */
    readonly derived: boolean;
    /** Nombre de guildes effectivement mesurées (celles avec au moins une activité). */
    readonly sampleSize: number;
}

export interface GuildFreshnessInput {
    readonly id: string;
    readonly name: string;
    readonly lastActivityAt: Date | string | null | undefined;
}

export interface GuildFreshness {
    readonly id: string;
    readonly name: string;
    /** Jours entiers depuis la dernière action, `null` si la guilde n'a jamais rien fait. */
    readonly daysInactive: number | null;
    readonly status: FreshnessStatus;
}

/** Jours d'inactivité d'une guilde, `null` si sa dernière action est inconnue ou illisible. */
function inactivityOf(guild: GuildFreshnessInput, now: Date): number | null {
    if (!guild.lastActivityAt) return null;
    const last = guild.lastActivityAt instanceof Date ? guild.lastActivityAt : new Date(guild.lastActivityAt);
    if (Number.isNaN(last.getTime())) return null;
    return Math.max(0, Math.floor((now.getTime() - last.getTime()) / 86400000));
}

/**
 * Déduit les seuils d'alerte de la **distribution observée** : troisième quartile des
 * inactivités réelles (les guildes « en retard » par rapport aux autres), avec le plancher
 * `MIN_INACTIVITY_FLOOR_DAYS` si l'échantillon est trop pauvre pour qu'un centile ait un sens.
 */
export function deriveFreshnessThresholds(
    guilds: readonly GuildFreshnessInput[],
    now: Date
): FreshnessThresholds {
    const observed = guilds
        .map((guild) => inactivityOf(guild, now))
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b);

    if (observed.length < MIN_GUILDS_FOR_DERIVED_THRESHOLD) {
        return {
            warningDays: MIN_INACTIVITY_FLOOR_DAYS,
            dormantDays: MIN_INACTIVITY_FLOOR_DAYS * 2,
            derived: false,
            sampleSize: observed.length,
        };
    }

    // Rang du 3e quartile (méthode du rang le plus proche) : jamais un seuil rond sorti de nulle part.
    const rank = Math.min(observed.length - 1, Math.ceil(observed.length * 0.75) - 1);
    const warningDays = Math.max(MIN_INACTIVITY_FLOOR_DAYS, observed[rank] ?? MIN_INACTIVITY_FLOOR_DAYS);

    return {
        warningDays,
        dormantDays: warningDays * 2,
        derived: true,
        sampleSize: observed.length,
    };
}

/**
 * Classe les guildes par fraîcheur. Les seuils peuvent être fournis (pour rester cohérents entre
 * deux appels) ou dérivés ici.
 */
export function classifyGuildFreshness(
    guilds: readonly GuildFreshnessInput[],
    now: Date,
    thresholds?: FreshnessThresholds
): { thresholds: FreshnessThresholds; guilds: GuildFreshness[] } {
    const resolved = thresholds ?? deriveFreshnessThresholds(guilds, now);

    const classified: GuildFreshness[] = guilds.map((guild) => {
        const daysInactive = inactivityOf(guild, now);
        const status: FreshnessStatus =
            daysInactive === null || daysInactive > resolved.dormantDays
                ? "DORMANT"
                : daysInactive > resolved.warningDays
                    ? "SLOWING"
                    : "ACTIVE";

        return { id: guild.id, name: guild.name, daysInactive, status };
    });

    // Jamais d'activité d'abord (les plus urgents), puis les plus anciens.
    classified.sort((a, b) => {
        if (a.daysInactive === null && b.daysInactive === null) return a.name.localeCompare(b.name);
        if (a.daysInactive === null) return -1;
        if (b.daysInactive === null) return 1;
        return b.daysInactive - a.daysInactive || a.name.localeCompare(b.name);
    });

    return { thresholds: resolved, guilds: classified };
}

// ---------------------------------------------------------------------------
// Honnêteté d'échantillon
// ---------------------------------------------------------------------------

/**
 * Nombre minimal de membres distincts pour qu'un classement par membre soit publiable.
 * Même valeur que la queue de `splitEngagement` (`2 × 7 + 1`) : un seul nombre dans tout le module.
 */
export const MIN_RELIABLE_DISTINCT_ACTORS = 15;

/** L'échantillon permet-il de publier un classement nominatif sans fabriquer un résultat ? */
export function isSampleReliable(
    distinctActors: number,
    minimum: number = MIN_RELIABLE_DISTINCT_ACTORS
): boolean {
    if (!Number.isFinite(distinctActors)) return false;
    return Math.trunc(distinctActors) >= Math.max(1, Math.trunc(minimum));
}
