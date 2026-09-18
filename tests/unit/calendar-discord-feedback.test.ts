/**
 * Constat beta du 18/09/2026 — événements raid du calendrier :
 *  - un clic **réussi** répondait un ACK muet Discord (`type: 6`) : ni « bien inscrit »,
 *    ni compteur — seuls les refus parlaient (« Déjà inscrit », « Doucement ! ») ;
 *  - « S'inscrire » puis « Se désinscrire » partageaient la **même** fenêtre anti-spam
 *    (`userId:eventId`), armée **avant** les gardes ⇒ « Patiente quelques secondes avant
 *    d'annuler » juste après une inscription ;
 *  - l'embed n'était rafraîchi qu'en tâche de fond (`.catch()` non attendu) : le compteur
 *    et les pseudos restaient périmés alors que les joueurs étaient bien enregistrés.
 *
 * Ces tests verrouillent les trois corrections : message éphémère **explicite** (fonction
 * pure), anti-spam **par action**, et rafraîchissement d'embed **attendu**.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    CALENDAR_EMBED_WARNING,
    buildCalendarInteractionFeedback,
    type CalendarRegistrationOutcome,
} from "@/lib/calendar-interaction-feedback";

const ROUTE = "src/app/api/discord/interactions/route.ts";
const SERVICE = "src/server/calendar-service.ts";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ROUTE_CODE = codeOnly(readFileSync(ROUTE, "utf8"));
const SERVICE_CODE = codeOnly(readFileSync(SERVICE, "utf8"));

/**
 * Corps d'une fonction exportée du service : du `export async function <nom>`
 * jusqu'au prochain `export`. Permet de verrouiller UN parcours précis sans
 * compter les appels des autres appelants (ex: le menu classe Discord).
 */
function serviceFunction(name: string): string {
    const start = SERVICE_CODE.indexOf(`export async function ${name}`);
    expect(start, `fonction \`${name}\` introuvable dans le service`).toBeGreaterThan(-1);
    const next = SERVICE_CODE.indexOf("\nexport ", start + 1);
    return SERVICE_CODE.slice(start, next === -1 ? undefined : next);
}

/** Corps de la branche `calendar` (boutons d'inscription) de la route. */
function calendarBranch(): string {
    const start = ROUTE_CODE.indexOf('if (prefix === "calendar")');
    expect(start, "branche `calendar` introuvable dans la route").toBeGreaterThan(-1);
    const end = ROUTE_CODE.indexOf('} else if (prefix === "songes")', start);
    return ROUTE_CODE.slice(start, end === -1 ? undefined : end);
}

describe("Calendar — messages éphémères du cliqueur", () => {
    it("inscription validée : annonce explicite + compteur de l'embed", () => {
        const content = buildCalendarInteractionFeedback("join", {
            success: true,
            isReserve: false,
            registeredCount: 4,
            maxParticipants: 8,
            embedStatus: "synced",
        });
        expect(content).toContain("Bien inscrit");
        expect(content).toContain("4/8 places");
        expect(content).not.toContain(CALENDAR_EMBED_WARNING);
    });

    it("inscription en file d'attente : rappel des Kamas Violets, jamais un refus", () => {
        const content = buildCalendarInteractionFeedback("join", {
            success: true,
            isReserve: true,
            reserveMessage: "Tes Kamas Violets ne seront pas déduits si tu ne participes pas au raid.",
            registeredCount: 8,
            maxParticipants: 8,
            reserveCount: 1,
        });
        expect(content).toContain("File d'attente");
        expect(content).not.toContain("❌");
    });

    it("« déjà inscrit » est une information (ℹ️), pas une erreur (❌)", () => {
        const base: CalendarRegistrationOutcome = {
            success: false,
            error: "Déjà inscrit",
            alreadyRegistered: true,
            registeredCount: 3,
            maxParticipants: 8,
        };
        const registered = buildCalendarInteractionFeedback("join", base);
        expect(registered.startsWith("ℹ️")).toBe(true);
        expect(registered).not.toContain("❌");
        expect(registered).toContain("3/8 places");

        const reserve = buildCalendarInteractionFeedback("join", { ...base, isReserve: true });
        expect(reserve).toContain("déjà en file d'attente");
    });

    it("désinscription : compteur + promotion éventuelle du 1er de la file", () => {
        const content = buildCalendarInteractionFeedback("leave", {
            success: true,
            promoted: true,
            registeredCount: 2,
            maxParticipants: 8,
            embedStatus: "synced",
        });
        expect(content).toContain("Désinscrit");
        expect(content).toContain("2/8 places");
        expect(content).toContain("promu");
    });

    it("« non inscrit » se dit calmement (ℹ️) au lieu d'une erreur", () => {
        const content = buildCalendarInteractionFeedback("leave", {
            success: false,
            error: "Non inscrit",
            notRegistered: true,
        });
        expect(content.startsWith("ℹ️")).toBe(true);
        expect(content).not.toContain("❌");
    });

    it("un refus métier garde son message ❌ (kamas, permissions…)", () => {
        const content = buildCalendarInteractionFeedback("join", {
            success: false,
            error: "Permission requise: Participation aux Raids",
        });
        expect(content).toBe("❌ Permission requise: Participation aux Raids");
    });

    it("avertit quand l'embed n'a pas suivi, jamais sur un défer (PATCH encore en vol)", () => {
        expect(buildCalendarInteractionFeedback("join", { success: true, embedStatus: "failed" }))
            .toContain(CALENDAR_EMBED_WARNING);
        expect(buildCalendarInteractionFeedback("join", { success: true, embedStatus: "skipped" }))
            .toContain(CALENDAR_EMBED_WARNING);
        expect(buildCalendarInteractionFeedback("join", { success: true, embedStatus: "deferred" }))
            .not.toContain(CALENDAR_EMBED_WARNING);
        expect(buildCalendarInteractionFeedback("join", { success: true }))
            .not.toContain(CALENDAR_EMBED_WARNING);
    });
});

