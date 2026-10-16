/**
 * 🎫 Tickets — **ouverture** : qui peut ouvrir (RBAC), et **qui est prévenu, avec quel
 * message** (lot 3, demande user du 16/10/2026).
 *
 * Ce que ces tests protègent :
 *   · la **liste blanche d'ouverture** par motif (vide = tout le monde, admin toujours
 *     autorisé) — c'était la question « où on définit quel rôle peut ouvrir un ticket ? » ;
 *   · l'**interrupteur** « prévenir l'équipe » (un vrai oui/non, plus seulement une liste vide) ;
 *   · les **messages personnalisés** (`{membre}`, `{motif}`, `{numero}`), avec la mention du
 *     demandeur **garantie** même si le gabarit l'oublie ;
 *   · le **fail-closed** : configuration illisible = aucun accès ouvert, aucun ping inventé.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    isTicketNotifyEnabled,
    isTicketOpenAllowedByRoles,
    readTicketMotifMessages,
    readTicketPermissionSettings,
    writeTicketPermissionSettings,
} from "@/lib/tickets/category-permissions";
import {
    TICKET_MESSAGE_MAX,
    buildTicketCreatorContent,
    buildTicketNotifyContentWithTemplate,
    renderTicketMessage,
} from "@/lib/tickets/notifications";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ROLE = "111111111111111111";
const OTHER_ROLE = "222222222222222222";
const CREATOR = "333333333333333333";

describe("qui peut ouvrir un ticket (RBAC d'ouverture)", () => {
    it("sans liste blanche, tout le monde peut ouvrir (comportement historique)", () => {
        const settings = readTicketPermissionSettings({});
        expect(
            isTicketOpenAllowedByRoles({ settings, motifKey: "candidature", actorRoleIds: [OTHER_ROLE] })
        ).toBe(true);
        // Une liste explicitement vide veut dire « tout le monde », pas « personne ».
        const explicit = readTicketPermissionSettings({
            categories: { candidature: { allowedRoleIds: [] } },
        });
        expect(isTicketOpenAllowedByRoles({ settings: explicit, motifKey: "candidature", actorRoleIds: [] })).toBe(true);
    });

    it("avec une liste, il faut l'un des rôles autorisés", () => {
        const settings = readTicketPermissionSettings({
            categories: { candidature: { allowedRoleIds: [ROLE] } },
        });
        expect(isTicketOpenAllowedByRoles({ settings, motifKey: "candidature", actorRoleIds: [ROLE] })).toBe(true);
        expect(isTicketOpenAllowedByRoles({ settings, motifKey: "candidature", actorRoleIds: [OTHER_ROLE] })).toBe(false);
        expect(isTicketOpenAllowedByRoles({ settings, motifKey: "candidature", actorRoleIds: [] })).toBe(false);
        // La restriction ne fuit pas vers un autre motif.
        expect(isTicketOpenAllowedByRoles({ settings, motifKey: "support", actorRoleIds: [OTHER_ROLE] })).toBe(true);
    });

    it("un administrateur Discord n'est jamais enfermé dehors", () => {
        const settings = readTicketPermissionSettings({
            categories: { candidature: { allowedRoleIds: [ROLE] } },
        });
        expect(
            isTicketOpenAllowedByRoles({
                settings,
                motifKey: "candidature",
                actorRoleIds: [],
                actorIsAdmin: true,
            })
        ).toBe(true);
    });
});

describe("prévenir l'équipe : un vrai oui/non", () => {
    it("prévient par défaut, et se coupe explicitement", () => {
        expect(isTicketNotifyEnabled(readTicketPermissionSettings({}), "candidature")).toBe(true);
        const off = readTicketPermissionSettings({
            categories: { candidature: { notifyEnabled: false } },
        });
        expect(isTicketNotifyEnabled(off, "candidature")).toBe(false);
        // La coupure est propre au motif.
        expect(isTicketNotifyEnabled(off, "support")).toBe(true);
    });

    it("relit les messages personnalisés écrits par l'écran", () => {
        const written = writeTicketPermissionSettings(null, {
            category: {
                id: "candidature",
                override: {
                    closePolicy: "STAFF_ONLY",
                    requireConfirm: true,
                    allowedRoleIds: [ROLE],
                    notifyEnabled: true,
                    notifyMessage: "Nouvelle demande de {membre}",
                    creatorMessage: "{membre} merci !",
                },
            },
        });
        const settings = readTicketPermissionSettings(written);
        expect(settings.categories.candidature?.allowedRoleIds).toEqual([ROLE]);
        expect(readTicketMotifMessages(settings, "candidature")).toEqual({
            notifyMessage: "Nouvelle demande de {membre}",
            creatorMessage: "{membre} merci !",
        });
    });
});

describe("messages personnalisés — rendu sûr", () => {
    it("remplace les variables et borne le texte", () => {
        expect(
            renderTicketMessage("Salut {membre} — {motif} #{numero}", {
                membre: "@Wylan",
                motif: "Candidature",
                numero: 42,
            })
        ).toBe("Salut @Wylan — Candidature #42");
        expect(renderTicketMessage("", {})).toBeNull();
        expect(renderTicketMessage("   ", {})).toBeNull();
        const long = renderTicketMessage("x".repeat(5000), {});
        expect(String(long).length).toBeLessThanOrEqual(TICKET_MESSAGE_MAX);
    });

    it("ajoute les mentions de rôles, jamais `@everyone`", () => {
        const content = buildTicketNotifyContentWithTemplate({
            roleIds: [ROLE, "@everyone", "pas-un-role"],
            template: "Nouvelle demande !",
        });
        expect(content).toBe(`Nouvelle demande ! <@&${ROLE}>`);
        // Sans gabarit, le message par défaut du module reste la référence unique.
        expect(buildTicketNotifyContentWithTemplate({ roleIds: [ROLE] })).toContain("🔔 Nouveau ticket —");
        // Interrupteur à non, ou aucun rôle : rien du tout (jamais un ping inventé).
        expect(buildTicketNotifyContentWithTemplate({ roleIds: [ROLE], enabled: false })).toBeNull();
        expect(buildTicketNotifyContentWithTemplate({ roleIds: [] })).toBeNull();
    });

    it("garantit la mention du demandeur, même si le gabarit l'oublie", () => {
        expect(buildTicketCreatorContent({ creatorDiscordId: CREATOR })).toBe(`<@${CREATOR}>`);
        expect(
            buildTicketCreatorContent({ creatorDiscordId: CREATOR, template: "Merci {membre} !" })
        ).toBe(`Merci <@${CREATOR}> !`);
        expect(
            buildTicketCreatorContent({ creatorDiscordId: CREATOR, template: "Bienvenue dans le support !" })
        ).toBe(`<@${CREATOR}> Bienvenue dans le support !`);
        // Un identifiant qui n'est pas un flocon ne produit aucune mention.
        expect(buildTicketCreatorContent({ creatorDiscordId: "cmlozn4dj000g01mj6d1lz4iw" })).toBeNull();
    });
});

describe("le branchement serveur (gardes de source)", () => {
    it("vérifie la liste blanche au clic du panneau, avec un refus motivé", () => {
        const route = codeOnly(read("src/app/api/discord/interactions/route.ts"));
        expect(route).toContain("isTicketOpenAllowedByRoles({");
        expect(route).toContain("motifKey: categoryId");
        expect(route).toContain("actorIsAdmin: ticketActorContext.discordUserIsAdmin");
        expect(route).toContain("ne permet pas d'ouvrir ce type de demande");
    });

    it("envoie les messages du motif à la création (équipe + demandeur)", () => {
        const actions = codeOnly(read("src/server/actions/ticket-bot-actions.ts"));
        expect(actions).toContain("buildTicketNotifyContentWithTemplate(");
        expect(actions).toContain("buildTicketCreatorContent(");
        expect(actions).toContain("notifyMessage: categoryOverride?.notifyMessage ?? null");
        expect(actions).toContain("creatorMessage: categoryOverride?.creatorMessage ?? null");
    });
});
