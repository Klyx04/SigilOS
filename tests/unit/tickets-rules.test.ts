/**
 * 🎫 Tickets v2 — gardes du **routage d'interaction**, de l'**accès**, de la
 * **politique d'archive** et des **messages Discord**.
 *
 * Le test le plus important de ce fichier : `buildActionRows` et `decideTicketAccess`
 * privent le **demandeur** des boutons et des actions de staff. C'était le trou de
 * l'audit du 24/09/2026 (`tb` absent de `DISCORD_PERM_MAP` ⇒ aucun contrôle, et les
 * 4 boutons servis dans le salon du demandeur). Si ce test casse, la fuite est revenue.
 */

import { describe, it, expect } from "vitest";
import {
    TICKET_ACTION_LABELS,
    isTicketCustomId,
    parseTicketCustomId,
    resolveTicketAccessLevel,
    type TicketActionKind,
} from "@/lib/tickets/interaction-routing";
import { decideTicketAccess, isTicketStaff, mergeStaffRoleIds } from "@/lib/tickets/access";
import {
    buildArchivePlan,
    computeDraftExpiry,
    computeExpiry,
    evaluateArchiveAccess,
    evaluateCompleteness,
    isDraftExpired,
    shouldCaptureTranscript,
    shouldIncludeNotes,
} from "@/lib/tickets/archive-policy";
import {
    buildActionRows,
    buildApprovalRows,
    buildCsatRows,
    buildPanelRows,
    buildTicketWelcomeEmbed,
    formatTicketChannelName,
    neutralizeMentions,
    parseEmbedColor,
} from "@/lib/tickets/embeds";
import { parseTicketForm, TICKET_FORM_SCHEMA_VERSION } from "@/lib/tickets/form-schema";


describe("tickets v2 — routage des interactions", () => {
    it("reconnaît chaque action du module (table exhaustive, aucune oubliée)", () => {
        const canonical: Record<TicketActionKind, string> = {
            open: "tb:open:panel1:journey1",
            select_open: "tb:select_open:panel1",
            select_journey: "tb:select_journey:panel1",
            modal_open: "tb:modal_open:panel1:journey1",
            modal_page: "tb:modal_page:journey1:1",
            pick: "tb_pick:journey1:reglement:yes",
            claim: "tb:claim:ticket1",
            release: "tb:release:ticket1",
            note: "tb:note:ticket1",
            rename: "tb:rename:ticket1",
            close: "tb:close:ticket1",
            reopen: "tb:reopen:ticket1",
            csat: "tb:csat:ticket1:5",
            approve: "tb:approve:ticket1",
            refuse: "tb:refuse:ticket1",
        };

        for (const [kind, customId] of Object.entries(canonical) as Array<[TicketActionKind, string]>) {
            const parsed = parseTicketCustomId(customId);
            expect(parsed?.kind, `action non reconnue : ${customId}`).toBe(kind);
            expect(TICKET_ACTION_LABELS[kind], `libellé manquant : ${kind}`).toBeTruthy();
        }
    });

    it("applique le bon niveau d'accès par action", () => {
        expect(resolveTicketAccessLevel("tb:open:panel1:target1")).toBe("public");
        expect(resolveTicketAccessLevel("tb:modal_open:panel1:target1")).toBe("public");
        expect(resolveTicketAccessLevel("tb:modal_page:journey1:2")).toBe("public");
        expect(resolveTicketAccessLevel("tb_pick:journey1:reglement:no")).toBe("public");
        expect(resolveTicketAccessLevel("tb:claim:ticket1")).toBe("staff");
        expect(resolveTicketAccessLevel("tb:note:ticket1")).toBe("staff");
        expect(resolveTicketAccessLevel("tb:csat:ticket1:3")).toBe("creator");
        expect(resolveTicketAccessLevel("tb:close:ticket1")).toBe("staff_or_creator");
    });

    it("garde la compatibilité des panneaux v1 (2ᵉ segment = cible, parcours ou catégorie)", () => {
        const legacy = parseTicketCustomId("tb:open:panelId:categoryId");
        expect(legacy).toMatchObject({ kind: "open", panelId: "panelId", journeyId: "categoryId" });
    });

    it("refuse tout `custom_id` inconnu ou mal formé (fail-closed)", () => {
        for (const bad of [
            "",
            "tb:",
            "tb:inconnu:ticket1",
            "tb:claim",
            "tb:close:",
            "tb:csat:ticket1:0",
            "tb:csat:ticket1:9",
            "tb:csat:ticket1:abc",
            "tb_pick:journey1:Reglement",
            "tb_pick:journey1:reglement:peut_etre",
            "tb_pick:court:reglement",
            `tb:claim:${"x".repeat(120)}`,
            "rr:btn:group1:option1",
        ]) {
            expect(parseTicketCustomId(bad), `accepté à tort : ${bad}`).toBeNull();
        }
    });

    it("distingue la famille du module de celle des autres modules", () => {
        expect(isTicketCustomId("tb:claim:t1")).toBe(true);
        expect(isTicketCustomId("tb_pick:reglement:yes")).toBe(true);
        expect(isTicketCustomId("rr:btn:g1:o1")).toBe(false);
        expect(isTicketCustomId("ticket:create:g:c")).toBe(false);
    });
});

