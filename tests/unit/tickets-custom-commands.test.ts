/**
 * 🎫 Tests unitaires — Commandes Slash Personnalisées de Tickets
 *
 * Vérifie :
 *   1. Validation Zod stricte (nom regex 1-32, description 1-100, quota 20).
 *   2. Remplacement complet des variables contextuelles (demandeur, cible, staff, ticket, serveur).
 *   3. Lecture / Écriture sécurisée dans settingsJson (aucun I/O, zéro écrasement).
 *   4. Génération des options Discord (option membre:USER conditionnelle).
 */

import { describe, it, expect } from "vitest";
import {
    TicketCustomCommandSaveSchema,
    interpolateTicketCommandTokens,
    readTicketCustomCommands,
    writeTicketCustomCommands,
    buildTicketSlashCommandOptions,
    TICKET_CUSTOM_COMMANDS_MAX,
    type TicketCustomCommand,
    type TicketCommandContext,
} from "@/lib/tickets/custom-commands";

describe("1. Validation des Commandes Personnalisées (Zod)", () => {
    it("valide une commande conforme avec toutes ses options", () => {
        const input = {
            name: "gardien",
            description: "Ajout du rôle Gardien 2 Mois",
            isEnabled: true,
            ephemeral: false,
            allowTargetMember: true,
            content: "Félicitations {cible} pour ton rang {motif} !",
            embedEnabled: true,
            embed: {
                title: "Grade attribué",
                description: "Bravo {pseudo} !",
                color: "#5865F2",
                imageUrl: "https://example.com/badge.png",
                thumbnailUrl: "https://example.com/avatar.png",
                footer: "SigilOS Staff",
            },
            addRoleIds: ["111222333444555666"],
            removeRoleIds: ["999888777666555444"],
            autoCloseTicket: false,
            permissionMode: "STAFF_ONLY" as const,
            allowedRoleIds: [],
        };

        const res = TicketCustomCommandSaveSchema.safeParse(input);
        expect(res.success).toBe(true);
    });

    it("refuse un nom de commande avec des majuscules, espaces ou caractères spéciaux", () => {
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "Gardien", description: "Desc" }).success).toBe(false);
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "mon gardien", description: "Desc" }).success).toBe(false);
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "gardien!", description: "Desc" }).success).toBe(false);
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "a".repeat(33), description: "Desc" }).success).toBe(false);
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "", description: "Desc" }).success).toBe(false);
    });

    it("accepte les tirets et underscores dans le nom", () => {
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "role-gardien", description: "Desc" }).success).toBe(true);
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "valider_recrue", description: "Desc" }).success).toBe(true);
    });

    it("borne la description à 100 caractères", () => {
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "test", description: "a".repeat(101) }).success).toBe(false);
        expect(TicketCustomCommandSaveSchema.safeParse({ name: "test", description: "a".repeat(100) }).success).toBe(true);
    });
});

describe("2. Moteur d'interpolation des variables ({demandeur}, {cible}, {pseudo}, etc.)", () => {
    const context: TicketCommandContext = {
        demandeurId: "123456789012345678",
        demandeurPseudo: "Aventurier",
        demandeurAvatar: "https://cdn.discordapp.com/avatars/123/avatar.png",
        targetId: "987654321098765432",
        targetPseudo: "Recrue",
        targetAvatar: "https://cdn.discordapp.com/avatars/987/avatar.png",
        staffId: "555666777888999000",
        staffPseudo: "ChefDeGuilde",
        ticketNumero: 42,
        ticketMotif: "Candidature",
        channelId: "111222333444555",
        serverName: "STELLIUM",
        formResponses: {
            "1": "Iop Terre 200",
            "classe": "Iop",
        },
    };

    it("remplace les variables du demandeur et de la cible", () => {
        const template = "Bravo {cible} ({pseudo}) ! Demandeur initial : {demandeur} ({demandeur.pseudo})";
        const result = interpolateTicketCommandTokens(template, context);

        expect(result).toBe("Bravo <@987654321098765432> (Recrue) ! Demandeur initial : <@123456789012345678> (Aventurier)");
    });

    it("remplace les variables du staff, du ticket et du serveur", () => {
        const template = "Staff : {staff} ({staff.pseudo}) | Ticket {numero} ({motif}) dans {salon} sur {serveur}";
        const result = interpolateTicketCommandTokens(template, context);

        expect(result).toBe("Staff : <@555666777888999000> (ChefDeGuilde) | Ticket #0042 (Candidature) dans <#111222333444555> sur STELLIUM");
    });

    it("supporte les alias {moderateur} et {equipe}/{roles} pour mentionner l'équipe", () => {
        const contextWithRoles: TicketCommandContext = {
            ...context,
            staffRoleIds: ["111222", "333444"],
        };
        const template = "Validé par {moderateur} pour l'équipe {equipe} ({roles})";
        const result = interpolateTicketCommandTokens(template, contextWithRoles);

        expect(result).toBe("Validé par <@555666777888999000> pour l'équipe <@&111222> <@&333444> (<@&111222> <@&333444>)");
    });

    it("retombe sur le demandeur si aucune cible spécifique n'est définie", () => {
        const noTargetContext: TicketCommandContext = {
            ...context,
            targetId: undefined,
            targetPseudo: undefined,
        };
        const template = "Salut {cible} ({pseudo}) !";
        const result = interpolateTicketCommandTokens(template, noTargetContext);

        expect(result).toBe("Salut <@123456789012345678> (Aventurier) !");
    });

    it("supporte les réponses de formulaires dynamiques ({reponse:1})", () => {
        const template = "Classe choisie : {reponse:1}";
        const result = interpolateTicketCommandTokens(template, context);

        expect(result).toBe("Classe choisie : Iop Terre 200");
    });
});

