import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    allChannelsSentinel,
    buildCommandPermissionEntries,
    isCatalogCommandDeployed,
    resolveTicketCommandRoleIds,
} from "@/lib/discord/command-permissions";
import {
    buildDiscordCommandPayloads,
    catalogCommandsMissingPresentation,
} from "@/lib/discord/command-payloads";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";

const GUILD = "1290442961380835451";
const STAFF = "111111111111111111";
const EMPEREUR = "222222222222222222";
const CHANNEL = "333333333333333333";

describe("déploiement d'une commande par guilde", () => {
    it("une commande staffOnly est FERMÉE par défaut (aucune ligne en base)", () => {
        expect(isCatalogCommandDeployed({ name: "valider-recrue", staffOnly: true }, null)).toBe(false);
        expect(isCatalogCommandDeployed({ name: "valider-recrue", staffOnly: true }, undefined)).toBe(false);
    });

    it("une commande staffOnly est déployée quand God l'a autorisée", () => {
        expect(
            isCatalogCommandDeployed(
                { name: "valider-recrue", staffOnly: true },
                { commandName: "valider-recrue", isEnabled: true }
            )
        ).toBe(true);
        expect(
            isCatalogCommandDeployed(
                { name: "valider-recrue", staffOnly: true },
                { commandName: "valider-recrue", isEnabled: false }
            )
        ).toBe(false);
    });

    it("une commande publique est déployée par défaut, retirée si désactivée", () => {
        expect(isCatalogCommandDeployed({ name: "almanax" }, null)).toBe(true);
        expect(isCatalogCommandDeployed({ name: "almanax" }, { commandName: "almanax", isEnabled: false })).toBe(false);
    });
});

describe("dérogations Discord d'une commande", () => {
    it("sans rôle ni salon : liste vide (efface une restriction périmée)", () => {
        expect(buildCommandPermissionEntries({ discordGuildId: GUILD, roleIds: [], channelIds: [] })).toEqual([]);
    });

    it("deux rôles autorisés → deux dérogations de type 1, permission true", () => {
        expect(
            buildCommandPermissionEntries({ discordGuildId: GUILD, roleIds: [STAFF, EMPEREUR], channelIds: [] })
        ).toEqual([
            { id: STAFF, type: 1, permission: true },
            { id: EMPEREUR, type: 1, permission: true },
        ]);
    });

    it("des salons → « tous les salons » refusé (id = guilde − 1) puis chaque salon autorisé", () => {
        expect(
            buildCommandPermissionEntries({ discordGuildId: GUILD, roleIds: [], channelIds: [CHANNEL] })
        ).toEqual([
            { id: allChannelsSentinel(GUILD), type: 3, permission: false },
            { id: CHANNEL, type: 3, permission: true },
        ]);
        expect(allChannelsSentinel(GUILD)).toBe((BigInt(GUILD) - 1n).toString());
    });

    it("rôles + salons se combinent, doublons et identifiants invalides écartés", () => {
        const entries = buildCommandPermissionEntries({
            discordGuildId: GUILD,
            roleIds: [STAFF, STAFF, "pas-un-flocon", ""],
            channelIds: [CHANNEL, "@everyone"],
        });
        expect(entries).toEqual([
            { id: STAFF, type: 1, permission: true },
            { id: allChannelsSentinel(GUILD), type: 3, permission: false },
            { id: CHANNEL, type: 3, permission: true },
        ]);
    });
});

describe("rôles d'une commande de ticket", () => {
    const staffRoles = [STAFF, EMPEREUR];

    it("STAFF_ONLY → staff du module (global + motifs)", () => {
        expect(resolveTicketCommandRoleIds({ permissionMode: "STAFF_ONLY" }, staffRoles)).toEqual(staffRoles);
    });

    it("CUSTOM_ROLES → rôles choisis ; liste vide = tout le monde (aucune dérogation)", () => {
        expect(
            resolveTicketCommandRoleIds({ permissionMode: "CUSTOM_ROLES", allowedRoleIds: [EMPEREUR] }, staffRoles)
        ).toEqual([EMPEREUR]);
        expect(resolveTicketCommandRoleIds({ permissionMode: "CUSTOM_ROLES", allowedRoleIds: [] }, staffRoles)).toEqual(
            []
        );
    });

    it("ALL → aucune restriction de rôle", () => {
        expect(resolveTicketCommandRoleIds({ permissionMode: "ALL" }, staffRoles)).toEqual([]);
    });
});

describe("payloads Discord dérivés du catalogue", () => {
    it("une seule source : les noms viennent du catalogue, dans le même ordre", () => {
        expect(buildDiscordCommandPayloads().map((payload) => payload.name)).toEqual(
            SLASH_COMMANDS_CATALOG.map((command) => command.name)
        );
        expect(catalogCommandsMissingPresentation()).toEqual([]);
    });

    it("aucune commande n'envoie `options: []` et la liste est bien dérivée du catalogue", () => {
        for (const payload of buildDiscordCommandPayloads()) {
            if (payload.options) expect(payload.options.length).toBeGreaterThan(0);
        }
        const source = readFileSync("src/lib/discord/command-payloads.ts", "utf8");
        expect(source).toContain("SLASH_COMMANDS_CATALOG.map");
    });

    it("description bornée à 100 caractères (limite Discord)", () => {
        for (const payload of buildDiscordCommandPayloads()) {
            expect(payload.description.length).toBeLessThanOrEqual(100);
        }
    });

    it("valider-recrue ne garde que l'option « membre »", () => {
        const payload = buildDiscordCommandPayloads().find((entry) => entry.name === "valider-recrue");
        expect(payload?.options?.map((option) => option.name)).toEqual(["membre"]);
    });
});

describe("synchronisation — contrats de source", () => {
    const source = readFileSync("src/server/actions/discord-commands-sync.ts", "utf8");

    it("pousse les permissions de CHAQUE commande (rôles + salons)", () => {
        expect(source).toContain("/commands/${command.id}/permissions");
        expect(source).toContain("buildCommandPermissionEntries");
        expect(source).toContain("resolveTicketCommandRoleIds");
    });

    it("réinitialise les défauts de l'application (plus de salons imposés à la main)", () => {
        expect(source).toContain("/commands/permissions");
        expect(source).toContain("permissions: []");
    });

    it("ne déploie que les commandes autorisées sur la guilde", () => {
        expect(source).toContain("isCatalogCommandDeployed");
    });

    it("remonte les erreurs de Discord au lieu de les avaler", () => {
        expect(source).toContain("permissionErrors");
        expect(source).toContain("logger.warn");
    });
});

describe("gate d'exécution de /valider-recrue", () => {
    const route = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");

    it("accepte la permission RH, un rôle Discord autorisé ou un admin Discord", () => {
        expect(route).toContain("hasGuildRole");
        expect(route).toContain("isDiscordAdmin");
        expect(route).toContain("!isStaff && !hasGuildRole && !isDiscordAdmin");
    });

    it("ne renvoie plus de 500 sur une interaction (Discord afficherait « pas de réponse »)", () => {
        expect(route).not.toContain('{ error: "Internal error" }, { status: 500 }');
        expect(route).toContain("Une erreur interne est survenue");
    });
});
