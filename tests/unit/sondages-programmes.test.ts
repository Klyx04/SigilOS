/**
 * Module staff **Sondages programmés** (`scheduledPolls`) — verrou du chantier.
 *
 * 🛡️ Ce que ce test protège, et pourquoi :
 * ① les **règles pures** (3 créneaux maximum, minute unique, bornes de date,
 *    durée bornée, bornes du titre) — c'est le contrat métier, il doit se casser
 *    *ici* et pas en production ;
 * ② l'**enregistrement du module** partout où il doit l'être : registre
 *    (`DEFAULT_MODULES`), verrou God (dérivé, donc plateforme **et** guilde),
 *    permission RBAC `staff:scheduled_polls` liée au module, catalogue, couverture
 *    doc, sélecteur de modules de `getUserContext` ;
 * ③ la **revendication atomique** : le passage `SCHEDULED → PUBLISHING` doit
 *    porter la garde d'état dans le `WHERE` (`count === 0` ⇒ on s'arrête) — c'est
 *    la seule chose qui empêche une double publication entre le cron et un clic
 *    « Publier maintenant » ;
 * ④ le **fail-closed** : module coupé ⇒ aucune publication, créneau conservé ;
 * ⑤ l'**embed** (tag « Sondage programmé », description multiligne, ID outbox
 *    résolu avant édition — sans quoi l'embed reste figé) ;
 * ⑥ le **cœur du squelette** : pas de `"use server"` sur le core (sinon il serait
 *    exposé au client), pas de `console.log`.
 *
 * Lecture seule, aucune base : uniquement du code source + des fonctions pures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    MAX_DURATION_HOURS,
    MAX_HORIZON_DAYS,
    MAX_SCHEDULED_POLLS,
    MIN_DURATION_HOURS,
    MIN_LEAD_MINUTES,
    SLOT_LIMIT_ERROR,
    canScheduleAnotherPoll,
    findMinuteConflict,
    isPendingStatus,
    isSameMinute,
    remainingSlots,
    resolveDurationHours,
    validateScheduledAt,
} from "@/lib/polls/scheduling";
import { POLL_TITLE_MAX_LENGTH, pollTitleLengthError } from "@/lib/polls/limits";
import { DEFAULT_MODULES } from "@/lib/module-types";
import { GOD_LOCKABLE_MODULES, resolveModuleState } from "@/lib/module-lock";
import { PERMISSIONS, PERMISSION_DETAILS, PERMISSION_GUILD_MODULES, GUILD_MODULE_LABELS } from "@/lib/permissions";
import { MODULE_GROUPS } from "@/lib/module-catalog";
import { MODULE_DOC_COVERAGE, MODULE_ROUTES } from "@/lib/docs-modules";

const SCHEDULING = "src/lib/polls/scheduling.ts";
const LIMITS = "src/lib/polls/limits.ts";
const PUBLISH = "src/server/polls/publish.ts";
const CORE = "src/server/scheduled-polls-core.ts";
const ACTIONS = "src/server/actions/scheduled-poll-actions.ts";
const CRON_ROUTE = "src/app/api/cron/publish-scheduled-polls/route.ts";
const PAGE = "src/app/dashboard/[guildId]/sondages/programmes/page.tsx";
const SETTINGS_CLIENT = "src/app/dashboard/[guildId]/admin/_components/scheduled-poll-settings-client.tsx";
const SETTINGS_PAGE = "src/app/dashboard/[guildId]/admin/settings/page.tsx";
const POLL_ACTIONS = "src/server/actions/poll-actions.ts";
const POLL_CREATOR = "src/components/sondages/poll-creator.tsx";

const source = (path: string) => readFileSync(path, "utf8");
/** Retire les commentaires : un motif interdit ne doit pas se cacher dans la prose. */
const codeOnly = (path: string) =>
    source(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("sondages programmés — règles pures", () => {
    it("plafond de créneaux en attente : 3, jamais un 4ᵉ", () => {
        expect(MAX_SCHEDULED_POLLS).toBe(3);
        expect(remainingSlots(0)).toBe(3);
        expect(remainingSlots(2)).toBe(1);
        expect(remainingSlots(3)).toBe(0);
        expect(remainingSlots(9)).toBe(0); // jamais négatif
        expect(canScheduleAnotherPoll(2)).toBe(true);
        expect(canScheduleAnotherPoll(3)).toBe(false);
        expect(SLOT_LIMIT_ERROR).toContain("3");
    });

    it("un créneau publié ou annulé ne compte plus (il libère sa place)", () => {
        expect(isPendingStatus("SCHEDULED")).toBe(true);
        expect(isPendingStatus("PUBLISHING")).toBe(true);
        expect(isPendingStatus("PUBLISHED")).toBe(false);
        expect(isPendingStatus("CANCELLED")).toBe(false);
        expect(isPendingStatus("FAILED")).toBe(false);
    });

    it("jamais deux créneaux à la même minute (seconde et fuseau indifférents)", () => {
        const taken = new Date("2026-10-20T21:30:00.000Z");
        expect(isSameMinute(taken, new Date("2026-10-20T21:30:58.000Z"))).toBe(true);
        // Deux écritures différentes du MÊME instant (UTC vs Paris) : la règle
        // compare des instants, pas des chaînes — un VPS en UTC et un navigateur
        // en Europe/Paris tombent donc d'accord sur « même minute ».
        expect(isSameMinute("2026-10-20T21:30:00.000Z", "2026-10-20T23:30:00+02:00")).toBe(true);
        expect(isSameMinute("2026-10-20T21:30:00.000Z", "2026-10-20T21:31:00.000Z")).toBe(false);
        expect(isSameMinute("pas-une-date", "2026-10-20T21:31:00.000Z")).toBe(false);
    });

    it("détecte le créneau déjà pris, et s'ignore lui-même en modification", () => {
        const slots = [{ id: "a", scheduledAt: "2026-10-20T21:30:00.000Z" }];
        expect(findMinuteConflict("2026-10-20T21:30:20.000Z", slots)?.id).toBe("a");
        expect(findMinuteConflict("2026-10-20T22:30:00.000Z", slots)).toBeNull();
        // Modification du même créneau : il ne se détecte pas lui-même.
        expect(findMinuteConflict("2026-10-20T21:30:00.000Z", slots, "a")).toBeNull();
    });

    it("bornes de programmation : au moins 5 min, au plus 30 jours", () => {
        const now = new Date("2026-10-13T12:00:00.000Z");
        expect(validateScheduledAt(new Date("2026-10-13T12:04:00.000Z"), now).ok).toBe(false);
        expect(validateScheduledAt(new Date("2026-10-13T12:05:00.000Z"), now).ok).toBe(true);
        expect(validateScheduledAt(new Date("2026-11-12T12:00:00.000Z"), now).ok).toBe(true);
        expect(validateScheduledAt(new Date("2026-11-13T12:00:00.000Z"), now).ok).toBe(false);
        expect(validateScheduledAt("pas-une-date", now).ok).toBe(false);
        expect(MIN_LEAD_MINUTES).toBe(5);
        expect(MAX_HORIZON_DAYS).toBe(30);
    });

    it("durée de vote bornée : créneau → défaut guilde → aucune (jamais hors plage)", () => {
        expect(resolveDurationHours(12, 48)).toBe(12);
        expect(resolveDurationHours(null, 48)).toBe(48);
        expect(resolveDurationHours(null, null)).toBeNull();
        expect(resolveDurationHours(0, null)).toBe(MIN_DURATION_HOURS);
        expect(resolveDurationHours(99999, null)).toBe(MAX_DURATION_HOURS);
        expect(resolveDurationHours(Number.NaN, null)).toBeNull();
    });

    it("bornes du titre : 150 caractères, partagées par tous les formulaires", () => {
        expect(POLL_TITLE_MAX_LENGTH).toBe(150);
        expect(pollTitleLengthError("ab")).not.toBeNull();
        expect(pollTitleLengthError("Existe-t-il une question assez longue pour tenir ?")).toBeNull();
        expect(pollTitleLengthError("a".repeat(151))).not.toBeNull();
        for (const path of [POLL_ACTIONS, POLL_CREATOR, ACTIONS]) {
            expect(codeOnly(path), `${path} doit utiliser la borne partagée`).toContain("POLL_TITLE_MAX_LENGTH");
        }
        // Plus aucun « 80 » figé dans un schéma de validation.
        expect(codeOnly(ACTIONS)).not.toMatch(/max\(80/);
        expect(codeOnly(POLL_ACTIONS)).not.toMatch(/max\(80/);
        expect(codeOnly(SCHEDULING)).toContain("MAX_HORIZON_DAYS");
        expect(codeOnly(LIMITS)).toContain("POLL_TITLE_MAX_LENGTH");
    });
});


describe("module enregistré partout (désactivation God globale ET par guilde, RBAC)", () => {
    it("le module existe, est OFF par défaut, et verrouillable par le God", () => {
        expect(DEFAULT_MODULES.scheduledPolls).toBe(false);
        // Dérivé du registre ⇒ un seul endroit à écrire, et `admin` reste protégé.
        expect([...GOD_LOCKABLE_MODULES]).toContain("scheduledPolls");
    });

    it("verrou plateforme (toutes les guildes) et verrou de guilde coupent l'accès", () => {
        const on = { scheduledPolls: true };
        expect(resolveModuleState("scheduledPolls", on).enabled).toBe(true);
        const platform = resolveModuleState("scheduledPolls", on, { platformLocks: ["scheduledPolls"] });
        expect(platform.enabled).toBe(false);
        expect(platform.lockedBy).toBe("platform");
        const guild = resolveModuleState("scheduledPolls", on, { guildLocks: ["scheduledPolls"] });
        expect(guild.enabled).toBe(false);
        expect(guild.lockedBy).toBe("guild");
    });

    it("une permission RBAC dédiée porte le module", () => {
        expect(PERMISSIONS.STAFF_SCHEDULED_POLLS).toBe("staff:scheduled_polls");
        expect(PERMISSION_DETAILS[PERMISSIONS.STAFF_SCHEDULED_POLLS]?.module).toBe("admin");
        expect(PERMISSION_GUILD_MODULES[PERMISSIONS.STAFF_SCHEDULED_POLLS]).toEqual(["scheduledPolls"]);
        expect(GUILD_MODULE_LABELS.scheduledPolls).toBe("Sondages programmés");
    });

    it("catalogue, documentation et sélecteur de modules de getUserContext le connaissent", () => {
        const keys = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));
        expect(keys).toContain("scheduledPolls");
        const adminGroup = MODULE_GROUPS.find((g) => g.modules.some((m) => m.key === "scheduledPolls"));
        expect(adminGroup?.label).toBe("Administration");

        const coverage = MODULE_DOC_COVERAGE.scheduledPolls;
        expect(coverage?.staff).toBe("admin-sondages-programmes");
        expect(MODULE_ROUTES["admin-sondages-programmes"]?.href).toBe("/sondages/programmes");

        // Sans lecture dans le `select` de getUserContext, le module serait
        // « activé mais invisible » (régression déjà vécue sur `marche`).
        expect(codeOnly("src/server/actions/user-actions.ts")).toMatch(/\bscheduledPolls\s*:\s*true/);
        expect(codeOnly("src/server/actions/user-actions.ts")).toContain("canSchedulePolls");
    });
});

describe("publication automatique — revendication atomique et fail-closed", () => {
    it("le moteur est un core serveur, jamais une server action exposée au client", () => {
        expect(codeOnly(CORE)).not.toContain("use server");
        // Il applique la MÊME règle de verrou que le reste de l'application.
        expect(codeOnly(CORE)).toContain("resolveModuleState");
        expect(codeOnly(CORE)).toContain("getPlatformModuleState");
    });

    it("un créneau ne peut être publié qu'une fois (garde d'état dans le WHERE)", () => {
        const core = codeOnly(CORE);
        expect(core).toContain('status: "SCHEDULED"');
        expect(core).toContain('status: "PUBLISHING"');
        expect(core).toContain("count === 0");
        // La revendication précède la publication, dans CET ordre : d'abord on
        // s'approprie le créneau (sinon on s'arrête), ensuite on publie.
        expect(core.indexOf("if (claim.count === 0) continue")).toBeLessThan(core.indexOf("await publishClaimedSlot(id, now)"));
        expect(core.indexOf("status: \"PUBLISHING\", claimedAt: now")).toBeLessThan(core.indexOf("await publishClaimedSlot(id, now)"));
    });

    it("module coupé ⇒ aucune publication, le créneau reste en attente avec la raison", () => {
        const core = codeOnly(CORE);
        expect(core).toContain("releaseClaim");
        expect(core).toContain("lastError");
        expect(core).toContain('status: "SCHEDULED"');
        expect(core).toContain('status: "FAILED"');
    });

    it("le cron est protégé, télémétré, et n'est pas mis en cache", () => {
        const route = codeOnly(CRON_ROUTE);
        expect(route).toContain("verifyCronSecret");
        expect(route).toContain('recordCronExecution("publish_scheduled_polls"');
        expect(route).toContain("force-dynamic");
    });

    it("les actions staff sont gardées, bornées et tracées", () => {
        const actions = codeOnly(ACTIONS);
        // Chaque fonction exportée qui écrit passe par la garde d'accès.
        const mutations = actions.match(/export async function (create|update|cancel|publish)\w+/g) || [];
        expect(mutations.length).toBeGreaterThanOrEqual(4);
        expect(actions.match(/requireScheduledPollsStaff/g)?.length).toBeGreaterThanOrEqual(4);
        expect(actions).toContain("rateLimit");
        expect(actions).toContain("createAuditLog");
        // Cloisonnement : la cible est comparée à la guilde résolue côté serveur.
        expect(actions).toContain("existing.guildId !== guild.id");
        expect(actions).toContain("slot.guildId !== guild.id");
    });

    it("la page staff refuse tout accès sans permission ou module actif", () => {
        const page = codeOnly(PAGE);
        expect(page).toContain("canSchedulePolls");
        expect(page).toContain('isModuleEnabled(guildId, "scheduledPolls")');
        expect(page).toContain("AccessDenied");
    });

    it("aucun console.log dans les surfaces neuves (logger uniquement)", () => {
        for (const path of [SCHEDULING, LIMITS, PUBLISH, CORE, ACTIONS, CRON_ROUTE, PAGE, SETTINGS_CLIENT]) {
            expect(codeOnly(path), path).not.toContain("console.log");
        }
    });
});

describe("embed Discord — tag, description propre et pourcentages à jour", () => {
    it("porte le tag « Sondage programmé » (description ET métadonnées)", () => {
        const publish = codeOnly(PUBLISH);
        const occurrences = publish.match(/SCHEDULED_POLL_TAG/g) || [];
        expect(occurrences.length).toBeGreaterThanOrEqual(2);
        expect(publish).toContain("isScheduled");
    });

    it("rend la description en citation multiligne, bornée et honnête", () => {
        const publish = codeOnly(PUBLISH);
        expect(publish).toContain("embedDescriptionBlock");
        expect(publish).toContain("POLL_EMBED_DESCRIPTION_MAX_LENGTH");
        // Chaque ligne devient une ligne de citation : l'italique d'une seule ligne
        // (l'ancien rendu) écrasait les retours à la ligne.
        expect(publish).toMatch(/\$\{line\}|\`> \\\$\{line\}|> \$\{/);
        expect(publish).not.toContain("> *${poll.description}*");
    });

    it("résout l'ID outbox avant d'éditer (sinon l'embed reste figé : « les % ne s'affichent pas »)", () => {
        const publish = codeOnly(PUBLISH);
        expect(publish).toContain("storeMessageIdKey");
        expect(publish).toContain("pollMessageKey");
        expect(publish).toContain("isOutboxMessageId");
        // Édition uniquement avec un vrai snowflake, puis ancrage de l'ID définitif.
        expect(publish).toContain("resolvePollMessageId");
    });

    it("le vote rafraîchit bien l'embed publié (barres de pourcentage)", () => {
        const actions = codeOnly(POLL_ACTIONS);
        expect(actions).toContain("publishPollToDiscord");
        expect(actions).toMatch(/isUpdate|true \/\/ Is update|true,/);
    });
});

describe("encart de paramètres (2ᵉ carte de l'onglet Sondages)", () => {
    it("est monté sous la carte des sondages classiques", () => {
        const page = codeOnly(SETTINGS_PAGE);
        expect(page).toContain("PollSettingsClient");
        expect(page).toContain("ScheduledPollSettingsClient");
        expect(page.indexOf("PollSettingsClient")).toBeLessThan(page.indexOf("ScheduledPollSettingsClient"));
    });

    it("enregistre le salon, la whitelist de ping et la durée par défaut", () => {
        const client = codeOnly(SETTINGS_CLIENT);
        expect(client).toContain("DiscordChannelPicker");
        expect(client).toContain("PingRolesSelector");
        expect(client).toContain('updateAllowedPingRolesAction(guildId, pingRoleIds, "scheduledPolls")');
        expect(client).toContain("updateScheduledPollSettings");
        expect(client).toContain("POLL_SLOT_COUNTER");
    });
});

