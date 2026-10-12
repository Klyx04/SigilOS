/**
 * Gardes — **fiche guilde God** (`/god/guilds/[id]`) : onglets Modules · Logs · Accès.
 *
 * Audit croisé du 24/09/2026 : la fiche empilait roster + modules et **rien d'autre** —
 * aucun journal par guilde (alors que le rendu riche existait côté guilde) et aucune
 * vue des accès (rôles Discord, `rolesMapping`, `usersMapping`, rôle d'accès, owner).
 *
 * Ce test verrouille la structure livrée (lecture seule côté accès, rendu riche
 * **réutilisé** et non recopié, verrous de modules toujours réservés au God).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const PAGE = "src/app/god/guilds/[id]/page.tsx";
const TABS = "src/app/god/guilds/[id]/god-guild-tabs.tsx";
const ACCESS = "src/app/god/guilds/[id]/god-guild-access-panel.tsx";

describe("fiche guilde God — onglets", () => {
    it("les trois onglets sont présents, et les verrous de modules restent au God", () => {
        const page = readFileSync(PAGE, "utf8");
        expect(page).toContain("GodGuildTabs");
        expect(page).toMatch(/modules=\{isAdmin \?/);
        expect(page).toMatch(/logs=\{</);
        expect(page).toMatch(/access=\{</);
        // Un sous-god reçoit un état explicite, jamais la grille d'actions.
        expect(page).toMatch(/Lecture seule/);
    });

    it("l'onglet Logs RÉUTILISE le rendu riche de la guilde (jamais une copie)", () => {
        const page = readFileSync(PAGE, "utf8");
        expect(page).toContain("admin/logs/_components/audit-logs-client");
        expect(page).toContain("AuditLogsClient");
        // Le compteur par guilde existe déjà : il est branché, pas recalculé.
        expect(page).toContain("getGuildLogsStats");
    });

    it("l'onglet Accès est LECTURE SEULE (aucune action importée)", () => {
        const access = readFileSync(ACCESS, "utf8");
        expect(access).not.toMatch(/from "@\/server\/actions\//);
        expect(access).not.toContain("setModuleGodLock");
        expect(access).not.toMatch(/onClick=\{/);
        expect(access).toContain("rolesMapping");
        expect(access).toContain("usersMapping");
    });

    it("les onglets ne refetch rien (contenu rendu côté serveur)", () => {
        const tabs = readFileSync(TABS, "utf8");
        expect(tabs).not.toContain("fetch(");
        expect(tabs).not.toMatch(/from "@\/server\/actions\//);
        expect(tabs).toContain("useState");
    });
});
