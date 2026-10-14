/**
 * RBAC — **suppression définitive d'un profil de guilde** (chantier B, lot B-3).
 *
 * Ce que ce verrou protège :
 * - la permission **dédiée** `staff:member_delete` existe et est marquée **sensible** ;
 * - `getUserContext` la traduit en `canDeleteMembers` **fail-closed** (jamais accordée par défaut) ;
 * - l'action de guilde est gardée par cette permission, **isole** la cible par `guildId` résolu
 *   serveur, **rate-limite**, et ne pose **aucun tombstone** (`GuildMemberBan`) — la suppression
 *   est définitive : le membre qui revient repart comme un nouvel arrivant ;
 * - l'action God est gardée par `isSuperAdmin()` et **n'écrit pas dans le journal de la guilde**.
 *
 * Lecture seule : code source.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const PERMISSIONS = "src/lib/permissions.ts";
const USER_ACTIONS = "src/server/actions/user-actions.ts";
const LIFECYCLE = "src/server/actions/lifecycle-actions.ts";
const GOD_LIFECYCLE = "src/server/actions/god-lifecycle-actions.ts";
const DIALOG = "src/components/admin/members/member-detail-dialog.tsx";

/** Retire les commentaires : un motif interdit ne doit pas se cacher dans la prose.
 *  ⚠️ L'ordre compte : les commentaires de LIGNE d'abord — un `// … /* …` contient un
 *  pseudo-ouvrant de bloc qui, traité en premier, avalerait tout le code suivant. */
const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
        .replace(/\/\*[\s\S]*?\*\//g, "");

/** Corps d'une fonction, du `export async function <name>` au prochain `export `. */
function functionBody(source: string, name: string): string {
    const start = source.indexOf(`export async function ${name}`);
    expect(start, `${name} introuvable`).toBeGreaterThan(-1);
    const next = source.indexOf("export async function", start + 10);
    return source.slice(start, next === -1 ? source.length : next);
}

describe("RBAC suppression définitive — la permission gouverne", () => {
    it("déclare la permission dédiée, marquée sensible", () => {
        const permissions = codeOnly(PERMISSIONS);
        expect(permissions).toContain('STAFF_MEMBER_DELETE: "staff:member_delete"');
        // Le bloc de DÉTAILS de cette permission (et lui seul) porte `sensitive: true`.
        const blockStart = permissions.indexOf("[PERMISSIONS.STAFF_MEMBER_DELETE]: {");
        expect(blockStart, "bloc PERMISSION_DETAILS introuvable").toBeGreaterThan(-1);
        const blockEnd = permissions.indexOf("},", blockStart);
        const block = permissions.slice(blockStart, blockEnd);
        expect(block).toContain("sensitive: true");
        expect(block).toContain('module: "admin"');
    });

    it("`getUserContext` l'expose en `canDeleteMembers` (fail-closed)", () => {
        const actions = codeOnly(USER_ACTIONS);
        expect(actions).toContain("canDeleteMembers: boolean;");
        expect(actions).toContain("canDeleteMembers: false,");
        expect(actions).toContain(
            "const canDeleteMembers = permissionSet.has(PERMISSIONS.STAFF_MEMBER_DELETE) || isAdminFinal;"
        );
        expect(actions).toContain("canDeleteMembers: !!canDeleteMembers,");
        // Le repli « accès restreint » remet le droit à zéro.
        expect(actions).toContain("finalContext.canDeleteMembers = false;");
    });

    it("l'action de guilde est gardée, isolée, limitée — et sans tombstone", () => {
        const body = functionBody(codeOnly(LIFECYCLE), "purgeMemberFromGuild");
        expect(body).toContain("if (!ctx.canDeleteMembers && !ctx.isAdmin)");
        // Isolation de guilde : guildId résolu côté serveur, cible filtrée dessus.
        expect(body).toContain("where: { discordGuildId: guildId }");
        expect(body).toContain("where: { id: profileId, guildId: guild.id }");
        // Rate-limit fail-closed.
        expect(body).toContain("rateLimit(");
        // 🔒 Suppression DÉFINITIVE : aucun tombstone dans cette action.
        expect(body).not.toContain("guildMemberBan");
        // Le profil de la guilde est bien supprimé, la cible ne peut pas être soi-même.
        expect(body).toContain("db.userProfile.delete(");
        expect(body).toContain("target.userId === ctx.id");
    });

    it("l'action God est gardée par isSuperAdmin et n'écrit pas dans le journal de la guilde", () => {
        const body = functionBody(codeOnly(GOD_LIFECYCLE), "godPurgeMemberFromGuild");
        expect(body).toContain("if (!isAdmin) return { success: false, error: \"Super Admin requis\" }");
        // Aucune trace dans le journal de guilde (règle « actions God invisibles côté guilde »).
        expect(body).not.toContain("createAuditLog");
        // La purge du compte plateforme reste optionnelle.
        expect(body).toContain("options?.deleteAccount");
    });

    it("l'UI n'expose le bouton que si `canDeleteMembers`", () => {
        const dialog = codeOnly(DIALOG);
        expect(dialog).toContain("onDelete && canDeleteMembers && isDashboard && !isSelf");
    });
});
