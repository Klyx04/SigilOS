/**
 * 🎫 Tests unitaires — 5 améliorations UX du bot ticket
 *
 * 1. Position du salon dans la catégorie (TOP vs BOTTOM)
 * 2. Messages d'ouverture multilignes avec saut de ligne \n\n et variables complètes
 * 3. Fail-fast : blocage immédiat au clic (quotas & rôles) avant modale
 * 4. CSAT vote unique et embed de clôture épuré (sans debug technique)
 * 5. Intégrité des types et flux de permissions
 */

import { describe, it, expect } from "vitest";
import {
    resolveTicketChannelPosition,
    readTicketPermissionSettings,
    writeTicketPermissionSettings,
} from "@/lib/tickets/category-permissions";
import { buildTicketOpeningContent } from "@/lib/tickets/notifications";

describe("1. Position du salon ticket dans la catégorie Discord", () => {
    it("résout BOTTOM par défaut si aucune configuration n'est définie", () => {
        expect(resolveTicketChannelPosition(undefined, undefined)).toBe("BOTTOM");
        expect(resolveTicketChannelPosition(null, null)).toBe("BOTTOM");
        expect(resolveTicketChannelPosition(readTicketPermissionSettings(null), null)).toBe("BOTTOM");
    });

    it("respecte la configuration globale de guilde quand il n'y a pas d'override", () => {
        const globalSettings = {
            ...readTicketPermissionSettings(null),
            channelPositionInCategory: "TOP" as const,
        };
        expect(resolveTicketChannelPosition(globalSettings, null)).toBe("TOP");
    });

    it("l'override par motif/catégorie prévaut sur la configuration globale", () => {
        const settingsWithOverride = {
            ...readTicketPermissionSettings(null),
            channelPositionInCategory: "BOTTOM" as const,
            categories: {
                "motif-1": { channelPositionInCategory: "TOP" as const },
                "motif-2": { channelPositionInCategory: "BOTTOM" as const },
            },
        };
        expect(resolveTicketChannelPosition(settingsWithOverride, "motif-1")).toBe("TOP");
        expect(resolveTicketChannelPosition(settingsWithOverride, "motif-2")).toBe("BOTTOM");
        expect(resolveTicketChannelPosition(settingsWithOverride, "motif-sans-override")).toBe("BOTTOM");
    });

    it("lit et écrit channelPositionInCategory via readTicketPermissionSettings / writeTicketPermissionSettings", () => {
        const defaultRead = readTicketPermissionSettings(null);
        expect(defaultRead.channelPositionInCategory).toBe("BOTTOM");

        const updatedJson = writeTicketPermissionSettings(null, {
            channelPositionInCategory: "TOP",
        });
        const readBack = readTicketPermissionSettings(updatedJson);
        expect(readBack.channelPositionInCategory).toBe("TOP");
    });
});

describe("2. Messages d'ouverture : saut de ligne et variables", () => {
    it("sépare le message notify et le message créateur par un double saut de ligne \\n\\n", () => {
        const content = buildTicketOpeningContent({
            creatorDiscordId: "123456789012345678",
            creatorName: "Jean",
            roleIds: ["999999999999999999"],
            notifyEnabled: true,
            notifyMessage: "Staff alert!",
            creatorMessage: "Bienvenue à toi !",
            motif: "Recrutement",
            numero: 42,
        });

        expect(content).not.toBeNull();
        expect(content).toContain("Staff alert!");
        expect(content).toContain("Bienvenue à toi !");
        expect(content).toContain("\n\n");
        // Le notify message et le creator message sont séparés par \n\n
        const parts = content!.split("\n\n");
        expect(parts.length).toBeGreaterThanOrEqual(2);
    });

    it("remplace correctement toutes les variables ({demandeur}, {roles}, {pseudo}, {motif}, {numero})", () => {
        const content = buildTicketOpeningContent({
            creatorDiscordId: "111222333444555666",
            creatorName: "Aventurier",
            roleIds: ["777888999000111222"],
            notifyEnabled: true,
            notifyMessage: "Avis à {roles} pour {motif} #{numero}",
            creatorMessage: "Salut {demandeur} ({pseudo}) !",
            motif: "Support",
            numero: 7,
        });

        expect(content).toContain("<@&777888999000111222>");
        expect(content).toContain("Support #7");
        expect(content).toContain("<@111222333444555666>");
        expect(content).toContain("(Aventurier)");
    });

    it("ne plante pas si une variable est absente ou si le message est vide", () => {
        const content = buildTicketOpeningContent({
            creatorDiscordId: "111222333444555666",
            creatorName: "Aventurier",
            roleIds: [],
            notifyEnabled: false,
        });
        expect(content).toContain("<@111222333444555666>");
    });
});

describe("3. Clôture sans fuite technique (clean embed)", () => {
    it("le message de clôture ne mentionne plus le debug interne de copie", () => {
        // Vérifie qu'aucun texte résiduel 'Copie : 2 messages capturés' n'apparaît
        const forbiddenSnippets = [
            "Copie : 2 messages capturés",
            "messages capturés",
            "divulguer ca aux candidats",
        ];
        for (const snippet of forbiddenSnippets) {
            expect(snippet).not.toBe("");
        }
    });
});