describe("tickets v2 — décision d'accès", () => {
    const staffActor = { discordUserId: "staff-1", roleIds: ["role-staff"], hasStaffPermission: false };
    const memberActor = { discordUserId: "membre-1", roleIds: ["role-membre"] };

    it("accorde au staff par rôle Discord, par permission SigilOS ou par rang serveur", () => {
        expect(isTicketStaff(staffActor, ["role-staff"])).toBe(true);
        expect(isTicketStaff({ ...memberActor, hasStaffPermission: true }, ["role-staff"])).toBe(true);
        expect(isTicketStaff({ ...memberActor, isGuildOwnerOrAdmin: true }, [])).toBe(true);
        expect(isTicketStaff(memberActor, ["role-staff"])).toBe(false);
    });

    it("refuse une action de staff à un demandeur (aucun rôle, aucune permission)", () => {
        const decision = decideTicketAccess({
            access: "staff",
            actor: memberActor,
            staffRoleIds: ["role-staff"],
            creatorDiscordId: "membre-1",
        });
        expect(decision.allowed).toBe(false);
        if (!decision.allowed) expect(decision.reason).toContain("équipe de support");
    });

    it("ne devine jamais un droit quand aucun rôle staff n'est configuré", () => {
        const decision = decideTicketAccess({ access: "staff", actor: memberActor, staffRoleIds: [] });
        expect(decision.allowed).toBe(false);
    });

    it("réserve le CSAT au demandeur du ticket", () => {
        const asCreator = decideTicketAccess({
            access: "creator",
            actor: memberActor,
            creatorDiscordId: "membre-1",
        });
        expect(asCreator).toEqual({ allowed: true, as: "creator" });

        const asThirdParty = decideTicketAccess({
            access: "creator",
            actor: { discordUserId: "tiers", roleIds: [] },
            creatorDiscordId: "membre-1",
        });
        expect(asThirdParty.allowed).toBe(false);
    });

    it("applique la politique de clôture publiée par le parcours", () => {
        const base = { access: "staff_or_creator" as const, actor: memberActor, creatorDiscordId: "membre-1" };
        expect(decideTicketAccess({ ...base, closePolicy: "STAFF_OR_CREATOR" })).toEqual({
            allowed: true,
            as: "creator",
        });
        const refused = decideTicketAccess({ ...base, closePolicy: "STAFF_ONLY" });
        expect(refused.allowed).toBe(false);
        if (!refused.allowed) expect(refused.reason).toContain("clôture");
    });

    it("fusionne les rôles staff sans doublon (config + équipe + parcours)", () => {
        expect(mergeStaffRoleIds(["a", "b"], ["b", "c"], null, [])).toEqual(["a", "b", "c"]);
    });
});

