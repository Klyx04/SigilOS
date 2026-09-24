/**
 * 🎫 Tickets v2 — **gardes de runtime** (lecture seule du source, aucun import exécuté).
 *
 * Ces tests verrouillent les correctifs P0/P1 de l'audit du 24/09/2026 **là où ils
 * vivent** (route d'interactions, handlers internes, route de transcript, service
 * d'archive). Ils sont volontairement statiques : ils ne peuvent pas devenir une
 * surface d'attaque ni un test instable, et ils échouent **bruyamment** si un fichier
 * est renommé ou si un motif disparaît.
 *
 * Si l'un de ces tests casse, la fuite ou le bug correspondant est revenu :
 *   · P0-1 la note interne republiée dans le salon du demandeur ;
 *   · P0-2 aucune vérification de guilde/rôle/identité dans les handlers Discord ;
 *   · P0-4 le CSAT ouvert à un tiers (et le 500 en message privé) ;
 *   · P1-1 l'archive tronquée à 100 messages présentée comme complète ;
 *   · P1-3 les notes internes dans le document partageable ;
 *   · N-2 l'annexe interne servie par un simple jeton public.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE = "src/app/api/discord/interactions/route.ts";
const ACTIONS = "src/server/actions/ticket-bot-actions.ts";
const TRANSCRIPT_ROUTE = "src/app/api/tickets/transcript/[secretToken]/route.ts";
const ARCHIVE = "src/server/tickets/archive.ts";
const ACTOR = "src/lib/tickets/interaction-actor.ts";
const PANELS_TAB = "src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-panels-tab.tsx";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Retire les commentaires : on vérifie le **code**, pas la prose qui cite le bug. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Corps d'une fonction, du `function <nom>` (exportée ou non) à l'accolade fermante. */
function functionBody(source: string, name: string): string {
    const start = source.indexOf(`function ${name}`);
    if (start === -1) return "";
    const end = source.indexOf("\n}\n", start);
    return end === -1 ? source.slice(start) : source.slice(start, end + 3);
}

