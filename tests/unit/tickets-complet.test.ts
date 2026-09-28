/**
 * 🎫 Tickets complets — textes FR/EN, icônes et permissions sans migration.
 *
 * Verrouille :
 *   · boutons bilingues vulgarisés (jamais plus de 80 caractères Discord) ;
 *   · icônes unicode ou custom `<:nom:id>`, repli 🎫, jamais de casse Discord ;
 *   · permissions lues dans `settingsJson` sans jeter (défauts sûrs).
 */

import { describe, it, expect } from "vitest";
import { ticketLabel, ticketTexts, TICKET_BUTTON_LABEL_MAX } from "@/lib/tickets/ticket-texts";
import {
    isCustomTicketIcon,
    normalizeTicketIcon,
    ticketButtonStyleNumber,
    ticketIconPayload,
    TICKET_BUTTON_STYLES,
    TICKET_ICON_PRESETS,
} from "@/lib/tickets/ticket-icons";
import {
    isBlacklisted,
    readTicketPermissionSettings,
    requireCloseConfirm,
    resolveCategoryClosePolicy,
    writeTicketPermissionSettings,
} from "@/lib/tickets/category-permissions";
import {
    buildTicketOverwrites,
    permSetToBitmasks,
    readChannelPermissions,
    writeChannelPermissions,
} from "@/lib/tickets/channel-permissions";

describe("tickets complets — libellés FR/EN vulgarisés", () => {
    /** Clés posées sur des **boutons** Discord (80 caractères max). */
    const buttonKeys = [
        "claim",
        "release",
        "add",
        "remove",
        "note",
        "rename",
        "close",
        "closeMine",
        "confirmClose",
        "cancel",
        "reopen",
        "transcript",
        "delete",
        "confirmDelete",
    ] as const;

    it("chaque texte est bilingue, chaque bouton tient dans la limite Discord", () => {
        for (const [key, label] of Object.entries(ticketTexts)) {
            expect(label, `pas bilingue : ${key}`).toContain("/");
        }
        for (const key of buttonKeys) {
            const label = ticketLabel(key);
            expect(label.length, `trop long pour Discord : ${key}`).toBeLessThanOrEqual(
                TICKET_BUTTON_LABEL_MAX
            );
            expect(label, `pas bilingue : ${key}`).toContain("/");
        }
    });

    it("le côté FR des boutons bannit le jargon (claim/transcript)", () => {
        for (const key of buttonKeys) {
            const frSide = ticketLabel(key).split("/")[0].toLowerCase();
            expect(frSide, `jargon dans ${key}`).not.toContain("claim");
            expect(frSide, `jargon dans ${key}`).not.toContain("transcript");
        }
    });
});

describe("tickets complets — icônes de bouton", () => {
    it("propose des presets sobres et 4 styles Discord", () => {
        expect(TICKET_ICON_PRESETS).toContain("🎫");
        expect(TICKET_BUTTON_STYLES).toEqual(["PRIMARY", "SECONDARY", "SUCCESS", "DANGER"]);
        expect(ticketButtonStyleNumber("DANGER")).toBe(4);
        expect(ticketButtonStyleNumber("nimporte-quoi")).toBe(1);
    });

    it("normalise sans jamais casser Discord", () => {
        expect(normalizeTicketIcon("")).toBe("🎫");
        expect(normalizeTicketIcon(null)).toBe("🎫");
        expect(normalizeTicketIcon("🛡️")).toBe("🛡️");
        expect(normalizeTicketIcon("<:candidature:123456789012345678>")).toBe(
            "<:candidature:123456789012345678>"
        );
        // Un identifiant collé par erreur ne part jamais tel quel.
        expect(normalizeTicketIcon("123456789012345678")).toBe("🎫");
    });

    it("distingue unicode et custom pour le payload Discord", () => {
        expect(isCustomTicketIcon("🎫")).toBe(false);
        expect(isCustomTicketIcon("<:candidature:123456789012345678>")).toBe(true);
        expect(ticketIconPayload("🎫")).toEqual({ name: "🎫" });
        expect(ticketIconPayload("<:candidature:123456789012345678>")).toEqual({
            name: "candidature",
            id: "123456789012345678",
        });
    });
});

