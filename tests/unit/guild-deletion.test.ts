/**
 * Suppression d'une guilde par son **propriétaire** — règle de confirmation + garde de source.
 *
 * 📌 Décision du 01/11/2026 : le propriétaire peut retirer sa guilde du produit. Ce n'est **pas**
 * une suppression instantanée (archivage + échéance J+30, suppression physique God seulement), et
 * la porte est le **propriétaire Discord live** — pas un administrateur, pas `GuildConfig.ownerId`
 * (qui peut porter un UUID interne après succession).
 *
 * Ce que ce verrou protège :
 * 1. la confirmation par le nom (accents/casse/espaces tolérés, « oui » refusé) ;
 * 2. la garde passe **avant** l'écriture, et une seule fois (état dans le `WHERE`) ;
 * 3. aucune suppression physique dans le chemin propriétaire ;
 * 4. l'onglet « Zone sensible » n'existe que pour le propriétaire.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GUILD_DELETION_GRACE_DAYS, isDeletionConfirmationValid } from "@/lib/guild-deletion";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const ACTION = read("src/server/actions/guild-lifecycle-actions.ts");
const GUARDS = read("src/server/actions/guards.ts");
const PAGE = read("src/app/dashboard/[guildId]/admin/pilotage/page.tsx");

describe("confirmation par le nom — une action grave ne part pas d'un clic", () => {
    it("le nom exact passe", () => {
        expect(isDeletionConfirmationValid("Kamas & Co", "Kamas & Co")).toBe(true);
    });

    it("casse, espaces multiples et accents sont tolérés", () => {
        expect(isDeletionConfirmationValid("  kamas  &   co ", "Kamas & Co")).toBe(true);
        expect(isDeletionConfirmationValid("Eliatrop", "Éliatrop")).toBe(true);
    });

    it("une réponse vague est refusée", () => {
        expect(isDeletionConfirmationValid("oui", "Kamas & Co")).toBe(false);
        expect(isDeletionConfirmationValid("", "Kamas & Co")).toBe(false);
    });

    it("un nom de guilde vide ne peut jamais être confirmé", () => {
        expect(isDeletionConfirmationValid("", "")).toBe(false);
        expect(isDeletionConfirmationValid("   ", "   ")).toBe(false);
    });
});

describe("garde du propriétaire — live Discord, sans bypass", () => {
    it("lit `owner_id` sur Discord, jamais `GuildConfig.ownerId`", () => {
        expect(GUARDS).toContain("fetchGuild(guildId)");
        expect(GUARDS).toContain("guildInfo.owner_id === discordUserId");
        expect(GUARDS).toContain("requireGuildOwner");
    });

    it("n'ouvre aucun bypass God ni administrateur", () => {
        const debut = GUARDS.indexOf("export async function requireGuildOwner");
        // Fin du corps de la fonction : son dernier `return`, avant le doc de la fonction suivante.
        const fin = GUARDS.indexOf("Impossible de vérifier la propriété du serveur.", debut);
        const bloc = GUARDS.slice(debut, fin);

        expect(debut).toBeGreaterThan(-1);
        expect(fin).toBeGreaterThan(debut);
        expect(bloc).not.toContain("isSuperAdmin");
        expect(bloc).not.toContain("0x8");
    });
});

describe("action `requestGuildDeletion` — l'ordre et l'état avant tout", () => {
    it("exige le propriétaire avant la moindre écriture", () => {
        const garde = ACTION.indexOf("requireGuildOwner(");
        const ecriture = ACTION.indexOf("db.guildConfig.updateMany");

        expect(garde).toBeGreaterThan(-1);
        expect(ecriture).toBeGreaterThan(-1);
        expect(garde).toBeLessThan(ecriture);
    });

    it("garde l'état dans le `WHERE` (pas de double désactivation)", () => {
        expect(ACTION).toContain("where: { id: config.id, isActive: true, deletedAt: null }");
        expect(ACTION).toContain("updated.count !== 1");
    });

    it("archive les profils au lieu de les supprimer", () => {
        expect(ACTION).toContain('archiveReason: "GUILD_DELETED"');
        expect(ACTION).toContain('status: "ARCHIVED"');
    });

    it("ne supprime jamais physiquement la guilde", () => {
        expect(ACTION).not.toContain("guildConfig.delete");
        expect(ACTION).not.toContain("deleteMany");
    });

    it("pose l'échéance à partir de la constante partagée", () => {
        expect(ACTION).toContain("GUILD_DELETION_GRACE_DAYS");
        expect(GUILD_DELETION_GRACE_DAYS).toBe(30);
    });

    it("trace l'action et prévient God", () => {
        expect(ACTION).toContain('action: "GUILD_DELETE_REQUESTED"');
        expect(ACTION).toContain("notifyGod");
    });
});

describe("page Pilotage — l'onglet n'existe que pour le propriétaire", () => {
    it("l'onglet est conditionné par `isGuildOwner`", () => {
        expect(PAGE).toContain("const isGuildOwner = Boolean(user.isGuildOwner);");
        expect(PAGE).toContain("...(isGuildOwner");
    });

    it("un `?tab=sensible` forcé par un admin retombe sur « etat »", () => {
        expect(PAGE).toContain('tab === "sensible"');
        expect(PAGE).toContain('? isGuildOwner ? "sensible" : "etat"');
    });

    it("le contenu est revérifié au rendu", () => {
        expect(PAGE).toContain('activeTab === "sensible" && isGuildOwner');
    });
});