describe("tickets v2 — la route normalise l'acteur (bug CSAT en MP)", () => {
    it("lit l'actor via le helper au lieu de `member` en aveugle", () => {
        const code = codeOnly(read(ROUTE));
        expect(code).toContain("resolveInteractionActor(payload");
        expect((code.match(/resolveInteractionActor\(/g) || []).length).toBeGreaterThanOrEqual(2);
        expect((code.match(/payload\.member \?\?/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    it("ne déstructure plus `member` du payload sans repli", () => {
        const code = codeOnly(read(ROUTE));
        expect(code).not.toContain("const { member, guild_id } = payload;");
    });

    it("construit le contexte d'autorisation serveur (rôles, rang, `staff:tickets`)", () => {
        const code = codeOnly(read(ROUTE));
        expect(code).toContain("discordUserRoleIds: actor.roleIds");
        expect(code).toContain("discordUserIsAdmin: actor.isGuildAdmin");
        expect(code).toContain("PERMISSION_IDS.STAFF_TICKETS");
        expect(code).toContain("actor: ticketActorContext");
        expect(code).toContain("actor: modalTicketActorContext");
    });
});

describe("tickets v2 — les handlers Discord passent par le gate d'accès", () => {
    it("le helper `guardTicketAction` vérifie guilde, rôle et identité", () => {
        const source = read(ACTIONS);
        expect(source).toContain("async function guardTicketAction");
        const guard = functionBody(source, "guardTicketAction");
        expect(guard, "le gate doit exister").not.toBe("");
        expect(guard).toContain("ticket.discordGuildId !== input.discordGuildId");
        expect(guard).toContain("mergeStaffRoleIds(");
        expect(guard).toContain("decideTicketAccess(");
        expect(guard).toContain('closePolicy: ticket.journey?.closePolicy ?? "STAFF_ONLY"');
    });

    it("claim, note, fermeture, renommage et CSAT appellent le gate", () => {
        const source = read(ACTIONS);
        const guarded: Array<[string, string]> = [
            ["internalHandleTicketClaim", 'access: "staff"'],
            ["internalHandleTicketAddNote", 'access: "staff"'],
            ["internalHandleTicketRename", 'access: "staff"'],
            ["internalHandleTicketClose", 'access: "staff_or_creator"'],
        ];

        for (const [name, access] of guarded) {
            const body = functionBody(source, name);
            expect(body, `handler introuvable : ${name}`).not.toBe("");
            expect(body, `${name} ne passe pas par le gate`).toContain("guardTicketAction({");
            expect(body, `${name} n'applique pas le niveau ${access}`).toContain(access);
        }

        const csat = functionBody(source, "internalHandleTicketCsat");
        expect(csat).toContain("ticket.creatorDiscordId !== params.discordUserId");
        expect(csat).toContain('ticket.status !== "CLOSED"');
    });

    it("🔒 la note interne n'est plus publiée dans le salon du demandeur", () => {
        const note = codeOnly(functionBody(read(ACTIONS), "internalHandleTicketAddNote"));
        expect(note).not.toContain("fetchWithRetry(");
        expect(note).not.toContain("Note Interne Staff");
        expect(note).toContain("staff uniquement");
    });

    it("plus aucun appel à l'action dashboard depuis les interactions Discord", () => {
        const rename = codeOnly(functionBody(read(ACTIONS), "internalHandleTicketRename"));
        expect(rename).toContain("renameChannelDiscord(");
        expect(rename).toContain("if (!renamed.success)");
    });
});

describe("tickets v2 — archive honnête et jeton non public", () => {
    it("l'archive est paginée et sépare les deux documents", () => {
        const archive = codeOnly(read(ARCHIVE));
        expect(archive).toContain("fetchChannelMessagesPagedDiscord(");
        expect(archive).toContain('kind: "SHAREABLE"');
        expect(archive).toContain('kind: "INTERNAL"');
        expect(archive).toContain("shouldIncludeNotes(");
        expect(archive).toContain("computeExpiry(");
        expect(archive).toMatch(/generateHtmlTranscript\(\s*meta,\s*conversation\s*\)/);
    });

    it("la fermeture n'utilise plus la capture bornée à 100 messages", () => {
        const actions = codeOnly(read(ACTIONS));
        expect(actions).not.toContain("fetchChannelMessagesDiscord(");
        expect((actions.match(/captureTicketArchives\(/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    it("une capture impossible se dit, elle ne bloque pas la fermeture", () => {
        const archive = codeOnly(read(ARCHIVE));
        expect(archive).toContain("Archives désactivées pour cette guilde.");
        expect(archive).toContain("Aucun salon Discord à archiver.");
        expect(archive).toContain("errors.push(");
    });

    it("N-2 : l'annexe interne est refusée sur la route publique à jeton", () => {
        const route = codeOnly(read(TRANSCRIPT_ROUTE));
        expect(route).toContain('transcript.kind === "INTERNAL"');
        expect(route).toContain("evaluateArchiveAccess(");
        expect(route).toContain('"Cache-Control": "no-store"');
        expect(route).toMatch(/generateHtmlTranscript\([\s\S]{0,1500}?\[\]\s*\)/);
    });
});

describe("tickets v2 — le branchement Discord de l'ouverture (parcours réels)", () => {
    it("la route implémente les quatre branches du tunnel (`pick`, `open`, `modal_open`, `modal_page`)", () => {
        const code = codeOnly(read(ROUTE));
        expect(code).toContain("prefix === TICKET_PICK_PREFIX");
        expect(code).toContain('descriptor.kind !== "pick"');
        expect(code).toContain('descriptor.kind !== "modal_page"');
        expect(code).toContain("await ticketJourneyInteraction(");
        // La résolution des `custom_id` passe par le routeur (fail-closed), jamais par un split.
        expect(code).toContain("parseTicketCustomId(custom_id)");
        expect(code).toContain('action === "open" || action === "select_journey"');
    });

    it("un parcours prend la main et retombe sur une catégorie v1 seulement s'il n'existe pas", () => {
        const code = codeOnly(read(ROUTE));
        expect(code).toContain('if (result.code === "NOT_FOUND") return { handled: false };');
        // La catégorie v1 est relue **dans la guilde** (aucun identifiant venu d'ailleurs).
        expect(code).toContain("guild: { discordGuildId: guild_id }");
    });

    it("la création est revalidée puis écrite avec `journeyId` et la version figée du formulaire", () => {
        const actions = codeOnly(read(ACTIONS));
        expect(actions).toContain("async function createTicketFromJourney");
        expect(actions).toContain("await clearTicketDraft(");
        expect(actions).toContain("journeyId: journey.id,");
        expect(actions).toContain("formVersionId,");
        expect(actions).toContain("const verdict = evaluateAnswers(form, params.intakeAnswers);");
        expect(actions).toContain("if (!verdict.ok)");

        const create = functionBody(actions, "createTicketFromJourney");
        expect(create, "le nom du salon vient du parcours").toContain("formatTicketChannelName(");
        expect(create).toContain("buildTicketWelcomeEmbed(");
        expect(create).toContain("buildActionRows(");
        // Invariant #1 : le demandeur ne reçoit jamais les boutons de staff.
        expect(create).toContain("viewerIsStaff: false");
        // Ping : seuls les rôles choisis, jamais `@everyone`, et un `allowed_mentions` explicite.
        expect(create).toContain("resolveTicketNotifyRoleIds(");
        expect(actions).toContain("buildTicketNotifyContent(");
        expect(actions).toContain("allowed_mentions:");
    });

    it("« Publier » un parcours a un effet observable : le déploiement lit `isPublished`", () => {
        const actions = codeOnly(read(ACTIONS));
        const deploy = functionBody(actions, "deployTicketPanelAction");
        expect(deploy, "les parcours publiés sont exposés").toContain("isPublished: true");
        expect(deploy).toContain('targetKey: "journey"');
        expect(deploy, "les panneaux existants gardent leurs catégories").toContain('targetKey: "category"');
        expect(deploy).toContain("buildPanelRows(");

        const panels = codeOnly(read(PANELS_TAB));
        expect(panels).toContain("journeyIds: selectedJourneyIds");
        expect(panels).toContain("panel.journeyIds");
    });
});

describe("tickets v2 — l'acteur est normalisé (MP et salon)", () => {
    it("le helper lit `member` ou `user` et refuse un identifiant absent", () => {
        const actor = codeOnly(read(ACTOR));
        expect(actor).toContain("payload.member ?? null");
        expect(actor).toContain("member?.user ?? payload.user ?? null");
        expect(actor).toContain('source: discordGuildId ? "guild" : "dm"');
        expect(actor).toContain("DISCORD_ADMINISTRATOR_BIT");
    });
});
