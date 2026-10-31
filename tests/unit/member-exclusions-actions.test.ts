/**
 * Onglet « Exclus » de la gestion des membres — 31/10/2026.
 *
 * Mesure du jour sur la bêta : **27** exclusions (tombstones) toutes issues d'un ban Discord par
 * le bot, avec **une seule** action (« Réintégrer ») — donc aucune façon de nettoyer la liste, et
 * un toast qui promettait un retour alors que la personne n'est plus sur le serveur (elle
 * n'apparaît alors dans **aucune** source, ni actifs ni archivés).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ACTIONS = readFileSync(join(process.cwd(), "src/server/actions/lifecycle-actions.ts"), "utf8");
const TABLE = readFileSync(join(process.cwd(), "src/components/admin/member-management-table.tsx"), "utf8");
const DIALOG = readFileSync(
    join(process.cwd(), "src/components/admin/members/member-detail-dialog.tsx"),
    "utf8",
);

function action(name: string): string {
    const start = ACTIONS.indexOf(`export async function ${name}`);
    const end = ACTIONS.indexOf("\nexport async function", start + 10);
    return ACTIONS.slice(start, end > start ? end : undefined);
}

describe("exclusion — suppression définitive", () => {
    it("l'action existe, est gardée par la permission membres et supprime la ligne", () => {
        const fn = action("deleteGuildMemberBan");
        expect(fn).toContain("canManageMembers");
        expect(fn).toContain('"Permission');
        expect(fn).toContain("guildMemberBan.delete");
    });

    it("la fiche membre (Registre) propose les DEUX actions, pas seulement la levée", () => {
        // Mesure du 31/10/2026 : le bouton n'était que dans l'ancien tableau, la page réelle est le
        // Registre (`member-roster-list`) qui ouvre cette modale → sans ça, aucune trace visible.
        expect(DIALOG).toContain("handleDeleteExclusion");
        expect(DIALOG).toContain("deleteGuildMemberBan(guildId, discordId)");
        expect(DIALOG).toContain("Lever l&apos;exclusion");
        expect(DIALOG).toContain("Supprimer");
    });

    it("le motif d'exclusion n'est jamais affiché sous forme de code technique", () => {
        expect(DIALOG).not.toContain("{activeExclusion.reason}");
        expect(DIALOG).toContain("exclusionReasonLabel(activeExclusion.reason)");
        expect(DIALOG).toContain("MEMBER_DELETED: \"Membre supprimé\"");
    });

    it("la suppression est journalisée (nom + motif, sans snowflake)", () => {
        const fn = action("deleteGuildMemberBan");
        expect(fn).toContain('action: "MEMBER_BAN_DELETED"');
        expect(fn).toContain("memberName");
        expect(fn).toContain("reason");
        // Le journal ne recopie pas l'identifiant Discord : nom et motif suffisent.
        const audit = fn.slice(fn.indexOf("createAuditLog"));
        expect(audit).not.toContain("discordId");
    });

    it("l'écran expose les DEUX actions sur chaque exclusion", () => {
        expect(TABLE).toContain("liftGuildMemberBan");
        expect(TABLE).toContain("deleteGuildMemberBan");
        expect(TABLE).toContain("handleDeleteExclusion");
        expect(TABLE).toContain("Supprimer");
    });
});

describe("exclusion — message honnête après la levée", () => {
    it("la levée ne promet plus un retour : elle distingue « encore sur le serveur » / « n'est plus là »", () => {
        expect(TABLE).toContain("n'est plus sur le serveur Discord");
        expect(TABLE).toContain("est toujours sur le serveur Discord");
        // L'ancien message promettait un accès immédiat sans condition.
        expect(TABLE).not.toContain("le membre peut de nouveau accéder au dashboard");
    });
});
