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
import { GUILD_DELETION_GRACE_DAYS, isDeletionConfirmationValid, isGuildPurgeDue } from "@/lib/guild-deletion";

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

describe("échéance de purge — jamais une guilde active, jamais une date illisible", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");

    it("une guilde vivante n'est jamais due", () => {
        expect(isGuildPurgeDue({ deletedAt: null, scheduledDeletion: "2026-01-01T00:00:00.000Z" }, now)).toBe(false);
    });

    it("supprimée sans échéance : pas de purge (on ne devine pas)", () => {
        expect(
            isGuildPurgeDue({ deletedAt: "2026-10-01T00:00:00.000Z", scheduledDeletion: null }, now),
        ).toBe(false);
    });

    it("échéance future : on attend", () => {
        expect(
            isGuildPurgeDue(
                { deletedAt: "2026-10-15T00:00:00.000Z", scheduledDeletion: "2026-11-14T00:00:00.000Z" },
                now,
            ),
        ).toBe(false);
    });

    it("échéance atteinte : purge", () => {
        expect(
            isGuildPurgeDue(
                { deletedAt: "2026-10-01T00:00:00.000Z", scheduledDeletion: "2026-10-31T00:00:00.000Z" },
                now,
            ),
        ).toBe(true);
    });

    it("l'instant exact de l'échéance compte comme atteint", () => {
        expect(
            isGuildPurgeDue({ deletedAt: now, scheduledDeletion: now }, now),
        ).toBe(true);
    });

    it("une date illisible ne purge jamais (fail-closed)", () => {
        expect(
            isGuildPurgeDue({ deletedAt: "2026-10-01T00:00:00.000Z", scheduledDeletion: "pas-une-date" }, now),
        ).toBe(false);
    });
});

describe("cron `guild-purge` — borné, protégé, sans `force`", () => {
    const CRON = read("src/app/api/cron/guild-purge/route.ts");
    const CORE = read("src/server/guild-purge-core.ts");

    it("vérifie le secret du cron et répond 401 (fail-closed)", () => {
        expect(CRON).toContain("verifyCronSecret(req)");
        expect(CRON).toContain('status: 401');
    });

    it("émet la télémétrie et déclare la tâche", () => {
        expect(CRON).toContain('recordCronExecution("guild_purge"');
        expect(read("src/lib/cron-telemetry.ts")).toContain("guild_purge:");
    });

    it("ne purge que les guildes désactivées et échues, par lots bornés", () => {
        expect(CORE).toContain("where: { deletedAt: { not: null }, scheduledDeletion: { lte: now } }");
        expect(CORE).toContain("take: limit");
        expect(CORE).toContain("!options.force && !isGuildPurgeDue");
    });

    it("le cron n'utilise jamais `force` (réservé à God)", () => {
        expect(CRON).not.toContain("{ force");
        expect(CRON).not.toContain("purgeGuildById");
    });

    it("God et le cron partagent la même purge", () => {
        const GOD = read("src/server/actions/god-lifecycle-actions.ts");
        const debut = GOD.indexOf("export async function hardDeleteGuild");
        const fin = GOD.indexOf("export async function softDeleteProfile");
        const bloc = GOD.slice(debut, fin);

        expect(bloc).toContain("purgeGuildById(guildId, { force: true })");
        expect(bloc).not.toContain("db.guildConfig.delete");
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

describe("écran « Serveur Supprimé » — dire la vérité, pas une déconnexion", () => {
    const LAYOUT = read("src/app/dashboard/[guildId]/layout.tsx");
    const ACTIONS = read("src/server/actions/user-actions.ts");
    const ACCESS_DENIED = read("src/components/layout/access-denied.tsx");

    it("ne promet plus une déconnexion qui n'a pas lieu", () => {
        expect(LAYOUT).not.toContain("Vous allez être déconnecté");
        expect(LAYOUT).toContain("Votre compte et vos autres serveurs ne sont pas concernés");
    });

    it("annonce la fenêtre de restauration", () => {
        expect(LAYOUT).toContain("restauration au support pendant 30 jours");
    });

    it("affiche le compte à rebours de la purge réelle", () => {
        expect(LAYOUT).toContain("countdownDate={(user as any).scheduledDeletion}");
        expect(ACTIONS).toContain("scheduledDeletion: guildConfig?.scheduledDeletion?.toISOString() ?? null");
    });

    it("le contexte expose l'échéance (select caché + clés obligatoires)", () => {
        expect(ACTIONS).toContain("scheduledDeletion: true");
        expect(read("src/lib/guild-config-cache.ts")).toContain('"scheduledDeletion"');
    });

    it("le lien de support reste présent sur l'écran", () => {
        expect(ACCESS_DENIED).toContain("Contacter le support");
        expect(ACCESS_DENIED).toContain("discord.gg/");
    });
});

