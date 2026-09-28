"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import {
    MIN_COHORT_SIZE,
    PRODUCT_FACT_LIMIT,
    PRODUCT_WINDOW_DAYS,
    RETENTION_WEEKS,
    buildRetentionCohorts,
    buildWeeklyActivity,
    classifyGuildFreshness,
    deriveModuleAdoption,
    isSampleReliable,
    listWeekKeys,
    weekKey,
    type ModuleAdoptionInput,
} from "@/lib/telemetry/product";
import { isSuperAdmin } from "./super-admin-actions";

/**
 * Mesures **produit** du panneau God (D-2bis).
 *
 * Différence avec `getTelemetryStats` : ce dernier décrit la **navigation** (pages vues, clics,
 * chemin, user-agent) sur un échantillon de quelques comptes. Ici on décrit le **produit** :
 * quelles guildes sont actives, quels modules sont réellement utilisés, qui décroche.
 *
 * Trois règles non négociables appliquées ici :
 * 1. **L'usage interne God ne compte pas** : tout est lu avec `isGodLog: false`. Mesuré en base
 *    locale : 750 des 1 036 lignes de `AuditLog` étaient des accès au panneau God — les compter
 *    comme « activité produit » ferait de l'observation d'un produit son propre usage.
 * 2. **Toute lecture est bornée** (`take`) et la troncature est **publiée** (`truncated`) : un
 *    échantillon ne doit jamais se présenter comme un total.
 * 3. **Aucun seuil inventé** : les règles pures de `src/lib/telemetry/product.ts` dérivent les
 *    seuils des données observées et refusent de publier un taux sur une cohorte trop petite.
 */

/**
 * Plafond de lecture explicite des faits d'audit : il vit dans `src/lib/telemetry/product.ts`
 * (une logique pure, testable) — un fichier `"use server"` ne peut exporter que des fonctions
 * `async`, la constante n'a donc rien à faire ici.
 */

/** Fenêtre de lecture des faits : elle couvre toute la rétention affichée. */
const FACT_WINDOW_DAYS = RETENTION_WEEKS * 7;

/** Plafond des guildes lues (une ligne par guilde, plafond de sécurité). */
const GUILD_LIMIT = 1_000;

interface GuildModuleCountRow {
    guildId: string | null;
    _count: { _all: number };
}

/** Ligne `groupBy guildId` → couple `{ guildId, count }`. */
function toGuildCounts(rows: GuildModuleCountRow[]): Array<{ guildId: string | null; count: number }> {
    return rows.map((row) => ({ guildId: row.guildId, count: row._count._all }));
}

/**
 * Sonde d'usage réel d'un module : **une table métier horodatée et cloisonnée par guilde**.
 * Un module sans sonde n'est pas « inutilisé » : il est **non mesuré**, et l'écran doit le dire.
 */
interface ModuleProbe {
    /** Clé de module (`ModuleKey`). */
    readonly module: string;
    /** Ce que la sonde compte, en clair (« Songes lancés »). */
    readonly action: string;
    readonly run: (since: Date) => Promise<Array<{ guildId: string | null; count: number }>>;
}

