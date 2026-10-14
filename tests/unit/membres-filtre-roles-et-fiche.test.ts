/**
 * Module Membres — filtre de rôles borné au RBAC, choix du recruteur, mules vérifiées.
 *
 * Demandes user (verbatim) : « n'affiche et ne filtre que sur les roles autorisés dashboard plus
 * logique sans casser la vue des hors dashboard » · « choix modale recruteur : affiche plus
 * proprement une petite modale champ de recherche pseudo » · « pas besoin d'afficher le bandeau
 * zone sensible pour qqun qui n'est pas présent dashboard » · « idem pour les mules : pas de champ
 * manuel : affichage responsive verif pseudo ladder (repli si bouton god manuel appliqué) choix
 * icone classe ».
 *
 * Ce que le verrou protège : la règle pure (rôle autorisé dashboard = rôle **mappé** dans le RBAC),
 * son câblage page → liste (les lignes « hors dashboard » ne sont jamais filtrées), les deux
 * composants de fiche (recruteur, mules) et l'absence de bandeau « Zone sensible » hors dashboard.
 * Lecture seule (fichiers + règles pures), aucune base.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

import { PERMISSIONS, roleHasDashboardAccess } from "@/lib/permissions";
import { registryRoleOptions } from "@/lib/member-registry";
import { rosterRoleOptions, type RosterRow } from "@/lib/member-roster";

const PAGE = "src/app/dashboard/[guildId]/admin/members/page.tsx";
const MANAGEMENT = "src/components/admin/members/member-management.tsx";
const LIST = "src/components/admin/members/member-roster-list.tsx";
const DIALOG = "src/components/admin/members/member-detail-dialog.tsx";
const RECRUITER = "src/components/admin/members/recruiter-picker.tsx";
const MULES = "src/components/admin/members/member-mules-editor.tsx";

const read = (path: string) => readFileSync(path, "utf8");

/** Deux rôles : un mappé dans le RBAC, un purement cosmétique (rôle de jeu). */
const ROLES = [
    { id: "role-membre", name: "Membres", color: 0, position: 2 },
    { id: "role-songe", name: "Songe", color: 0, position: 1 },
];

const rows = (): RosterRow[] =>
    [
        { roles: ["role-membre"] },
        { roles: ["role-songe"] },
        { roles: [] },
    ] as unknown as RosterRow[];

describe("filtre de rôles — seuls les rôles autorisés dashboard", () => {
    it("rôle mappé = autorisé · rôle sans permission = exclu", () => {
        const mapping = {
            "role-membre": [PERMISSIONS.DASHBOARD_LOGIN],
            "role-bot": [],
        };
        expect(roleHasDashboardAccess(mapping, "role-membre")).toBe(true);
        expect(roleHasDashboardAccess(mapping, "role-bot")).toBe(false);
        // Rôle jamais mappé (rôle de jeu, cosmétique) : aucune page ouverte.
        expect(roleHasDashboardAccess(mapping, "role-songe")).toBe(false);
    });

    it("RBAC non configuré : aucune restriction inventée", () => {
        expect(roleHasDashboardAccess(null, "role-quelconque")).toBe(true);
        expect(roleHasDashboardAccess(undefined, "role-quelconque")).toBe(true);
        expect(roleHasDashboardAccess({}, "role-quelconque")).toBe(true);
    });

    it("les options du filtre suivent la liste autorisée", () => {
        const restricted = registryRoleOptions(ROLES, rows(), ["role-membre"]);
        expect(restricted.map((option) => option.id)).toEqual(["role-membre"]);

        // Aucune restriction (vue God, écrans historiques) : liste complète des rôles portés.
        const open = registryRoleOptions(ROLES, rows());
        expect(open.map((option) => option.id)).toEqual(["role-membre", "role-songe"]);

        // `rosterRoleOptions` (la porte du module Membres) transmet bien la restriction.
        expect(rosterRoleOptions(ROLES, rows(), ["role-membre"]).map((o) => o.id)).toEqual(["role-membre"]);
    });
});

describe("filtre de rôles — câblage de l'écran", () => {
    it("la page calcule la liste autorisée depuis le RBAC de la guilde", () => {
        const src = read(PAGE);
        expect(src).toContain("rolesMapping: true");
        expect(src).toContain("roleHasDashboardAccess(rolesMapping, roleId)");
        expect(src).toContain("dashboardRoleIds={dashboardRoleIds}");
        // Les lignes « hors dashboard » continuent d'être construites (vue non cassée).
        expect(src).toContain("discordOnly:");
    });

    it("la liste borne son filtre de rôles et rien d'autre", () => {
        const list = read(LIST);
        expect(list).toContain("rosterRoleOptions(roles, rows, dashboardRoleIds)");
        // Les rôles complets restent passés à la fiche (badges) : le filtre ne les ampute pas.
        expect(list).toContain("roles={roles}");
        expect(read(MANAGEMENT)).toContain("dashboardRoleIds={dashboardRoleIds}");
    });
});

describe("fiche membre — recruteur, mules, zone sensible", () => {
    it("le recruteur se choisit dans une petite modale avec recherche de pseudo", () => {
        expect(existsSync(RECRUITER)).toBe(true);
        const src = read(RECRUITER);
        expect(src).toContain("Rechercher un pseudo");
        expect(src).toContain("CommandInput");
        expect(src).toContain("Aucun recruteur");
        expect(src).toContain("DialogContent");
        // Le `<Select>` du recruteur a quitté la fiche : plus de liste déroulante interminable.
        const dialog = read(DIALOG);
        expect(dialog).toContain("<RecruiterPicker");
        expect(dialog).not.toMatch(/onValueChange=\{setRecruiterId\}/);
    });

    it("les mules sont une liste vérifiée par le ladder, jamais un champ libre", () => {
        expect(existsSync(MULES)).toBe(true);
        const src = read(MULES);
        expect(src).toContain("verifyDofusPseudo");
        expect(src).toContain("isLadderManualFallbackEnabled");
        expect(src).toContain("DOFUS_CLASSES");
        expect(src).toContain("manualFallback");
        // Responsive : une colonne en mobile, deux dès `sm`.
        expect(src).toContain("grid grid-cols-1 gap-2 sm:grid-cols-2");
        expect(src).not.toContain("Textarea");

        const dialog = read(DIALOG);
        expect(dialog).toContain("<MemberMulesEditor");
        expect(dialog).not.toContain("une par ligne");
    });

    it("le bandeau « Zone sensible » ne s'affiche que sur une fiche dashboard", () => {
        const dialog = read(DIALOG);
        expect(dialog).toMatch(/\{isDashboard && \(\s*<DialogFooter/);
        // Le bouton de suppression garde sa propre garde (dashboard + permissions + pas soi-même).
        expect(dialog).toContain("onDelete && canDeleteMembers && isDashboard && !isSelf");
    });
});

