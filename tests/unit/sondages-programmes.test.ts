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
    MAX_REPEAT_EVERY,
    MAX_REPEAT_UNTIL_DAYS,
    MAX_SCHEDULED_POLLS,
    MIN_DURATION_HOURS,
    MIN_LEAD_MINUTES,
    REPEAT_EVERY_ERROR,
    REPEAT_UNTIL_ERROR,
    SLOT_LIMIT_ERROR,
    canScheduleAnotherPoll,
    findMinuteConflict,
    isPendingStatus,
    isSameMinute,
    nextOccurrence,
    remainingSlots,
    repeatLabel,
    repeatOccurrences,
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
const PAGE = "src/app/dashboard/[guildId]/admin/sondages-programmes/page.tsx";
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
        expect(MODULE_ROUTES["admin-sondages-programmes"]?.href).toBe("/admin/sondages-programmes");

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


describe("placement — module STAFF, dans le Centre de contrôle (jamais dans la sidebar)", () => {
    const SIDEBAR = "src/components/layout/app-sidebar.tsx";
    const ADMIN_PAGE = "src/app/dashboard/[guildId]/admin/page.tsx";
    const ADMIN_STAFF_PAGE = "src/app/dashboard/[guildId]/admin/sondages-programmes/page.tsx";

    it("aucune entrée de navigation pour le module (il n'est pas un onglet membre)", () => {
        const sidebar = codeOnly(SIDEBAR);
        expect(sidebar).not.toContain("sondages/programmes");
        expect(sidebar).not.toContain("Sondages programmés");
        // … mais son URL reste une **alias** du bouton « Staff » (surbrillance correcte).
        expect(sidebar).toContain("/admin/sondages-programmes");
    });

    it("la permission du module ouvre le bouton « Staff » de la sidebar", () => {
        const sidebar = codeOnly(SIDEBAR);
        expect(sidebar).toMatch(/hasAnyAdminPermission = [\s\S]{0,400}user\.canSchedulePolls/);
        expect(sidebar).toContain('visible: hasAnyAdminPermission');
    });

    it("la carte du module est dans le Centre de contrôle, derrière sa permission", () => {
        const admin = codeOnly(ADMIN_PAGE);
        expect(admin).toContain("/admin/sondages-programmes");
        expect(admin).toContain('title: "Sondages programmés"');
        expect(admin).toContain("permission: (u) => u.canSchedulePolls");
        expect(admin).toContain('modules: "scheduledPolls"');
    });

    it("la carte « Gestion des Modules » ne double plus : elle vit dans Pilotage → Modules", () => {
        const admin = codeOnly(ADMIN_PAGE);
        expect(admin).not.toContain("Gestion des Modules");
        expect(admin).not.toContain("/admin/modules");
        // La surface de pilotage reste la seule à porter les toggles.
        const pilotage = codeOnly("src/app/dashboard/[guildId]/admin/pilotage/page.tsx");
        expect(pilotage).toContain("ModulesClient");
    });

    it("les réglages du module vivent dans Paramètres → Sondages, et nulle part ailleurs", () => {
        const page = codeOnly(ADMIN_STAFF_PAGE);
        expect(page).toContain("canSchedulePolls");
        expect(page).toContain('isModuleEnabled(guildId, "scheduledPolls")');
        // Plus aucun encart de réglages sur la page du module (un seul écran par réglage).
        expect(page).not.toContain("ScheduledPollSettingsClient");
        // … et le compteur de places reste porté par le tableau (rien n'est perdu).
        expect(codeOnly("src/components/sondages/programmes/scheduled-poll-board.tsx")).toContain("{board.pendingCount}/{board.maxSlots}");

        // Le rôle staff ouvre l'onglet Sondages SANS `system:config` (mesure : sinon il
        // n'avait aucun accès à ses propres réglages)…
        const settings = codeOnly(SETTINGS_PAGE);
        expect(settings).toContain("const staffOnlySondages = !user.canViewSettings && user.canSchedulePolls;");
        expect(settings).toContain('item.id === "sondages"');
        // … et le réglage des sondages CLASSIQUES reste gouverné par `system:config`.
        expect(settings).toContain("{user.canViewSettings && <PollSettingsClient guildId={guildId} />}");

        const actions = codeOnly(ACTIONS);
        // Les réglages restent éditables par le rôle du module, depuis Paramètres.
        expect(actions).toContain("requireScheduledPollSettingsAccess");
        expect(actions).toMatch(/requireGuildConfigAccess\(discordGuildId, context\)[\s\S]{0,400}if \(staff\.ok\) return \{ ok: true \}/);
    });

    it("le salon n'est plus un champ du créneau (ni modale, ni API)", () => {
        const form = codeOnly("src/components/sondages/programmes/scheduled-poll-form.tsx");
        expect(form).not.toContain("DiscordChannelPicker");
        expect(form).not.toContain("Salon Discord de publication");
        // La modale dit où le créneau partira, et prévient si rien n'est réglé.
        expect(form).toContain("Paramètres → Sondages");

        const actions = codeOnly(ACTIONS);
        expect(actions).not.toContain("discordChannelId: z.string()");
        expect(actions).not.toContain("checked.channelId");
        // Le créneau ne porte plus de salon : la publication suit la guilde.
        expect(actions).toContain("discordChannelId: null");
    });
});