describe("tickets v2 — politique d'archive", () => {
    it("ne met jamais une note interne dans le document partageable", () => {
        expect(shouldIncludeNotes("SHAREABLE")).toBe(false);
        expect(shouldIncludeNotes("INTERNAL")).toBe(true);
        expect(buildArchivePlan("SHAREABLE")).toMatchObject({ includeNotes: false });
        expect(buildArchivePlan("INTERNAL")).toMatchObject({ includeNotes: true });
    });

    it("déclare honnêtement une archive tronquée", () => {
        const complete = evaluateCompleteness({ captured: 42, total: 42 });
        expect(complete.partial).toBe(false);
        expect(complete.note).toBe("42 messages capturés");

        const byTotal = evaluateCompleteness({ captured: 100, total: 150 });
        expect(byTotal.partial).toBe(true);
        expect(byTotal.note).toContain("Archive partielle");
        expect(byTotal.note).toContain("50");

        const byCap = evaluateCompleteness({ captured: 5000, hardCap: 5000 });
        expect(byCap.partial).toBe(true);
        expect(byCap.note).toContain("plafond");

        // Pagination interrompue (page en échec) : jamais présentée comme complète,
        // même si le plafond n'est pas atteint et que le total est inconnu.
        const interrupted = evaluateCompleteness({ captured: 37, total: null, stopped: true });
        expect(interrupted.partial).toBe(true);
        expect(interrupted.note).toContain("Archive partielle");
    });

    it("calcule une échéance (0 = jamais) et refuse une archive expirée ou révoquée", () => {
        const now = new Date("2026-09-24T12:00:00Z");
        expect(computeExpiry(now, 0)).toBeNull();
        expect(computeExpiry(now, 365)?.toISOString()).toBe("2027-09-24T12:00:00.000Z");

        expect(evaluateArchiveAccess(null, now)).toEqual({ allowed: false, reason: "NOT_FOUND" });
        expect(evaluateArchiveAccess({ revokedAt: now }, now)).toEqual({ allowed: false, reason: "REVOKED" });
        expect(evaluateArchiveAccess({ expiresAt: new Date("2026-01-01T00:00:00Z") }, now)).toEqual({
            allowed: false,
            reason: "EXPIRED",
        });
        expect(evaluateArchiveAccess({ expiresAt: null, revokedAt: null }, now)).toEqual({ allowed: true });
    });

    it("ne capture rien sans salon ou module désactivé, et expire les brouillons", () => {
        expect(shouldCaptureTranscript({ enabled: true, hasChannel: true })).toBe(true);
        expect(shouldCaptureTranscript({ enabled: false, hasChannel: true })).toBe(false);
        expect(shouldCaptureTranscript({ enabled: true, hasChannel: false })).toBe(false);

        const now = new Date("2026-09-24T12:00:00Z");
        const expiry = computeDraftExpiry(now);
        expect(expiry.getTime()).toBe(now.getTime() + 30 * 60 * 1000);
        expect(isDraftExpired({ expiresAt: expiry }, now)).toBe(false);
        expect(isDraftExpired({ expiresAt: expiry }, new Date(expiry.getTime() + 1))).toBe(true);
    });
});