describe("tickets complets — permissions sans migration", () => {
    it("lit des réglages absents ou invalides avec des défauts sûrs", () => {
        expect(readTicketPermissionSettings(null).allowUserClose).toBe(true);
        expect(readTicketPermissionSettings(null).requireCloseConfirm).toBe(true);
        expect(readTicketPermissionSettings("pas-un-objet").blacklistRoleIds).toEqual([]);
        expect(readTicketPermissionSettings({ allowUserClose: false }).allowUserClose).toBe(false);
    });

    it("le motif décide, le global est le repli", () => {
        const settings = readTicketPermissionSettings({
            allowUserClose: true,
            requireCloseConfirm: true,
            categories: { cat1: { closePolicy: "STAFF_ONLY", requireConfirm: false } },
        });
        expect(resolveCategoryClosePolicy(settings, "cat1")).toBe("STAFF_ONLY");
        expect(resolveCategoryClosePolicy(settings, "cat2")).toBe("STAFF_OR_CREATOR");
        expect(requireCloseConfirm(settings, "cat1")).toBe(false);
        expect(requireCloseConfirm(settings, "cat2")).toBe(true);

        const strict = readTicketPermissionSettings({ allowUserClose: false });
        expect(resolveCategoryClosePolicy(strict, "cat9")).toBe("STAFF_ONLY");
    });

    it("la blacklist ne bloque que les rôles listés, bornée à 25", () => {
        const blockedA = "111111111111111111";
        const blockedB = "222222222222222222";
        const other = "333333333333333333";
        const settings = readTicketPermissionSettings({ blacklistRoleIds: [blockedA, blockedB] });
        expect(isBlacklisted(settings, [other])).toBe(false);
        expect(isBlacklisted(settings, [blockedB, other])).toBe(true);
        expect(isBlacklisted(settings, [])).toBe(false);

        const dirty = writeTicketPermissionSettings(null, {
            blacklistRoleIds: ["pas-un-flocon", "444444444444444444"],
        });
        expect(readTicketPermissionSettings(dirty).blacklistRoleIds).toEqual(["444444444444444444"]);
    });

    it("fusionne un réglage sans écraser le reste du JSON", () => {
        const merged = writeTicketPermissionSettings({ autreCle: 1 }, { allowUserClose: false });
        expect(merged.autreCle).toBe(1);
        expect(readTicketPermissionSettings(merged).allowUserClose).toBe(false);

        const perCategory = writeTicketPermissionSettings(null, {
            category: { id: "cat1", override: { closePolicy: "STAFF_ONLY" } },
        });
        expect(resolveCategoryClosePolicy(readTicketPermissionSettings(perCategory), "cat1")).toBe(
            "STAFF_ONLY"
        );
    });

    it("lit les rôles invités du motif, bornés et valides uniquement", () => {
        const withGuests = readTicketPermissionSettings({
            categories: {
                cat1: { additionalRoleIds: ["111111111111111111", "nope", "222222222222222222"] },
            },
        });
        expect(withGuests.categories.cat1?.additionalRoleIds).toEqual([
            "111111111111111111",
            "222222222222222222",
        ]);
        expect(readTicketPermissionSettings(null).categories).toEqual({});
    });
});

describe("tickets complets — matrice des permissions de salon", () => {
    it("défauts sûrs : staff et demandeur voient et écrivent, personne d'autre", () => {
        const matrix = readChannelPermissions(null);
        expect(matrix.support.open.view).toBe(true);
        expect(matrix.support.open.send).toBe(true);
        expect(matrix.support.open.manage).toBe(false);
        expect(matrix.owner.open.send).toBe(true);
        // Fermé : le demandeur lit mais n'écrit plus, l'équipe garde tout.
        expect(matrix.owner.closed.view).toBe(true);
        expect(matrix.owner.closed.send).toBe(false);
        expect(matrix.support.closed.send).toBe(true);
        expect(matrix.additional.open.view).toBe(true);
        expect(matrix.additional.open.send).toBe(false);
        expect(matrix.everyone.open.view).toBe(false);
        expect(matrix.everyone.closed.view).toBe(false);
    });

    it("« Tout le monde » n'est jamais modifiable (un ticket reste privé)", () => {
        const matrix = readChannelPermissions({
            channelPermissions: { everyone: { open: { view: true }, closed: { view: true } } },
        });
        expect(matrix.everyone.open.view).toBe(false);
        expect(matrix.everyone.closed.view).toBe(false);
    });

    it("n'enregistre que des booléens, sans écraser le reste du JSON", () => {
        const matrix = readChannelPermissions(null);
        matrix.owner.closed.send = true;
        const merged = writeChannelPermissions({ autreCle: 2 }, matrix);
        expect(merged.autreCle).toBe(2);
        expect(readChannelPermissions(merged).owner.closed.send).toBe(true);
        expect(readChannelPermissions("invalide").owner.closed.send).toBe(false);
    });

    it("convertit un jeu en bitmasks Discord explicites", () => {
        const { allow, deny } = permSetToBitmasks({
            view: true,
            send: true,
            history: true,
            attach: false,
            embed: false,
            react: false,
            manage: false,
            invite: false,
        });
        expect(BigInt(allow) & 1024n).toBe(1024n);
        expect(BigInt(allow) & 2048n).toBe(2048n);
        expect(BigInt(deny) & 2048n).toBe(0n);
    });

    it("construit les overwrites dans l'ordre : everyone, demandeur, équipe, invités", () => {
        const matrix = readChannelPermissions(null);
        const overwrites = buildTicketOverwrites({
            guildId: "999",
            creatorDiscordId: "111111111111111111",
            staffRoleIds: ["222222222222222222"],
            additionalRoleIds: ["333333333333333333", "222222222222222222"],
            state: "open",
            matrix,
        });
        expect(overwrites[0]).toMatchObject({ id: "999", type: 0 });
        expect(overwrites[1]).toMatchObject({ id: "111111111111111111", type: 1 });
        const ids = overwrites.map((overwrite) => overwrite.id);
        expect(ids).toContain("222222222222222222");
        expect(ids).toContain("333333333333333333");
        // Un rôle staff n'est jamais dupliqué en invité.
        expect(ids.filter((id) => id === "222222222222222222")).toHaveLength(1);
        for (const overwrite of overwrites) {
            expect(overwrite.allow).toMatch(/^\d+$/);
            expect(overwrite.deny).toMatch(/^\d+$/);
        }
    });
});