describe("récurrence — « tous les N jours / semaines / mois »", () => {
    const FORM = "src/components/sondages/programmes/scheduled-poll-form.tsx";
    const BOARD = "src/components/sondages/programmes/scheduled-poll-board.tsx";

    it("avance d'un cran dans chaque unité en gardant l'HEURE LOCALE (DST comprise)", () => {
        // Heure locale (jamais UTC) : « chaque dimanche 21 h » doit rester 21 h
        // même après un changement d'heure — d'où des attentes en composantes
        // locales, indépendantes du fuseau de la machine de test.
        const base = new Date(2026, 9, 20, 21, 30);
        const plus3j = nextOccurrence(base, 3, "DAYS");
        expect([plus3j.getFullYear(), plus3j.getMonth(), plus3j.getDate(), plus3j.getHours(), plus3j.getMinutes()])
            .toEqual([2026, 9, 23, 21, 30]);

        const plus2s = nextOccurrence(base, 2, "WEEKS");
        expect([plus2s.getMonth(), plus2s.getDate(), plus2s.getHours(), plus2s.getMinutes()])
            .toEqual([10, 3, 21, 30]);

        // 20 octobre → 20 novembre traverse le changement d'heure : l'heure
        // locale ne bouge pas (21 h 30 les deux fois).
        const plus1m = nextOccurrence(base, 1, "MONTHS");
        expect([plus1m.getMonth(), plus1m.getDate(), plus1m.getHours(), plus1m.getMinutes()])
            .toEqual([10, 20, 21, 30]);
    });

    it("plafonne au dernier jour du mois (31 janvier + 1 mois ≠ 3 mars)", () => {
        const jan31 = new Date(2026, 0, 31, 10, 0);
        const feb = nextOccurrence(jan31, 1, "MONTHS");
        expect([feb.getFullYear(), feb.getMonth(), feb.getDate(), feb.getHours()])
            .toEqual([2026, 1, 28, 10]);

        // 2028 est bissextile : on garde bien le 29.
        const febLeap = nextOccurrence(new Date(2028, 0, 31, 10, 0), 1, "MONTHS");
        expect([febLeap.getFullYear(), febLeap.getMonth(), febLeap.getDate()]).toEqual([2028, 1, 29]);

        // Décembre → janvier de l'année suivante.
        const jan = nextOccurrence(new Date(2026, 11, 15, 8, 0), 1, "MONTHS");
        expect([jan.getFullYear(), jan.getMonth(), jan.getDate(), jan.getHours()]).toEqual([2027, 0, 15, 8]);
    });

    it("libellé FR juste (singulier/pluriel, jours/semaines/mois)", () => {
        expect(repeatLabel({ every: 1, unit: "DAYS" })).toBe("chaque jour");
        expect(repeatLabel({ every: 1, unit: "WEEKS" })).toBe("chaque semaine");
        expect(repeatLabel({ every: 1, unit: "MONTHS" })).toBe("chaque mois");
        expect(repeatLabel({ every: 2, unit: "WEEKS" })).toBe("toutes les 2 semaines");
        expect(repeatLabel({ every: 3, unit: "MONTHS" })).toBe("tous les 3 mois");
        expect(repeatLabel({ every: 15, unit: "DAYS" })).toBe("tous les 15 jours");
        expect(repeatLabel({ every: null, unit: null })).toBeNull();
        expect(repeatLabel({ every: 2, unit: null })).toBeNull();
    });

    it("aperçu borné par la fin choisie, et sans fin quand il n'y en a pas", () => {
        const from = new Date(2026, 9, 20, 21, 30);
        const sansFin = repeatOccurrences({ from, every: 7, unit: "DAYS" }, 3);
        expect(sansFin.map((d) => [d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()])).toEqual([
            [9, 27, 21, 30],
            [10, 3, 21, 30],
            [10, 10, 21, 30],
        ]);
        const avecFin = repeatOccurrences({ from, every: 7, unit: "DAYS", until: new Date(2026, 10, 1) }, 5);
        expect(avecFin.map((d) => [d.getMonth(), d.getDate()])).toEqual([[9, 27]]);
        // Une fin antérieure à la première occurrence ⇒ aucune suivante.
        expect(repeatOccurrences({ from, every: 1, unit: "DAYS", until: new Date(2026, 8, 1) })).toEqual([]);
    });

    it("bornes : intervalle 1..90, fin ≤ 365 jours", () => {
        expect(MAX_REPEAT_EVERY).toBe(90);
        expect(MAX_REPEAT_UNTIL_DAYS).toBe(365);
        expect(REPEAT_EVERY_ERROR).toContain("90");
        expect(REPEAT_UNTIL_ERROR).toContain("365");
    });

    it("le moteur repose la suivante APRÈS avoir publié (une seule à la fois)", () => {
        const core = codeOnly(CORE);
        expect(core).toContain("nextOccurrence");
        expect(core).toContain("scheduledPoll.create");
        expect(core.indexOf("publishPollToDiscord")).toBeLessThan(core.indexOf("Occurrence suivante programmée"));
        expect(core).toContain("let nextScheduledAt: Date | null = null");
    });

    it("la modale propose l'option et l'explique (aperçu), le tableau la rappelle", () => {
        const form = codeOnly(FORM);
        expect(form).toContain("repeatOccurrences");
        expect(form).toContain("repeatLabel");
        expect(form).toContain("Aucune (créneau unique)");
        expect(form).toContain("Prochaines publications");
        expect(codeOnly(BOARD)).toContain("repeatLabel");
    });

    it("la répétition est bornée côté serveur (Zod + contrôle applicatif)", () => {
        const actions = codeOnly(ACTIONS);
        expect(actions).toContain("MAX_REPEAT_EVERY");
        expect(actions).toMatch(/repeatEvery: z\.number\(\)\.int\(\)\.min\(1\)\.max\(MAX_REPEAT_EVERY\)/);
        expect(actions).toContain('z.enum(["DAYS", "WEEKS", "MONTHS"])');
        expect(actions).toContain("Répétition incomplète");
    });
});

