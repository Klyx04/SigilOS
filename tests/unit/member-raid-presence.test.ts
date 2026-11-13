/**
 * Onglet « Présences » de la fiche membre (staff) — R1 « no-show », décision du 31/10/2026.
 *
 * Le registre a quitté la modale de clôture : un constat de raid appartient au **membre**,
 * pas à l'acte de clôture. Garde de source : l'onglet existe, le panneau lit et corrige via
 * les actions staff-only, et il ne réinvente pas les libellés.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const DIALOG = readFileSync(
    join(process.cwd(), "src/components/admin/members/member-detail-dialog.tsx"),
    "utf8",
);
const PANEL = readFileSync(
    join(process.cwd(), "src/components/admin/members/member-raid-presence.tsx"),
    "utf8",
);

describe("fiche membre — onglet Présences", () => {
    it("la fiche membre propose l'onglet et monte le panneau", () => {
        expect(DIALOG).toContain('{ id: "presences" as const, label: "Présences" }');
        expect(DIALOG).toContain("<MemberRaidPresence");
    });

    it("le panneau lit les présences du membre et permet la correction d'officier", () => {
        expect(PANEL).toContain("getMemberRaidPresence(guildId, memberUserId)");
        expect(PANEL).toContain("correctRaidPresence(guildId, row.eventId, memberUserId, next)");
    });

    it("le statut affiché vient du libellé unique (jamais une chaîne locale)", () => {
        expect(PANEL).toContain("RAID_PRESENCE_LABELS[row.status]");
        expect(PANEL).toContain("RAID_PRESENCE_LABELS[status]");
    });

    it("charte : pas de `font-black` ni de rayon > 12 px", () => {
        expect(PANEL).not.toMatch(/\bfont-black\b/);
        expect(PANEL).not.toMatch(/rounded-(?:2|3)xl/);
    });
});
