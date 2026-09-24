/**
 * 🎫 Tickets v2 — gardes des **mentions à l'ouverture** (`src/lib/tickets/notifications.ts`).
 *
 * Demande user : « une option permettant de ping tel rôle ou tel rôle quand un ticket est
 * créé ». Ce que ces tests protègent :
 *   · seuls des **flocons valides** sont mentionnés (impossible de transformer un champ
 *     libre en `@everyone` — fail-closed) ;
 *   · la borne Discord (25 mentions) est respectée **par troncature propre**, jamais par
 *     un message refusé ;
 *   · le **parcours décide, l'équipe parle à défaut**, et sans configuration
 *     `buildTicketNotifyContent` rend `null` : aucun ping inventé.
 *
 * Pur : aucun import serveur, aucune base, aucun mock.
 */

import { describe, it, expect } from "vitest";
import {
    TICKET_NOTIFY_ROLES_MAX,
    buildTicketNotifyContent,
    resolveTicketNotifyRoleIds,
    sanitizeTicketNotifyRoleIds,
} from "@/lib/tickets/notifications";

const ROLE_A = "111111111111111111";
const ROLE_B = "222222222222222222";

describe("mentions à l'ouverture — nettoyage des rôles", () => {
    it("ne garde que des flocons valides, sans doublon et dans l'ordre", () => {
        expect(
            sanitizeTicketNotifyRoleIds([ROLE_A, ROLE_A, "pas-un-role", "", null, undefined, ROLE_B])
        ).toEqual([ROLE_A, ROLE_B]);
    });

    it("refuse `@everyone` et tout ce qui n'est pas un flocon (aucune mention surprise)", () => {
        expect(sanitizeTicketNotifyRoleIds(["@everyone", "everyone", "123", "123456789012345678901"])).toEqual([]);
    });

    it("borne à 25 rôles (limite Discord d'un message)", () => {
        const many = Array.from({ length: 40 }, (_, index) => String(index + 1).padStart(18, "0"));
        expect(sanitizeTicketNotifyRoleIds(many)).toHaveLength(TICKET_NOTIFY_ROLES_MAX);
    });

    it("accepte une entrée absente", () => {
        expect(sanitizeTicketNotifyRoleIds(null)).toEqual([]);
        expect(sanitizeTicketNotifyRoleIds(undefined)).toEqual([]);
    });
});

describe("mentions à l'ouverture — qui est prévenu", () => {
    it("le parcours décide quand il définit ses rôles", () => {
        expect(resolveTicketNotifyRoleIds({ journeyRoleIds: [ROLE_A], teamRoleIds: [ROLE_B] })).toEqual({
            roleIds: [ROLE_A],
            source: "journey",
        });
    });

    it("l'équipe parle à défaut (parcours vide ou invalide)", () => {
        expect(resolveTicketNotifyRoleIds({ journeyRoleIds: [], teamRoleIds: [ROLE_B] })).toEqual({
            roleIds: [ROLE_B],
            source: "team",
        });
        expect(resolveTicketNotifyRoleIds({ journeyRoleIds: ["@everyone"], teamRoleIds: [ROLE_B] })).toEqual({
            roleIds: [ROLE_B],
            source: "team",
        });
    });

    it("sans rien de configuré, personne n'est mentionné", () => {
        expect(resolveTicketNotifyRoleIds({})).toEqual({ roleIds: [], source: "none" });
        expect(resolveTicketNotifyRoleIds({ journeyRoleIds: null, teamRoleIds: null })).toEqual({
            roleIds: [],
            source: "none",
        });
    });
});

describe("mentions à l'ouverture — message Discord", () => {
    it("n'envoie rien quand il n'y a aucun rôle valide", () => {
        expect(buildTicketNotifyContent([])).toBeNull();
        expect(buildTicketNotifyContent(["@everyone"])).toBeNull();
        expect(buildTicketNotifyContent(null)).toBeNull();
    });

    it("mentionne chaque rôle une fois, sous forme de mention Discord", () => {
        const content = buildTicketNotifyContent([ROLE_A, ROLE_B, ROLE_A]);
        expect(content).toBe(`🔔 Nouveau ticket — <@&${ROLE_A}> <@&${ROLE_B}>`);
        expect(content).not.toContain("@everyone");
    });

    it("ne dépasse jamais 25 mentions", () => {
        const many = Array.from({ length: 40 }, (_, index) => String(index + 1).padStart(18, "0"));
        const content = buildTicketNotifyContent(many) ?? "";
        expect((content.match(/<@&/g) || []).length).toBe(TICKET_NOTIFY_ROLES_MAX);
    });
});