const MODULE_PROBES: readonly ModuleProbe[] = [
    {
        module: "songes",
        action: "Songes lancés",
        run: (since) =>
            db.dreamRun
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "missions",
        action: "Missions créées",
        run: (since) =>
            db.mission
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "polls",
        action: "Sondages créés",
        run: (since) =>
            db.poll
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "marche",
        action: "Annonces de marché",
        run: (since) =>
            db.marketListing
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "tickets",
        action: "Tickets ouverts",
        run: (since) =>
            db.ticketRecord
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "profile",
        action: "Profils membres créés",
        run: (since) =>
            db.userProfile
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "succes",
        action: "Succès soumis",
        run: (since) =>
            db.achievementSubmission
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "calendar",
        action: "Événements créés",
        run: (since) =>
            db.guildEvent
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
    {
        module: "services",
        action: "Services publiés",
        run: (since) =>
            db.serviceListing
                .groupBy({ by: ["guildId"], where: { createdAt: { gte: since } }, _count: { _all: true } })
                .then(toGuildCounts),
    },
];

/**
 * Clés de module réellement portées par une ligne `GuildModules` : le schéma est la vérité,
 * aucune liste n'est recopiée ici (une colonne ajoutée apparaît seule dans la mesure).
 */
function moduleKeysOf(row: unknown): string[] {
    if (!row || typeof row !== "object") return [];
    return Object.entries(row as Record<string, unknown>)
        .filter(([, value]) => typeof value === "boolean")
        .map(([key]) => key);
}

/**
 * État **produit** mesuré : guildes et membres réellement actifs, rétention par cohortes,
 * adoption réelle des modules, guildes à relancer. Réservé au super-admin (fail-closed).
 */
export async function getProductStats() {
    try {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            throw new Error("Unauthorized: Super-admin access required");
        }

        const now = new Date();
        const windowStart = new Date(now.getTime() - FACT_WINDOW_DAYS * 86400000);
        const thirtyDaysAgo = new Date(now.getTime() - PRODUCT_WINDOW_DAYS * 86400000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

        const [guilds, facts, moduleRows, accountsTotal, profilesTotal, lastSeenRows, ...probeResults] =
            await Promise.all([
                db.guildConfig.findMany({
                    select: { id: true, name: true, createdAt: true },
                    take: GUILD_LIMIT,
                }),
                // ⚠️ `isGodLog: false` : l'usage du panneau God n'est pas de l'activité produit.
                db.auditLog.findMany({
                    where: { isGodLog: false, createdAt: { gte: windowStart } },
                    select: { guildId: true, actorUserId: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: PRODUCT_FACT_LIMIT,
                }),
                db.guildModules.findMany({ take: GUILD_LIMIT }),
                db.user.count(),
                db.userProfile.count(),
                // Dernière action **de tous les temps** par guilde : une guilde endormie depuis
                // trois mois ne doit pas s'afficher « jamais vue » parce qu'elle est hors fenêtre.
                db.auditLog.groupBy({
                    by: ["guildId"],
                    where: { isGodLog: false, guildId: { not: null } },
                    _max: { createdAt: true },
                }),
                ...MODULE_PROBES.map((probe) => probe.run(thirtyDaysAgo)),
            ]);

        const truncated = facts.length >= PRODUCT_FACT_LIMIT;
        const weeks = listWeekKeys(now, RETENTION_WEEKS);

        const weekly = buildWeeklyActivity(
            facts.map((fact) => ({ guildId: fact.guildId, actorId: fact.actorUserId, at: fact.createdAt })),
            { end: now, weeks: RETENTION_WEEKS }
        );

        const guildWeekMap = new Map<string, string[]>();
        const actorsWindow = new Set<string>();
        const actors7 = new Set<string>();
        const actors30 = new Set<string>();
        const guildsActive7 = new Set<string>();
        const guildsActive30 = new Set<string>();
        let actions7 = 0;
        let actions30 = 0;

        for (const fact of facts) {
            if (fact.actorUserId) {
                actorsWindow.add(fact.actorUserId);
                if (fact.createdAt >= sevenDaysAgo) actors7.add(fact.actorUserId);
                if (fact.createdAt >= thirtyDaysAgo) actors30.add(fact.actorUserId);
            }

            const key = weekKey(fact.createdAt);
            if (key && fact.guildId) {
                const list = guildWeekMap.get(fact.guildId);
                if (list) list.push(key);
                else guildWeekMap.set(fact.guildId, [key]);
            }

            if (fact.createdAt >= sevenDaysAgo) {
                actions7 += 1;
                if (fact.guildId) guildsActive7.add(fact.guildId);
            }
            if (fact.createdAt >= thirtyDaysAgo) {
                actions30 += 1;
                if (fact.guildId) guildsActive30.add(fact.guildId);
            }
        }

        const retention = buildRetentionCohorts(
            Array.from(guildWeekMap.entries()).map(([guildId, weekList]) => ({ guildId, weeks: weekList })),
            weeks
        );

        // « Activé et effectif » : une bascule conservée mais verrouillée par le staff
        // (`disabledByGod`) n'est pas une activation.
        const moduleKeys = new Set<string>();
        for (const row of moduleRows) {
            for (const key of moduleKeysOf(row)) moduleKeys.add(key);
        }

        const enabledByModule = new Map<string, Set<string>>();
        for (const key of moduleKeys) enabledByModule.set(key, new Set());
        for (const row of moduleRows) {
            const disabled = new Set(row.disabledByGod ?? []);
            const asRecord = row as unknown as Record<string, unknown>;
            for (const key of moduleKeys) {
                if (asRecord[key] === true && !disabled.has(key)) {
                    enabledByModule.get(key)?.add(row.guildId);
                }
            }
        }

        const adoptionInputs: ModuleAdoptionInput[] = [];
        const businessRowsByGuild = new Map<string, number>();

        MODULE_PROBES.forEach((probe, index) => {
            const enabled = enabledByModule.get(probe.module) ?? new Set<string>();
            const used = new Set<string>();

            for (const entry of probeResults[index] ?? []) {
                if (!entry.guildId) continue;
                businessRowsByGuild.set(entry.guildId, (businessRowsByGuild.get(entry.guildId) ?? 0) + entry.count);
                if (enabled.has(entry.guildId)) used.add(entry.guildId);
            }

            adoptionInputs.push({
                module: probe.module,
                enabledGuilds: enabled.size,
                usedGuilds: used.size,
            });
        });

        const unmeasured = Array.from(moduleKeys)
            .filter((key) => !MODULE_PROBES.some((probe) => probe.module === key))
            .map((key) => ({ module: key, enabledGuilds: enabledByModule.get(key)?.size ?? 0 }))
            .sort((a, b) => b.enabledGuilds - a.enabledGuilds || a.module.localeCompare(b.module));

        const adoption = {
            /** Adoption des modules **mesurables** (ceux qui ont une table métier horodatée). */
            modules: deriveModuleAdoption(adoptionInputs, moduleRows.length),
            probedModules: MODULE_PROBES.length,
            enabledModules: moduleKeys.size,
            /** Modules activés mais **non mesurables** : affichés, jamais comptés comme inutilisés. */
            unmeasured,
        };

        const lastActivityByGuild = new Map<string, Date>();
        for (const row of lastSeenRows) {
            if (row.guildId && row._max.createdAt) lastActivityByGuild.set(row.guildId, row._max.createdAt);
        }

        const freshness = classifyGuildFreshness(
            guilds.map((guild) => ({
                id: guild.id,
                name: guild.name,
                lastActivityAt: lastActivityByGuild.get(guild.id) ?? null,
            })),
            now
        );

        const counts = {
            guildsTotal: guilds.length,
            guildsActive7: guildsActive7.size,
            guildsActive30: guildsActive30.size,
            guildsNew30: guilds.filter((guild) => guild.createdAt >= thirtyDaysAgo).length,
            accountsTotal,
            profilesTotal,
            membersActive7: actors7.size,
            membersActive30: actors30.size,
            actions7,
            actions30,
        };

        // Profondeur d'usage : lignes métier créées sur la fenêtre, par guilde (10 premières).
        const guildNameById = new Map(guilds.map((guild) => [guild.id, guild.name]));
        const businessRows30 = Array.from(businessRowsByGuild.entries())
            .map(([guildId, rows]) => ({
                guildId,
                guildName: guildNameById.get(guildId) ?? "Guilde inconnue",
                rows,
            }))
            .sort((a, b) => b.rows - a.rows)
            .slice(0, 10);

        return {
            generatedAt: now.toISOString(),
            windowDays: PRODUCT_WINDOW_DAYS,
            retentionWeeks: RETENTION_WEEKS,
            minCohortSize: MIN_COHORT_SIZE,
            /** `true` = la lecture a touché son plafond : l'écran doit parler d'échantillon. */
            truncated,
            weeks,
            weekly,
            counts,
            retention,
            adoption,
            freshness,
            businessRows30,
            /**
             * Honnêteté d'échantillon : `reliable === false` interdit tout classement nominatif
             * (même règle que la queue de `splitEngagement`, cf. `src/lib/telemetry/product.ts`).
             */
            sample: {
                actions: facts.length,
                distinctActors: actorsWindow.size,
                reliable: isSampleReliable(actorsWindow.size),
            },
        };
    } catch (err) {
        logger.error("[getProductStats Error]:", err);
        throw err;
    }
}