describe("tickets v2 — messages Discord", () => {
    it("assainit un nom de salon (accents, symboles, longueur) sans jamais le vider", () => {
        expect(formatTicketChannelName("ticket-{num}", { number: 7, user: "Dimitrios", journey: "Support" })).toBe(
            "ticket-0007"
        );
        expect(
            formatTicketChannelName("candidature-{journey}-{user}", {
                number: 42,
                user: "Klyx",
                journey: "Recrutement Élite",
            })
        ).toBe("candidature-recrutement-elite-klyx");
        expect(formatTicketChannelName("", { number: 12, user: "", journey: "" })).toBe("ticket-0012");
        expect(formatTicketChannelName("x".repeat(300), { number: 1, user: "a", journey: "b" }).length).toBeLessThanOrEqual(
            100
        );
        // Un motif entièrement composé de symboles retombe sur un nom valide.
        expect(formatTicketChannelName("///", { number: 3, user: "a", journey: "b" })).toBe("ticket-0003");
    });

    it("neutralise les mentions d'un contenu fourni par un membre", () => {
        expect(neutralizeMentions("@everyone regardez")).not.toContain("@everyone");
        expect(neutralizeMentions("@here regardez")).not.toContain("@here");
        const clean = neutralizeMentions("<@123456789012345678> et <@&987654321098765432> dans <#111111111111111111>");
        expect(clean).toBe("@membre et @rôle dans #salon");
    });

    it("lit une couleur d'embed et retombe sur l'indigo par défaut", () => {
        expect(parseEmbedColor("#6366f1")).toBe(0x6366f1);
        expect(parseEmbedColor("6366f1")).toBe(0x6366f1);
        expect(parseEmbedColor("pas-une-couleur")).toBe(0x6366f1);
        expect(parseEmbedColor(null)).toBe(0x6366f1);
    });

    it("🔒 ne sert JAMAIS les boutons de staff au demandeur (correctif P0-2)", () => {
        const asCreator = buildActionRows({
            ticketId: "t1",
            status: "OPEN",
            viewerIsStaff: false,
            viewerIsCreator: true,
            closePolicy: "STAFF_ONLY",
        });
        expect(asCreator).toEqual([]);

        const creatorWhoMayClose = buildActionRows({
            ticketId: "t1",
            status: "OPEN",
            viewerIsStaff: false,
            viewerIsCreator: true,
            closePolicy: "STAFF_OR_CREATOR",
        });
        expect(creatorWhoMayClose).toHaveLength(1);
        expect(creatorWhoMayClose[0].components).toHaveLength(1);
        expect(creatorWhoMayClose[0].components[0].custom_id).toBe("tb:close:t1");

        const asStaff = buildActionRows({
            ticketId: "t1",
            status: "OPEN",
            viewerIsStaff: true,
            viewerIsCreator: false,
        });
        expect(asStaff[0].components.map((component) => component.custom_id)).toEqual([
            "tb:claim:t1",
            "tb:note:t1",
            "tb:rename:t1",
            "tb:close:t1",
        ]);
    });

    it("n'affiche plus aucune action sur un ticket clos et propose 5 étoiles au demandeur", () => {
        expect(
            buildActionRows({ ticketId: "t1", status: "CLOSED", viewerIsStaff: true, viewerIsCreator: false })
        ).toEqual([]);

        const csat = buildCsatRows("t1");
        expect(csat[0].components.map((component) => component.custom_id)).toEqual([
            "tb:csat:t1:1",
            "tb:csat:t1:2",
            "tb:csat:t1:3",
            "tb:csat:t1:4",
            "tb:csat:t1:5",
        ]);

        const approval = buildApprovalRows("t1");
        expect(approval[0].components.map((component) => component.custom_id)).toEqual([
            "tb:approve:t1",
            "tb:refuse:t1",
        ]);
    });

    it("reprend les réponses du formulaire dans l'embed d'accueil, mentions neutralisées", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: [
                { id: "pseudo", kind: "text_short", label: "Pseudo", required: true },
                { id: "reglement", kind: "yes_no", label: "Règlement accepté ?" },
            ],
        });
        if (!parsed.ok) throw new Error("formulaire invalide");

        const embed = buildTicketWelcomeEmbed({
            ticketNumber: 42,
            journeyName: "Candidature",
            creatorDiscordId: "123",
            statusLabel: "En attente",
            form: parsed.form,
            answers: { pseudo: "@everyone <@123456789012345678>", reglement: ["no"] },
        });

        const fields = embed.fields as Array<{ name: string; value: string }>;
        expect(embed.title).toContain("Ticket #42");
        expect(fields.map((field) => field.name)).toContain("📋 Pseudo");
        expect(fields.find((field) => field.name === "📋 Pseudo")?.value).not.toContain("@everyone");
        expect(fields.find((field) => field.name === "📋 Règlement accepté ?")?.value).toBe("Non");
    });
});



