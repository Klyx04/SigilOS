/**
 * `/admin/members` — le RBAC passe **avant** les lectures.
 *
 * 🐛 Mesure du 01/11/2026 (`JAVASCRIPT-NEXTJS-2B`, `GET /dashboard/<guildId>/admin/members`) :
 * `getGuildMemberStats` lève `Unauthorized` quand la session manque. Comme elle partait dans
 * le **même `Promise.all`** que `getUserContext`, la redirection n'avait pas le temps de
 * s'appliquer ⇒ la page rendait un **500** au lieu de renvoyer au dashboard. Et un visiteur
 * sans droits déclenchait quand même les lectures (statistiques, cycle de vie, exclusions)
 * avant d'être écarté.
 *
 * 🔒 Verrouillé ici : la garde de rôle précède le premier chargement, et le contexte est
 * résolu **hors** du `Promise.all` — sinon la redirection est de nouveau court-circuitée.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const PAGE = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/dashboard/[guildId]/admin/members/page.tsx"),
    "utf8",
);

describe("page admin/members — garde avant lecture", () => {
    it("vérifie les droits avant d'appeler getGuildMemberStats", () => {
        const garde = PAGE.indexOf("redirect(`/dashboard/${guildId}`)");
        const lecture = PAGE.indexOf("getGuildMemberStats(guildId)");

        expect(garde, "la redirection RBAC doit exister").toBeGreaterThan(-1);
        expect(lecture, "les statistiques doivent être chargées").toBeGreaterThan(-1);
        expect(garde).toBeLessThan(lecture);
    });

    it("résout le contexte hors du Promise.all des lectures", () => {
        expect(PAGE).toMatch(/const ctx = await getUserContext\(guildId\);/);

        const promiseAll = PAGE.slice(PAGE.indexOf("await Promise.all(["));
        expect(promiseAll).not.toContain("getUserContext");
    });
});
