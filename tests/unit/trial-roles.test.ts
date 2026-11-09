/**
 * Gardes — rôles Discord du **cycle de vie d'essai** (V1) : réglages, application, retrait.
 *
 * Mesure du 09/11/2026 : les colonnes `trialRoleId` / `confirmedRoleId` existaient depuis le
 * 12/10 sans aucun consommateur. Ce verrou tient la chaîne complète — lister (règle pure),
 * régler (admin), appliquer (essai / validation / départ) — et l'articulation avec
 * `/valider-recrue`, qui garde sa modale et n'ajoute qu'un effet **optionnel**.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("rôles du cycle de vie d'essai", () => {
    const lifecycle = read("src/server/actions/member-lifecycle-actions.ts");
    const settings = read("src/server/actions/trial-end-actions.ts");
    const interactions = read("src/app/api/discord/interactions/route.ts");

    it("la liste des rôles proposés passe par la règle pure de hiérarchie", () => {
        expect(lifecycle).toContain("export async function getAssignableTrialRoles");
        expect(lifecycle).toContain("filterAssignableRoles(roles, { guildId, botPosition, staffPosition })");
        expect(lifecycle).toContain("highestRolePosition(botMember?.roles ?? [], roles)");
        // Un staff non admin est borné par son propre rôle le plus haut.
        expect(lifecycle).toContain("highestRolePosition(staffMember?.roles ?? [], roles)");
    });

    it("l'essai applique les rôles réglés : + essai au démarrage, + confirmé et − essai à la validation", () => {
        expect(lifecycle).toContain("addGuildMemberRole(guildId, targetDiscordId, guild.trialRoleId, roleReason)");
        expect(lifecycle).toContain("addGuildMemberRole(guildId, targetDiscordId, guild.confirmedRoleId, roleReason)");
        expect(lifecycle).toContain("removeGuildMemberRole(guildId, targetDiscordId, guild.trialRoleId, roleReason)");
        // Jamais un « ok » optimiste : un refus Discord est remonté dans le message.
        expect(lifecycle).toContain("⚠️ rôle d'essai non ajouté");
        expect(lifecycle).toContain("⚠️ rôle confirmé non ajouté");
        expect(lifecycle).toContain("⚠️ aucun compte Discord lié : rôle non appliqué");
    });

    it("un départ retire le rôle d'essai (sans bloquer l'archivage)", () => {
        expect(lifecycle).toContain("removeGuildMemberRole(guildId, discordId, guild.trialRoleId");
        expect(lifecycle).toContain("[recordMemberDeparture] rôle d'essai non retiré");
    });

    it("les réglages n'acceptent qu'un rôle réellement attribuable", () => {
        expect(settings).toContain("getAssignableTrialRoles(guildId)");
        expect(settings).toContain("requestedRoleIds.some((id) => !allowed.has(id))");
        expect(settings).toContain("...(trialRoleId !== undefined ? { trialRoleId } : {})");
        expect(settings).toContain("...(confirmedRoleId !== undefined ? { confirmedRoleId } : {})");
        // `undefined` = ne pas toucher ; `null` = retirer. Un enregistrement de salon seul
        // ne doit donc jamais effacer un rôle déjà réglé.
        expect(settings).toContain("roles?: { trialRoleId?: string | null; confirmedRoleId?: string | null }");
    });

    it("/valider-recrue applique le rôle d'essai quand l'essai démarre, sans changer sa modale", () => {
        expect(interactions).toContain("if (needsTrial && guildConfig.trialRoleId)");
        expect(interactions).toContain("trialRoleId: true");
        // Le rôle d'arrivée reste celui de la commande : pas de doublon de source.
        expect(interactions).toContain("const addRoleId = dashboardRoles.addRoleId");
    });
});
