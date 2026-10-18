/**
 * RBAC — « la permission gouverne, pas le rôle natif » (constat user du
 * 14/10/2026 : « vérifie côté RBAC staff, gestion membres etc. — on m'a dit qu'il
 * y avait des problèmes même avec les droits »).
 *
 * 🛡️ Ce que ce test protège : l'écran de gestion des membres expose une écriture
 * dès que `canManageMembers` est vrai (`staff:member_mgmt`) ; le serveur doit donc
 * accepter **la même** condition — sinon le droit affiché ne sert à rien (un staff
 * voyait le champ « pseudo Dofus » / « ID Dofus » et se faisait refuser l'écriture,
 * qui exigeait le rôle admin **natif Discord**).
 *
 * Lecture seule : code source.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const USER_ACTIONS = "src/server/actions/user-actions.ts";
const MEMBER_LIFECYCLE = "src/server/actions/member-lifecycle-actions.ts";
const BLACKLIST = "src/server/actions/blacklist-actions.ts";
const MEMBER_TABLE = "src/components/admin/member-management-table.tsx";
const MEMBER_MANAGEMENT = "src/components/admin/members/member-management.tsx";
const MEMBER_ROSTER_LIST = "src/components/admin/members/member-roster-list.tsx";
const MEMBER_DIALOG = "src/components/admin/members/member-detail-dialog.tsx";
const MEMBERS_PAGE = "src/app/dashboard/[guildId]/admin/members/page.tsx";

/** Retire les commentaires : un motif interdit ne doit pas se cacher dans la prose. */
const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("RBAC membres — l'écran et le serveur disent la même chose", () => {
    const actions = codeOnly(USER_ACTIONS);
    const endOfFunction = (start: number) => {
        const next = actions.indexOf("export async function", start + 10);
        return next === -1 ? actions.length : next;
    };

    it("l'édition manuelle du pseudo et de l'ID Dofus accepte `canManageMembers`", () => {
        const pseudo = actions.indexOf("export async function updateMemberPseudo");
        const ankama = actions.indexOf("export async function updateMemberAnkamaId");
        expect(pseudo, "updateMemberPseudo introuvable").toBeGreaterThan(-1);
        expect(ankama, "updateMemberAnkamaId introuvable").toBeGreaterThan(-1);

        for (const [name, start] of [["pseudo", pseudo], ["ID Dofus", ankama]] as const) {
            const body = actions.slice(start, endOfFunction(start));
            expect(body, name).toContain("if (!actor.isAdmin && !actor.canManageMembers)");
            // Plus aucune garde « admin natif seul » sur ces deux écritures.
            expect(body, name).not.toMatch(/if \(!actor\.isAdmin\) \{/);
        }
    });

    it("l'UI de ces deux écritures est bien celle de `canManageMembers` (aucun décalage)", () => {
        const table = codeOnly(MEMBER_TABLE);
        expect(table).toContain("updateMemberPseudo(profileId, newPseudo)");
        expect(table).toContain("updateMemberAnkamaId(");

        // La modale membre ouvre l'édition dès `canManageMembers`, pour les **deux** natures de
        // lignes (profil dashboard **ou** membre Discord hors dashboard — chantier B-2).
        // Lot 2 : la condition porte sur la ligne affichée (`current`), dérivée de la même identité.
        expect(codeOnly(MEMBER_DIALOG)).toContain("canManageMembers && (isDashboard || !!current.discordId)");
        // …et la permission traverse page → liste → modale (aucun maillon ne la perd).
        expect(codeOnly(MEMBER_MANAGEMENT)).toContain("canManageMembers={canManageMembers}");
        expect(codeOnly(MEMBER_ROSTER_LIST)).toContain("canManageMembers={canManageMembers}");
    });

    it("les autres écritures de la gestion des membres suivent le MÊME patron", () => {
        for (const path of [MEMBER_LIFECYCLE, BLACKLIST]) {
            expect(codeOnly(path), path).toContain("!ctx.isAdmin && !ctx.canManageMembers");
        }
        // La page accepte l'admin, la gestion des membres ou les relances.
        expect(codeOnly(MEMBERS_PAGE)).toContain("if (!ctx.isAdmin && !ctx.canManageMembers && !ctx.canManageRelance)");
    });
});