describe("emoji & harmonie des deux modales", () => {
    const TILES = "src/components/sondages/poll-category-tiles.tsx";
    const FORM = "src/components/sondages/programmes/scheduled-poll-form.tsx";

    it("un composant UNIQUE de tuiles sert les deux modales (zéro duplication)", () => {
        const tiles = codeOnly(TILES);
        expect(tiles).toContain("export function PollCategoryTiles");
        expect(tiles).toContain("grid-cols-3 sm:grid-cols-5");
        expect(codeOnly(POLL_CREATOR)).toContain("PollCategoryTiles");
        expect(codeOnly(FORM)).toContain("PollCategoryTiles");
    });

    it("la description accepte des emojis (picker partagé, insertion au curseur) — les deux modales", () => {
        for (const path of [POLL_CREATOR, FORM]) {
            const source = codeOnly(path);
            expect(source, path).toContain("@/components/editor/emoji-picker");
            expect(source, path).toContain("insertEmoji");
            expect(source, path).toContain("selectionStart");
            expect(source, path).toContain("requestAnimationFrame");
        }
    });

    it("les choix portent aussi un emoji dans la modale staff (juste milieu demandé)", () => {
        const form = codeOnly(FORM);
        expect(form).toContain("EmojiPicker");
        expect(form).toMatch(/emoji: string/);
    });
});