describe("3. Lecture et Écriture dans settingsJson (Zéro I/O)", () => {
    it("lit une liste vide si settingsJson est nul ou sans customCommands", () => {
        expect(readTicketCustomCommands(null)).toEqual([]);
        expect(readTicketCustomCommands({})).toEqual([]);
        expect(readTicketCustomCommands({ allowUserClose: true })).toEqual([]);
    });

    it("écrit customCommands sans écraser les autres paramètres du ticket", () => {
        const initial = {
            allowUserClose: true,
            channelPositionInCategory: "TOP",
            buttons: { claim: { label: "Prendre" } },
        };

        const command: TicketCustomCommand = {
            id: "cmd_1",
            name: "gardien",
            description: "Passe gardien",
            isEnabled: true,
            ephemeral: false,
            allowTargetMember: true,
            content: "Salut !",
            embedEnabled: false,
            permissionMode: "STAFF_ONLY",
            createdAt: "2026-10-20T20:00:00Z",
            updatedAt: "2026-10-20T20:00:00Z",
        };

        const updated = writeTicketCustomCommands(initial, [command]);

        expect((updated as any).allowUserClose).toBe(true);
        expect((updated as any).channelPositionInCategory).toBe("TOP");
        expect(readTicketCustomCommands(updated)).toHaveLength(1);
        expect(readTicketCustomCommands(updated)[0].name).toBe("gardien");
    });

    it("limite le stockage à TICKET_CUSTOM_COMMANDS_MAX (20)", () => {
        const many = Array.from({ length: 30 }, (_, i) => ({
            id: `cmd_${i}`,
            name: `cmd${i}`,
            description: `Desc ${i}`,
            isEnabled: true,
            ephemeral: false,
            allowTargetMember: true,
            content: "Hello",
            embedEnabled: false,
            permissionMode: "STAFF_ONLY" as const,
            createdAt: "2026-10-20T20:00:00Z",
            updatedAt: "2026-10-20T20:00:00Z",
        }));

        const updated = writeTicketCustomCommands({}, many);
        expect(readTicketCustomCommands(updated)).toHaveLength(TICKET_CUSTOM_COMMANDS_MAX);
    });
});

describe("4. Construction des Options Discord Slash Command", () => {
    it("génère l'option membre:USER quand allowTargetMember est activé", () => {
        const cmd: TicketCustomCommand = {
            id: "1",
            name: "test",
            description: "test",
            isEnabled: true,
            ephemeral: false,
            allowTargetMember: true,
            content: "test",
            embedEnabled: false,
            permissionMode: "STAFF_ONLY",
            createdAt: "",
            updatedAt: "",
        };

        const options = buildTicketSlashCommandOptions(cmd);
        expect(options).toBeDefined();
        expect(options).toHaveLength(1);
        expect(options![0].name).toBe("membre");
        expect(options![0].type).toBe(6); // USER
        expect(options![0].required).toBe(false);
    });

    it("ne génère aucune option quand allowTargetMember est désactivé", () => {
        const cmd: TicketCustomCommand = {
            id: "1",
            name: "test",
            description: "test",
            isEnabled: true,
            ephemeral: false,
            allowTargetMember: false,
            content: "test",
            embedEnabled: false,
            permissionMode: "STAFF_ONLY",
            createdAt: "",
            updatedAt: "",
        };

        expect(buildTicketSlashCommandOptions(cmd)).toBeUndefined();
    });
});