describe("Route Discord — boutons du calendrier (non-régression du constat)", () => {
    it("n'utilise plus d'ACK muet `type: 6` comme réponse", () => {
        expect(ROUTE_CODE, "un défer non résolu ne doit plus servir de réponse").not.toMatch(
            /return NextResponse\.json\(\{\s*type:\s*6\s*\}\)/
        );
    });

    it("répond un éphémère construit par la fonction pure", () => {
        const branch = calendarBranch();
        expect(branch).toMatch(/processRegistration\(guild_id, entityId, account!\.userId\)/);
        expect(branch).toMatch(/processUnregistration\(guild_id, entityId, account!\.userId\)/);
        expect(branch).toMatch(/ephemeralDiscordMessage\(buildCalendarInteractionFeedback\(action, outcome\)\)/);
    });
});

describe("Service calendrier — anti-spam et rafraîchissement de l'embed", () => {
    it("indexe la fenêtre anti-spam par **action** (join ≠ leave)", () => {
        expect(SERVICE_CODE).toMatch(/return `\$\{action\}:\$\{userId\}:\$\{eventId\}`;/);
        expect(SERVICE_CODE, "l'ancienne clé partagée join/leave ne doit plus exister").not.toMatch(
            /interactionCooldowns\.set\(`\$\{userId\}:\$\{eventId\}/
        );
        expect(SERVICE_CODE).toMatch(/armCooldown\(userId, eventId, "join"\)/);
        expect(SERVICE_CODE).toMatch(/armCooldown\(userId, eventId, "leave"\)/);
    });

    it("**attend** le PATCH de l'embed avant de rendre l'issue (join ET leave)", () => {
        // Portée limitée aux deux parcours d'inscription : le menu classe Discord
        // (`updateRegistrationClass`) attend lui aussi son PATCH, mais ce n'est pas
        // ce que ce test verrouille.
        expect(serviceFunction("processRegistration"), "l'inscription doit attendre le PATCH").toMatch(
            /await refreshEmbedWithinDeadline\(guildId, eventId\)/
        );
        expect(serviceFunction("processUnregistration"), "la désinscription doit attendre le PATCH").toMatch(
            /await refreshEmbedWithinDeadline\(guildId, eventId\)/
        );
        expect(SERVICE_CODE, "plus de rafraîchissement d'embed lancé à l'aveugle").not.toMatch(
            /updateDiscordEventEmbed\(guildId, eventId\)\.catch/
        );
    });

    it("borne l'attente du PATCH pour ne jamais expirer l'interaction (> 3 s)", () => {
        expect(SERVICE_CODE).toMatch(/EMBED_SYNC_DEADLINE_MS = 1500/);
        expect(SERVICE_CODE).toMatch(/Promise\.race\(\[refreshDiscordEventEmbed\(guildId, eventId\), deadline\]\)/);
    });
});
